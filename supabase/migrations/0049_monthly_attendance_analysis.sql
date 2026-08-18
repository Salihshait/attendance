-- Monthly Attendance Analysis. One row per employee for the selected
-- month, aggregated from already-computed attendance columns --
-- effective/late/early/missing/shortfall/excess-stay all come straight
-- from recompute_attendance_day() (0044-0046), never recomputed here. This
-- mirrors src/lib/monthlyAnalysisEngine.ts's aggregateMonthlyAttendance()
-- exactly (see that file's tests, validated against a realistic 15-day
-- attendance record set): Working Days = calendar days that are neither a
-- holiday nor a weekly off; Present = day_status in ('present','half_day');
-- WFH/On-Duty are read via the distinguishing remark on a 'present' row,
-- matching the live schema (no separate 'wfh' status exists -- see 0037).
--
-- Comp-Off Earned/Used are returned as 0 -- Comp-Off does not exist as a
-- feature in this schema yet (a later phase). Not fabricated, flagged
-- rather than guessed at.

create or replace function public.get_monthly_attendance_summary(
  _year int,
  _month int,
  _employee_id uuid default null,
  _department_id uuid default null,
  _manager_id uuid default null,
  _location_id uuid default null
)
returns table (
  employee_id uuid,
  employee_code text,
  employee_name text,
  department_name text,
  location_name text,
  manager_name text,
  working_days int,
  present_days int,
  absent_days int,
  leave_days int,
  wfh_days int,
  on_duty_days int,
  permission_count int,
  permission_minutes int,
  late_days int,
  early_going_days int,
  missing_punch_days int,
  effective_minutes bigint,
  required_minutes bigint,
  shortfall_minutes bigint,
  excess_stay_minutes bigint,
  comp_off_earned numeric,
  comp_off_used numeric
)
language plpgsql stable security definer set search_path = public as $$
declare
  _from_date date := make_date(_year, _month, 1);
  _to_date date := (make_date(_year, _month, 1) + interval '1 month - 1 day')::date;
begin
  return query
  with scoped_employees as (
    select
      e.id, e.employee_code,
      (e.first_name || coalesce(' ' || e.last_name, '')) as full_name,
      d.name as dept_name, l.name as loc_name, e.organization_id,
      (m.first_name || coalesce(' ' || m.last_name, '')) as mgr_name
    from public.employees e
    left join public.departments d on d.id = e.department_id
    left join public.locations l on l.id = e.location_id
    left join public.employees m on m.id = e.reporting_manager_id
    where e.employment_status = 'active'
      and e.organization_id = public.current_organization_id()
      and (e.id = public.current_employee_id() or public.is_manager_of(e.id) or public.is_hr_or_admin())
      and (_employee_id is null or e.id = _employee_id)
      and (_department_id is null or e.department_id = _department_id)
      and (_manager_id is null or e.reporting_manager_id = _manager_id)
      and (_location_id is null or e.location_id = _location_id)
  ),
  calendar as (
    select se.*, gs.cal_date::date as cal_date
    from scoped_employees se
    cross join lateral generate_series(_from_date, least(_to_date, current_date), interval '1 day') as gs(cal_date)
  ),
  with_shift as (
    select c.*, s.weekoff_days, s.full_day_hours
    from calendar c
    left join lateral (
      select sa_inner.shift_id from public.shift_assignments sa_inner
      where sa_inner.employee_id = c.id and sa_inner.effective_from <= c.cal_date
      order by sa_inner.effective_from desc limit 1
    ) sa on true
    left join public.shifts s on s.id = sa.shift_id
  ),
  day_rows as (
    select
      ws.*,
      exists(select 1 from public.holidays h where h.organization_id = ws.organization_id and h.holiday_date = ws.cal_date) as is_holiday,
      coalesce(ws.weekoff_days is not null and extract(dow from ws.cal_date)::int = any(ws.weekoff_days), false) as is_weekoff,
      a.day_status, a.remarks, a.late_minutes, a.early_going_minutes,
      a.missing_in, a.missing_out, a.effective_minutes, a.shortfall_minutes, a.excess_stay_minutes
    from with_shift ws
    left join public.attendance a on a.employee_id = ws.id and a.attendance_date = ws.cal_date
  ),
  with_required as (
    select dr.*,
      case when not dr.is_holiday and not dr.is_weekoff then (coalesce(dr.full_day_hours, 8) * 60)::int else 0 end as required_minutes_for_day
    from day_rows dr
  ),
  permission_agg as (
    select pr.employee_id, count(*) as permission_count, sum(pr.duration_minutes) as permission_minutes
    from public.permission_requests pr
    where pr.status = 'approved' and pr.permission_date between _from_date and _to_date
    group by pr.employee_id
  )
  select
    wr.id,
    wr.employee_code,
    wr.full_name,
    wr.dept_name,
    wr.loc_name,
    wr.mgr_name,
    count(*) filter (where not wr.is_holiday and not wr.is_weekoff)::int as working_days,
    count(*) filter (where wr.day_status in ('present', 'half_day'))::int as present_days,
    count(*) filter (where wr.day_status = 'absent')::int as absent_days,
    count(*) filter (where wr.day_status = 'leave')::int as leave_days,
    count(*) filter (where wr.day_status = 'present' and wr.remarks = 'Work From Home')::int as wfh_days,
    count(*) filter (where wr.day_status = 'on_duty' or (wr.day_status = 'present' and wr.remarks = 'On Duty'))::int as on_duty_days,
    coalesce(max(pa.permission_count), 0)::int as permission_count,
    coalesce(max(pa.permission_minutes), 0)::int as permission_minutes,
    count(*) filter (where coalesce(wr.late_minutes, 0) > 0)::int as late_days,
    count(*) filter (where coalesce(wr.early_going_minutes, 0) > 0)::int as early_going_days,
    count(*) filter (where coalesce(wr.missing_in, false) or coalesce(wr.missing_out, false))::int as missing_punch_days,
    coalesce(sum(wr.effective_minutes), 0)::bigint as effective_minutes,
    coalesce(sum(wr.required_minutes_for_day), 0)::bigint as required_minutes,
    coalesce(sum(wr.shortfall_minutes), 0)::bigint as shortfall_minutes,
    coalesce(sum(wr.excess_stay_minutes), 0)::bigint as excess_stay_minutes,
    0::numeric as comp_off_earned,
    0::numeric as comp_off_used
  from with_required wr
  left join permission_agg pa on pa.employee_id = wr.id
  group by wr.id, wr.employee_code, wr.full_name, wr.dept_name, wr.loc_name, wr.mgr_name
  order by wr.full_name;
end;
$$;

grant execute on function public.get_monthly_attendance_summary(int, int, uuid, uuid, uuid, uuid) to authenticated;
