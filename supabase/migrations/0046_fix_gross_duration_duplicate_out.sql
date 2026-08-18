-- Real bug found while building comprehensive tests for the TS mirror
-- (src/lib/attendanceCalc.ts's computeSessionsFromPunches): gross_minutes
-- was computed as `_last_out - _first_in`, where `_last_out` is updated on
-- *every* OUT punch seen -- including a spurious duplicate/orphan OUT that
-- doesn't close any session (e.g. a card reader double-scanning on exit:
-- IN 09:30, OUT 18:30, OUT 18:35). That extra 5 minutes was silently
-- inflating gross_minutes (and, since effective_minutes = gross - break,
-- effective_minutes too) even though no work happened in that window and no
-- break was measured for it either -- the gross/effective/break identity
-- quietly broke for exactly this duplicate-punch case.
--
-- Fix: gross_minutes now spans to the last punch that actually *closed* a
-- session (_prev_session_close's final value), not the raw last OUT seen.
-- check_in/check_out (used for "First IN"/"Last OUT" display) are
-- unchanged -- they still show the raw last punch, since that's real
-- evidence worth surfacing even when it's anomalous; only the gross/
-- effective/break arithmetic is corrected.

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
  _existing_check_in timestamptz;
  _existing_check_out timestamptz;
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
  -- (_prev_session_close), not the raw last OUT seen -- see this
  -- migration's header comment for why.
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
