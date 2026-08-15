-- Exit module additions: department clearance workflow, final settlement,
-- an HR-contact lookup, and the two SECURITY DEFINER RPCs that drive the
-- resignation approval / clearance state machines (the same pattern as
-- act_on_approval() for Attendance — see 0025_approval_action_rpc.sql).

create table public.exit_clearances (
  id uuid primary key default gen_random_uuid(),
  exit_request_id uuid not null references public.exit_requests(id) on delete cascade,
  department text not null check (department in ('manager', 'hr', 'it', 'finance', 'admin')),
  status text not null default 'pending' check (status in ('pending', 'cleared', 'rejected')),
  remarks text,
  cleared_by uuid references public.employees(id),
  cleared_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (exit_request_id, department)
);
create trigger trg_exit_clearances_updated_at before update on public.exit_clearances
  for each row execute function public.set_updated_at();
create index idx_exit_clearances_request on public.exit_clearances(exit_request_id);

create table public.exit_settlements (
  id uuid primary key default gen_random_uuid(),
  exit_request_id uuid not null unique references public.exit_requests(id) on delete cascade,
  last_working_date date not null,
  leave_encashment numeric(12,2) not null default 0,
  notice_pay numeric(12,2) not null default 0,
  pending_salary numeric(12,2) not null default 0,
  deductions numeric(12,2) not null default 0,
  bonus numeric(12,2) not null default 0,
  other_adjustments numeric(12,2) not null default 0,
  -- Kept in sync with src/lib/settlementCalc.ts's calculateFinalSettlement() —
  -- update both if the formula ever changes.
  final_settlement_amount numeric(12,2) generated always as (
    pending_salary + leave_encashment + bonus + other_adjustments - notice_pay - deductions
  ) stored,
  status text not null default 'draft' check (status in ('draft', 'released')),
  released_by uuid references public.employees(id),
  released_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_exit_settlements_updated_at before update on public.exit_settlements
  for each row execute function public.set_updated_at();

-- RLS: exit_clearances is select-only for plain clients — every write goes
-- through act_on_exit_clearance() below, which enforces per-department
-- authorization server-side.
alter table public.exit_clearances enable row level security;
create policy exit_clearances_select on public.exit_clearances for select
  using (
    public.is_hr_or_admin()
    or exists (
      select 1 from public.exit_requests er
      where er.id = exit_request_id
        and (er.employee_id = public.current_employee_id() or public.is_manager_of(er.employee_id))
    )
  );

alter table public.exit_settlements enable row level security;
create policy exit_settlements_select on public.exit_settlements for select
  using (
    public.is_hr_or_admin()
    or (
      status = 'released'
      and exists (select 1 from public.exit_requests er where er.id = exit_request_id and er.employee_id = public.current_employee_id())
    )
  );
create policy exit_settlements_write on public.exit_settlements for all
  using (public.is_hr_or_admin()) with check (public.is_hr_or_admin());

-- Tighten exit_requests_update (0020_rls_sensitive_and_payroll.sql): the
-- original policy let an employee or their manager UPDATE any column on a
-- row they can already see, including `status` — i.e. an employee could
-- set their own request straight to 'hr_approved' via a raw client update.
-- act_on_exit_request() below is the sanctioned path for every status
-- transition; this WITH CHECK backstops direct table access so self-service
-- updates can only ever land on the row's own "nothing happened yet" states.
drop policy if exists exit_requests_update on public.exit_requests;
create policy exit_requests_update on public.exit_requests for update
  using (
    employee_id = public.current_employee_id()
    or manager_id = public.current_employee_id()
    or public.is_hr_or_admin()
  )
  with check (
    public.is_hr_or_admin()
    or (employee_id = public.current_employee_id() and status in ('draft', 'withdrawn'))
    or (manager_id = public.current_employee_id() and status in ('manager_approved', 'rejected'))
  );

-- The exit interview is self-administered (spec: "Employee can submit
-- answers"), but the original exit_interviews_write/exit_interview_responses_write
-- policies only granted write access to is_hr_or_admin() or conducted_by =
-- self — conducted_by is for an HR-run interview, so a plain employee could
-- never actually submit their own responses. Extend both to also allow the
-- interview's own employee_id.
drop policy if exists exit_interviews_write on public.exit_interviews;
create policy exit_interviews_write on public.exit_interviews for all
  using (public.is_hr_or_admin() or employee_id = public.current_employee_id() or conducted_by = public.current_employee_id())
  with check (public.is_hr_or_admin() or employee_id = public.current_employee_id() or conducted_by = public.current_employee_id());

drop policy if exists exit_interview_responses_write on public.exit_interview_responses;
create policy exit_interview_responses_write on public.exit_interview_responses for all
  using (
    public.is_hr_or_admin()
    or exists (
      select 1 from public.exit_interviews ei
      where ei.id = exit_interview_id
        and (ei.employee_id = public.current_employee_id() or ei.conducted_by = public.current_employee_id())
    )
  )
  with check (
    public.is_hr_or_admin()
    or exists (
      select 1 from public.exit_interviews ei
      where ei.id = exit_interview_id
        and (ei.employee_id = public.current_employee_id() or ei.conducted_by = public.current_employee_id())
    )
  );

-- Read-only HR-contact lookup for the Exit Dashboard. A plain employee can't
-- otherwise see who holds the hr_admin role (user_roles RLS is self-or-HR
-- only) — this exposes just name + email, nothing else.
create or replace function public.get_hr_contact()
returns table (display_name text, email text)
language sql stable security definer set search_path = public as $$
  select (e.first_name || coalesce(' ' || e.last_name, ''))::text, e.official_email
  from public.employees e
  join public.user_roles ur on ur.user_id = e.user_id
  join public.roles r on r.id = ur.role_id
  where e.organization_id = public.current_organization_id()
    and r.code = 'hr_admin'
  order by e.employee_code
  limit 1;
$$;
grant execute on function public.get_hr_contact() to authenticated;

-- Resignation workflow state machine (spec section 3). Submission itself
-- stays a plain client insert (matching how leave/permission/regularization
-- requests are created elsewhere in the app); every subsequent transition —
-- manager approve/reject, HR approve/reject, employee withdraw — goes
-- through this RPC so status changes are authorized and audited in one
-- place. HR-approve additionally provisions the five clearance rows and the
-- exit interview record, since both only become meaningful once HR has
-- signed off.
create or replace function public.act_on_exit_request(
  _exit_request_id uuid,
  _action text,
  _remarks text default null
)
returns void
language plpgsql security definer set search_path = public as $$
declare
  _actor_id uuid := public.current_employee_id();
  _req public.exit_requests%rowtype;
  _org_id uuid;
  _recipient_user uuid;
  _title text;
begin
  select * into _req from public.exit_requests where id = _exit_request_id for update;
  if not found then
    raise exception 'act_on_exit_request: request not found';
  end if;

  if _action = 'withdraw' then
    if _req.employee_id <> _actor_id then
      raise exception 'act_on_exit_request: only the employee can withdraw their own resignation';
    end if;
    if _req.status not in ('submitted', 'manager_approved') then
      raise exception 'act_on_exit_request: cannot withdraw a resignation in status %', _req.status;
    end if;
    update public.exit_requests set status = 'withdrawn' where id = _exit_request_id;
    return;
  end if;

  if _action in ('manager_approve', 'manager_reject') then
    if not (public.is_manager_of(_req.employee_id) or public.is_hr_or_admin()) then
      raise exception 'act_on_exit_request: not authorized as manager';
    end if;
    if _req.status <> 'submitted' then
      raise exception 'act_on_exit_request: resignation is not pending manager review';
    end if;

    if _action = 'manager_approve' then
      update public.exit_requests
        set status = 'manager_approved', manager_approved_at = now(), manager_remarks = _remarks
        where id = _exit_request_id;
      _title := 'Your resignation was approved by your manager';
    else
      update public.exit_requests set status = 'rejected', manager_remarks = _remarks where id = _exit_request_id;
      _title := 'Your resignation was rejected by your manager';
    end if;

  elsif _action in ('hr_approve', 'hr_reject') then
    if not public.is_hr_or_admin() then
      raise exception 'act_on_exit_request: not authorized as HR';
    end if;
    if _req.status <> 'manager_approved' then
      raise exception 'act_on_exit_request: resignation is not pending HR review';
    end if;

    if _action = 'hr_approve' then
      update public.exit_requests
        set status = 'hr_approved', hr_approver_id = _actor_id, hr_approved_at = now(), hr_remarks = _remarks
        where id = _exit_request_id;

      insert into public.exit_clearances (exit_request_id, department)
        select _exit_request_id, d from unnest(array['manager', 'hr', 'it', 'finance', 'admin']) as d
        on conflict (exit_request_id, department) do nothing;

      insert into public.exit_interviews (exit_request_id, employee_id, status)
        values (_exit_request_id, _req.employee_id, 'pending')
        on conflict (exit_request_id) do nothing;

      _title := 'Your resignation was approved by HR. Exit clearance and interview are now available.';
    else
      update public.exit_requests set status = 'rejected', hr_remarks = _remarks where id = _exit_request_id;
      _title := 'Your resignation was rejected by HR';
    end if;
  else
    raise exception 'act_on_exit_request: unsupported action %', _action;
  end if;

  select organization_id, user_id into _org_id, _recipient_user from public.employees where id = _req.employee_id;
  if _recipient_user is not null then
    insert into public.notifications (organization_id, recipient_user_id, notification_type, title, body, link_path)
      values (_org_id, _recipient_user, 'resignation_update', _title, _remarks, '/exit');
  end if;
end;
$$;
grant execute on function public.act_on_exit_request(uuid, text, text) to authenticated;

-- Per-department clearance marking (spec section 6). Any department can be
-- actioned by HR/admin; the 'manager' row can additionally be actioned by
-- the employee's actual reporting-chain manager. Once every department
-- reads 'cleared', the parent resignation flips to 'completed'.
create or replace function public.act_on_exit_clearance(
  _clearance_id uuid,
  _status text,
  _remarks text default null
)
returns void
language plpgsql security definer set search_path = public as $$
declare
  _actor_id uuid := public.current_employee_id();
  _department text;
  _exit_request_id uuid;
  _req_employee_id uuid;
  _org_id uuid;
  _recipient_user uuid;
  _remaining int;
begin
  if _status not in ('cleared', 'rejected') then
    raise exception 'act_on_exit_clearance: status must be cleared or rejected';
  end if;

  select ec.department, ec.exit_request_id, er.employee_id
    into _department, _exit_request_id, _req_employee_id
  from public.exit_clearances ec
  join public.exit_requests er on er.id = ec.exit_request_id
  where ec.id = _clearance_id
  for update of ec;

  if not found then
    raise exception 'act_on_exit_clearance: clearance not found';
  end if;

  if not (
    public.is_hr_or_admin()
    or (_department = 'manager' and public.is_manager_of(_req_employee_id))
  ) then
    raise exception 'act_on_exit_clearance: not authorized to act on % clearance', _department;
  end if;

  update public.exit_clearances
    set status = _status, remarks = _remarks, cleared_by = _actor_id, cleared_at = now()
    where id = _clearance_id;

  select count(*) into _remaining
  from public.exit_clearances
  where exit_request_id = _exit_request_id and status <> 'cleared';

  if _remaining = 0 then
    update public.exit_requests set status = 'completed' where id = _exit_request_id and status = 'hr_approved';
  end if;

  select organization_id, user_id into _org_id, _recipient_user from public.employees where id = _req_employee_id;
  if _recipient_user is not null then
    insert into public.notifications (organization_id, recipient_user_id, notification_type, title, body, link_path)
      values (
        _org_id, _recipient_user, 'resignation_update',
        initcap(_department) || ' clearance ' || _status,
        _remarks, '/exit'
      );
  end if;
end;
$$;
grant execute on function public.act_on_exit_clearance(uuid, text, text) to authenticated;
