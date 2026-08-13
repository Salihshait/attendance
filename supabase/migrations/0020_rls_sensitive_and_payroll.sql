-- Extra-sensitive data: self + HR only, never managers. The canonical
-- bank_details/statutory_details rows are only ever written by HR — an
-- employee can view their own (masked client-side) and file a change
-- request, but the approval step (HR) is what actually updates the row.

alter table public.bank_details enable row level security;
create policy bank_details_select on public.bank_details for select
  using (employee_id = public.current_employee_id() or public.is_hr_or_admin());
create policy bank_details_write on public.bank_details for all
  using (public.is_hr_or_admin()) with check (public.is_hr_or_admin());

alter table public.bank_detail_change_requests enable row level security;
create policy bank_change_requests_select on public.bank_detail_change_requests for select
  using (employee_id = public.current_employee_id() or public.is_hr_or_admin());
create policy bank_change_requests_insert on public.bank_detail_change_requests for insert
  with check (employee_id = public.current_employee_id());
create policy bank_change_requests_update on public.bank_detail_change_requests for update
  using (public.is_hr_or_admin());

alter table public.statutory_details enable row level security;
create policy statutory_details_select on public.statutory_details for select
  using (employee_id = public.current_employee_id() or public.is_hr_or_admin());
create policy statutory_details_write on public.statutory_details for all
  using (public.is_hr_or_admin()) with check (public.is_hr_or_admin());

alter table public.payslips enable row level security;
create policy payslips_select on public.payslips for select
  using (employee_id = public.current_employee_id() or public.is_hr_or_admin());
create policy payslips_write on public.payslips for all
  using (public.is_hr_or_admin()) with check (public.is_hr_or_admin());

alter table public.tax_declarations enable row level security;
create policy tax_declarations_select on public.tax_declarations for select
  using (employee_id = public.current_employee_id() or public.is_hr_or_admin());
create policy tax_declarations_write on public.tax_declarations for all
  using (employee_id = public.current_employee_id() or public.is_hr_or_admin())
  with check (employee_id = public.current_employee_id() or public.is_hr_or_admin());

-- Exit workflow: employee owns the request; their reporting manager approves
-- step 1; HR approves the final step and runs the interview.
alter table public.exit_requests enable row level security;
create policy exit_requests_select on public.exit_requests for select
  using (
    employee_id = public.current_employee_id()
    or manager_id = public.current_employee_id()
    or public.is_manager_of(employee_id)
    or public.is_hr_or_admin()
  );
create policy exit_requests_insert on public.exit_requests for insert
  with check (employee_id = public.current_employee_id());
create policy exit_requests_update on public.exit_requests for update
  using (
    employee_id = public.current_employee_id()
    or manager_id = public.current_employee_id()
    or public.is_hr_or_admin()
  );

alter table public.exit_interviews enable row level security;
create policy exit_interviews_select on public.exit_interviews for select
  using (employee_id = public.current_employee_id() or conducted_by = public.current_employee_id() or public.is_hr_or_admin());
create policy exit_interviews_write on public.exit_interviews for all
  using (public.is_hr_or_admin() or conducted_by = public.current_employee_id())
  with check (public.is_hr_or_admin() or conducted_by = public.current_employee_id());

alter table public.exit_interview_responses enable row level security;
create policy exit_interview_responses_select on public.exit_interview_responses for select
  using (
    public.is_hr_or_admin()
    or exists (
      select 1 from public.exit_interviews ei
      where ei.id = exit_interview_id
        and (ei.employee_id = public.current_employee_id() or ei.conducted_by = public.current_employee_id())
    )
  );
create policy exit_interview_responses_write on public.exit_interview_responses for all
  using (
    public.is_hr_or_admin()
    or exists (select 1 from public.exit_interviews ei where ei.id = exit_interview_id and ei.conducted_by = public.current_employee_id())
  )
  with check (
    public.is_hr_or_admin()
    or exists (select 1 from public.exit_interviews ei where ei.id = exit_interview_id and ei.conducted_by = public.current_employee_id())
  );
