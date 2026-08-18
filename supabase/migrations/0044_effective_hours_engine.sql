-- Effective Hours must be the sum of every valid IN/OUT session in a day
-- (e.g. 10:00-11:00 + 11:15-18:30 = 08:15), not a single check_out - check_in
-- subtraction. Today it's the latter, computed independently (and
-- duplicated) in three places: src/lib/attendanceCalc.ts, this function's
-- old regularization branch, and supabase/seed/seed.sql. Meanwhile
-- `attendance_punches` (the raw multi-punch log) has existed since 0006 but
-- nothing has ever aggregated it into `attendance` — it's only ever been
-- read for the "Raw In/Out Records" report. AttendanceRulesPage.tsx even has
-- a banner admitting "attendance computation does not read them yet."
--
-- This migration adds `recompute_attendance_day()`: the one function that
-- reads `attendance_punches` for a given employee/day, pairs sequential
-- in->out punches (ignoring duplicate/orphan punches, per the spec's
-- explicit requirement to handle multiple/missing/duplicate/invalid-sequence
-- punches), sums the closed pairs as effective_minutes, and derives gross
-- duration, break duration (the gaps between sessions), first-in, last-out,
-- missing-in/missing-out flags, shortfall, and the corrected excess-stay
-- formula (Effective - Required, matching the spec's worked example --
-- today's excess_stay_minutes is wrongly time-of-day-based:
-- checkout - shift_end). It never overwrites a day already claimed by an
-- override status (leave/holiday/weekoff/on_duty/permission/WFH), which is
-- what makes the spec's attendance-priority order hold structurally.
--
-- Two callers feed it: act_on_approval()'s regularization branch (writes the
-- approved correction as a synthetic 'manual' punch pair instead of
-- recomputing metrics inline) and the reseeded supabase/seed/seed.sql.
--
-- get_missing_attendance() (0039/0041) is also fixed here: it recomputed
-- "missing" via `check_in is null`/`check_out is null`, which flagged every
-- approved WFH/On-Duty day (day_status='present', check_in/check_out both
-- null by design, per 0037) as a missing punch. It now reads the stored
-- missing_in/missing_out columns instead -- since leave/WFH/on-duty days
-- never go through recompute_attendance_day, those flags stay false by
-- construction, fixing the false positive at the root.

alter table public.attendance
  add column if not exists gross_minutes integer not null default 0,
  add column if not exists break_minutes integer not null default 0,
  add column if not exists missing_in boolean not null default false,
  add column if not exists missing_out boolean not null default false;

-- Informational reference value only (spec's "Standard break = 01:00"
-- default) -- the break actually shown/used is always the computed sum of
-- gaps between real sessions, not this configured number.
alter table public.shifts
  add column if not exists standard_break_minutes smallint not null default 60;

create or replace function public.recompute_attendance_day(_employee_id uuid, _attendance_date date)
returns void
language plpgsql security definer set search_path = public as $$
declare
  _org_id uuid;
  _shift_id uuid;
  _shift_start time;
  _shift_end time;
  _grace int;
  _half_day_hours numeric;
  _full_day_hours numeric;
  _shift_start_minutes int;
  _shift_end_minutes int;
  _existing_status text;
  _existing_remarks text;
  _existing_check_in timestamptz;
  _existing_check_out timestamptz;
  _rec record;
  _open_in timestamptz;
  _first_in timestamptz;
  _last_out timestamptz;
  _effective_minutes int := 0;
  _gross_minutes int := 0;
  _break_minutes int := 0;
  _missing_in boolean := false;
  _missing_out boolean := false;
  _has_any_punch boolean := false;
  _check_in_minutes int;
  _check_out_minutes int;
  _late_minutes int := 0;
  _early_going_minutes int := 0;
  _excess_stay_minutes int := 0;
  _shortfall_minutes int := 0;
  _half_day_minutes int;
  _full_day_minutes int;
  _day_status text;
begin
  select organization_id into _org_id from public.employees where id = _employee_id;
  if _org_id is null then
    return;
  end if;

  -- Never overwrite a day already claimed by an override status -- holiday/
  -- weekoff/leave/on_duty/permission always win over punches, and an
  -- approved WFH/On-Duty day (stored as day_status='present' with
  -- check_in/check_out both null, per 0037) must stay that way too, not be
  -- flipped to 'absent' just because there are no punches to aggregate.
  select day_status, remarks, check_in, check_out
    into _existing_status, _existing_remarks, _existing_check_in, _existing_check_out
    from public.attendance where employee_id = _employee_id and attendance_date = _attendance_date;

  if _existing_status in ('leave', 'holiday', 'weekoff', 'on_duty', 'permission') then
    return;
  end if;
  if _existing_status = 'present' and _existing_remarks in ('Work From Home', 'On Duty')
     and _existing_check_in is null and _existing_check_out is null then
    return;
  end if;

  -- Resolve the employee's shift as of this date (same lookup as the old
  -- regularization branch / seed.sql).
  select shift_id into _shift_id from public.shift_assignments
    where employee_id = _employee_id and effective_from <= _attendance_date
    order by effective_from desc limit 1;

  if _shift_id is not null then
    select start_time, end_time, grace_minutes, half_day_hours, full_day_hours
      into _shift_start, _shift_end, _grace, _half_day_hours, _full_day_hours
      from public.shifts where id = _shift_id;
    _shift_start_minutes := extract(hour from _shift_start)::int * 60 + extract(minute from _shift_start)::int;
    _shift_end_minutes := extract(hour from _shift_end)::int * 60 + extract(minute from _shift_end)::int;
    if _shift_end_minutes <= _shift_start_minutes then
      _shift_end_minutes := _shift_end_minutes + 1440; -- overnight shift
    end if;
  end if;

  -- Walk punches for this day in time order, pairing sequential in->out.
  -- `attendance_punches.punch_date` is always the shift's logical start day
  -- (the seed/regularization convention -- an overnight punch_time still
  -- rolls into the real next calendar day, but punch_date stays put), so no
  -- day+1 lookahead is needed; ordering by the real punch_time timestamptz
  -- keeps chronological order regardless.
  --
  -- A second consecutive 'in' before a matching 'out' is a duplicate --
  -- ignored, the earlier 'in' stays open. An 'out' with no open 'in' is an
  -- orphan/invalid-sequence punch -- ignored. This is the spec's explicit
  -- multiple/missing/duplicate/invalid-sequence handling.
  for _rec in
    select punch_time, punch_type from public.attendance_punches
    where employee_id = _employee_id and punch_date = _attendance_date
    order by punch_time
  loop
    _has_any_punch := true;
    if _rec.punch_type = 'in' then
      if _first_in is null then
        _first_in := _rec.punch_time;
      end if;
      if _open_in is null then
        _open_in := _rec.punch_time;
      end if;
    else -- 'out'
      -- Track the latest 'out' seen regardless of whether it closes a valid
      -- pair, so an orphan out (no open 'in') still counts for missing_in
      -- detection and the "Last OUT" display -- only effective_minutes
      -- requires a real closed pair.
      _last_out := _rec.punch_time;
      if _open_in is not null then
        _effective_minutes := _effective_minutes + round(extract(epoch from (_rec.punch_time - _open_in)) / 60)::int;
        _open_in := null;
      end if;
    end if;
  end loop;

  _missing_out := _open_in is not null;
  _missing_in := _first_in is null and _last_out is not null;

  if _first_in is not null and _last_out is not null then
    _gross_minutes := greatest(0, round(extract(epoch from (_last_out - _first_in)) / 60)::int);
  end if;
  _break_minutes := greatest(0, _gross_minutes - _effective_minutes);

  _half_day_minutes := (coalesce(_half_day_hours, 4.5) * 60)::int;
  _full_day_minutes := (coalesce(_full_day_hours, 8) * 60)::int;

  if _first_in is not null and _shift_id is not null then
    _check_in_minutes := extract(hour from _first_in)::int * 60 + extract(minute from _first_in)::int;
    _late_minutes := greatest(0, _check_in_minutes - (_shift_start_minutes + coalesce(_grace, 0)));
  end if;
  if _last_out is not null and _shift_id is not null then
    _check_out_minutes := extract(hour from _last_out)::int * 60 + extract(minute from _last_out)::int;
    if _check_in_minutes is not null and _check_out_minutes < _check_in_minutes then
      _check_out_minutes := _check_out_minutes + 1440; -- rolled past midnight
    end if;
    _early_going_minutes := greatest(0, _shift_end_minutes - _check_out_minutes);
  end if;

  _shortfall_minutes := greatest(0, _full_day_minutes - _effective_minutes);
  _excess_stay_minutes := greatest(0, _effective_minutes - _full_day_minutes);

  if not _has_any_punch then
    _day_status := 'absent';
  elsif _effective_minutes >= _half_day_minutes then
    _day_status := 'present';
  else
    -- Any real punch activity that isn't (yet) a complete, full-day pair --
    -- including an unmatched open 'in' with zero effective minutes -- stays
    -- visible to get_missing_attendance() (which only reports
    -- present/half_day rows), rather than disappearing into 'absent'.
    _day_status := 'half_day';
  end if;

  insert into public.attendance (
    organization_id, employee_id, attendance_date, shift_id, check_in, check_out,
    gross_minutes, break_minutes, effective_minutes, late_minutes, early_going_minutes,
    excess_stay_minutes, shortfall_minutes, missing_in, missing_out, day_status, validation_status
  ) values (
    _org_id, _employee_id, _attendance_date, _shift_id, _first_in, _last_out,
    _gross_minutes, _break_minutes, _effective_minutes, _late_minutes, _early_going_minutes,
    _excess_stay_minutes, _shortfall_minutes, _missing_in, _missing_out, _day_status, 'completed'
  )
  on conflict (employee_id, attendance_date) do update set
    shift_id = excluded.shift_id,
    check_in = excluded.check_in,
    check_out = excluded.check_out,
    gross_minutes = excluded.gross_minutes,
    break_minutes = excluded.break_minutes,
    effective_minutes = excluded.effective_minutes,
    late_minutes = excluded.late_minutes,
    early_going_minutes = excluded.early_going_minutes,
    excess_stay_minutes = excluded.excess_stay_minutes,
    shortfall_minutes = excluded.shortfall_minutes,
    missing_in = excluded.missing_in,
    missing_out = excluded.missing_out,
    day_status = excluded.day_status,
    validation_status = 'completed';
end;
$$;

grant execute on function public.recompute_attendance_day(uuid, date) to authenticated;

-- Defensive backfill: every pre-existing present/half_day row was written by
-- the old single-pair formula, which always set check_in and check_out
-- together (or neither) -- except the WFH/On-Duty rows this migration's fix
-- targets, which must stay excluded (false). Harmless no-op for rows this
-- doesn't apply to.
update public.attendance
  set missing_in = (check_in is null), missing_out = (check_out is null)
  where day_status in ('present', 'half_day')
    and not (remarks in ('Work From Home', 'On Duty') and check_in is null and check_out is null);

-- Full redeclare required (see 0037/0038/0043 -- create or replace function
-- needs the whole body every time). Every branch is unchanged from 0043
-- except the regularization arm, which now writes the approved correction
-- as synthetic 'manual' punches and delegates to recompute_attendance_day()
-- instead of computing shift-relative metrics inline -- so a regularization
-- composes correctly with any other real punches that day instead of
-- overwriting the whole day's numbers, and shares the exact same
-- multi-session/duplicate/invalid-sequence handling as everywhere else.
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
end;
$$;

grant execute on function public.act_on_approval(text, uuid, text, text) to authenticated;

-- Full redeclare from 0041 -- only the missing_in/missing_out computation
-- changes (reads the stored columns instead of recomputing null-checks),
-- which is the actual fix for the WFH/On-Duty false-positive bug described
-- above. Everything else (scoping, holiday/weekoff exclusion, ordering) is
-- unchanged.
create or replace function public.get_missing_attendance(_from_date date, _to_date date)
returns table (
  employee_id uuid,
  employee_code text,
  employee_name text,
  department_name text,
  location_name text,
  attendance_date date,
  shift_name text,
  shift_start_time time,
  shift_end_time time,
  missing_in boolean,
  missing_out boolean,
  day_status text,
  regularization_status text
)
language plpgsql stable security definer set search_path = public as $$
begin
  return query
  with scoped_employees as (
    select
      e.id,
      e.employee_code,
      (e.first_name || coalesce(' ' || e.last_name, '')) as full_name,
      d.name as dept_name,
      l.name as loc_name,
      e.organization_id
    from public.employees e
    left join public.departments d on d.id = e.department_id
    left join public.locations l on l.id = e.location_id
    where e.employment_status = 'active'
      and e.organization_id = public.current_organization_id()
      and (
        e.id = public.current_employee_id()
        or public.is_manager_of(e.id)
        or public.is_hr_or_admin()
      )
  ),
  calendar as (
    select se.*, gs.cal_date::date as cal_date
    from scoped_employees se
    cross join lateral generate_series(_from_date, least(_to_date, current_date), interval '1 day') as gs(cal_date)
  ),
  with_shift as (
    select
      c.*,
      s.name as shift_name,
      s.start_time,
      s.end_time,
      s.weekoff_days
    from calendar c
    left join lateral (
      select sa_inner.shift_id from public.shift_assignments sa_inner
      where sa_inner.employee_id = c.id and sa_inner.effective_from <= c.cal_date
      order by sa_inner.effective_from desc limit 1
    ) sa on true
    left join public.shifts s on s.id = sa.shift_id
  ),
  candidates as (
    select ws.*
    from with_shift ws
    where not exists (
      select 1 from public.holidays h
      where h.organization_id = ws.organization_id and h.holiday_date = ws.cal_date
    )
    and (ws.weekoff_days is null or not (extract(dow from ws.cal_date)::int = any(ws.weekoff_days)))
  )
  select
    c.id,
    c.employee_code,
    c.full_name,
    c.dept_name,
    c.loc_name,
    c.cal_date,
    c.shift_name,
    c.start_time,
    c.end_time,
    coalesce(a.missing_in, true) as missing_in,
    coalesce(a.missing_out, true) as missing_out,
    coalesce(a.day_status, 'no_record'),
    ar.status
  from candidates c
  left join public.attendance a on a.employee_id = c.id and a.attendance_date = c.cal_date
  left join public.attendance_regularizations ar
    on ar.employee_id = c.id and ar.attendance_date = c.cal_date and ar.status = 'pending'
  where a.id is null
     or (a.day_status in ('present', 'half_day') and (a.missing_in or a.missing_out))
  order by c.cal_date desc, c.employee_code;
end;
$$;

grant execute on function public.get_missing_attendance(date, date) to authenticated;
