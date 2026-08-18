-- Web check-in/out for Work From Home days. Employees already have a
-- 'web' source in attendance_punches (0006) and shifts are already
-- recomputed centrally by recompute_attendance_day() (0044-0046) -- this
-- migration wires a real employee-facing self-punch action into that
-- existing engine instead of adding a separate calculation path, per this
-- project's "centralized engine, no duplicate logic" convention.
--
-- Access is per-employee (not a single org-wide switch): HR/Admin turns
-- web_checkin_enabled on only for employees who are actually WFH-eligible,
-- toggled from the existing Employees admin screen the same way biometric
-- readers are enabled/disabled (0048's toggleable is_active pattern).
--
-- The action itself is further restricted to days already marked as an
-- approved WFH day (attendance.day_status = 'present' and
-- remarks = 'Work From Home', set by act_on_approval()'s onduty_request
-- branch, 0037) -- this is not a general-purpose self-punch button for
-- every day, only for WFH days, per the requested scope.

alter table public.employees
  add column web_checkin_enabled boolean not null default false;

-- ---------------------------------------------------------------------
-- recompute_attendance_day(): fix a guard that would silently swallow web
-- punches on a WFH day. The existing guard (0044-0046) skips recompute
-- entirely for a 'present'/'Work From Home' day whenever attendance.
-- check_in and check_out are both still null -- which was fine when WFH
-- days never had punches at all, but with web check-in now writing real
-- attendance_punches rows for exactly these days, that guard would fire on
-- the very first web punch (attendance.check_in is still null until this
-- function runs) and return before ever aggregating it, so the punch would
-- never show up as effective hours. Fixed by checking for the *existence*
-- of punch rows instead of the aggregated columns: an untouched WFH day
-- (no punches yet) still short-circuits and stays a clean override; a WFH
-- day with real web punches now falls through to the normal computation,
-- exactly like every other punch-tracked day. Full redeclare per this
-- project's convention (0044 -> 0045 -> 0046); only the guard changed.
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
  _min_break_minutes int := 10;
  _max_break_minutes int := 120;
  _break_paid boolean := false;
  _break_deduction_mode text := 'actual';
  _standard_break_minutes int := 60;
  _existing_status text;
  _existing_remarks text;
  _has_existing_punches boolean;
  _rec record;
  _open_in timestamptz;
  _first_in timestamptz;
  _last_out timestamptz;
  _prev_session_close timestamptz;
  _gap_minutes int;
  _measured_break_minutes int := 0;
  _has_excess_break boolean := false;
  _gross_minutes int := 0;
  _break_minutes int := 0;
  _effective_minutes int := 0;
  _payable_minutes int := 0;
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
  -- weekoff/leave/on_duty/permission always win over punches. An approved
  -- WFH/On-Duty day (day_status='present', remarks in ('Work From Home',
  -- 'On Duty')) also wins, but only while it has no real punches recorded
  -- yet -- once web check-in/out writes actual attendance_punches rows for
  -- that day, this falls through to the normal computation below so those
  -- punches actually count.
  select day_status, remarks
    into _existing_status, _existing_remarks
    from public.attendance where employee_id = _employee_id and attendance_date = _attendance_date;

  if _existing_status in ('leave', 'holiday', 'weekoff', 'on_duty', 'permission') then
    return;
  end if;
  if _existing_status = 'present' and _existing_remarks in ('Work From Home', 'On Duty') then
    select exists (
      select 1 from public.attendance_punches
      where employee_id = _employee_id and punch_date = _attendance_date
    ) into _has_existing_punches;
    if not _has_existing_punches then
      return;
    end if;
  end if;

  -- Resolve the employee's shift as of this date (same lookup as the old
  -- regularization branch / seed.sql). Falling back to the declared
  -- defaults above when no shift is resolvable.
  select shift_id into _shift_id from public.shift_assignments
    where employee_id = _employee_id and effective_from <= _attendance_date
    order by effective_from desc limit 1;

  if _shift_id is not null then
    select start_time, end_time, grace_minutes, half_day_hours, full_day_hours,
           min_break_minutes, max_break_minutes, break_paid, break_deduction_mode, standard_break_minutes
      into _shift_start, _shift_end, _grace, _half_day_hours, _full_day_hours,
           _min_break_minutes, _max_break_minutes, _break_paid, _break_deduction_mode, _standard_break_minutes
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
  -- orphan/invalid-sequence punch -- ignored. The gap between two
  -- consecutive *closed* sessions is classified against the break policy
  -- (not blindly deducted): too short -> bridged (not deducted at all);
  -- otherwise -> a qualifying break, and flagged if it exceeds the maximum.
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
      -- detection and the "Last OUT" display.
      _last_out := _rec.punch_time;
      if _open_in is not null then
        if _prev_session_close is not null then
          _gap_minutes := round(extract(epoch from (_open_in - _prev_session_close)) / 60)::int;
          if _gap_minutes < _min_break_minutes then
            null; -- too short to be a formal break -- bridged, not deducted
          else
            _measured_break_minutes := _measured_break_minutes + _gap_minutes;
            if _gap_minutes > _max_break_minutes then
              _has_excess_break := true;
            end if;
          end if;
        end if;
        _prev_session_close := _rec.punch_time;
        _open_in := null;
      end if;
    end if;
  end loop;

  _missing_out := _open_in is not null;
  _missing_in := _first_in is null and _last_out is not null;

  -- Gross duration spans to the last punch that actually closed a session
  -- (_prev_session_close), not the raw last OUT seen -- see 0046's header
  -- comment for why.
  if _first_in is not null and _prev_session_close is not null then
    _gross_minutes := greatest(0, round(extract(epoch from (_prev_session_close - _first_in)) / 60)::int);
  end if;

  if _break_deduction_mode = 'standard' then
    _break_minutes := case when _measured_break_minutes > 0 then _standard_break_minutes else 0 end;
  else
    _break_minutes := _measured_break_minutes;
  end if;
  _effective_minutes := greatest(0, _gross_minutes - _break_minutes);
  _payable_minutes := case when _break_paid then _effective_minutes + _break_minutes else _effective_minutes end;

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

  -- Shortfall/Excess Stay compare against payable minutes, not raw worked
  -- minutes -- a paid break still counts toward satisfying required hours.
  _shortfall_minutes := greatest(0, _full_day_minutes - _payable_minutes);
  _excess_stay_minutes := greatest(0, _payable_minutes - _full_day_minutes);

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
    gross_minutes, break_minutes, effective_minutes, payable_minutes, has_excess_break,
    late_minutes, early_going_minutes, excess_stay_minutes, shortfall_minutes,
    missing_in, missing_out, day_status, validation_status
  ) values (
    _org_id, _employee_id, _attendance_date, _shift_id, _first_in, _last_out,
    _gross_minutes, _break_minutes, _effective_minutes, _payable_minutes, _has_excess_break,
    _late_minutes, _early_going_minutes, _excess_stay_minutes, _shortfall_minutes,
    _missing_in, _missing_out, _day_status, 'completed'
  )
  on conflict (employee_id, attendance_date) do update set
    shift_id = excluded.shift_id,
    check_in = excluded.check_in,
    check_out = excluded.check_out,
    gross_minutes = excluded.gross_minutes,
    break_minutes = excluded.break_minutes,
    effective_minutes = excluded.effective_minutes,
    payable_minutes = excluded.payable_minutes,
    has_excess_break = excluded.has_excess_break,
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

-- ---------------------------------------------------------------------
-- Read side: everything the dashboard widget needs in one round trip --
-- whether this employee has web check-in access, whether today is an
-- approved WFH day, and their current punch state for today (so the UI
-- can show "Check In" vs "Check Out" and today's running effective time).
create or replace function public.get_web_checkin_status()
returns table (
  web_checkin_enabled boolean,
  is_wfh_today boolean,
  attendance_date date,
  last_punch_type text,
  last_punch_time timestamptz,
  effective_minutes int
)
language plpgsql stable security definer set search_path = public as $$
declare
  _employee_id uuid := public.current_employee_id();
  _today date := current_date;
begin
  if _employee_id is null then
    raise exception 'get_web_checkin_status: no employee linked to the current user';
  end if;

  return query
  select
    e.web_checkin_enabled,
    coalesce(a.day_status = 'present' and a.remarks = 'Work From Home', false),
    _today,
    lp.punch_type,
    lp.punch_time,
    coalesce(a.effective_minutes, 0)
  from public.employees e
  left join public.attendance a on a.employee_id = e.id and a.attendance_date = _today
  left join lateral (
    select punch_type, punch_time from public.attendance_punches
    where employee_id = e.id and punch_date = _today
    order by punch_time desc limit 1
  ) lp on true
  where e.id = _employee_id;
end;
$$;

grant execute on function public.get_web_checkin_status() to authenticated;

-- ---------------------------------------------------------------------
-- Write side: the actual self check-in/out action. Re-validates access and
-- WFH-day eligibility server-side (the client-side check mirrors this only
-- for instant button state, never as the real gate) and enforces a strict
-- in/out alternation from the last punch of the day, then delegates to
-- recompute_attendance_day() -- this function never touches attendance
-- columns directly.
create or replace function public.web_checkin_punch(_punch_type text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  _employee_id uuid := public.current_employee_id();
  _org_id uuid;
  _today date := current_date;
  _enabled boolean;
  _is_wfh boolean;
  _last_type text;
begin
  if _employee_id is null then
    raise exception 'web_checkin_punch: no employee linked to the current user';
  end if;
  if _punch_type not in ('in', 'out') then
    raise exception 'web_checkin_punch: _punch_type must be ''in'' or ''out''';
  end if;

  select organization_id, web_checkin_enabled into _org_id, _enabled
    from public.employees where id = _employee_id;

  if not coalesce(_enabled, false) then
    raise exception 'Web check-in is not enabled for your account. Contact HR.';
  end if;

  select coalesce(day_status = 'present' and remarks = 'Work From Home', false) into _is_wfh
    from public.attendance where employee_id = _employee_id and attendance_date = _today;

  if not coalesce(_is_wfh, false) then
    raise exception 'Web check-in/out is only available on an approved Work From Home day.';
  end if;

  select punch_type into _last_type from public.attendance_punches
    where employee_id = _employee_id and punch_date = _today
    order by punch_time desc limit 1;

  if _punch_type = 'in' and _last_type = 'in' then
    raise exception 'You are already checked in.';
  end if;
  if _punch_type = 'out' and (_last_type is null or _last_type = 'out') then
    raise exception 'You need to check in before checking out.';
  end if;

  insert into public.attendance_punches (organization_id, employee_id, punch_date, punch_time, punch_type, source)
  values (_org_id, _employee_id, _today, now(), _punch_type, 'web');

  perform public.recompute_attendance_day(_employee_id, _today);
end;
$$;

grant execute on function public.web_checkin_punch(text) to authenticated;
