-- Implements the "Permission Balance" concept flagged as a gap during the
-- production-readiness audit: the schema had no entitlement/balance concept
-- for permission requests at all (unlike leave), so BalancePage.tsx's
-- Permission row always showed hardcoded '00:00'/'-' placeholders no matter
-- how many permission requests were approved.
--
-- Durations are stored as integer minutes throughout (matching
-- permission_requests.duration_minutes, already the existing convention) —
-- never decimal hours — and formatted as HH:MM in the UI via the existing
-- formatHoursMinutes() in src/lib/dateFormat.ts. "01:30" is stored as 90,
-- not 1.30.
--
-- Monthly periods, mirroring leave_balances' period_start/period_end shape
-- exactly, so month-wise and year-wise reporting can both be built on top
-- (year-wise = sum of that year's monthly rows for an employee).

create table public.permission_balances (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  opening_minutes integer not null default 0,
  credited_minutes integer not null default 0,
  used_minutes integer not null default 0,
  balance_minutes integer not null default 0,
  updated_at timestamptz not null default now(),
  unique (employee_id, period_start)
);
create trigger trg_permission_balances_updated_at before update on public.permission_balances
  for each row execute function public.set_updated_at();
create index idx_permission_balances_employee on public.permission_balances(employee_id, period_start);

alter table public.permission_balances enable row level security;
create policy permission_balances_select on public.permission_balances for select
  using (employee_id = public.current_employee_id() or public.is_manager_of(employee_id) or public.is_hr_or_admin());
create policy permission_balances_write on public.permission_balances for all
  using (public.is_hr_or_admin()) with check (public.is_hr_or_admin());

-- Opening balance for the current month, every active employee: 3 hours
-- (180 minutes), matching the reference app's "03:00" example. Real
-- deployments would drive this from a configurable policy the same way
-- leave_policies does for leave — flagged as a follow-up, not invented here
-- to avoid a second, unused config screen no one asked for.
insert into public.permission_balances (employee_id, period_start, period_end, opening_minutes, credited_minutes, used_minutes, balance_minutes)
select
  e.id,
  date_trunc('month', current_date)::date,
  (date_trunc('month', current_date) + interval '1 month - 1 day')::date,
  180, 0, 0, 180
from public.employees e
where e.employment_status = 'active'
on conflict (employee_id, period_start) do nothing;

-- Backfill: sync used/balance for any permission_requests already approved
-- this month before this migration ran (same reasoning as 0031's leave
-- backfill).
update public.permission_balances pb
set used_minutes = pb.used_minutes + approved.total_minutes,
    balance_minutes = pb.balance_minutes - approved.total_minutes
from (
  select employee_id, sum(duration_minutes) as total_minutes
  from public.permission_requests
  where status = 'approved'
    and permission_date >= date_trunc('month', current_date)::date
    and permission_date <= (date_trunc('month', current_date) + interval '1 month - 1 day')::date
  group by employee_id
) as approved
where pb.employee_id = approved.employee_id
  and pb.period_start = date_trunc('month', current_date)::date;

-- Deduct permission balance on approval, mirroring 0031's leave-balance
-- block exactly (row lock, negative-balance guard). Only the new permission
-- block is added here — everything else is unchanged from 0037's version.
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
  _balance_id uuid;
  _remaining numeric(6,2);
  -- Regularization -> attendance sync
  _reg_date date;
  _reg_check_in timestamptz;
  _reg_check_out timestamptz;
  _existing_check_in timestamptz;
  _existing_check_out timestamptz;
  _shift_id uuid;
  _shift_start time;
  _shift_end time;
  _grace int;
  _half_day_hours numeric;
  _full_day_hours numeric;
  _check_in_minutes int;
  _check_out_minutes int;
  _shift_start_minutes int;
  _shift_end_minutes int;
  _effective_minutes int;
  _late_minutes int;
  _early_going_minutes int;
  _excess_stay_minutes int;
  _shortfall_minutes int;
  _day_status text;
  -- Leave / onduty -> attendance sync
  _onduty_type text;
  _loop_date date;
  _onduty_remark text;
  -- Permission balance
  _permission_date date;
  _permission_minutes int;
  _perm_balance_id uuid;
  _perm_remaining int;
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

  -- Deduct the matching leave-balance period on approval only (0031).
  if _request_type = 'leave_request' and _action = 'approved' then
    select id, balance into _balance_id, _remaining
      from public.leave_balances
      where employee_id = _owner_id
        and leave_type_id = _leave_type_id
        and period_start <= _from_date and period_end >= _from_date
      for update;

    if _balance_id is not null then
      if _remaining - _duration < 0 then
        raise exception 'act_on_approval: approving this request would drive leave type % balance negative (% available, % requested)',
          _leave_type_id, _remaining, _duration;
      end if;
      update public.leave_balances
        set used = used + _duration, balance = balance - _duration
        where id = _balance_id;
    end if;
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
  -- (e.g. a stale seeded 'absent' guess) — the approved leave is now the
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

  -- Apply an approved regularization to the actual attendance row. Resolve
  -- the shift from the existing attendance row if one exists, else from the
  -- employee's active shift_assignments as of the attendance date (mirrors
  -- how seed.sql assigns shifts). Falls back to marking the day 'present'
  -- with is_regularized = true (no shift-relative metrics) if no shift can
  -- be resolved at all, rather than silently doing nothing.
  if _request_type = 'attendance_regularization' and _action = 'approved' then
    select check_in, check_out, shift_id into _existing_check_in, _existing_check_out, _shift_id
      from public.attendance where employee_id = _owner_id and attendance_date = _reg_date;

    if _shift_id is null then
      select shift_id into _shift_id from public.shift_assignments
        where employee_id = _owner_id and effective_from <= _reg_date
        order by effective_from desc limit 1;
    end if;

    _reg_check_in := coalesce(_reg_check_in, _existing_check_in);
    _reg_check_out := coalesce(_reg_check_out, _existing_check_out);

    if _shift_id is not null then
      select start_time, end_time, grace_minutes, half_day_hours, full_day_hours
        into _shift_start, _shift_end, _grace, _half_day_hours, _full_day_hours
        from public.shifts where id = _shift_id;
    end if;

    if _reg_check_in is not null and _reg_check_out is not null and _shift_id is not null then
      _check_in_minutes := extract(hour from _reg_check_in)::int * 60 + extract(minute from _reg_check_in)::int;
      _check_out_minutes := extract(hour from _reg_check_out)::int * 60 + extract(minute from _reg_check_out)::int;
      if _check_out_minutes < _check_in_minutes then
        _check_out_minutes := _check_out_minutes + 1440; -- overnight shift/punch
      end if;

      _shift_start_minutes := extract(hour from _shift_start)::int * 60 + extract(minute from _shift_start)::int;
      _shift_end_minutes := extract(hour from _shift_end)::int * 60 + extract(minute from _shift_end)::int;
      if _shift_end_minutes <= _shift_start_minutes then
        _shift_end_minutes := _shift_end_minutes + 1440;
      end if;

      _effective_minutes := _check_out_minutes - _check_in_minutes;
      _late_minutes := greatest(0, _check_in_minutes - (_shift_start_minutes + coalesce(_grace, 0)));
      _early_going_minutes := greatest(0, _shift_end_minutes - _check_out_minutes);
      _excess_stay_minutes := greatest(0, _check_out_minutes - _shift_end_minutes);
      _shortfall_minutes := greatest(0, (coalesce(_full_day_hours, 8) * 60)::int - _effective_minutes);
      _day_status := case when _effective_minutes >= (coalesce(_half_day_hours, 4.5) * 60)::int then 'present' else 'half_day' end;

      insert into public.attendance (
        organization_id, employee_id, attendance_date, shift_id, check_in, check_out,
        effective_minutes, late_minutes, early_going_minutes, excess_stay_minutes, shortfall_minutes,
        day_status, validation_status, is_regularized, remarks
      ) values (
        _org_id, _owner_id, _reg_date, _shift_id, _reg_check_in, _reg_check_out,
        _effective_minutes, _late_minutes, _early_going_minutes, _excess_stay_minutes, _shortfall_minutes,
        _day_status, 'completed', true, _remarks
      )
      on conflict (employee_id, attendance_date) do update set
        shift_id = excluded.shift_id,
        check_in = excluded.check_in,
        check_out = excluded.check_out,
        effective_minutes = excluded.effective_minutes,
        late_minutes = excluded.late_minutes,
        early_going_minutes = excluded.early_going_minutes,
        excess_stay_minutes = excluded.excess_stay_minutes,
        shortfall_minutes = excluded.shortfall_minutes,
        day_status = excluded.day_status,
        validation_status = 'completed',
        is_regularized = true,
        remarks = coalesce(excluded.remarks, public.attendance.remarks);
    else
      -- No punch times and/or no resolvable shift (e.g. a plain
      -- present_correction with nothing but "I was present" and a reason) —
      -- still record the correction rather than silently dropping it.
      insert into public.attendance (organization_id, employee_id, attendance_date, shift_id, day_status, validation_status, is_regularized, remarks)
      values (_org_id, _owner_id, _reg_date, _shift_id, 'present', 'completed', true, _remarks)
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
end;
$$;

grant execute on function public.act_on_approval(text, uuid, text, text) to authenticated;
