-- One row per employee per calendar day — the source for the attendance
-- calendar, in/out reports, and the monthly balance panel.
create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  attendance_date date not null,
  shift_id uuid references public.shifts(id),
  check_in timestamptz,
  check_out timestamptz,
  effective_minutes integer not null default 0,
  late_minutes integer not null default 0,
  early_going_minutes integer not null default 0,
  excess_stay_minutes integer not null default 0,
  shortfall_minutes integer not null default 0,
  day_status text not null default 'absent'
    check (day_status in ('present', 'half_day', 'absent', 'weekoff', 'holiday', 'leave', 'on_duty', 'permission')),
  validation_status text not null default 'pending'
    check (validation_status in ('pending', 'completed')),
  is_regularized boolean not null default false,
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (employee_id, attendance_date)
);
create trigger trg_attendance_updated_at before update on public.attendance
  for each row execute function public.set_updated_at();
create index idx_attendance_employee_date on public.attendance(employee_id, attendance_date);
create index idx_attendance_org_date on public.attendance(organization_id, attendance_date);

-- Every raw device/mobile/web punch, before it's collapsed into `attendance`.
create table public.attendance_punches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  punch_date date not null,
  punch_time timestamptz not null,
  punch_type text not null check (punch_type in ('in', 'out')),
  device text,
  location text,
  source text not null default 'biometric' check (source in ('biometric', 'mobile', 'web', 'manual')),
  created_at timestamptz not null default now()
);
create index idx_attendance_punches_employee_date on public.attendance_punches(employee_id, punch_date);

create table public.attendance_regularizations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  attendance_date date not null,
  regularization_type text not null check (
    regularization_type in (
      'missed_punch', 'incorrect_checkin', 'incorrect_checkout',
      'work_from_home', 'present_correction', 'shift_correction'
    )
  ),
  original_check_in timestamptz,
  original_check_out timestamptz,
  requested_check_in timestamptz,
  requested_check_out timestamptz,
  reason text not null,
  attachment_url text,
  status text not null default 'pending'
    check (status in ('draft', 'pending', 'approved', 'rejected', 'cancelled')),
  applied_on timestamptz not null default now(),
  approver_id uuid references public.employees(id),
  approval_remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_attendance_regularizations_updated_at before update on public.attendance_regularizations
  for each row execute function public.set_updated_at();
create index idx_attendance_reg_employee on public.attendance_regularizations(employee_id, attendance_date);
