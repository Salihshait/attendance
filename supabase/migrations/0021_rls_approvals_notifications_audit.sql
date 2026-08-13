-- Approval engine runtime tables. Visibility follows the underlying
-- request's owner/manager/HR — see request_owner_employee_id() in
-- 0017_rls_helper_functions.sql. Actually flipping an instance to
-- approved/rejected should go through a SECURITY DEFINER RPC in a follow-up
-- session (so the step-advance + notification fire atomically); the
-- direct-update policy below is a foundation-stage stand-in.
alter table public.approval_instances enable row level security;
create policy approval_instances_select on public.approval_instances for select
  using (
    public.is_hr_or_admin()
    or public.request_owner_employee_id(request_type, request_id) = public.current_employee_id()
    or public.is_manager_of(public.request_owner_employee_id(request_type, request_id))
  );
create policy approval_instances_update on public.approval_instances for update
  using (
    public.is_hr_or_admin()
    or public.is_manager_of(public.request_owner_employee_id(request_type, request_id))
  );

alter table public.approval_actions enable row level security;
create policy approval_actions_select on public.approval_actions for select
  using (
    public.is_hr_or_admin()
    or actor_employee_id = public.current_employee_id()
    or exists (
      select 1 from public.approval_instances ai
      where ai.id = approval_instance_id
        and public.request_owner_employee_id(ai.request_type, ai.request_id) = public.current_employee_id()
    )
  );
create policy approval_actions_insert on public.approval_actions for insert
  with check (actor_employee_id = public.current_employee_id());

alter table public.notifications enable row level security;
create policy notifications_select on public.notifications for select
  using (recipient_user_id = auth.uid());
create policy notifications_update on public.notifications for update
  using (recipient_user_id = auth.uid());
create policy notifications_insert on public.notifications for insert
  with check (public.is_hr_or_admin());

-- Append-only: no update/delete policy is defined for audit_logs, so RLS
-- denies both by default even to owners.
alter table public.audit_logs enable row level security;
create policy audit_logs_select on public.audit_logs for select
  using (public.is_hr_or_admin() and organization_id = public.current_organization_id());
create policy audit_logs_insert on public.audit_logs for insert
  with check (organization_id = public.current_organization_id());
