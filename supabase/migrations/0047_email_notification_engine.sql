-- Centralized HR Email Notification Engine. Every module (Leave, WFH,
-- Permission, Comp-Off, On-Duty, Flexi Holiday, Attendance) queues an email
-- through the *same* function, queue_templated_email() -- no module renders
-- its own subject/body or resolves its own recipients. Two things feed it
-- today, both centralized rather than per-module:
--
--   1. trg_queue_approval_request_email() -- one generic trigger function
--      (same to_jsonb(NEW)/TG_TABLE_NAME pattern as the existing generic
--      audit_row_change() trigger from 0030) attached to all five request
--      tables' `after insert`. Fires the 'approval_request' template to the
--      reporting manager the moment any request is submitted, regardless of
--      which module submitted it.
--   2. act_on_approval() (already the single shared approval-decision
--      function) now also queues 'approval_approved'/'approval_rejected' to
--      the requesting employee, right alongside the existing in-app
--      notification insert.
--
-- The remaining 7 template types (Missing Punch, Early Going, WFH Weekly
-- Alert, Comp-Off Expiry, Attendance Closure Reminder, Reconciliation Alert,
-- System Notification) are fully supported by the engine -- templates,
-- rendering, queueing, retry, delivery logs -- and callable via
-- queue_templated_email() from anywhere, but nothing in this codebase
-- generates those *source events* on a schedule yet (several depend on
-- features -- Comp-Off, Attendance Closure, Reconciliation -- that don't
-- exist yet; Missing Punch/Early Going/WFH Weekly Alert would naturally be
-- triggered by a scheduled job, which needs pg_cron or an external
-- scheduler wired to the edge function below, not built in this migration).
-- Not claiming those are live today -- only that the shared engine they'll
-- plug into already is.
--
-- Actual SMTP delivery cannot happen in Postgres itself -- see
-- supabase/functions/process-email-queue/ (a Deno edge function, reading
-- SMTP credentials only from its own environment via `supabase secrets
-- set`, never from this database or any UI). This migration's job is the
-- queue + templates + delivery log + retry bookkeeping; the edge function
-- drains the queue. src/lib/emailEngine.ts is the tested TS mirror of the
-- rendering/recipient-resolution/retry-decision logic here, the same
-- TS-mirrors-SQL convention as src/lib/attendanceCalc.ts.

create table public.email_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  template_key text not null check (template_key in (
    'approval_request', 'approval_approved', 'approval_rejected', 'missing_punch', 'early_going',
    'wfh_weekly_alert', 'comp_off_expiry', 'attendance_closure_reminder', 'reconciliation_alert', 'system_notification'
  )),
  name text not null,
  subject text not null,
  body text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.employees(id),
  updated_by uuid references public.employees(id)
);
create trigger trg_email_templates_updated_at before update on public.email_templates
  for each row execute function public.set_updated_at();
create index idx_email_templates_org_key on public.email_templates(organization_id, template_key);
-- At most one ACTIVE template per (org, key) -- queue_templated_email()
-- always has an unambiguous template to pick, and enabling a second one
-- for the same key must first disable the one currently active.
create unique index uq_email_templates_active_key on public.email_templates(organization_id, template_key) where is_active;

alter table public.email_templates enable row level security;
create policy email_templates_select on public.email_templates for select
  using (organization_id = public.current_organization_id() and public.is_hr_or_admin());
create policy email_templates_write on public.email_templates for all
  using (organization_id = public.current_organization_id() and public.is_hr_or_admin())
  with check (organization_id = public.current_organization_id() and public.is_hr_or_admin());

create table public.email_delivery_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  -- Kept even if the template row is later deleted (on delete set null) --
  -- template_key alone still makes the log entry meaningful.
  template_id uuid references public.email_templates(id) on delete set null,
  template_key text not null,
  recipient_email text not null,
  cc text[] not null default '{}',
  bcc text[] not null default '{}',
  subject text,
  body text,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'retrying')),
  error_message text,
  -- Free-form business reference (e.g. 'leave_requests:<uuid>') so a log
  -- entry can be traced back to the request/event that caused it.
  reference_id text,
  attempt_count int not null default 0,
  max_attempts int not null default 3,
  next_retry_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index idx_email_delivery_logs_org_created on public.email_delivery_logs(organization_id, created_at desc);
create index idx_email_delivery_logs_pending on public.email_delivery_logs(status, next_retry_at) where status in ('pending', 'retrying');
create index idx_email_delivery_logs_reference on public.email_delivery_logs(reference_id);

alter table public.email_delivery_logs enable row level security;
create policy email_delivery_logs_select on public.email_delivery_logs for select
  using (organization_id = public.current_organization_id() and public.is_hr_or_admin());
-- No insert/update policy for regular clients -- every row is written by
-- queue_templated_email() (security definer) or the edge function (service
-- role), matching audit_logs' append-only-via-privileged-path convention.

-- SQL-side mirror of src/lib/emailEngine.ts's renderTemplate(): replaces
-- every {{key}} present in `_variables` and blanks out any placeholder left
-- over (an unsupplied or genuinely unknown variable), rather than leaking
-- the raw `{{...}}` into a sent email.
create or replace function public.render_email_template(_subject text, _body text, _variables jsonb)
returns table (subject text, body text)
language plpgsql immutable as $$
declare
  _key text;
  _value text;
  _rendered_subject text := _subject;
  _rendered_body text := _body;
begin
  for _key, _value in select * from jsonb_each_text(coalesce(_variables, '{}'::jsonb)) loop
    _rendered_subject := replace(_rendered_subject, '{{' || _key || '}}', coalesce(_value, ''));
    _rendered_body := replace(_rendered_body, '{{' || _key || '}}', coalesce(_value, ''));
  end loop;
  _rendered_subject := regexp_replace(_rendered_subject, '\{\{\s*[a-zA-Z0-9_]+\s*\}\}', '', 'g');
  _rendered_body := regexp_replace(_rendered_body, '\{\{\s*[a-zA-Z0-9_]+\s*\}\}', '', 'g');
  return query select _rendered_subject, _rendered_body;
end;
$$;

-- The one reusable notification service every module calls. Looks up the
-- active template for _template_key, renders it, and writes a delivery-log
-- row (status='pending') for the edge function to actually send. A missing
-- or disabled template is logged as a failed delivery with a clear error
-- instead of being silently dropped -- mirrors
-- src/lib/emailEngine.ts's decideQueueOutcome() exactly.
create or replace function public.queue_templated_email(
  _template_key text,
  _recipient_email text,
  _variables jsonb default '{}'::jsonb,
  _reference_id text default null,
  _cc text[] default '{}',
  _bcc text[] default '{}'
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  _org_id uuid := public.current_organization_id();
  _template record;
  _rendered record;
  _log_id uuid;
begin
  select id, subject, body into _template
    from public.email_templates
    where organization_id = _org_id and template_key = _template_key and is_active
    order by updated_at desc limit 1;

  if _template.id is null then
    insert into public.email_delivery_logs (
      organization_id, template_id, template_key, recipient_email, cc, bcc, status, error_message, reference_id
    ) values (
      _org_id, null, _template_key, _recipient_email, coalesce(_cc, '{}'), coalesce(_bcc, '{}'),
      'failed', 'No active template configured for this template_key', _reference_id
    )
    returning id into _log_id;
    return _log_id;
  end if;

  select * into _rendered from public.render_email_template(_template.subject, _template.body, _variables);

  insert into public.email_delivery_logs (
    organization_id, template_id, template_key, recipient_email, cc, bcc, subject, body, status, reference_id
  ) values (
    _org_id, _template.id, _template_key, _recipient_email, coalesce(_cc, '{}'), coalesce(_bcc, '{}'),
    _rendered.subject, _rendered.body, 'pending', _reference_id
  )
  returning id into _log_id;

  return _log_id;
end;
$$;

grant execute on function public.queue_templated_email(text, text, jsonb, text, text[], text[]) to authenticated;

-- Generic "approval request submitted" trigger -- one function, attached to
-- all five request tables, instead of each module queueing its own email.
-- to_jsonb(NEW)/TG_TABLE_NAME is the same pattern the existing generic
-- audit_row_change() trigger (0030) already uses for the same reason.
create or replace function public.trg_queue_approval_request_email()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  _row jsonb := to_jsonb(new);
  _manager_id uuid := nullif(_row->>'reporting_manager_id', '')::uuid;
  _org_id uuid;
  _employee_name text;
  _employee_code text;
  _manager_name text;
  _manager_email text;
  _request_type text;
  _from_date text;
  _to_date text;
  _duration text;
begin
  if new.status <> 'pending' then
    return new;
  end if;

  select organization_id, (first_name || coalesce(' ' || last_name, '')), employee_code
    into _org_id, _employee_name, _employee_code
    from public.employees where id = new.employee_id;

  if _manager_id is not null then
    select (first_name || coalesce(' ' || last_name, '')), official_email
      into _manager_name, _manager_email
      from public.employees where id = _manager_id;
  end if;

  if _manager_email is null then
    return new; -- no manager on record to notify
  end if;

  _request_type := case TG_TABLE_NAME
    when 'leave_requests' then 'Leave'
    when 'permission_requests' then 'Permission'
    when 'attendance_regularizations' then 'Attendance Regularization'
    when 'onduty_requests' then (case when _row->>'onduty_type' = 'work_from_home' then 'Work From Home' else 'On Duty' end)
    when 'other_requests' then coalesce(_row->>'request_title', 'Other Request')
    else TG_TABLE_NAME
  end;

  _from_date := coalesce(_row->>'from_date', _row->>'attendance_date', _row->>'permission_date', _row->>'request_date');
  _to_date := coalesce(_row->>'to_date', _from_date);
  _duration := case
    when _row ? 'duration_days' then (_row->>'duration_days') || ' day(s)'
    when _row ? 'duration_minutes' then (_row->>'duration_minutes') || ' min'
    else '-'
  end;

  perform public.queue_templated_email(
    'approval_request',
    _manager_email,
    jsonb_build_object(
      'employee_name', _employee_name,
      'employee_id', _employee_code,
      'manager_name', _manager_name,
      'request_type', _request_type,
      'from_date', _from_date,
      'to_date', _to_date,
      'duration', _duration,
      'reason', coalesce(_row->>'reason', ''),
      'application_id', new.id::text
    ),
    TG_TABLE_NAME || ':' || new.id::text
  );

  return new;
end;
$$;

create trigger trg_leave_requests_queue_approval_email after insert on public.leave_requests
  for each row execute function public.trg_queue_approval_request_email();
create trigger trg_permission_requests_queue_approval_email after insert on public.permission_requests
  for each row execute function public.trg_queue_approval_request_email();
create trigger trg_attendance_regularizations_queue_approval_email after insert on public.attendance_regularizations
  for each row execute function public.trg_queue_approval_request_email();
create trigger trg_onduty_requests_queue_approval_email after insert on public.onduty_requests
  for each row execute function public.trg_queue_approval_request_email();
create trigger trg_other_requests_queue_approval_email after insert on public.other_requests
  for each row execute function public.trg_queue_approval_request_email();

-- Full redeclare (see every prior act_on_approval migration's note on why).
-- Every branch is unchanged from 0046 except a new block right after the
-- existing in-app notification insert, which now also queues
-- 'approval_approved'/'approval_rejected' to the requesting employee via
-- the same central engine -- not a second, module-specific email path.
create or replace function public.act_on_approval(
  _request_type text,
  _request_id uuid,
  _action text,
  _remarks text default null
)
returns void
language plpgsql security definer set search_path = public as $$
declare
  _owner_id uuid;
  _actor_id uuid := public.current_employee_id();
  _org_id uuid;
  _old_status text;
  _workflow_id uuid;
  _instance_id uuid;
  _recipient_user uuid;
  _notification_type text;
  _title text;
  _leave_type_id uuid;
  _leave_type_name text;
  _duration numeric(5,2);
  _from_date date;
  _to_date date;
  _remaining numeric(6,2);
  _remaining_to_deduct numeric(5,2);
  _deduct_amount numeric(5,2);
  _period_row record;
  -- Regularization -> attendance sync
  _reg_date date;
  _reg_check_in timestamptz;
  _reg_check_out timestamptz;
  -- Leave / onduty -> attendance sync
  _onduty_type text;
  _loop_date date;
  _onduty_remark text;
  -- Permission balance
  _permission_date date;
  _permission_minutes int;
  _perm_balance_id uuid;
  _perm_remaining int;
  -- Approval-decision email
  _owner_email text;
  _owner_name text;
  _owner_code text;
  _actor_name text;
  _email_request_type text;
  _email_from_date text;
  _email_to_date text;
  _email_duration text;
begin
  if _action not in ('approved', 'rejected') then
    raise exception 'act_on_approval: action must be ''approved'' or ''rejected'', got %', _action;
  end if;

  _owner_id := public.request_owner_employee_id(_request_type, _request_id);
  if _owner_id is null then
    raise exception 'act_on_approval: request % / % not found', _request_type, _request_id;
  end if;

  if _actor_id is null or not (public.is_hr_or_admin() or public.is_manager_of(_owner_id)) then
    raise exception 'act_on_approval: not authorized to act on this request';
  end if;

  select organization_id into _org_id from public.employees where id = _owner_id;

  if _request_type = 'leave_request' then
    select status into _old_status from public.leave_requests where id = _request_id;
    update public.leave_requests
      set status = _action, approval_remarks = _remarks
      where id = _request_id and status = 'pending'
      returning leave_type_id, duration_days, from_date, to_date into _leave_type_id, _duration, _from_date, _to_date;
  elsif _request_type = 'permission_request' then
    select status into _old_status from public.permission_requests where id = _request_id;
    update public.permission_requests
      set status = _action, approval_remarks = _remarks
      where id = _request_id and status = 'pending'
      returning permission_date, duration_minutes into _permission_date, _permission_minutes;
  elsif _request_type = 'attendance_regularization' then
    select status into _old_status from public.attendance_regularizations where id = _request_id;
    update public.attendance_regularizations
      set status = _action, approval_remarks = _remarks, approver_id = _actor_id
      where id = _request_id and status = 'pending'
      returning attendance_date, requested_check_in, requested_check_out
        into _reg_date, _reg_check_in, _reg_check_out;
  elsif _request_type = 'onduty_request' then
    select status into _old_status from public.onduty_requests where id = _request_id;
    update public.onduty_requests
      set status = _action, approval_remarks = _remarks
      where id = _request_id and status = 'pending'
      returning from_date, to_date, onduty_type into _from_date, _to_date, _onduty_type;
  elsif _request_type = 'other_request' then
    select status into _old_status from public.other_requests where id = _request_id;
    update public.other_requests
      set status = _action, approval_remarks = _remarks
      where id = _request_id and status = 'pending';
  else
    raise exception 'act_on_approval: unsupported request type %', _request_type;
  end if;

  if not found then
    raise exception 'act_on_approval: request is not pending (already actioned?)';
  end if;

  -- Deduct across every leave_balances period for this employee/leave-type
  -- (cumulative model): check the sum first, then spend from the earliest
  -- period with remaining balance forward, so a request isn't blocked just
  -- because the specific month it falls in has too small a slice.
  if _request_type = 'leave_request' and _action = 'approved' then
    select coalesce(sum(balance), 0) into _remaining
      from public.leave_balances
      where employee_id = _owner_id and leave_type_id = _leave_type_id;

    if _remaining - _duration < 0 then
      raise exception 'act_on_approval: approving this request would drive leave type % balance negative (% available, % requested)',
        _leave_type_id, _remaining, _duration;
    end if;

    _remaining_to_deduct := _duration;
    for _period_row in
      select id, balance from public.leave_balances
      where employee_id = _owner_id and leave_type_id = _leave_type_id and balance > 0
      order by period_start
      for update
    loop
      exit when _remaining_to_deduct <= 0;
      _deduct_amount := least(_period_row.balance, _remaining_to_deduct);
      update public.leave_balances
        set used = used + _deduct_amount, balance = balance - _deduct_amount
        where id = _period_row.id;
      _remaining_to_deduct := _remaining_to_deduct - _deduct_amount;
    end loop;
    -- No balance rows at all is left un-deducted rather than blocking the
    -- approval outright -- leave types with accrual_frequency = 'none'
    -- (e.g. unpaid/compensatory) may legitimately have no leave_balances row.
  end if;

  -- Deduct the matching permission-balance period on approval only.
  if _request_type = 'permission_request' and _action = 'approved' then
    select id, balance_minutes into _perm_balance_id, _perm_remaining
      from public.permission_balances
      where employee_id = _owner_id
        and period_start <= _permission_date and period_end >= _permission_date
      for update;

    if _perm_balance_id is not null then
      if _perm_remaining - _permission_minutes < 0 then
        raise exception 'act_on_approval: approving this request would drive permission balance negative (% minutes available, % requested)',
          _perm_remaining, _permission_minutes;
      end if;
      update public.permission_balances
        set used_minutes = used_minutes + _permission_minutes, balance_minutes = balance_minutes - _permission_minutes
        where id = _perm_balance_id;
    end if;
    -- No matching period is left un-deducted rather than blocking the
    -- approval outright, same reasoning as the leave-balance block above.
  end if;

  -- (a) Apply an approved leave to the attendance table: every day in range
  -- becomes day_status = 'leave'. Overwrites whatever was there before
  -- (e.g. a stale seeded 'absent' guess) -- the approved leave is now the
  -- authoritative status for that day.
  if _request_type = 'leave_request' and _action = 'approved' then
    select name into _leave_type_name from public.leave_types where id = _leave_type_id;
    _loop_date := _from_date;
    while _loop_date <= _to_date loop
      insert into public.attendance (organization_id, employee_id, attendance_date, day_status, validation_status, remarks)
      values (_org_id, _owner_id, _loop_date, 'leave', 'completed', coalesce(_leave_type_name, 'Leave'))
      on conflict (employee_id, attendance_date) do update set
        day_status = 'leave',
        validation_status = 'completed',
        remarks = coalesce(excluded.remarks, public.attendance.remarks);
      _loop_date := _loop_date + 1;
    end loop;
  end if;

  -- (b) Apply an approved on-duty/WFH request the same way: every day in
  -- range becomes day_status = 'present' (the employee worked, just not
  -- from a punch-tracked location), with a remark noting which type.
  -- recompute_attendance_day() recognizes this remark and refuses to
  -- overwrite it if punches are ever recomputed for the same date.
  if _request_type = 'onduty_request' and _action = 'approved' then
    _onduty_remark := case when _onduty_type = 'work_from_home' then 'Work From Home' else 'On Duty' end;
    _loop_date := _from_date;
    while _loop_date <= _to_date loop
      insert into public.attendance (organization_id, employee_id, attendance_date, day_status, validation_status, remarks)
      values (_org_id, _owner_id, _loop_date, 'present', 'completed', _onduty_remark)
      on conflict (employee_id, attendance_date) do update set
        day_status = 'present',
        validation_status = 'completed',
        remarks = coalesce(excluded.remarks, public.attendance.remarks);
      _loop_date := _loop_date + 1;
    end loop;
  end if;

  -- Apply an approved regularization by writing the correction as
  -- synthetic 'manual' punches and letting recompute_attendance_day() do
  -- the actual shift-relative math -- the same engine every other punch
  -- (biometric, mobile, web) goes through. A prior 'manual' punch of the
  -- same type for this date is replaced, not stacked, so re-approving a
  -- corrected regularization doesn't accumulate duplicate synthetic punches.
  if _request_type = 'attendance_regularization' and _action = 'approved' then
    if _reg_check_in is not null or _reg_check_out is not null then
      if _reg_check_in is not null then
        delete from public.attendance_punches
          where employee_id = _owner_id and punch_date = _reg_date and source = 'manual' and punch_type = 'in';
        insert into public.attendance_punches (organization_id, employee_id, punch_date, punch_time, punch_type, source)
          values (_org_id, _owner_id, _reg_date, _reg_check_in, 'in', 'manual');
      end if;
      if _reg_check_out is not null then
        delete from public.attendance_punches
          where employee_id = _owner_id and punch_date = _reg_date and source = 'manual' and punch_type = 'out';
        insert into public.attendance_punches (organization_id, employee_id, punch_date, punch_time, punch_type, source)
          values (_org_id, _owner_id, _reg_date, _reg_check_out, 'out', 'manual');
      end if;

      perform public.recompute_attendance_day(_owner_id, _reg_date);

      update public.attendance
        set is_regularized = true, remarks = coalesce(_remarks, remarks)
        where employee_id = _owner_id and attendance_date = _reg_date;
    else
      -- No punch times at all (e.g. a plain present_correction with nothing
      -- but "I was present" and a reason) -- still record the correction
      -- rather than silently dropping it, same fallback as before.
      insert into public.attendance (organization_id, employee_id, attendance_date, day_status, validation_status, is_regularized, remarks)
      values (_org_id, _owner_id, _reg_date, 'present', 'completed', true, _remarks)
      on conflict (employee_id, attendance_date) do update set
        day_status = 'present',
        validation_status = 'completed',
        is_regularized = true,
        remarks = coalesce(excluded.remarks, public.attendance.remarks);
    end if;
  end if;

  insert into public.audit_logs (organization_id, actor_user_id, action, module, record_id, old_value, new_value)
    values (
      _org_id, auth.uid(), (case when _action = 'approved' then 'approval' else 'rejection' end),
      'manager_self_service', _request_id,
      jsonb_build_object('request_type', _request_type, 'status', _old_status),
      jsonb_build_object('request_type', _request_type, 'status', _action, 'remarks', _remarks)
    );

  select id into _workflow_id from public.approval_workflows
    where organization_id = _org_id and request_type = _request_type and is_active
    order by created_at limit 1;

  if _workflow_id is not null then
    insert into public.approval_instances (workflow_id, request_type, request_id, status, current_step_order)
      values (_workflow_id, _request_type, _request_id, _action, 1)
      on conflict (request_type, request_id) do update set status = excluded.status
      returning id into _instance_id;

    insert into public.approval_actions (approval_instance_id, step_order, actor_employee_id, action, remarks)
      values (_instance_id, 1, _actor_id, _action, _remarks);
  end if;

  _notification_type := case _request_type
    when 'leave_request' then (case when _action = 'approved' then 'leave_approved' else 'leave_rejected' end)
    when 'permission_request' then (case when _action = 'approved' then 'permission_approved' else 'permission_rejected' end)
    when 'attendance_regularization' then (case when _action = 'approved' then 'regularization_approved' else 'regularization_rejected' end)
    when 'onduty_request' then (case when _action = 'approved' then 'onduty_approved' else 'onduty_rejected' end)
    when 'other_request' then (case when _action = 'approved' then 'other_request_approved' else 'other_request_rejected' end)
  end;
  _title := case when _action = 'approved' then 'Your request has been approved' else 'Your request has been rejected' end;

  select user_id into _recipient_user from public.employees where id = _owner_id;
  if _recipient_user is not null then
    insert into public.notifications (organization_id, recipient_user_id, notification_type, title, body, link_path)
      values (_org_id, _recipient_user, _notification_type, _title, _remarks, '/attendance/event-request');
  end if;

  -- Queue the decision email to the requesting employee via the same
  -- central engine every other module uses -- not a bespoke send here.
  select official_email, (first_name || coalesce(' ' || last_name, '')), employee_code
    into _owner_email, _owner_name, _owner_code
    from public.employees where id = _owner_id;

  if _owner_email is not null then
    select (first_name || coalesce(' ' || last_name, '')) into _actor_name from public.employees where id = _actor_id;

    _email_request_type := case _request_type
      when 'leave_request' then 'Leave'
      when 'permission_request' then 'Permission'
      when 'attendance_regularization' then 'Attendance Regularization'
      when 'onduty_request' then (case when _onduty_type = 'work_from_home' then 'Work From Home' else 'On Duty' end)
      when 'other_request' then 'Other Request'
    end;
    _email_from_date := coalesce(_from_date::text, _reg_date::text, _permission_date::text);
    _email_to_date := coalesce(_to_date::text, _email_from_date);
    _email_duration := case
      when _duration is not null then _duration::text || ' day(s)'
      when _permission_minutes is not null then _permission_minutes::text || ' min'
      else '-'
    end;

    perform public.queue_templated_email(
      case when _action = 'approved' then 'approval_approved' else 'approval_rejected' end,
      _owner_email,
      jsonb_build_object(
        'employee_name', _owner_name,
        'employee_id', _owner_code,
        'manager_name', _actor_name,
        'request_type', _email_request_type,
        'from_date', _email_from_date,
        'to_date', _email_to_date,
        'duration', _email_duration,
        'remarks', coalesce(_remarks, ''),
        'status', _action,
        'application_id', _request_id::text
      ),
      _request_type || ':' || _request_id::text
    );
  end if;
end;
$$;

grant execute on function public.act_on_approval(text, uuid, text, text) to authenticated;
