-- Generic, configurable multi-step approval engine. A workflow is a named,
-- ordered chain of steps for one request type; an approval_instance is the
-- live run of that chain against one concrete request row (polymorphic via
-- request_type + request_id, since Postgres has no native polymorphic FK).
create table public.approval_workflows (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  request_type text not null check (
    request_type in (
      'leave_request', 'permission_request', 'onduty_request',
      'attendance_regularization', 'exit_request', 'bank_detail_change_request'
    )
  ),
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);
create trigger trg_approval_workflows_updated_at before update on public.approval_workflows
  for each row execute function public.set_updated_at();

create table public.approval_steps (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.approval_workflows(id) on delete cascade,
  step_order smallint not null,
  approver_type text not null check (approver_type in ('reporting_manager', 'role', 'specific_employee')),
  approver_role text check (approver_role in ('manager', 'hr_admin', 'super_admin')),
  approver_employee_id uuid references public.employees(id),
  is_final boolean not null default false,
  unique (workflow_id, step_order)
);

create table public.approval_instances (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.approval_workflows(id),
  request_type text not null,
  request_id uuid not null,
  current_step_order smallint not null default 1,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (request_type, request_id)
);
create trigger trg_approval_instances_updated_at before update on public.approval_instances
  for each row execute function public.set_updated_at();
create index idx_approval_instances_request on public.approval_instances(request_type, request_id);

create table public.approval_actions (
  id uuid primary key default gen_random_uuid(),
  approval_instance_id uuid not null references public.approval_instances(id) on delete cascade,
  step_order smallint not null,
  actor_employee_id uuid not null references public.employees(id),
  action text not null check (action in ('approved', 'rejected', 'delegated')),
  remarks text,
  acted_at timestamptz not null default now()
);
create index idx_approval_actions_instance on public.approval_actions(approval_instance_id);
