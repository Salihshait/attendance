-- Database hardening pass: closes gaps found by auditing the existing
-- schema (0001-0029) against the full HRMS data-governance spec. This is
-- NOT a rebuild — every requested table already exists (see
-- supabase/DATABASE.md for the full inventory and naming-deviation
-- rationale). This migration closes six specific, verified gaps:
--   a) employees can self-approve their own leave/permission/regularization/
--      onduty/other requests via a direct client update (no status check)
--   b) bank_details/statutory_details grant the owning employee raw,
--      unmasked SELECT on the base table, bypassing the masking RPCs
--   c) employees can be hard-deleted, cascading through ~15 dependent
--      tables with no legitimate caller (the UI only ever deactivates)
--   d) created_by/updated_by columns exist but are never populated
--   e) audit_logs is only written by 3 RPCs; most sensitive writes leave
--      no audit trail at all
--   f) permissions/role_permissions exist but are empty and unused

-- ============================================================
-- a) Employees cannot move their own request past pending/draft/cancelled.
-- Mirrors exit_requests_update's fix in 0027 for the same class of bug.
-- The legitimate approval path (act_on_approval(), SECURITY DEFINER, owned
-- by the table owner) already bypasses RLS entirely and is unaffected —
-- this only closes the direct-client-write loophole.
-- ============================================================

drop policy if exists leave_requests_update on public.leave_requests;
create policy leave_requests_update on public.leave_requests for update
  using (employee_id = public.current_employee_id() or public.is_manager_of(employee_id) or public.is_hr_or_admin())
  with check (
    public.is_hr_or_admin()
    or public.is_manager_of(employee_id)
    or (employee_id = public.current_employee_id() and status in ('draft', 'pending', 'cancelled'))
  );

drop policy if exists permission_requests_update on public.permission_requests;
create policy permission_requests_update on public.permission_requests for update
  using (employee_id = public.current_employee_id() or public.is_manager_of(employee_id) or public.is_hr_or_admin())
  with check (
    public.is_hr_or_admin()
    or public.is_manager_of(employee_id)
    or (employee_id = public.current_employee_id() and status in ('draft', 'pending', 'cancelled'))
  );

drop policy if exists attendance_regularizations_update on public.attendance_regularizations;
create policy attendance_regularizations_update on public.attendance_regularizations for update
  using (employee_id = public.current_employee_id() or public.is_manager_of(employee_id) or public.is_hr_or_admin())
  with check (
    public.is_hr_or_admin()
    or public.is_manager_of(employee_id)
    or (employee_id = public.current_employee_id() and status in ('draft', 'pending', 'cancelled'))
  );

drop policy if exists onduty_requests_update on public.onduty_requests;
create policy onduty_requests_update on public.onduty_requests for update
  using (employee_id = public.current_employee_id() or public.is_manager_of(employee_id) or public.is_hr_or_admin())
  with check (
    public.is_hr_or_admin()
    or public.is_manager_of(employee_id)
    or (employee_id = public.current_employee_id() and status in ('draft', 'pending', 'cancelled'))
  );

drop policy if exists other_requests_update on public.other_requests;
create policy other_requests_update on public.other_requests for update
  using (employee_id = public.current_employee_id() or public.is_manager_of(employee_id) or public.is_hr_or_admin())
  with check (
    public.is_hr_or_admin()
    or public.is_manager_of(employee_id)
    or (employee_id = public.current_employee_id() and status in ('draft', 'pending', 'cancelled'))
  );

-- ============================================================
-- b) Bank/statutory details: employees read their own data exclusively
-- through get_my_bank_details()/get_my_statutory_details() (0026), which
-- are SECURITY DEFINER and mask PAN/Aadhaar/account number before
-- returning — those RPCs read the raw table directly and are unaffected
-- by this change. Nothing in src/ queries these tables directly (verified),
-- so removing the employee-self SELECT branch only closes the bypass path.
-- ============================================================

drop policy if exists bank_details_select on public.bank_details;
create policy bank_details_select on public.bank_details for select
  using (public.is_hr_or_admin());

drop policy if exists statutory_details_select on public.statutory_details;
create policy statutory_details_select on public.statutory_details for select
  using (public.is_hr_or_admin());

-- ============================================================
-- c) No legitimate caller hard-deletes an employee (the Admin UI only
-- flips employment_status to 'inactive'); ~15 dependent tables reference
-- employee_id with on delete cascade, so a raw client DELETE here would
-- silently wipe a person's entire attendance/leave/payslip/bank history.
-- Remove the policy entirely — RLS default-denies with no policy present.
-- ============================================================

drop policy if exists employees_delete on public.employees;

-- ============================================================
-- d) Auto-populate created_by/updated_by at the DB layer. The app has
-- never set these columns from any hook across 5 sessions (verified via
-- grep) — a trigger is strictly more reliable than relying on every future
-- insert/update call site to remember.
-- ============================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  if to_jsonb(new) ? 'updated_by' then
    new.updated_by = public.current_employee_id();
  end if;
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'Stamps updated_at = now() (and updated_by, when the column exists) on every UPDATE. Attached as a BEFORE UPDATE trigger per table.';

create or replace function public.set_created_by()
returns trigger
language plpgsql
as $$
begin
  new.created_by = coalesce(new.created_by, public.current_employee_id());
  return new;
end;
$$;

comment on function public.set_created_by() is
  'Stamps created_by = current_employee_id() on INSERT unless already provided. Attached as a BEFORE INSERT trigger per table with a created_by column.';

-- Auto-discover every table with a created_by column rather than
-- hand-maintaining a list that will go stale as new tables are added.
do $$
declare
  r record;
begin
  for r in
    select table_name from information_schema.columns
    where table_schema = 'public' and column_name = 'created_by'
  loop
    execute format('drop trigger if exists trg_%s_created_by on public.%I', r.table_name, r.table_name);
    execute format(
      'create trigger trg_%s_created_by before insert on public.%I for each row execute function public.set_created_by()',
      r.table_name, r.table_name
    );
  end loop;
end;
$$;

-- ============================================================
-- e) Generic audit trigger for sensitive tables. Only 3 RPCs wrote
-- audit_logs before this (act_on_approval, get_my_bank_details,
-- get_my_statutory_details) — every direct client write (most CRUD,
-- including the entire Admin module) left zero trail. Full before/after
-- row snapshots are safe to store here because audit_logs is already
-- HR-admin-only-readable — the same people who can already read the
-- source tables directly.
-- ============================================================

create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _row jsonb;
  _org_id uuid;
  _action text;
  _record_id uuid;
begin
  _row := to_jsonb(coalesce(new, old));
  _action := case TG_OP when 'INSERT' then 'create' when 'UPDATE' then 'update' when 'DELETE' then 'delete' end;
  _record_id := case TG_OP when 'DELETE' then old.id else new.id end;
  _org_id := case
    when _row ? 'organization_id' and _row->>'organization_id' is not null then (_row->>'organization_id')::uuid
    else public.current_organization_id()
  end;

  insert into public.audit_logs (organization_id, actor_user_id, action, module, record_id, old_value, new_value)
  values (
    _org_id,
    auth.uid(),
    _action,
    TG_TABLE_NAME,
    _record_id,
    case when TG_OP <> 'INSERT' then to_jsonb(old) else null end,
    case when TG_OP <> 'DELETE' then to_jsonb(new) else null end
  );

  return coalesce(new, old);
end;
$$;

comment on function public.audit_row_change() is
  'Writes one audit_logs row per INSERT/UPDATE/DELETE on the tables it is attached to. Attached only to sensitive tables (PII, approvals, payroll, config) — not org-structure reference tables.';

do $$
declare
  t text;
  sensitive_tables text[] := array[
    'bank_details', 'statutory_details', 'employees', 'employee_profiles',
    'payslips', 'tax_declarations', 'previous_employer_declarations',
    'leave_requests', 'permission_requests', 'attendance_regularizations',
    'onduty_requests', 'other_requests',
    'exit_requests', 'exit_settlements', 'exit_clearances',
    'user_roles', 'system_settings', 'employee_documents',
    'bank_detail_change_requests', 'leave_balances'
  ];
begin
  foreach t in array sensitive_tables loop
    execute format('drop trigger if exists trg_%s_audit on public.%I', t, t);
    execute format(
      'create trigger trg_%s_audit after insert or update or delete on public.%I for each row execute function public.audit_row_change()',
      t, t
    );
  end loop;
end;
$$;

-- ============================================================
-- f) Seed permissions/role_permissions as reference/documentation data.
-- This is NOT a permissions-engine rewrite — real authorization stays
-- role-string-based via has_role()/is_hr_or_admin()/is_manager_of() as it
-- already is throughout every RLS policy in the app. This closes the gap
-- of these two tables existing, matching the spec's requested schema, but
-- being silently empty and unexplained. role_permissions reflects what
-- each role can already do per the existing RLS policies above.
-- ============================================================

insert into public.permissions (code, module, description) values
  ('employees.view_own', 'employee', 'View own employee record.'),
  ('employees.view_team', 'employee', 'View direct/indirect reports'' employee records.'),
  ('employees.manage_org', 'employee', 'Create, edit, and deactivate any employee in the organization.'),
  ('org_structure.view', 'employee', 'View departments, designations, locations, grades, shifts.'),
  ('org_structure.manage', 'employee', 'Create/edit/deactivate departments, designations, locations, grades, shifts.'),
  ('attendance.view_own', 'attendance', 'View own attendance and punches.'),
  ('attendance.view_team', 'attendance', 'View direct/indirect reports'' attendance.'),
  ('attendance.regularize_own', 'attendance', 'Submit an attendance regularization request for oneself.'),
  ('attendance.manage_org', 'attendance', 'Edit any employee''s attendance records org-wide.'),
  ('attendance_rules.manage', 'attendance', 'Configure shift/attendance-rule columns.'),
  ('leave.view_own', 'leave', 'View own leave balance and requests.'),
  ('leave.request_own', 'leave', 'Submit/cancel a leave request for oneself while it is still draft or pending.'),
  ('leave.approve_team', 'leave', 'Approve or reject direct/indirect reports'' leave requests.'),
  ('leave.manage_org', 'leave', 'Configure leave types and leave policies org-wide.'),
  ('permission.view_own', 'permission', 'View own permission requests.'),
  ('permission.request_own', 'permission', 'Submit/cancel a permission request for oneself.'),
  ('permission.approve_team', 'permission', 'Approve or reject direct/indirect reports'' permission requests.'),
  ('holidays.view', 'holiday', 'View the holiday calendar.'),
  ('holidays.manage', 'holiday', 'Create/edit/delete/import holidays.'),
  ('eip.view_own', 'eip', 'View own bank/statutory/family/education/employment/asset/document/payslip records.'),
  ('eip.manage_own', 'eip', 'Edit own family/education/employment/document records and submit a bank-detail change request.'),
  ('eip.manage_org', 'eip', 'Directly edit any employee''s bank/statutory/payslip/document records org-wide.'),
  ('payroll.manage', 'payroll', 'Create and view payslips org-wide.'),
  ('documents.verify', 'eip', 'Verify or reject an uploaded employee document.'),
  ('exit.request_own', 'exit', 'Submit/withdraw a resignation for oneself.'),
  ('exit.approve_team', 'exit', 'Approve a direct report''s resignation as their manager.'),
  ('exit.manage_org', 'exit', 'Approve resignations, manage clearances, interviews, and final settlements org-wide.'),
  ('workflow.manage', 'workflow', 'Configure approval workflows and steps.'),
  ('workflow.act', 'workflow', 'Approve or reject a request assigned for one''s decision.'),
  ('notifications.send', 'system', 'Compose and send a system announcement.'),
  ('audit_logs.view', 'system', 'View the organization''s audit log.'),
  ('system_settings.manage', 'system', 'View and edit organization-wide system settings.')
on conflict (code) do nothing;

do $$
declare
  _employee uuid := (select id from public.roles where code = 'employee');
  _manager uuid := (select id from public.roles where code = 'manager');
  _hr_admin uuid := (select id from public.roles where code = 'hr_admin');
  _super_admin uuid := (select id from public.roles where code = 'super_admin');
begin
  -- employee: everything scoped to "_own"
  insert into public.role_permissions (role_id, permission_id)
    select _employee, id from public.permissions
    where code like '%.view_own' or code like '%.request_own' or code like '%.manage_own' or code in ('org_structure.view', 'holidays.view', 'exit.request_own')
  on conflict do nothing;

  -- manager: employee permissions + "_team"/"approve"/"act" scoped ones
  insert into public.role_permissions (role_id, permission_id)
    select _manager, id from public.permissions
    where code like '%.view_own' or code like '%.request_own' or code like '%.manage_own'
       or code like '%.view_team' or code like '%.approve_team' or code in ('org_structure.view', 'holidays.view', 'exit.request_own', 'exit.approve_team', 'workflow.act')
  on conflict do nothing;

  -- hr_admin: everything except role/permission management itself and system_settings (super_admin only, matches its stricter RLS)
  insert into public.role_permissions (role_id, permission_id)
    select _hr_admin, id from public.permissions where code <> 'system_settings.manage'
  on conflict do nothing;

  -- super_admin: everything
  insert into public.role_permissions (role_id, permission_id)
    select _super_admin, id from public.permissions
  on conflict do nothing;
end;
$$;
