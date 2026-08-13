-- Core "self / manager-of-team / HR-org-wide / admin" access pattern used
-- throughout the app. Note: RLS is row-level, not column-level — endpoints
-- that must hide specific fields from a visible row (e.g. an employee's own
-- salary-adjacent fields from their manager) should read through a view or
-- RPC that projects only the allowed columns, layered on top of these
-- policies rather than replacing them.

alter table public.employees enable row level security;
create policy employees_select on public.employees for select
  using (
    id = public.current_employee_id()
    or public.is_manager_of(id)
    or (public.is_hr_or_admin() and organization_id = public.current_organization_id())
  );
create policy employees_update on public.employees for update
  using (id = public.current_employee_id() or (public.is_hr_or_admin() and organization_id = public.current_organization_id()));
create policy employees_insert on public.employees for insert
  with check (public.is_hr_or_admin() and organization_id = public.current_organization_id());
create policy employees_delete on public.employees for delete
  using (public.is_hr_or_admin() and organization_id = public.current_organization_id());

alter table public.employee_profiles enable row level security;
create policy employee_profiles_select on public.employee_profiles for select
  using (
    employee_id = public.current_employee_id()
    or public.is_manager_of(employee_id)
    or public.is_hr_or_admin()
  );
create policy employee_profiles_write on public.employee_profiles for all
  using (employee_id = public.current_employee_id() or public.is_hr_or_admin())
  with check (employee_id = public.current_employee_id() or public.is_hr_or_admin());

alter table public.shift_assignments enable row level security;
create policy shift_assignments_select on public.shift_assignments for select
  using (
    employee_id = public.current_employee_id()
    or public.is_manager_of(employee_id)
    or public.is_hr_or_admin()
  );
create policy shift_assignments_write on public.shift_assignments for all
  using (public.is_hr_or_admin()) with check (public.is_hr_or_admin());

alter table public.attendance enable row level security;
create policy attendance_select on public.attendance for select
  using (
    employee_id = public.current_employee_id()
    or public.is_manager_of(employee_id)
    or public.is_hr_or_admin()
  );
create policy attendance_write on public.attendance for all
  using (public.is_hr_or_admin()) with check (public.is_hr_or_admin());

alter table public.attendance_punches enable row level security;
create policy attendance_punches_select on public.attendance_punches for select
  using (
    employee_id = public.current_employee_id()
    or public.is_manager_of(employee_id)
    or public.is_hr_or_admin()
  );
create policy attendance_punches_write on public.attendance_punches for all
  using (public.is_hr_or_admin()) with check (public.is_hr_or_admin());

-- Employee-initiated request tables: self can create/view/cancel own,
-- manager can view + act on their team's, HR can do anything in-org.
alter table public.attendance_regularizations enable row level security;
create policy attendance_regularizations_select on public.attendance_regularizations for select
  using (employee_id = public.current_employee_id() or public.is_manager_of(employee_id) or public.is_hr_or_admin());
create policy attendance_regularizations_insert on public.attendance_regularizations for insert
  with check (employee_id = public.current_employee_id() or public.is_hr_or_admin());
create policy attendance_regularizations_update on public.attendance_regularizations for update
  using (employee_id = public.current_employee_id() or public.is_manager_of(employee_id) or public.is_hr_or_admin());

alter table public.leave_balances enable row level security;
create policy leave_balances_select on public.leave_balances for select
  using (employee_id = public.current_employee_id() or public.is_manager_of(employee_id) or public.is_hr_or_admin());
create policy leave_balances_write on public.leave_balances for all
  using (public.is_hr_or_admin()) with check (public.is_hr_or_admin());

alter table public.leave_requests enable row level security;
create policy leave_requests_select on public.leave_requests for select
  using (employee_id = public.current_employee_id() or public.is_manager_of(employee_id) or public.is_hr_or_admin());
create policy leave_requests_insert on public.leave_requests for insert
  with check (employee_id = public.current_employee_id() or public.is_hr_or_admin());
create policy leave_requests_update on public.leave_requests for update
  using (employee_id = public.current_employee_id() or public.is_manager_of(employee_id) or public.is_hr_or_admin());

alter table public.permission_requests enable row level security;
create policy permission_requests_select on public.permission_requests for select
  using (employee_id = public.current_employee_id() or public.is_manager_of(employee_id) or public.is_hr_or_admin());
create policy permission_requests_insert on public.permission_requests for insert
  with check (employee_id = public.current_employee_id() or public.is_hr_or_admin());
create policy permission_requests_update on public.permission_requests for update
  using (employee_id = public.current_employee_id() or public.is_manager_of(employee_id) or public.is_hr_or_admin());

alter table public.onduty_requests enable row level security;
create policy onduty_requests_select on public.onduty_requests for select
  using (employee_id = public.current_employee_id() or public.is_manager_of(employee_id) or public.is_hr_or_admin());
create policy onduty_requests_insert on public.onduty_requests for insert
  with check (employee_id = public.current_employee_id() or public.is_hr_or_admin());
create policy onduty_requests_update on public.onduty_requests for update
  using (employee_id = public.current_employee_id() or public.is_manager_of(employee_id) or public.is_hr_or_admin());

-- Personal records: self + HR only. Managers have no reason to see a
-- report's family/education/prior-employment details.
alter table public.family_members enable row level security;
create policy family_members_all on public.family_members for all
  using (employee_id = public.current_employee_id() or public.is_hr_or_admin())
  with check (employee_id = public.current_employee_id() or public.is_hr_or_admin());

alter table public.education_records enable row level security;
create policy education_records_all on public.education_records for all
  using (employee_id = public.current_employee_id() or public.is_hr_or_admin())
  with check (employee_id = public.current_employee_id() or public.is_hr_or_admin());

alter table public.previous_employment enable row level security;
create policy previous_employment_all on public.previous_employment for all
  using (employee_id = public.current_employee_id() or public.is_hr_or_admin())
  with check (employee_id = public.current_employee_id() or public.is_hr_or_admin());

alter table public.employee_documents enable row level security;
create policy employee_documents_all on public.employee_documents for all
  using (employee_id = public.current_employee_id() or public.is_hr_or_admin())
  with check (employee_id = public.current_employee_id() or public.is_hr_or_admin());
