-- HR Administration module: reference-data columns the Admin UI needs that
-- don't exist yet. Every touched table (departments, designations,
-- locations, shifts, approval_steps) already has HR-admin "for all" RLS
-- that's column-agnostic (0018_rls_org_and_reference_data.sql /
-- 0021_rls_approvals_notifications_audit.sql), so no new RLS is needed here.

alter table public.locations
  add column time_zone text;

alter table public.departments
  add column head_employee_id uuid references public.employees(id);

alter table public.designations
  add column code text,
  add column grade_id uuid references public.grades(id),
  add column department_id uuid references public.departments(id);

-- Attendance Rules extends the same shifts row the Shifts page edits.
-- Configuration only in this session — attendanceCalc.ts and the seed
-- generator don't read these columns yet.
alter table public.shifts
  add column weekoff_days smallint[] not null default '{0,6}',
  add column overtime_enabled boolean not null default false,
  add column overtime_rate_multiplier numeric(4,2) not null default 1.5,
  add column late_rule_enabled boolean not null default true,
  add column early_going_rule_enabled boolean not null default true,
  add column shortfall_rule_enabled boolean not null default true;

-- Captured but not enforced — act_on_approval() is hardcoded single-step and
-- never reads approval_steps at all (see 0025/0028), so this is schema-only
-- until a future session builds real multi-step routing/escalation.
alter table public.approval_steps
  add column escalate_after_hours smallint;
