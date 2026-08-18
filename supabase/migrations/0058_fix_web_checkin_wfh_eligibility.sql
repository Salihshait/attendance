-- Real bug found live-testing 0057's web check-in feature for the first
-- time: get_web_checkin_status() and web_checkin_punch() both gated WFH-day
-- eligibility on `day_status = 'present' and remarks = 'Work From Home'`.
-- That combination breaks the instant an employee actually checks in --
-- recompute_attendance_day() correctly reclassifies the day as 'half_day'
-- while effective minutes are still below the half-day threshold (exactly
-- as it does for every other employee), but remarks stays 'Work From Home'
-- untouched (recompute never writes that column). So the very next call --
-- checking back in to look at status, or checking out later -- saw
-- day_status='half_day' and reported "not an approved WFH day", locking the
-- employee out of ever checking out again for the rest of the day.
--
-- Fixed by dropping the day_status requirement: remarks = 'Work From Home'
-- alone is the stable, authoritative WFH-day tag (set once by
-- act_on_approval()'s onduty_request branch, 0037, never touched by
-- recompute_attendance_day() after that) -- day_status is allowed to move
-- between 'present' and 'half_day' around it as real hours accumulate,
-- same as it already does for every punch-tracked employee.

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
    coalesce(a.remarks = 'Work From Home', false),
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

  select coalesce(remarks = 'Work From Home', false) into _is_wfh
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
