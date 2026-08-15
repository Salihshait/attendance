-- Real gap found during a production-readiness audit's "indexes" check:
-- Postgres does not automatically index foreign-key columns (only the
-- referenced PK side gets one for free). Across 34 migrations of organic
-- growth, 53 FK columns ended up with no covering index at all — including
-- several that RLS policies filter/join on directly on nearly every
-- request (organization_id scoping, employee_id ownership checks,
-- manager_id/reporting_manager_id used by is_manager_of()'s chain walk).
-- All additions below are purely additive (create index if not exists) —
-- no data or behavior change, safe to run at any time.

-- ================= Identity/ownership + directly RLS-filtered columns =================
create index if not exists idx_profiles_org on public.profiles(organization_id);
create index if not exists idx_attendance_punches_org on public.attendance_punches(organization_id);
create index if not exists idx_attendance_regularizations_org on public.attendance_regularizations(organization_id);
create index if not exists idx_leave_policies_org on public.leave_policies(organization_id);
create index if not exists idx_leave_requests_org on public.leave_requests(organization_id);
create index if not exists idx_permission_requests_org on public.permission_requests(organization_id);
create index if not exists idx_onduty_requests_org on public.onduty_requests(organization_id);
create index if not exists idx_exit_requests_org on public.exit_requests(organization_id);
create index if not exists idx_exit_interview_questions_org on public.exit_interview_questions(organization_id);
create index if not exists idx_approval_workflows_org on public.approval_workflows(organization_id);
create index if not exists idx_notifications_org on public.notifications(organization_id);
create index if not exists idx_other_requests_org on public.other_requests(organization_id);
create index if not exists idx_user_roles_org on public.user_roles(organization_id);

create index if not exists idx_bank_detail_change_requests_employee on public.bank_detail_change_requests(employee_id);
create index if not exists idx_exit_interviews_employee on public.exit_interviews(employee_id);
create index if not exists idx_exit_requests_manager on public.exit_requests(manager_id);
create index if not exists idx_onduty_requests_manager on public.onduty_requests(reporting_manager_id, status);
create index if not exists idx_approval_actions_actor on public.approval_actions(actor_employee_id);
create index if not exists idx_exit_interviews_conducted_by on public.exit_interviews(conducted_by);

-- ================= Reference-data FKs (joins/lookups, moderate traffic) =================
create index if not exists idx_role_permissions_permission on public.role_permissions(permission_id);
create index if not exists idx_user_roles_role on public.user_roles(role_id);
create index if not exists idx_employees_designation on public.employees(designation_id);
create index if not exists idx_employees_location on public.employees(location_id);
create index if not exists idx_employees_grade on public.employees(grade_id);
create index if not exists idx_shift_assignments_shift on public.shift_assignments(shift_id);
create index if not exists idx_attendance_shift on public.attendance(shift_id);
create index if not exists idx_leave_policies_leave_type on public.leave_policies(leave_type_id);
create index if not exists idx_leave_policies_grade on public.leave_policies(grade_id);
create index if not exists idx_leave_balances_leave_type on public.leave_balances(leave_type_id);
create index if not exists idx_leave_requests_leave_type on public.leave_requests(leave_type_id);
create index if not exists idx_holidays_location on public.holidays(location_id);
create index if not exists idx_employee_documents_document_type on public.employee_documents(document_type_id);
create index if not exists idx_education_records_certificate_document on public.education_records(certificate_document_id);
create index if not exists idx_previous_employment_document on public.previous_employment(document_id);
create index if not exists idx_payslips_document on public.payslips(document_id);
create index if not exists idx_exit_interview_responses_question on public.exit_interview_responses(question_id);
create index if not exists idx_approval_instances_workflow on public.approval_instances(workflow_id);
create index if not exists idx_previous_employer_declarations_document on public.previous_employer_declarations(supporting_document_id);
create index if not exists idx_departments_head_employee on public.departments(head_employee_id);
create index if not exists idx_designations_grade on public.designations(grade_id);
create index if not exists idx_designations_department on public.designations(department_id);

-- ================= Audit-trail actor FKs (rarely filtered on, still worth covering) =================
create index if not exists idx_attendance_regularizations_approver on public.attendance_regularizations(approver_id);
create index if not exists idx_leave_requests_entry_by on public.leave_requests(entry_by);
create index if not exists idx_permission_requests_entry_by on public.permission_requests(entry_by);
create index if not exists idx_onduty_requests_entry_by on public.onduty_requests(entry_by);
create index if not exists idx_other_requests_entry_by on public.other_requests(entry_by);
create index if not exists idx_bank_detail_change_requests_approver on public.bank_detail_change_requests(approver_id);
create index if not exists idx_employee_documents_verified_by on public.employee_documents(verified_by);
create index if not exists idx_exit_requests_hr_approver on public.exit_requests(hr_approver_id);
create index if not exists idx_exit_clearances_cleared_by on public.exit_clearances(cleared_by);
create index if not exists idx_exit_settlements_released_by on public.exit_settlements(released_by);
create index if not exists idx_policy_documents_uploaded_by on public.policy_documents(uploaded_by);
create index if not exists idx_approval_steps_approver on public.approval_steps(approver_employee_id);
