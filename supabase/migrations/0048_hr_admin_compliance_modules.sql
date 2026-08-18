-- HR Administration and Compliance: Biometric Reader Configuration, Email
-- Configuration, Audit Log extensions, and Attendance Reconciliation. All
-- four are HR/Admin-only (is_hr_or_admin()), matching every other
-- HR-configuration surface in this schema.

-- ============================================================
-- a) Audit Log extensions -- Role, Employee, Result
-- ============================================================
-- audit_logs already existed (0016) and is already append-only (no
-- update/delete policy exists at all, per supabase/DATABASE.md). It was
-- missing three of the requested fields: the actor's role at the time of
-- the action, which employee record the action concerns (distinct from
-- record_id, which is the affected row's own id -- e.g. a leave_requests
-- row's id, not the employee's id), and a Result outcome.

alter table public.audit_logs
  add column if not exists actor_role text,
  add column if not exists employee_id uuid references public.employees(id),
  add column if not exists result text not null default 'success' check (result in ('success', 'failure'));

create index if not exists idx_audit_logs_employee on public.audit_logs(employee_id);

create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _row jsonb;
  _org_id uuid;
  _action text;
  _record_id uuid;
  _employee_id uuid;
  _actor_role text;
begin
  _row := to_jsonb(coalesce(new, old));
  _action := case TG_OP when 'INSERT' then 'create' when 'UPDATE' then 'update' when 'DELETE' then 'delete' end;
  _record_id := case TG_OP when 'DELETE' then old.id else new.id end;
  _org_id := case
    when _row ? 'organization_id' and _row->>'organization_id' is not null then (_row->>'organization_id')::uuid
    else public.current_organization_id()
  end;
  -- The row itself is the employee for the employees table; every other
  -- tracked table that concerns a specific employee carries employee_id
  -- directly. Org-structure/config tables (shifts, system_settings, ...)
  -- have neither, so employee_id stays null there -- correctly, since the
  -- action isn't about any one employee.
  _employee_id := case
    when TG_TABLE_NAME = 'employees' then _record_id
    when _row ? 'employee_id' and _row->>'employee_id' is not null then (_row->>'employee_id')::uuid
    else null
  end;

  select r.name into _actor_role
    from public.user_roles ur join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid()
    order by case r.name when 'super_admin' then 1 when 'hr_admin' then 2 when 'manager' then 3 else 4 end
    limit 1;

  insert into public.audit_logs (organization_id, actor_user_id, actor_role, employee_id, action, module, record_id, old_value, new_value, result)
  values (
    _org_id,
    auth.uid(),
    _actor_role,
    _employee_id,
    _action,
    TG_TABLE_NAME,
    _record_id,
    case when TG_OP <> 'INSERT' then to_jsonb(old) else null end,
    case when TG_OP <> 'DELETE' then to_jsonb(new) else null end,
    'success'
  );

  return coalesce(new, old);
end;
$$;

-- Note: the audit-trigger re-attach DO block that used to run here is moved
-- to the end of this file -- it references biometric_readers,
-- email_configuration, and attendance_reconciliation_findings, none of
-- which exist yet until sections (b)/(c)/(d) below create them.

-- ============================================================
-- b) Biometric Reader Configuration
-- ============================================================

create table public.biometric_readers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  device_id text not null,
  reader_type text not null default 'biometric' check (reader_type in ('biometric', 'rfid', 'face_recognition', 'hybrid')),
  ip_address inet not null,
  port integer not null default 4370,
  location text,
  department_id uuid references public.departments(id),
  is_active boolean not null default true,
  sync_interval_minutes integer not null default 15,
  last_sync_at timestamptz,
  last_sync_status text not null default 'never' check (last_sync_status in ('success', 'failed', 'never')),
  last_error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.employees(id),
  updated_by uuid references public.employees(id),
  unique (organization_id, device_id)
);
create trigger trg_biometric_readers_updated_at before update on public.biometric_readers
  for each row execute function public.set_updated_at();
create index idx_biometric_readers_org on public.biometric_readers(organization_id);

alter table public.biometric_readers enable row level security;
create policy biometric_readers_select on public.biometric_readers for select
  using (organization_id = public.current_organization_id() and public.is_hr_or_admin());
create policy biometric_readers_write on public.biometric_readers for all
  using (organization_id = public.current_organization_id() and public.is_hr_or_admin())
  with check (organization_id = public.current_organization_id() and public.is_hr_or_admin());

create table public.biometric_sync_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  reader_id uuid not null references public.biometric_readers(id) on delete cascade,
  event_type text not null check (event_type in (
    'created', 'updated', 'enabled', 'disabled', 'test_connection', 'sync_started', 'sync_completed', 'sync_failed'
  )),
  status text not null check (status in ('success', 'failed', 'in_progress')),
  records_synced integer,
  error_message text,
  triggered_by uuid references public.employees(id),
  created_at timestamptz not null default now()
);
create index idx_biometric_sync_logs_reader on public.biometric_sync_logs(reader_id, created_at desc);

alter table public.biometric_sync_logs enable row level security;
create policy biometric_sync_logs_select on public.biometric_sync_logs for select
  using (organization_id = public.current_organization_id() and public.is_hr_or_admin());
-- No direct write policy -- every row is written by
-- record_biometric_sync_event() (security definer) so status/last-sync
-- bookkeeping on the reader stays consistent with the log, not two
-- independently-writable surfaces that can drift apart.

-- Connection tests and sync runs are recorded through this one function --
-- the admin UI's Test/Sync buttons (via the biometric-reader-action edge
-- function, since Postgres itself cannot open a TCP connection to a
-- reader) and any future real biometric integration both call it, rather
-- than each writing its own ad hoc log/status update.
create or replace function public.record_biometric_sync_event(
  _reader_id uuid,
  _event_type text,
  _status text,
  _records_synced int default null,
  _error_message text default null
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  _org_id uuid;
  _log_id uuid;
begin
  select organization_id into _org_id from public.biometric_readers where id = _reader_id;
  if _org_id is null then
    raise exception 'record_biometric_sync_event: reader % not found', _reader_id;
  end if;
  if not public.is_hr_or_admin() then
    raise exception 'record_biometric_sync_event: not authorized';
  end if;

  insert into public.biometric_sync_logs (organization_id, reader_id, event_type, status, records_synced, error_message, triggered_by)
  values (_org_id, _reader_id, _event_type, _status, _records_synced, _error_message, public.current_employee_id())
  returning id into _log_id;

  if _event_type in ('sync_completed', 'sync_failed', 'test_connection') then
    update public.biometric_readers
      set last_sync_at = case when _event_type = 'sync_completed' then now() else last_sync_at end,
          last_sync_status = case when _status = 'success' then 'success' else 'failed' end,
          last_error_message = _error_message
      where id = _reader_id;
  end if;

  return _log_id;
end;
$$;
grant execute on function public.record_biometric_sync_event(uuid, text, text, int, text) to authenticated;

-- ============================================================
-- c) Email Configuration (SMTP)
-- ============================================================
-- Non-secret fields are readable by any HR/admin. The password is never
-- stored in plaintext and never leaves this database in decrypted form
-- except to the service-role-only get_smtp_credentials() below --
-- pgp_sym_encrypt/pgp_sym_decrypt (pgcrypto, enabled since 0001) with a key
-- that lives only in a Postgres configuration parameter set once via:
--   ALTER DATABASE postgres SET app.settings.smtp_encryption_key = '<a long random value>';
-- (run once in the Supabase SQL editor by a project owner -- the same kind
-- of one-time manual step every migration in this project already needs).
-- If that key is never set, the password is simply never encrypted/stored
-- and every SMTP-dependent feature degrades to "not configured" rather
-- than silently storing an unencrypted secret.

create table public.email_configuration (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  host text,
  port integer default 587,
  encryption text default 'tls' check (encryption in ('none', 'tls', 'ssl')),
  username text,
  password_encrypted bytea,
  has_password boolean generated always as (password_encrypted is not null) stored,
  from_name text,
  from_email text,
  reply_to text,
  is_active boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.employees(id),
  unique (organization_id)
);
create trigger trg_email_configuration_updated_at before update on public.email_configuration
  for each row execute function public.set_updated_at();

alter table public.email_configuration enable row level security;
create policy email_configuration_select on public.email_configuration for select
  using (organization_id = public.current_organization_id() and public.is_hr_or_admin());
-- No direct write policy -- every write goes through set_email_configuration()
-- so the password is only ever handled server-side via pgcrypto.

create or replace function public.set_email_configuration(
  _host text,
  _port int,
  _encryption text,
  _username text,
  _from_name text,
  _from_email text,
  _reply_to text,
  _is_active boolean,
  _password text default null
)
returns void
language plpgsql security definer set search_path = public as $$
declare
  _org_id uuid := public.current_organization_id();
  _key text := current_setting('app.settings.smtp_encryption_key', true);
begin
  if not public.is_hr_or_admin() then
    raise exception 'set_email_configuration: not authorized';
  end if;

  insert into public.email_configuration (
    organization_id, host, port, encryption, username, from_name, from_email, reply_to, is_active,
    password_encrypted, updated_by
  ) values (
    _org_id, _host, _port, _encryption, _username, _from_name, _from_email, _reply_to, _is_active,
    case when _password is not null and _key is not null then pgp_sym_encrypt(_password, _key) else null end,
    public.current_employee_id()
  )
  on conflict (organization_id) do update set
    host = excluded.host,
    port = excluded.port,
    encryption = excluded.encryption,
    username = excluded.username,
    from_name = excluded.from_name,
    from_email = excluded.from_email,
    reply_to = excluded.reply_to,
    is_active = excluded.is_active,
    -- A blank password in the update means "keep the existing secret" --
    -- HR isn't forced to re-enter it on every unrelated field edit.
    password_encrypted = case
      when _password is not null and _key is not null then excluded.password_encrypted
      else public.email_configuration.password_encrypted
    end,
    updated_by = excluded.updated_by;
end;
$$;
grant execute on function public.set_email_configuration(text, int, text, text, text, text, text, boolean, text) to authenticated;

-- Decrypted credentials -- granted ONLY to service_role. Even an HR
-- admin's authenticated browser session can never retrieve the plaintext
-- password through the app; only the server-side email-sending edge
-- function can, because it alone holds the service-role key. This is the
-- actual security boundary, not the RLS policy above (which only gates the
-- ciphertext column, never selected by the UI anyway).
create or replace function public.get_smtp_credentials(_organization_id uuid)
returns table (
  host text, port int, encryption text, username text, password text,
  from_name text, from_email text, reply_to text, is_active boolean
)
language plpgsql security definer set search_path = public as $$
declare
  _key text := current_setting('app.settings.smtp_encryption_key', true);
begin
  return query
  select
    c.host, c.port, c.encryption, c.username,
    case when c.password_encrypted is not null and _key is not null then pgp_sym_decrypt(c.password_encrypted, _key) else null end,
    c.from_name, c.from_email, c.reply_to, c.is_active
  from public.email_configuration c
  where c.organization_id = _organization_id;
end;
$$;
revoke all on function public.get_smtp_credentials(uuid) from public, authenticated, anon;
grant execute on function public.get_smtp_credentials(uuid) to service_role;

-- ============================================================
-- d) Attendance Reconciliation
-- ============================================================

create table public.attendance_reconciliation_findings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  finding_date date not null,
  mismatch_type text not null check (mismatch_type in (
    'biometric_present_but_leave', 'wfh_with_biometric_present', 'unexplained_absence',
    'onduty_marked_absent', 'missing_in', 'missing_out', 'duplicate_punch', 'invalid_punch_sequence'
  )),
  biometric_status text,
  hr_status text,
  expected_status text,
  resolution_status text not null default 'open' check (resolution_status in ('open', 'resolved', 'accepted', 'overridden')),
  resolved_by uuid references public.employees(id),
  resolved_at timestamptz,
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (employee_id, finding_date, mismatch_type)
);
create trigger trg_attendance_reconciliation_findings_updated_at before update on public.attendance_reconciliation_findings
  for each row execute function public.set_updated_at();
create index idx_reconciliation_findings_org_date on public.attendance_reconciliation_findings(organization_id, finding_date desc);
create index idx_reconciliation_findings_status on public.attendance_reconciliation_findings(resolution_status);

alter table public.attendance_reconciliation_findings enable row level security;
create policy reconciliation_findings_select on public.attendance_reconciliation_findings for select
  using (organization_id = public.current_organization_id() and public.is_hr_or_admin());
-- Plain RLS-gated writes (not an RPC) for resolution -- HR updating
-- resolution_status/remarks directly is exactly what the generic audit
-- trigger above (now covering this table) is for: every manual resolution
-- is an ordinary UPDATE, which the trigger audits automatically, rather
-- than a bespoke "record this as audited" call the UI could forget to make.
create policy reconciliation_findings_write on public.attendance_reconciliation_findings for update
  using (organization_id = public.current_organization_id() and public.is_hr_or_admin())
  with check (organization_id = public.current_organization_id() and public.is_hr_or_admin());

-- Scans a date range for every employee and upserts findings -- re-running
-- it is safe (on conflict do update), so an already-resolved finding whose
-- underlying mismatch condition still holds is NOT reset to 'open' by a
-- later scan (only its status snapshot fields refresh); resolution state
-- is only ever changed by an explicit HR action on the row itself.
create or replace function public.run_attendance_reconciliation(_from_date date, _to_date date)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  _org_id uuid := public.current_organization_id();
  _found integer := 0;
  _rec record;
begin
  if not public.is_hr_or_admin() then
    raise exception 'run_attendance_reconciliation: not authorized';
  end if;

  for _rec in
    select
      e.id as employee_id,
      c.cal_date,
      exists (select 1 from public.attendance_punches p where p.employee_id = e.id and p.punch_date = c.cal_date) as has_punches,
      a.day_status,
      coalesce(a.missing_in, false) as missing_in,
      coalesce(a.missing_out, false) as missing_out,
      exists (
        select 1 from public.leave_requests lr
        where lr.employee_id = e.id and lr.status = 'approved' and c.cal_date between lr.from_date and lr.to_date
      ) as approved_leave,
      exists (
        select 1 from public.onduty_requests o
        where o.employee_id = e.id and o.status = 'approved' and o.onduty_type = 'work_from_home'
          and c.cal_date between o.from_date and o.to_date
      ) as approved_wfh,
      exists (
        select 1 from public.onduty_requests o
        where o.employee_id = e.id and o.status = 'approved' and o.onduty_type = 'on_duty'
          and c.cal_date between o.from_date and o.to_date
      ) as approved_onduty,
      exists (
        select 1 from public.holidays h where h.organization_id = e.organization_id and h.holiday_date = c.cal_date
      ) as is_holiday,
      coalesce(ws.weekoff_days is not null and extract(dow from c.cal_date)::int = any(ws.weekoff_days), false) as is_weekoff
    from public.employees e
    cross join lateral generate_series(_from_date, least(_to_date, current_date), interval '1 day') as c(cal_date)
    left join public.attendance a on a.employee_id = e.id and a.attendance_date = c.cal_date
    left join lateral (
      select sa_inner.shift_id from public.shift_assignments sa_inner
      where sa_inner.employee_id = e.id and sa_inner.effective_from <= c.cal_date
      order by sa_inner.effective_from desc limit 1
    ) sa on true
    left join public.shifts ws on ws.id = sa.shift_id
    where e.organization_id = _org_id and e.employment_status = 'active'
  loop
    if _rec.has_punches and _rec.approved_leave then
      insert into public.attendance_reconciliation_findings (organization_id, employee_id, finding_date, mismatch_type, biometric_status, hr_status, expected_status)
      values (_org_id, _rec.employee_id, _rec.cal_date, 'biometric_present_but_leave', 'present', coalesce(_rec.day_status, 'no_record'), 'leave')
      on conflict (employee_id, finding_date, mismatch_type) do update set
        biometric_status = excluded.biometric_status, hr_status = excluded.hr_status, expected_status = excluded.expected_status, updated_at = now();
      _found := _found + 1;
    end if;

    if _rec.has_punches and _rec.approved_wfh then
      insert into public.attendance_reconciliation_findings (organization_id, employee_id, finding_date, mismatch_type, biometric_status, hr_status, expected_status)
      values (_org_id, _rec.employee_id, _rec.cal_date, 'wfh_with_biometric_present', 'present', coalesce(_rec.day_status, 'no_record'), 'work_from_home')
      on conflict (employee_id, finding_date, mismatch_type) do update set
        biometric_status = excluded.biometric_status, hr_status = excluded.hr_status, expected_status = excluded.expected_status, updated_at = now();
      _found := _found + 1;
    end if;

    if _rec.approved_onduty and _rec.day_status = 'absent' then
      insert into public.attendance_reconciliation_findings (organization_id, employee_id, finding_date, mismatch_type, biometric_status, hr_status, expected_status)
      values (_org_id, _rec.employee_id, _rec.cal_date, 'onduty_marked_absent', 'absent', 'absent', 'on_duty')
      on conflict (employee_id, finding_date, mismatch_type) do update set
        biometric_status = excluded.biometric_status, hr_status = excluded.hr_status, expected_status = excluded.expected_status, updated_at = now();
      _found := _found + 1;
    end if;

    if not _rec.has_punches and not _rec.approved_leave and not _rec.approved_wfh and not _rec.approved_onduty
       and not _rec.is_holiday and not _rec.is_weekoff
       and coalesce(_rec.day_status, 'no_record') in ('absent', 'no_record') then
      insert into public.attendance_reconciliation_findings (organization_id, employee_id, finding_date, mismatch_type, biometric_status, hr_status, expected_status)
      values (_org_id, _rec.employee_id, _rec.cal_date, 'unexplained_absence', 'absent', coalesce(_rec.day_status, 'no_record'), 'present')
      on conflict (employee_id, finding_date, mismatch_type) do update set
        biometric_status = excluded.biometric_status, hr_status = excluded.hr_status, expected_status = excluded.expected_status, updated_at = now();
      _found := _found + 1;
    end if;

    if _rec.missing_in then
      insert into public.attendance_reconciliation_findings (organization_id, employee_id, finding_date, mismatch_type, biometric_status, hr_status, expected_status)
      values (_org_id, _rec.employee_id, _rec.cal_date, 'missing_in', coalesce(_rec.day_status, 'no_record'), coalesce(_rec.day_status, 'no_record'), 'complete_punch_pair')
      on conflict (employee_id, finding_date, mismatch_type) do update set updated_at = now();
      _found := _found + 1;
    end if;

    if _rec.missing_out then
      insert into public.attendance_reconciliation_findings (organization_id, employee_id, finding_date, mismatch_type, biometric_status, hr_status, expected_status)
      values (_org_id, _rec.employee_id, _rec.cal_date, 'missing_out', coalesce(_rec.day_status, 'no_record'), coalesce(_rec.day_status, 'no_record'), 'complete_punch_pair')
      on conflict (employee_id, finding_date, mismatch_type) do update set updated_at = now();
      _found := _found + 1;
    end if;
  end loop;

  return _found;
end;
$$;
grant execute on function public.run_attendance_reconciliation(date, date) to authenticated;

-- ============================================================
-- e) Audit trigger re-attach (moved here from section a) -- must run after
-- b/c/d have created biometric_readers, email_configuration, and
-- attendance_reconciliation_findings, since this DO block references them.
-- ============================================================
-- Full re-attach (idempotent per table -- drop-if-exists then re-create) so
-- every table this codebase has added since 0030, including this
-- migration's own new tables, gets audit coverage.
do $$
declare
  t text;
  sensitive_tables text[] := array[
    'bank_details', 'statutory_details', 'employees', 'employee_profiles',
    'payslips', 'tax_declarations', 'previous_employer_declarations',
    'leave_requests', 'permission_requests', 'attendance_regularizations',
    'onduty_requests', 'other_requests',
    'exit_requests', 'exit_settlements', 'exit_clearances',
    'user_roles', 'system_settings', 'employee_documents',
    'bank_detail_change_requests', 'leave_balances',
    'email_templates', 'biometric_readers', 'email_configuration',
    'attendance_reconciliation_findings'
  ];
begin
  foreach t in array sensitive_tables loop
    execute format('drop trigger if exists trg_%s_audit on public.%I', t, t);
    execute format(
      'create trigger trg_%s_audit after insert or update or delete on public.%I for each row execute function public.audit_row_change()',
      t, t
    );
  end loop;
end;
$$;
