create table public.permission_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  permission_date date not null,
  from_time time not null,
  to_time time not null,
  duration_minutes integer not null,
  reason text not null,
  reporting_manager_id uuid references public.employees(id),
  entry_by uuid references public.employees(id),
  applied_on timestamptz not null default now(),
  status text not null default 'pending'
    check (status in ('draft', 'pending', 'approved', 'rejected', 'cancelled')),
  approval_remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (to_time > from_time)
);
create trigger trg_permission_requests_updated_at before update on public.permission_requests
  for each row execute function public.set_updated_at();
create index idx_permission_requests_employee on public.permission_requests(employee_id, permission_date);
create index idx_permission_requests_manager on public.permission_requests(reporting_manager_id, status);

create table public.onduty_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  onduty_type text not null default 'on_duty' check (onduty_type in ('on_duty', 'work_from_home')),
  from_date date not null,
  to_date date not null,
  reason text not null,
  location text,
  reporting_manager_id uuid references public.employees(id),
  entry_by uuid references public.employees(id),
  applied_on timestamptz not null default now(),
  status text not null default 'pending'
    check (status in ('draft', 'pending', 'approved', 'rejected', 'cancelled')),
  approval_remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (to_date >= from_date)
);
create trigger trg_onduty_requests_updated_at before update on public.onduty_requests
  for each row execute function public.set_updated_at();
create index idx_onduty_requests_employee on public.onduty_requests(employee_id, from_date);
