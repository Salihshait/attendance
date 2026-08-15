-- employees_select (0019) let a manager read their reports, but never the
-- reverse — an employee couldn't read their OWN manager's row, which broke
-- resolving "reporting manager" for display. Add that direction.
create or replace function public.current_reporting_manager_id()
returns uuid
language sql stable security definer set search_path = public as $$
  select reporting_manager_id from public.employees where user_id = auth.uid() limit 1;
$$;

drop policy if exists employees_select on public.employees;
create policy employees_select on public.employees for select
  using (
    id = public.current_employee_id()
    or public.is_manager_of(id)
    or id = public.current_reporting_manager_id()
    or (public.is_hr_or_admin() and organization_id = public.current_organization_id())
  );
