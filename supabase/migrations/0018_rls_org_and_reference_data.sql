-- Organization-scoped reference/config data: readable by any authenticated
-- member of the organization, writable only by HR admins and above.

alter table public.organizations enable row level security;
create policy organizations_select on public.organizations for select
  using (id = public.current_organization_id());
create policy organizations_update on public.organizations for update
  using (id = public.current_organization_id() and public.has_role('super_admin'));

alter table public.profiles enable row level security;
create policy profiles_select_self on public.profiles for select
  using (id = auth.uid() or public.is_hr_or_admin());
create policy profiles_update_self on public.profiles for update
  using (id = auth.uid() or public.is_hr_or_admin());

alter table public.roles enable row level security;
create policy roles_select_all on public.roles for select using (auth.uid() is not null);

alter table public.permissions enable row level security;
create policy permissions_select_all on public.permissions for select using (auth.uid() is not null);

alter table public.role_permissions enable row level security;
create policy role_permissions_select_all on public.role_permissions for select using (auth.uid() is not null);
create policy role_permissions_manage on public.role_permissions for all
  using (public.has_role('super_admin')) with check (public.has_role('super_admin'));

alter table public.user_roles enable row level security;
create policy user_roles_select on public.user_roles for select
  using (user_id = auth.uid() or public.is_hr_or_admin());
create policy user_roles_manage on public.user_roles for all
  using (public.has_role('super_admin')) with check (public.has_role('super_admin'));

-- Reusable macro-by-hand: same four policies (select-all-in-org, insert/update/delete-hr-only)
-- repeated per reference table below.

alter table public.locations enable row level security;
create policy locations_select on public.locations for select
  using (organization_id = public.current_organization_id());
create policy locations_write on public.locations for all
  using (organization_id = public.current_organization_id() and public.is_hr_or_admin())
  with check (organization_id = public.current_organization_id() and public.is_hr_or_admin());

alter table public.departments enable row level security;
create policy departments_select on public.departments for select
  using (organization_id = public.current_organization_id());
create policy departments_write on public.departments for all
  using (organization_id = public.current_organization_id() and public.is_hr_or_admin())
  with check (organization_id = public.current_organization_id() and public.is_hr_or_admin());

alter table public.designations enable row level security;
create policy designations_select on public.designations for select
  using (organization_id = public.current_organization_id());
create policy designations_write on public.designations for all
  using (organization_id = public.current_organization_id() and public.is_hr_or_admin())
  with check (organization_id = public.current_organization_id() and public.is_hr_or_admin());

alter table public.grades enable row level security;
create policy grades_select on public.grades for select
  using (organization_id = public.current_organization_id());
create policy grades_write on public.grades for all
  using (organization_id = public.current_organization_id() and public.is_hr_or_admin())
  with check (organization_id = public.current_organization_id() and public.is_hr_or_admin());

alter table public.shifts enable row level security;
create policy shifts_select on public.shifts for select
  using (organization_id = public.current_organization_id());
create policy shifts_write on public.shifts for all
  using (organization_id = public.current_organization_id() and public.is_hr_or_admin())
  with check (organization_id = public.current_organization_id() and public.is_hr_or_admin());

alter table public.leave_types enable row level security;
create policy leave_types_select on public.leave_types for select
  using (organization_id = public.current_organization_id());
create policy leave_types_write on public.leave_types for all
  using (organization_id = public.current_organization_id() and public.is_hr_or_admin())
  with check (organization_id = public.current_organization_id() and public.is_hr_or_admin());

alter table public.leave_policies enable row level security;
create policy leave_policies_select on public.leave_policies for select
  using (organization_id = public.current_organization_id());
create policy leave_policies_write on public.leave_policies for all
  using (organization_id = public.current_organization_id() and public.is_hr_or_admin())
  with check (organization_id = public.current_organization_id() and public.is_hr_or_admin());

alter table public.holidays enable row level security;
create policy holidays_select on public.holidays for select
  using (organization_id = public.current_organization_id());
create policy holidays_write on public.holidays for all
  using (organization_id = public.current_organization_id() and public.is_hr_or_admin())
  with check (organization_id = public.current_organization_id() and public.is_hr_or_admin());

alter table public.documents enable row level security;
create policy documents_select on public.documents for select
  using (organization_id = public.current_organization_id());
create policy documents_write on public.documents for all
  using (organization_id = public.current_organization_id() and public.is_hr_or_admin())
  with check (organization_id = public.current_organization_id() and public.is_hr_or_admin());

alter table public.exit_interview_questions enable row level security;
create policy exit_interview_questions_select on public.exit_interview_questions for select
  using (organization_id = public.current_organization_id());
create policy exit_interview_questions_write on public.exit_interview_questions for all
  using (organization_id = public.current_organization_id() and public.is_hr_or_admin())
  with check (organization_id = public.current_organization_id() and public.is_hr_or_admin());

alter table public.system_settings enable row level security;
create policy system_settings_select on public.system_settings for select
  using (organization_id = public.current_organization_id() and public.is_hr_or_admin());
create policy system_settings_write on public.system_settings for all
  using (organization_id = public.current_organization_id() and public.has_role('super_admin'))
  with check (organization_id = public.current_organization_id() and public.has_role('super_admin'));

alter table public.approval_workflows enable row level security;
create policy approval_workflows_select on public.approval_workflows for select
  using (organization_id = public.current_organization_id() and public.is_hr_or_admin());
create policy approval_workflows_write on public.approval_workflows for all
  using (organization_id = public.current_organization_id() and public.is_hr_or_admin())
  with check (organization_id = public.current_organization_id() and public.is_hr_or_admin());

alter table public.approval_steps enable row level security;
create policy approval_steps_select on public.approval_steps for select
  using (
    public.is_hr_or_admin()
    and exists (
      select 1 from public.approval_workflows w
      where w.id = workflow_id and w.organization_id = public.current_organization_id()
    )
  );
create policy approval_steps_write on public.approval_steps for all
  using (
    public.is_hr_or_admin()
    and exists (
      select 1 from public.approval_workflows w
      where w.id = workflow_id and w.organization_id = public.current_organization_id()
    )
  )
  with check (
    exists (
      select 1 from public.approval_workflows w
      where w.id = workflow_id and w.organization_id = public.current_organization_id()
    )
  );
