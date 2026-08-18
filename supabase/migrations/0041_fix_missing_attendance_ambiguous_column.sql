-- Real bug found while live-verifying 0039: get_missing_attendance()'s
-- RETURNS TABLE(employee_id uuid, ...) implicitly declares an `employee_id`
-- plpgsql variable visible throughout the function body. The shift
-- resolution subquery's `where employee_id = c.id` was unqualified, so
-- Postgres couldn't tell whether that meant the OUT parameter or
-- shift_assignments.employee_id — confirmed live: calling the function
-- returned "column reference \"employee_id\" is ambiguous" (42702) instead
-- of ever executing. Fixed by qualifying it. No other logic changes.

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
    (a.id is null or (a.day_status in ('present', 'half_day') and a.check_in is null)) as missing_in,
    (a.id is null or (a.day_status in ('present', 'half_day') and a.check_out is null)) as missing_out,
    coalesce(a.day_status, 'no_record'),
    ar.status
  from candidates c
  left join public.attendance a on a.employee_id = c.id and a.attendance_date = c.cal_date
  left join public.attendance_regularizations ar
    on ar.employee_id = c.id and ar.attendance_date = c.cal_date and ar.status = 'pending'
  where a.id is null
     or (a.day_status in ('present', 'half_day') and (a.check_in is null or a.check_out is null))
  order by c.cal_date desc, c.employee_code;
end;
$$;

grant execute on function public.get_missing_attendance(date, date) to authenticated;
