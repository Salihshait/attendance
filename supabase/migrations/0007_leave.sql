create table public.leave_types (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  name text not null,
  is_paid boolean not null default true,
  accrual_frequency text not null default 'yearly' check (accrual_frequency in ('monthly', 'yearly', 'none')),
  allow_half_day boolean not null default true,
  requires_attachment boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  unique (organization_id, code)
);
create trigger trg_leave_types_updated_at before update on public.leave_types
  for each row execute function public.set_updated_at();

create table public.leave_policies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  leave_type_id uuid not null references public.leave_types(id) on delete cascade,
  grade_id uuid references public.grades(id),
  annual_entitlement numeric(6,2) not null default 0,
  carry_forward_limit numeric(6,2) not null default 0,
  encashment_allowed boolean not null default false,
  effective_from date not null,
  effective_to date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);
create trigger trg_leave_policies_updated_at before update on public.leave_policies
  for each row execute function public.set_updated_at();

-- One row per employee per leave type per accrual period (e.g. per calendar
-- month, matching the reference app's "Balance" screen). `balance` is
-- maintained by the accrual/consumption jobs, not a generated column, so it
-- stays cheap to read on every dashboard load.
create table public.leave_balances (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  leave_type_id uuid not null references public.leave_types(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  opening numeric(6,2) not null default 0,
  credited numeric(6,2) not null default 0,
  used numeric(6,2) not null default 0,
  balance numeric(6,2) not null default 0,
  updated_at timestamptz not null default now(),
  unique (employee_id, leave_type_id, period_start)
);
create trigger trg_leave_balances_updated_at before update on public.leave_balances
  for each row execute function public.set_updated_at();
create index idx_leave_balances_employee on public.leave_balances(employee_id, period_start);

create table public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  leave_type_id uuid not null references public.leave_types(id),
  from_date date not null,
  to_date date not null,
  is_half_day boolean not null default false,
  half_day_session text check (half_day_session in ('first_half', 'second_half')),
  duration_days numeric(5,2) not null,
  reason text not null,
  attachment_url text,
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
create trigger trg_leave_requests_updated_at before update on public.leave_requests
  for each row execute function public.set_updated_at();
create index idx_leave_requests_employee on public.leave_requests(employee_id, from_date);
create index idx_leave_requests_manager on public.leave_requests(reporting_manager_id, status);
