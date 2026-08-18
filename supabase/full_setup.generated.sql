-- GENERATED FILE — do not hand-edit.
-- This is supabase/migrations/0001..0058 + supabase/seed/seed.sql concatenated
-- in order, for a one-paste setup in the Supabase SQL Editor. The source of
-- truth is the individual files; regenerate this one from them if they change.
-- Live-applied and verified against a real Supabase project in this session,
-- including real login credentials (see seed.sql for the password).
--
-- Paste this whole file into: Supabase Dashboard -> SQL Editor -> New query -> Run.

-- ============================================================
-- 0001_extensions_and_helpers.sql
-- ============================================================
-- Extensions
create extension if not exists "pgcrypto";

-- Generic updated_at trigger, reused by every table below.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'Stamps updated_at = now() on every UPDATE. Attached as a BEFORE UPDATE trigger per table.';

-- ============================================================
-- 0002_core_reference_tables.sql
-- ============================================================
-- Organizations (multi-tenant root). A single demo org is seeded, but every
-- HR-scoped table below carries organization_id so a second tenant can be
-- onboarded without a schema change.
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  short_code text not null unique,
  logo_url text,
  timezone text not null default 'Asia/Kolkata',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);
create trigger trg_organizations_updated_at before update on public.organizations
  for each row execute function public.set_updated_at();

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  city text,
  state text,
  country text default 'India',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  unique (organization_id, name)
);
create trigger trg_locations_updated_at before update on public.locations
  for each row execute function public.set_updated_at();

create table public.departments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  code text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  unique (organization_id, name)
);
create trigger trg_departments_updated_at before update on public.departments
  for each row execute function public.set_updated_at();

create table public.designations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  unique (organization_id, name)
);
create trigger trg_designations_updated_at before update on public.designations
  for each row execute function public.set_updated_at();

create table public.grades (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  rank smallint,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  unique (organization_id, name)
);
create trigger trg_grades_updated_at before update on public.grades
  for each row execute function public.set_updated_at();

-- ============================================================
-- 0003_roles_permissions_profiles.sql
-- ============================================================
-- `profiles` extends Supabase's built-in auth.users with app-level identity
-- fields. This fulfils the spec's "users" table — we don't shadow the name
-- `users`, since Supabase already owns auth.users.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  phone text,
  is_active boolean not null default true,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code in ('employee', 'manager', 'hr_admin', 'super_admin')),
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

create table public.permissions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  module text not null,
  description text,
  created_at timestamptz not null default now()
);

create table public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid,
  unique (user_id, role_id, organization_id)
);
create index idx_user_roles_user_id on public.user_roles(user_id);

insert into public.roles (code, name, description) values
  ('employee', 'Employee', 'Base role held by every active employee.'),
  ('manager', 'Manager', 'Approves requests for direct/indirect reports.'),
  ('hr_admin', 'HR Administrator', 'Manages employee lifecycle, policies, and org configuration.'),
  ('super_admin', 'Super Administrator', 'Full system access, including role and permission management.');

-- ============================================================
-- 0004_shifts.sql
-- ============================================================
create table public.shifts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  start_time time not null,
  end_time time not null,
  grace_minutes smallint not null default 0,
  half_day_hours numeric(4,2) not null default 4.5,
  full_day_hours numeric(4,2) not null default 8,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  unique (organization_id, name)
);
create trigger trg_shifts_updated_at before update on public.shifts
  for each row execute function public.set_updated_at();

-- ============================================================
-- 0005_employees.sql
-- ============================================================
create table public.employees (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  employee_code text not null,
  first_name text not null,
  middle_name text,
  last_name text,
  gender text check (gender in ('male', 'female', 'other')),
  father_name text,
  date_of_birth date,
  date_of_joining date not null,
  date_of_leaving date,
  photo_url text,
  official_email text not null,
  official_mobile text,
  paygroup text,
  department_id uuid references public.departments(id),
  designation_id uuid references public.designations(id),
  location_id uuid references public.locations(id),
  grade_id uuid references public.grades(id),
  cost_centre text,
  place_of_tax_deduction text,
  reporting_manager_id uuid references public.employees(id),
  job_responsibility text,
  employment_type text not null default 'full_time'
    check (employment_type in ('full_time', 'part_time', 'contract', 'intern')),
  employment_status text not null default 'active'
    check (employment_status in ('active', 'inactive', 'on_notice', 'exited')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  unique (organization_id, employee_code)
);
create trigger trg_employees_updated_at before update on public.employees
  for each row execute function public.set_updated_at();

create index idx_employees_org on public.employees(organization_id);
create index idx_employees_manager on public.employees(reporting_manager_id);
create index idx_employees_user on public.employees(user_id);
create index idx_employees_department on public.employees(department_id);

-- Extended personal-details fields kept off the core row (section 28 of the spec).
create table public.employee_profiles (
  employee_id uuid primary key references public.employees(id) on delete cascade,
  marital_status text check (marital_status in ('single', 'married', 'divorced', 'widowed')),
  nationality text default 'Indian',
  blood_group text,
  personal_email text,
  personal_mobile text,
  address_line1 text,
  address_line2 text,
  city text,
  state text,
  country text default 'India',
  pin_code text,
  emergency_contact_name text,
  emergency_contact_number text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid
);
create trigger trg_employee_profiles_updated_at before update on public.employee_profiles
  for each row execute function public.set_updated_at();

-- Now that public.employees exists, wire up the shift roster table.
create table public.shift_assignments (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  shift_id uuid not null references public.shifts(id) on delete restrict,
  effective_from date not null,
  effective_to date,
  created_at timestamptz not null default now(),
  created_by uuid
);
create index idx_shift_assignments_employee on public.shift_assignments(employee_id, effective_from);

-- ============================================================
-- 0006_attendance.sql
-- ============================================================
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

-- ============================================================
-- 0007_leave.sql
-- ============================================================
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

-- ============================================================
-- 0008_permission_onduty.sql
-- ============================================================
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

-- ============================================================
-- 0009_holidays.sql
-- ============================================================
create table public.holidays (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  location_id uuid references public.locations(id),
  holiday_date date not null,
  name text not null,
  holiday_type text not null default 'public' check (holiday_type in ('public', 'restricted', 'optional')),
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);
create trigger trg_holidays_updated_at before update on public.holidays
  for each row execute function public.set_updated_at();
create index idx_holidays_org_date on public.holidays(organization_id, holiday_date);

-- ============================================================
-- 0010_documents.sql
-- ============================================================
-- Configurable document-type catalog (Resume, ID Proof, PAN, ...).
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  name text not null,
  is_required boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, code)
);

-- Actual uploaded files. file_path points into a Supabase Storage bucket
-- (see README for the `employee-documents` bucket + RLS policy setup).
create table public.employee_documents (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  document_type_id uuid not null references public.documents(id),
  file_path text not null,
  file_name text not null,
  uploaded_at timestamptz not null default now(),
  uploaded_by uuid,
  verification_status text not null default 'pending'
    check (verification_status in ('pending', 'verified', 'rejected')),
  verified_by uuid references public.employees(id),
  verified_at timestamptz,
  verification_remarks text,
  delete_requested boolean not null default false
);
create index idx_employee_documents_employee on public.employee_documents(employee_id);

-- ============================================================
-- 0011_family_education_employment.sql
-- ============================================================
create table public.family_members (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  name text not null,
  relationship text not null,
  date_of_birth date,
  gender text check (gender in ('male', 'female', 'other')),
  occupation text,
  is_dependent boolean not null default false,
  contact_number text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_family_members_updated_at before update on public.family_members
  for each row execute function public.set_updated_at();
create index idx_family_members_employee on public.family_members(employee_id);

create table public.education_records (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  qualification text not null,
  specialization text,
  institution text,
  university text,
  year_of_passing smallint,
  score_type text check (score_type in ('percentage', 'cgpa')),
  score numeric(5,2),
  certificate_document_id uuid references public.employee_documents(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_education_records_updated_at before update on public.education_records
  for each row execute function public.set_updated_at();
create index idx_education_records_employee on public.education_records(employee_id);

create table public.previous_employment (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  company_name text not null,
  designation text,
  start_date date,
  end_date date,
  total_experience_years numeric(4,1),
  reason_for_leaving text,
  last_drawn_salary numeric(12,2),
  document_id uuid references public.employee_documents(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_previous_employment_updated_at before update on public.previous_employment
  for each row execute function public.set_updated_at();
create index idx_previous_employment_employee on public.previous_employment(employee_id);

-- ============================================================
-- 0012_bank_statutory.sql
-- ============================================================
-- Highly sensitive: locked down hard by RLS (see 0019_rls_sensitive.sql) and
-- masked in the UI by default. Never returned to a plain SELECT * client query.
create table public.bank_details (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  bank_name text not null,
  account_number text not null,
  ifsc_code text not null,
  branch text,
  account_holder_name text not null,
  payment_mode text not null default 'bank_transfer' check (payment_mode in ('bank_transfer', 'cheque', 'cash')),
  is_pending_change boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid
);
create trigger trg_bank_details_updated_at before update on public.bank_details
  for each row execute function public.set_updated_at();
create unique index idx_bank_details_employee on public.bank_details(employee_id);

-- Bank-detail change requests go through approval before overwriting the row above.
create table public.bank_detail_change_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  requested_bank_name text not null,
  requested_account_number text not null,
  requested_ifsc_code text not null,
  requested_branch text,
  requested_account_holder_name text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  approver_id uuid references public.employees(id),
  approval_remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_bank_change_requests_updated_at before update on public.bank_detail_change_requests
  for each row execute function public.set_updated_at();

create table public.statutory_details (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  pan_number text,
  aadhaar_number text,
  uan_number text,
  pf_number text,
  esi_number text,
  tax_regime text check (tax_regime in ('old', 'new')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid
);
create trigger trg_statutory_details_updated_at before update on public.statutory_details
  for each row execute function public.set_updated_at();
create unique index idx_statutory_details_employee on public.statutory_details(employee_id);

-- ============================================================
-- 0013_payroll.sql
-- ============================================================
create table public.payslips (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  pay_period_month smallint not null check (pay_period_month between 1 and 12),
  pay_period_year smallint not null,
  gross_earnings numeric(12,2) not null default 0,
  total_deductions numeric(12,2) not null default 0,
  net_pay numeric(12,2) not null default 0,
  document_id uuid references public.employee_documents(id),
  generated_at timestamptz not null default now(),
  unique (employee_id, pay_period_year, pay_period_month)
);
create index idx_payslips_employee on public.payslips(employee_id, pay_period_year, pay_period_month);

create table public.tax_declarations (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  financial_year text not null,
  regime text not null default 'new' check (regime in ('old', 'new')),
  declared_investments numeric(12,2) not null default 0,
  hra_exemption numeric(12,2) not null default 0,
  status text not null default 'draft' check (status in ('draft', 'submitted', 'verified', 'locked')),
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (employee_id, financial_year)
);
create trigger trg_tax_declarations_updated_at before update on public.tax_declarations
  for each row execute function public.set_updated_at();

-- ============================================================
-- 0014_exit.sql
-- ============================================================
create table public.exit_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  resignation_date date not null,
  proposed_last_working_date date not null,
  notice_period_days integer not null,
  expected_last_working_date date not null,
  reason text not null,
  detailed_comments text,
  attachment_url text,
  status text not null default 'draft' check (
    status in ('draft', 'submitted', 'manager_approved', 'hr_approved', 'rejected', 'withdrawn', 'completed')
  ),
  manager_id uuid references public.employees(id),
  manager_approved_at timestamptz,
  manager_remarks text,
  hr_approver_id uuid references public.employees(id),
  hr_approved_at timestamptz,
  hr_remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_exit_requests_updated_at before update on public.exit_requests
  for each row execute function public.set_updated_at();
create index idx_exit_requests_employee on public.exit_requests(employee_id);

-- HR-configurable questionnaire, grouped by category (section 32).
create table public.exit_interview_questions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  category text not null check (
    category in (
      'job_satisfaction', 'management', 'work_environment', 'compensation',
      'career_growth', 'learning', 'company_culture', 'reason_for_leaving', 'suggestions'
    )
  ),
  question_text text not null,
  response_type text not null default 'rating' check (response_type in ('rating', 'text', 'yes_no')),
  display_order smallint not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid
);

create table public.exit_interviews (
  id uuid primary key default gen_random_uuid(),
  exit_request_id uuid not null references public.exit_requests(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  conducted_by uuid references public.employees(id),
  conducted_at timestamptz,
  status text not null default 'pending' check (status in ('pending', 'completed')),
  created_at timestamptz not null default now(),
  unique (exit_request_id)
);

create table public.exit_interview_responses (
  id uuid primary key default gen_random_uuid(),
  exit_interview_id uuid not null references public.exit_interviews(id) on delete cascade,
  question_id uuid not null references public.exit_interview_questions(id),
  rating_value smallint check (rating_value between 1 and 5),
  text_value text,
  yes_no_value boolean,
  created_at timestamptz not null default now(),
  unique (exit_interview_id, question_id)
);

-- ============================================================
-- 0015_approval_engine.sql
-- ============================================================
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

-- ============================================================
-- 0016_notifications_audit_settings.sql
-- ============================================================
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  notification_type text not null check (
    notification_type in (
      'leave_approved', 'leave_rejected', 'permission_approved', 'permission_rejected',
      'regularization_approved', 'regularization_rejected', 'new_approval',
      'resignation_update', 'document_verification', 'system_announcement'
    )
  ),
  title text not null,
  body text,
  link_path text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
create index idx_notifications_recipient on public.notifications(recipient_user_id, is_read, created_at desc);

-- Append-only audit trail. Never updated or deleted by application code.
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_user_id uuid references auth.users(id),
  action text not null check (
    action in ('login', 'logout', 'create', 'update', 'delete', 'approval', 'rejection', 'document_upload')
  ),
  module text not null,
  record_id uuid,
  old_value jsonb,
  new_value jsonb,
  ip_address inet,
  created_at timestamptz not null default now()
);
create index idx_audit_logs_org_created on public.audit_logs(organization_id, created_at desc);
create index idx_audit_logs_actor on public.audit_logs(actor_user_id);

create table public.system_settings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  setting_key text not null,
  setting_value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  unique (organization_id, setting_key)
);
create trigger trg_system_settings_updated_at before update on public.system_settings
  for each row execute function public.set_updated_at();

-- ============================================================
-- 0017_rls_helper_functions.sql
-- ============================================================
-- RLS helper functions. All SECURITY DEFINER + stable so they can be used
-- freely inside policy USING/WITH CHECK clauses without recursive RLS checks
-- on the tables they read.

create or replace function public.current_employee_id()
returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.employees where user_id = auth.uid() limit 1;
$$;

create or replace function public.current_organization_id()
returns uuid
language sql stable security definer set search_path = public as $$
  select organization_id from public.employees where user_id = auth.uid() limit 1;
$$;

create or replace function public.has_role(_role_code text)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid() and r.code = _role_code
  );
$$;

create or replace function public.is_hr_or_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_role('hr_admin') or public.has_role('super_admin');
$$;

-- Walks the reporting_manager_id chain upward from _employee_id (bounded to
-- 12 levels) to test whether the current user's employee sits above it.
create or replace function public.is_manager_of(_employee_id uuid)
returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  _me uuid := public.current_employee_id();
  _walk uuid := _employee_id;
  _depth int := 0;
begin
  if _me is null or _employee_id is null then
    return false;
  end if;

  while _walk is not null and _depth < 12 loop
    select reporting_manager_id into _walk from public.employees where id = _walk;
    if _walk = _me then
      return true;
    end if;
    _depth := _depth + 1;
  end loop;

  return false;
end;
$$;

-- Polymorphic lookup: which employee owns a given approval-engine request.
-- Extend the CASE list here whenever a new request_type is added to
-- approval_workflows / approval_instances.
create or replace function public.request_owner_employee_id(_request_type text, _request_id uuid)
returns uuid
language sql stable security definer set search_path = public as $$
  select case _request_type
    when 'leave_request' then (select employee_id from public.leave_requests where id = _request_id)
    when 'permission_request' then (select employee_id from public.permission_requests where id = _request_id)
    when 'onduty_request' then (select employee_id from public.onduty_requests where id = _request_id)
    when 'attendance_regularization' then (select employee_id from public.attendance_regularizations where id = _request_id)
    when 'exit_request' then (select employee_id from public.exit_requests where id = _request_id)
    when 'bank_detail_change_request' then (select employee_id from public.bank_detail_change_requests where id = _request_id)
    else null
  end;
$$;

-- ============================================================
-- 0018_rls_org_and_reference_data.sql
-- ============================================================
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

-- ============================================================
-- 0019_rls_employees_and_requests.sql
-- ============================================================
-- Core "self / manager-of-team / HR-org-wide / admin" access pattern used
-- throughout the app. Note: RLS is row-level, not column-level — endpoints
-- that must hide specific fields from a visible row (e.g. an employee's own
-- salary-adjacent fields from their manager) should read through a view or
-- RPC that projects only the allowed columns, layered on top of these
-- policies rather than replacing them.

alter table public.employees enable row level security;
create policy employees_select on public.employees for select
  using (
    id = public.current_employee_id()
    or public.is_manager_of(id)
    or (public.is_hr_or_admin() and organization_id = public.current_organization_id())
  );
create policy employees_update on public.employees for update
  using (id = public.current_employee_id() or (public.is_hr_or_admin() and organization_id = public.current_organization_id()));
create policy employees_insert on public.employees for insert
  with check (public.is_hr_or_admin() and organization_id = public.current_organization_id());
create policy employees_delete on public.employees for delete
  using (public.is_hr_or_admin() and organization_id = public.current_organization_id());

alter table public.employee_profiles enable row level security;
create policy employee_profiles_select on public.employee_profiles for select
  using (
    employee_id = public.current_employee_id()
    or public.is_manager_of(employee_id)
    or public.is_hr_or_admin()
  );
create policy employee_profiles_write on public.employee_profiles for all
  using (employee_id = public.current_employee_id() or public.is_hr_or_admin())
  with check (employee_id = public.current_employee_id() or public.is_hr_or_admin());

alter table public.shift_assignments enable row level security;
create policy shift_assignments_select on public.shift_assignments for select
  using (
    employee_id = public.current_employee_id()
    or public.is_manager_of(employee_id)
    or public.is_hr_or_admin()
  );
create policy shift_assignments_write on public.shift_assignments for all
  using (public.is_hr_or_admin()) with check (public.is_hr_or_admin());

alter table public.attendance enable row level security;
create policy attendance_select on public.attendance for select
  using (
    employee_id = public.current_employee_id()
    or public.is_manager_of(employee_id)
    or public.is_hr_or_admin()
  );
create policy attendance_write on public.attendance for all
  using (public.is_hr_or_admin()) with check (public.is_hr_or_admin());

alter table public.attendance_punches enable row level security;
create policy attendance_punches_select on public.attendance_punches for select
  using (
    employee_id = public.current_employee_id()
    or public.is_manager_of(employee_id)
    or public.is_hr_or_admin()
  );
create policy attendance_punches_write on public.attendance_punches for all
  using (public.is_hr_or_admin()) with check (public.is_hr_or_admin());

-- Employee-initiated request tables: self can create/view/cancel own,
-- manager can view + act on their team's, HR can do anything in-org.
alter table public.attendance_regularizations enable row level security;
create policy attendance_regularizations_select on public.attendance_regularizations for select
  using (employee_id = public.current_employee_id() or public.is_manager_of(employee_id) or public.is_hr_or_admin());
create policy attendance_regularizations_insert on public.attendance_regularizations for insert
  with check (employee_id = public.current_employee_id() or public.is_hr_or_admin());
create policy attendance_regularizations_update on public.attendance_regularizations for update
  using (employee_id = public.current_employee_id() or public.is_manager_of(employee_id) or public.is_hr_or_admin());

alter table public.leave_balances enable row level security;
create policy leave_balances_select on public.leave_balances for select
  using (employee_id = public.current_employee_id() or public.is_manager_of(employee_id) or public.is_hr_or_admin());
create policy leave_balances_write on public.leave_balances for all
  using (public.is_hr_or_admin()) with check (public.is_hr_or_admin());

alter table public.leave_requests enable row level security;
create policy leave_requests_select on public.leave_requests for select
  using (employee_id = public.current_employee_id() or public.is_manager_of(employee_id) or public.is_hr_or_admin());
create policy leave_requests_insert on public.leave_requests for insert
  with check (employee_id = public.current_employee_id() or public.is_hr_or_admin());
create policy leave_requests_update on public.leave_requests for update
  using (employee_id = public.current_employee_id() or public.is_manager_of(employee_id) or public.is_hr_or_admin());

alter table public.permission_requests enable row level security;
create policy permission_requests_select on public.permission_requests for select
  using (employee_id = public.current_employee_id() or public.is_manager_of(employee_id) or public.is_hr_or_admin());
create policy permission_requests_insert on public.permission_requests for insert
  with check (employee_id = public.current_employee_id() or public.is_hr_or_admin());
create policy permission_requests_update on public.permission_requests for update
  using (employee_id = public.current_employee_id() or public.is_manager_of(employee_id) or public.is_hr_or_admin());

alter table public.onduty_requests enable row level security;
create policy onduty_requests_select on public.onduty_requests for select
  using (employee_id = public.current_employee_id() or public.is_manager_of(employee_id) or public.is_hr_or_admin());
create policy onduty_requests_insert on public.onduty_requests for insert
  with check (employee_id = public.current_employee_id() or public.is_hr_or_admin());
create policy onduty_requests_update on public.onduty_requests for update
  using (employee_id = public.current_employee_id() or public.is_manager_of(employee_id) or public.is_hr_or_admin());

-- Personal records: self + HR only. Managers have no reason to see a
-- report's family/education/prior-employment details.
alter table public.family_members enable row level security;
create policy family_members_all on public.family_members for all
  using (employee_id = public.current_employee_id() or public.is_hr_or_admin())
  with check (employee_id = public.current_employee_id() or public.is_hr_or_admin());

alter table public.education_records enable row level security;
create policy education_records_all on public.education_records for all
  using (employee_id = public.current_employee_id() or public.is_hr_or_admin())
  with check (employee_id = public.current_employee_id() or public.is_hr_or_admin());

alter table public.previous_employment enable row level security;
create policy previous_employment_all on public.previous_employment for all
  using (employee_id = public.current_employee_id() or public.is_hr_or_admin())
  with check (employee_id = public.current_employee_id() or public.is_hr_or_admin());

alter table public.employee_documents enable row level security;
create policy employee_documents_all on public.employee_documents for all
  using (employee_id = public.current_employee_id() or public.is_hr_or_admin())
  with check (employee_id = public.current_employee_id() or public.is_hr_or_admin());

-- ============================================================
-- 0020_rls_sensitive_and_payroll.sql
-- ============================================================
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

-- ============================================================
-- 0021_rls_approvals_notifications_audit.sql
-- ============================================================
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

-- ============================================================
-- 0022_storage_buckets.sql
-- ============================================================
-- Private bucket for personal documents, keyed by folder-per-employee
-- (`<employee_id>/<filename>`), enforced by the RLS policies below.
insert into storage.buckets (id, name, public)
values ('employee-documents', 'employee-documents', false)
on conflict (id) do nothing;

create policy "employee_documents_read" on storage.objects for select
  using (
    bucket_id = 'employee-documents'
    and ((storage.foldername(name))[1] = public.current_employee_id()::text or public.is_hr_or_admin())
  );
create policy "employee_documents_write" on storage.objects for insert
  with check (
    bucket_id = 'employee-documents'
    and ((storage.foldername(name))[1] = public.current_employee_id()::text or public.is_hr_or_admin())
  );
create policy "employee_documents_delete" on storage.objects for delete
  using (
    bucket_id = 'employee-documents'
    and ((storage.foldername(name))[1] = public.current_employee_id()::text or public.is_hr_or_admin())
  );

-- Public bucket for profile photos — low sensitivity, and avatars need to be
-- easily displayable across the org (team lists, approval cards) without
-- signed URLs.
insert into storage.buckets (id, name, public)
values ('employee-photos', 'employee-photos', true)
on conflict (id) do nothing;

create policy "employee_photos_write" on storage.objects for insert
  with check (
    bucket_id = 'employee-photos'
    and ((storage.foldername(name))[1] = public.current_employee_id()::text or public.is_hr_or_admin())
  );
create policy "employee_photos_update" on storage.objects for update
  using (
    bucket_id = 'employee-photos'
    and ((storage.foldername(name))[1] = public.current_employee_id()::text or public.is_hr_or_admin())
  );

-- ============================================================
-- 0023_login_lookup_rpc.sql
-- ============================================================
-- Lets the login page's "Username" field accept an employee code (matching
-- the reference app's login UX, e.g. "EMP0001") in addition to a plain
-- email — Supabase Auth itself only ever signs in by email. SECURITY
-- DEFINER so an unauthenticated client can resolve code -> email before
-- calling signInWithPassword; returns null on no match, and is scoped to
-- exactly one column so it can't be used to pull anything else out of
-- public.employees.
create or replace function public.resolve_login_email(_username text)
returns text
language sql stable security definer set search_path = public as $$
  select official_email
  from public.employees
  where lower(employee_code) = lower(trim(_username))
  limit 1;
$$;

grant execute on function public.resolve_login_email(text) to anon, authenticated;

-- ============================================================
-- 0024_employees_can_view_own_manager.sql
-- ============================================================
-- employees_select (0019) let a manager read their reports, but never the
-- reverse — an employee couldn't read their OWN manager's row, which broke
-- resolving "reporting manager" for display. Add that direction.
create or replace function public.current_reporting_manager_id()
returns uuid
language sql stable security definer set search_path = public as $$
  select reporting_manager_id from public.employees where user_id = auth.uid() limit 1;
$$;

drop policy if exists employees_select on public.employees;
create policy employees_select on public.employees for select
  using (
    id = public.current_employee_id()
    or public.is_manager_of(id)
    or id = public.current_reporting_manager_id()
    or (public.is_hr_or_admin() and organization_id = public.current_organization_id())
  );

-- ============================================================
-- 0025_approval_action_rpc.sql
-- ============================================================
-- SECURITY DEFINER RPC that atomically flips a leave/permission/regularization
-- request's status, advances the approval engine (approval_instances +
-- approval_actions), and notifies the requesting employee. This is the
-- "follow-up session" RPC flagged in 0021_rls_approvals_notifications_audit.sql
-- — direct client updates to approval_instances remain policy-gated for
-- defense in depth, but the app should call this function instead.
create or replace function public.act_on_approval(
  _request_type text,
  _request_id uuid,
  _action text,
  _remarks text default null
)
returns void
language plpgsql security definer set search_path = public as $$
declare
  _owner_id uuid;
  _actor_id uuid := public.current_employee_id();
  _org_id uuid;
  _workflow_id uuid;
  _instance_id uuid;
  _recipient_user uuid;
  _notification_type text;
  _title text;
begin
  if _action not in ('approved', 'rejected') then
    raise exception 'act_on_approval: action must be ''approved'' or ''rejected'', got %', _action;
  end if;

  _owner_id := public.request_owner_employee_id(_request_type, _request_id);
  if _owner_id is null then
    raise exception 'act_on_approval: request % / % not found', _request_type, _request_id;
  end if;

  if _actor_id is null or not (public.is_hr_or_admin() or public.is_manager_of(_owner_id)) then
    raise exception 'act_on_approval: not authorized to act on this request';
  end if;

  if _request_type = 'leave_request' then
    update public.leave_requests
      set status = _action, approval_remarks = _remarks
      where id = _request_id and status = 'pending';
  elsif _request_type = 'permission_request' then
    update public.permission_requests
      set status = _action, approval_remarks = _remarks
      where id = _request_id and status = 'pending';
  elsif _request_type = 'attendance_regularization' then
    update public.attendance_regularizations
      set status = _action, approval_remarks = _remarks, approver_id = _actor_id
      where id = _request_id and status = 'pending';
  else
    raise exception 'act_on_approval: unsupported request type %', _request_type;
  end if;

  if not found then
    raise exception 'act_on_approval: request is not pending (already actioned?)';
  end if;

  select organization_id into _org_id from public.employees where id = _owner_id;

  select id into _workflow_id from public.approval_workflows
    where organization_id = _org_id and request_type = _request_type and is_active
    order by created_at limit 1;

  if _workflow_id is not null then
    insert into public.approval_instances (workflow_id, request_type, request_id, status, current_step_order)
      values (_workflow_id, _request_type, _request_id, _action, 1)
      on conflict (request_type, request_id) do update set status = excluded.status
      returning id into _instance_id;

    insert into public.approval_actions (approval_instance_id, step_order, actor_employee_id, action, remarks)
      values (_instance_id, 1, _actor_id, _action, _remarks);
  end if;

  _notification_type := case _request_type
    when 'leave_request' then (case when _action = 'approved' then 'leave_approved' else 'leave_rejected' end)
    when 'permission_request' then (case when _action = 'approved' then 'permission_approved' else 'permission_rejected' end)
    else (case when _action = 'approved' then 'regularization_approved' else 'regularization_rejected' end)
  end;
  _title := case when _action = 'approved' then 'Your request has been approved' else 'Your request has been rejected' end;

  select user_id into _recipient_user from public.employees where id = _owner_id;
  if _recipient_user is not null then
    insert into public.notifications (organization_id, recipient_user_id, notification_type, title, body, link_path)
      values (_org_id, _recipient_user, _notification_type, _title, _remarks, '/attendance/event-request');
  end if;
end;
$$;

grant execute on function public.act_on_approval(text, uuid, text, text) to authenticated;

-- ============================================================
-- 0026_eip_extras.sql
-- ============================================================
-- EIP module additions: company assets, org-wide policy documents, previous
-- employer tax declarations, a detailed payslip breakdown, and masked
-- read paths for the two most sensitive tables (statutory + bank details).

create table public.employee_assets (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  asset_code text not null,
  asset_type text not null,
  asset_name text not null,
  serial_number text,
  issued_date date not null default current_date,
  return_date date,
  status text not null default 'assigned' check (status in ('assigned', 'returned', 'lost', 'damaged')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_employee_assets_updated_at before update on public.employee_assets
  for each row execute function public.set_updated_at();
create index idx_employee_assets_employee on public.employee_assets(employee_id);

-- Org-wide policy documents (holiday list, HR handbook, etc.), grouped by
-- year on the Policies screen — the year is data, never hardcoded in the UI.
create table public.policy_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  policy_year smallint not null,
  title text not null,
  category text not null default 'general',
  file_path text not null,
  file_name text not null,
  uploaded_by uuid references public.employees(id),
  uploaded_at timestamptz not null default now()
);
create index idx_policy_documents_org_year on public.policy_documents(organization_id, policy_year desc);

-- Previous employer's income/TDS for the current financial year, declared
-- for payroll tax computation — distinct from `previous_employment` (the
-- career-history record shown on the Previous Employment profile tab).
create table public.previous_employer_declarations (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  financial_year text not null,
  employer_name text not null,
  income_earned numeric(12,2) not null default 0,
  tds_deducted numeric(12,2) not null default 0,
  pf_contribution numeric(12,2) not null default 0,
  supporting_document_id uuid references public.employee_documents(id),
  status text not null default 'draft' check (status in ('draft', 'submitted', 'verified')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (employee_id, financial_year)
);
create trigger trg_previous_employer_declarations_updated_at before update on public.previous_employer_declarations
  for each row execute function public.set_updated_at();

-- The payslip screen (spec section 11) needs a full breakdown, not just the
-- gross/deductions/net summary the table originally shipped with.
alter table public.payslips
  add column basic_pay numeric(12,2) not null default 0,
  add column hra numeric(12,2) not null default 0,
  add column other_allowances numeric(12,2) not null default 0,
  add column pf_employee_contribution numeric(12,2) not null default 0,
  add column esi_employee_contribution numeric(12,2) not null default 0,
  add column professional_tax numeric(12,2) not null default 0,
  add column tds numeric(12,2) not null default 0;

alter table public.audit_logs drop constraint audit_logs_action_check;
alter table public.audit_logs add constraint audit_logs_action_check
  check (action in ('login', 'logout', 'create', 'update', 'delete', 'approval', 'rejection', 'document_upload', 'view'));

-- RLS: employee_assets follows the "self or HR, HR writes" pattern used
-- throughout the module — assets are HR/admin-assigned, not self-reported.
alter table public.employee_assets enable row level security;
create policy employee_assets_select on public.employee_assets for select
  using (employee_id = public.current_employee_id() or public.is_hr_or_admin());
create policy employee_assets_write on public.employee_assets for all
  using (public.is_hr_or_admin()) with check (public.is_hr_or_admin());

-- Policy documents are readable by every member of the org, uploaded by HR only.
alter table public.policy_documents enable row level security;
create policy policy_documents_select on public.policy_documents for select
  using (organization_id = public.current_organization_id());
create policy policy_documents_write on public.policy_documents for all
  using (organization_id = public.current_organization_id() and public.is_hr_or_admin())
  with check (organization_id = public.current_organization_id() and public.is_hr_or_admin());

alter table public.previous_employer_declarations enable row level security;
create policy previous_employer_declarations_select on public.previous_employer_declarations for select
  using (employee_id = public.current_employee_id() or public.is_hr_or_admin());
create policy previous_employer_declarations_insert on public.previous_employer_declarations for insert
  with check (employee_id = public.current_employee_id());
create policy previous_employer_declarations_update on public.previous_employer_declarations for update
  using (employee_id = public.current_employee_id() or public.is_hr_or_admin());

-- Bucket for org-wide policy documents, keyed by `<organization_id>/<filename>`
-- (parallel to the per-employee folder convention in 0022_storage_buckets.sql).
insert into storage.buckets (id, name, public)
values ('policy-documents', 'policy-documents', false)
on conflict (id) do nothing;

create policy "policy_documents_read" on storage.objects for select
  using (
    bucket_id = 'policy-documents'
    and (storage.foldername(name))[1] = public.current_organization_id()::text
  );
create policy "policy_documents_write" on storage.objects for insert
  with check (
    bucket_id = 'policy-documents'
    and (storage.foldername(name))[1] = public.current_organization_id()::text
    and public.is_hr_or_admin()
  );
create policy "policy_documents_delete" on storage.objects for delete
  using (
    bucket_id = 'policy-documents'
    and (storage.foldername(name))[1] = public.current_organization_id()::text
    and public.is_hr_or_admin()
  );

-- Masked reads for the two most sensitive profile tabs. The employee-facing
-- UI calls these RPCs instead of selecting statutory_details/bank_details
-- directly, so the full PAN/Aadhaar/account number never leaves Postgres for
-- a routine profile view — only the last 4 characters do. Each call is
-- audit-logged. HR/admin tooling (a future Admin console) that genuinely
-- needs the unmasked value still can, via the existing RLS-gated direct
-- table select — masking here is a UI/least-privilege layer on top of that,
-- not a replacement for it. True column-level encryption (pgcrypto, already
-- enabled) is a natural next step once a KMS-backed secret exists to encrypt
-- under; without one, a hardcoded app-level key would be security theater,
-- so it's intentionally left as a documented follow-up rather than faked.
create or replace function public.get_my_statutory_details()
returns table (
  pan_number text,
  aadhaar_number text,
  uan_number text,
  pf_number text,
  esi_number text,
  tax_regime text
)
language plpgsql security definer set search_path = public as $$
declare
  _employee_id uuid := public.current_employee_id();
  _org_id uuid;
begin
  if _employee_id is null then
    return;
  end if;

  select organization_id into _org_id from public.employees where id = _employee_id;
  insert into public.audit_logs (organization_id, actor_user_id, action, module, record_id)
    values (_org_id, auth.uid(), 'view', 'statutory_details', _employee_id);

  return query
  select
    case when sd.pan_number is null then null else overlay(sd.pan_number placing repeat('X', greatest(length(sd.pan_number) - 4, 0)) from 1 for greatest(length(sd.pan_number) - 4, 0)) end,
    case when sd.aadhaar_number is null then null else overlay(sd.aadhaar_number placing repeat('X', greatest(length(sd.aadhaar_number) - 4, 0)) from 1 for greatest(length(sd.aadhaar_number) - 4, 0)) end,
    sd.uan_number,
    sd.pf_number,
    sd.esi_number,
    sd.tax_regime
  from public.statutory_details sd
  where sd.employee_id = _employee_id;
end;
$$;
grant execute on function public.get_my_statutory_details() to authenticated;

create or replace function public.get_my_bank_details()
returns table (
  bank_name text,
  account_number text,
  ifsc_code text,
  branch text,
  account_holder_name text,
  is_pending_change boolean
)
language plpgsql security definer set search_path = public as $$
declare
  _employee_id uuid := public.current_employee_id();
  _org_id uuid;
begin
  if _employee_id is null then
    return;
  end if;

  select organization_id into _org_id from public.employees where id = _employee_id;
  insert into public.audit_logs (organization_id, actor_user_id, action, module, record_id)
    values (_org_id, auth.uid(), 'view', 'bank_details', _employee_id);

  return query
  select
    bd.bank_name,
    case when bd.account_number is null then null else overlay(bd.account_number placing repeat('X', greatest(length(bd.account_number) - 4, 0)) from 1 for greatest(length(bd.account_number) - 4, 0)) end,
    bd.ifsc_code,
    bd.branch,
    bd.account_holder_name,
    bd.is_pending_change
  from public.bank_details bd
  where bd.employee_id = _employee_id;
end;
$$;
grant execute on function public.get_my_bank_details() to authenticated;

-- ============================================================
-- 0027_exit_extras.sql
-- ============================================================
-- Exit module additions: department clearance workflow, final settlement,
-- an HR-contact lookup, and the two SECURITY DEFINER RPCs that drive the
-- resignation approval / clearance state machines (the same pattern as
-- act_on_approval() for Attendance — see 0025_approval_action_rpc.sql).

create table public.exit_clearances (
  id uuid primary key default gen_random_uuid(),
  exit_request_id uuid not null references public.exit_requests(id) on delete cascade,
  department text not null check (department in ('manager', 'hr', 'it', 'finance', 'admin')),
  status text not null default 'pending' check (status in ('pending', 'cleared', 'rejected')),
  remarks text,
  cleared_by uuid references public.employees(id),
  cleared_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (exit_request_id, department)
);
create trigger trg_exit_clearances_updated_at before update on public.exit_clearances
  for each row execute function public.set_updated_at();
create index idx_exit_clearances_request on public.exit_clearances(exit_request_id);

create table public.exit_settlements (
  id uuid primary key default gen_random_uuid(),
  exit_request_id uuid not null unique references public.exit_requests(id) on delete cascade,
  last_working_date date not null,
  leave_encashment numeric(12,2) not null default 0,
  notice_pay numeric(12,2) not null default 0,
  pending_salary numeric(12,2) not null default 0,
  deductions numeric(12,2) not null default 0,
  bonus numeric(12,2) not null default 0,
  other_adjustments numeric(12,2) not null default 0,
  -- Kept in sync with src/lib/settlementCalc.ts's calculateFinalSettlement() —
  -- update both if the formula ever changes.
  final_settlement_amount numeric(12,2) generated always as (
    pending_salary + leave_encashment + bonus + other_adjustments - notice_pay - deductions
  ) stored,
  status text not null default 'draft' check (status in ('draft', 'released')),
  released_by uuid references public.employees(id),
  released_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_exit_settlements_updated_at before update on public.exit_settlements
  for each row execute function public.set_updated_at();

-- RLS: exit_clearances is select-only for plain clients — every write goes
-- through act_on_exit_clearance() below, which enforces per-department
-- authorization server-side.
alter table public.exit_clearances enable row level security;
create policy exit_clearances_select on public.exit_clearances for select
  using (
    public.is_hr_or_admin()
    or exists (
      select 1 from public.exit_requests er
      where er.id = exit_request_id
        and (er.employee_id = public.current_employee_id() or public.is_manager_of(er.employee_id))
    )
  );

alter table public.exit_settlements enable row level security;
create policy exit_settlements_select on public.exit_settlements for select
  using (
    public.is_hr_or_admin()
    or (
      status = 'released'
      and exists (select 1 from public.exit_requests er where er.id = exit_request_id and er.employee_id = public.current_employee_id())
    )
  );
create policy exit_settlements_write on public.exit_settlements for all
  using (public.is_hr_or_admin()) with check (public.is_hr_or_admin());

-- Tighten exit_requests_update (0020_rls_sensitive_and_payroll.sql): the
-- original policy let an employee or their manager UPDATE any column on a
-- row they can already see, including `status` — i.e. an employee could
-- set their own request straight to 'hr_approved' via a raw client update.
-- act_on_exit_request() below is the sanctioned path for every status
-- transition; this WITH CHECK backstops direct table access so self-service
-- updates can only ever land on the row's own "nothing happened yet" states.
drop policy if exists exit_requests_update on public.exit_requests;
create policy exit_requests_update on public.exit_requests for update
  using (
    employee_id = public.current_employee_id()
    or manager_id = public.current_employee_id()
    or public.is_hr_or_admin()
  )
  with check (
    public.is_hr_or_admin()
    or (employee_id = public.current_employee_id() and status in ('draft', 'withdrawn'))
    or (manager_id = public.current_employee_id() and status in ('manager_approved', 'rejected'))
  );

-- The exit interview is self-administered (spec: "Employee can submit
-- answers"), but the original exit_interviews_write/exit_interview_responses_write
-- policies only granted write access to is_hr_or_admin() or conducted_by =
-- self — conducted_by is for an HR-run interview, so a plain employee could
-- never actually submit their own responses. Extend both to also allow the
-- interview's own employee_id.
drop policy if exists exit_interviews_write on public.exit_interviews;
create policy exit_interviews_write on public.exit_interviews for all
  using (public.is_hr_or_admin() or employee_id = public.current_employee_id() or conducted_by = public.current_employee_id())
  with check (public.is_hr_or_admin() or employee_id = public.current_employee_id() or conducted_by = public.current_employee_id());

drop policy if exists exit_interview_responses_write on public.exit_interview_responses;
create policy exit_interview_responses_write on public.exit_interview_responses for all
  using (
    public.is_hr_or_admin()
    or exists (
      select 1 from public.exit_interviews ei
      where ei.id = exit_interview_id
        and (ei.employee_id = public.current_employee_id() or ei.conducted_by = public.current_employee_id())
    )
  )
  with check (
    public.is_hr_or_admin()
    or exists (
      select 1 from public.exit_interviews ei
      where ei.id = exit_interview_id
        and (ei.employee_id = public.current_employee_id() or ei.conducted_by = public.current_employee_id())
    )
  );

-- Read-only HR-contact lookup for the Exit Dashboard. A plain employee can't
-- otherwise see who holds the hr_admin role (user_roles RLS is self-or-HR
-- only) — this exposes just name + email, nothing else.
create or replace function public.get_hr_contact()
returns table (display_name text, email text)
language sql stable security definer set search_path = public as $$
  select (e.first_name || coalesce(' ' || e.last_name, ''))::text, e.official_email
  from public.employees e
  join public.user_roles ur on ur.user_id = e.user_id
  join public.roles r on r.id = ur.role_id
  where e.organization_id = public.current_organization_id()
    and r.code = 'hr_admin'
  order by e.employee_code
  limit 1;
$$;
grant execute on function public.get_hr_contact() to authenticated;

-- Resignation workflow state machine (spec section 3). Submission itself
-- stays a plain client insert (matching how leave/permission/regularization
-- requests are created elsewhere in the app); every subsequent transition —
-- manager approve/reject, HR approve/reject, employee withdraw — goes
-- through this RPC so status changes are authorized and audited in one
-- place. HR-approve additionally provisions the five clearance rows and the
-- exit interview record, since both only become meaningful once HR has
-- signed off.
create or replace function public.act_on_exit_request(
  _exit_request_id uuid,
  _action text,
  _remarks text default null
)
returns void
language plpgsql security definer set search_path = public as $$
declare
  _actor_id uuid := public.current_employee_id();
  _req public.exit_requests%rowtype;
  _org_id uuid;
  _recipient_user uuid;
  _title text;
begin
  select * into _req from public.exit_requests where id = _exit_request_id for update;
  if not found then
    raise exception 'act_on_exit_request: request not found';
  end if;

  if _action = 'withdraw' then
    if _req.employee_id <> _actor_id then
      raise exception 'act_on_exit_request: only the employee can withdraw their own resignation';
    end if;
    if _req.status not in ('submitted', 'manager_approved') then
      raise exception 'act_on_exit_request: cannot withdraw a resignation in status %', _req.status;
    end if;
    update public.exit_requests set status = 'withdrawn' where id = _exit_request_id;
    return;
  end if;

  if _action in ('manager_approve', 'manager_reject') then
    if not (public.is_manager_of(_req.employee_id) or public.is_hr_or_admin()) then
      raise exception 'act_on_exit_request: not authorized as manager';
    end if;
    if _req.status <> 'submitted' then
      raise exception 'act_on_exit_request: resignation is not pending manager review';
    end if;

    if _action = 'manager_approve' then
      update public.exit_requests
        set status = 'manager_approved', manager_approved_at = now(), manager_remarks = _remarks
        where id = _exit_request_id;
      _title := 'Your resignation was approved by your manager';
    else
      update public.exit_requests set status = 'rejected', manager_remarks = _remarks where id = _exit_request_id;
      _title := 'Your resignation was rejected by your manager';
    end if;

  elsif _action in ('hr_approve', 'hr_reject') then
    if not public.is_hr_or_admin() then
      raise exception 'act_on_exit_request: not authorized as HR';
    end if;
    if _req.status <> 'manager_approved' then
      raise exception 'act_on_exit_request: resignation is not pending HR review';
    end if;

    if _action = 'hr_approve' then
      update public.exit_requests
        set status = 'hr_approved', hr_approver_id = _actor_id, hr_approved_at = now(), hr_remarks = _remarks
        where id = _exit_request_id;

      insert into public.exit_clearances (exit_request_id, department)
        select _exit_request_id, d from unnest(array['manager', 'hr', 'it', 'finance', 'admin']) as d
        on conflict (exit_request_id, department) do nothing;

      insert into public.exit_interviews (exit_request_id, employee_id, status)
        values (_exit_request_id, _req.employee_id, 'pending')
        on conflict (exit_request_id) do nothing;

      _title := 'Your resignation was approved by HR. Exit clearance and interview are now available.';
    else
      update public.exit_requests set status = 'rejected', hr_remarks = _remarks where id = _exit_request_id;
      _title := 'Your resignation was rejected by HR';
    end if;
  else
    raise exception 'act_on_exit_request: unsupported action %', _action;
  end if;

  select organization_id, user_id into _org_id, _recipient_user from public.employees where id = _req.employee_id;
  if _recipient_user is not null then
    insert into public.notifications (organization_id, recipient_user_id, notification_type, title, body, link_path)
      values (_org_id, _recipient_user, 'resignation_update', _title, _remarks, '/exit');
  end if;
end;
$$;
grant execute on function public.act_on_exit_request(uuid, text, text) to authenticated;

-- Per-department clearance marking (spec section 6). Any department can be
-- actioned by HR/admin; the 'manager' row can additionally be actioned by
-- the employee's actual reporting-chain manager. Once every department
-- reads 'cleared', the parent resignation flips to 'completed'.
create or replace function public.act_on_exit_clearance(
  _clearance_id uuid,
  _status text,
  _remarks text default null
)
returns void
language plpgsql security definer set search_path = public as $$
declare
  _actor_id uuid := public.current_employee_id();
  _department text;
  _exit_request_id uuid;
  _req_employee_id uuid;
  _org_id uuid;
  _recipient_user uuid;
  _remaining int;
begin
  if _status not in ('cleared', 'rejected') then
    raise exception 'act_on_exit_clearance: status must be cleared or rejected';
  end if;

  select ec.department, ec.exit_request_id, er.employee_id
    into _department, _exit_request_id, _req_employee_id
  from public.exit_clearances ec
  join public.exit_requests er on er.id = ec.exit_request_id
  where ec.id = _clearance_id
  for update of ec;

  if not found then
    raise exception 'act_on_exit_clearance: clearance not found';
  end if;

  if not (
    public.is_hr_or_admin()
    or (_department = 'manager' and public.is_manager_of(_req_employee_id))
  ) then
    raise exception 'act_on_exit_clearance: not authorized to act on % clearance', _department;
  end if;

  update public.exit_clearances
    set status = _status, remarks = _remarks, cleared_by = _actor_id, cleared_at = now()
    where id = _clearance_id;

  select count(*) into _remaining
  from public.exit_clearances
  where exit_request_id = _exit_request_id and status <> 'cleared';

  if _remaining = 0 then
    update public.exit_requests set status = 'completed' where id = _exit_request_id and status = 'hr_approved';
  end if;

  select organization_id, user_id into _org_id, _recipient_user from public.employees where id = _req_employee_id;
  if _recipient_user is not null then
    insert into public.notifications (organization_id, recipient_user_id, notification_type, title, body, link_path)
      values (
        _org_id, _recipient_user, 'resignation_update',
        initcap(_department) || ' clearance ' || _status,
        _remarks, '/exit'
      );
  end if;
end;
$$;
grant execute on function public.act_on_exit_clearance(uuid, text, text) to authenticated;

-- ============================================================
-- 0028_mss_other_requests_and_approvals.sql
-- ============================================================
-- Manager Self Service: adds the "Other Requests" category, extends the
-- approval engine to cover all 5 pending-approval categories (leave,
-- permission, attendance regularization, on duty/work-from-home, other), and
-- makes act_on_approval write a real audit_logs row on every decision.

-- 1. Other Requests table -----------------------------------------------

create table public.other_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  request_title text not null,
  request_date date not null,
  reason text not null,
  reporting_manager_id uuid references public.employees(id),
  entry_by uuid references public.employees(id),
  applied_on timestamptz not null default now(),
  status text not null default 'pending'
    check (status in ('draft', 'pending', 'approved', 'rejected', 'cancelled')),
  approval_remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_other_requests_updated_at before update on public.other_requests
  for each row execute function public.set_updated_at();
create index idx_other_requests_employee on public.other_requests(employee_id, request_date);
create index idx_other_requests_manager on public.other_requests(reporting_manager_id, status);

alter table public.other_requests enable row level security;
create policy other_requests_select on public.other_requests for select
  using (employee_id = public.current_employee_id() or public.is_manager_of(employee_id) or public.is_hr_or_admin());
create policy other_requests_insert on public.other_requests for insert
  with check (employee_id = public.current_employee_id() or public.is_hr_or_admin());
create policy other_requests_update on public.other_requests for update
  using (employee_id = public.current_employee_id() or public.is_manager_of(employee_id) or public.is_hr_or_admin());

-- 2. request_owner_employee_id(): add 'other_request' arm ---------------

create or replace function public.request_owner_employee_id(_request_type text, _request_id uuid)
returns uuid
language sql stable security definer set search_path = public as $$
  select case _request_type
    when 'leave_request' then (select employee_id from public.leave_requests where id = _request_id)
    when 'permission_request' then (select employee_id from public.permission_requests where id = _request_id)
    when 'onduty_request' then (select employee_id from public.onduty_requests where id = _request_id)
    when 'attendance_regularization' then (select employee_id from public.attendance_regularizations where id = _request_id)
    when 'exit_request' then (select employee_id from public.exit_requests where id = _request_id)
    when 'bank_detail_change_request' then (select employee_id from public.bank_detail_change_requests where id = _request_id)
    when 'other_request' then (select employee_id from public.other_requests where id = _request_id)
    else null
  end;
$$;

-- 3. approval_workflows.request_type: allow 'other_request' -------------

alter table public.approval_workflows
  drop constraint if exists approval_workflows_request_type_check,
  add constraint approval_workflows_request_type_check check (
    request_type in (
      'leave_request', 'permission_request', 'onduty_request',
      'attendance_regularization', 'exit_request', 'bank_detail_change_request',
      'other_request'
    )
  );

-- 4. notifications.notification_type: add onduty/other outcomes ---------

alter table public.notifications
  drop constraint if exists notifications_notification_type_check,
  add constraint notifications_notification_type_check check (
    notification_type in (
      'leave_approved', 'leave_rejected', 'permission_approved', 'permission_rejected',
      'regularization_approved', 'regularization_rejected',
      'onduty_approved', 'onduty_rejected',
      'other_request_approved', 'other_request_rejected',
      'new_approval', 'resignation_update', 'document_verification', 'system_announcement'
    )
  );

-- 5. act_on_approval: cover all 5 request types + write an audit_logs row

create or replace function public.act_on_approval(
  _request_type text,
  _request_id uuid,
  _action text,
  _remarks text default null
)
returns void
language plpgsql security definer set search_path = public as $$
declare
  _owner_id uuid;
  _actor_id uuid := public.current_employee_id();
  _org_id uuid;
  _old_status text;
  _workflow_id uuid;
  _instance_id uuid;
  _recipient_user uuid;
  _notification_type text;
  _title text;
begin
  if _action not in ('approved', 'rejected') then
    raise exception 'act_on_approval: action must be ''approved'' or ''rejected'', got %', _action;
  end if;

  _owner_id := public.request_owner_employee_id(_request_type, _request_id);
  if _owner_id is null then
    raise exception 'act_on_approval: request % / % not found', _request_type, _request_id;
  end if;

  if _actor_id is null or not (public.is_hr_or_admin() or public.is_manager_of(_owner_id)) then
    raise exception 'act_on_approval: not authorized to act on this request';
  end if;

  select organization_id into _org_id from public.employees where id = _owner_id;

  if _request_type = 'leave_request' then
    select status into _old_status from public.leave_requests where id = _request_id;
    update public.leave_requests
      set status = _action, approval_remarks = _remarks
      where id = _request_id and status = 'pending';
  elsif _request_type = 'permission_request' then
    select status into _old_status from public.permission_requests where id = _request_id;
    update public.permission_requests
      set status = _action, approval_remarks = _remarks
      where id = _request_id and status = 'pending';
  elsif _request_type = 'attendance_regularization' then
    select status into _old_status from public.attendance_regularizations where id = _request_id;
    update public.attendance_regularizations
      set status = _action, approval_remarks = _remarks, approver_id = _actor_id
      where id = _request_id and status = 'pending';
  elsif _request_type = 'onduty_request' then
    select status into _old_status from public.onduty_requests where id = _request_id;
    update public.onduty_requests
      set status = _action, approval_remarks = _remarks
      where id = _request_id and status = 'pending';
  elsif _request_type = 'other_request' then
    select status into _old_status from public.other_requests where id = _request_id;
    update public.other_requests
      set status = _action, approval_remarks = _remarks
      where id = _request_id and status = 'pending';
  else
    raise exception 'act_on_approval: unsupported request type %', _request_type;
  end if;

  if not found then
    raise exception 'act_on_approval: request is not pending (already actioned?)';
  end if;

  insert into public.audit_logs (organization_id, actor_user_id, action, module, record_id, old_value, new_value)
    values (
      _org_id, auth.uid(), (case when _action = 'approved' then 'approval' else 'rejection' end),
      'manager_self_service', _request_id,
      jsonb_build_object('request_type', _request_type, 'status', _old_status),
      jsonb_build_object('request_type', _request_type, 'status', _action, 'remarks', _remarks)
    );

  select id into _workflow_id from public.approval_workflows
    where organization_id = _org_id and request_type = _request_type and is_active
    order by created_at limit 1;

  if _workflow_id is not null then
    insert into public.approval_instances (workflow_id, request_type, request_id, status, current_step_order)
      values (_workflow_id, _request_type, _request_id, _action, 1)
      on conflict (request_type, request_id) do update set status = excluded.status
      returning id into _instance_id;

    insert into public.approval_actions (approval_instance_id, step_order, actor_employee_id, action, remarks)
      values (_instance_id, 1, _actor_id, _action, _remarks);
  end if;

  _notification_type := case _request_type
    when 'leave_request' then (case when _action = 'approved' then 'leave_approved' else 'leave_rejected' end)
    when 'permission_request' then (case when _action = 'approved' then 'permission_approved' else 'permission_rejected' end)
    when 'attendance_regularization' then (case when _action = 'approved' then 'regularization_approved' else 'regularization_rejected' end)
    when 'onduty_request' then (case when _action = 'approved' then 'onduty_approved' else 'onduty_rejected' end)
    when 'other_request' then (case when _action = 'approved' then 'other_request_approved' else 'other_request_rejected' end)
  end;
  _title := case when _action = 'approved' then 'Your request has been approved' else 'Your request has been rejected' end;

  select user_id into _recipient_user from public.employees where id = _owner_id;
  if _recipient_user is not null then
    insert into public.notifications (organization_id, recipient_user_id, notification_type, title, body, link_path)
      values (_org_id, _recipient_user, _notification_type, _title, _remarks, '/attendance/event-request');
  end if;
end;
$$;

grant execute on function public.act_on_approval(text, uuid, text, text) to authenticated;

-- ============================================================
-- 0029_admin_module_extras.sql
-- ============================================================
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

-- ============================================================
-- 0030_data_governance_hardening.sql
-- ============================================================
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

-- ============================================================
-- 0031_leave_balance_and_overlap_guards.sql
-- ============================================================
-- Two real gaps found during a production-readiness audit, both against the
-- already-live leave workflow (act_on_approval(), most recently rewritten
-- by 0028 to cover 5 request types + write an audit_logs row):
--
-- a) act_on_approval() flips leave_requests.status to 'approved' but never
--    touches leave_balances — the Balance screen (BalancePage.tsx) never
--    reflects an approved leave's usage, no matter how many requests are
--    approved. Fixed by deducting duration_days from the matching period's
--    `used`/`balance` inside the same transaction as the approval, with a
--    guard against driving balance negative (defense in depth — the app
--    already blocks this client-side in leaveValidation.ts, but a raw
--    approval racing two overlapping requests could still get here).
--
-- b) Overlap protection (leaveValidation.ts) only ever ran in the browser;
--    a direct client insert bypassing the app could still create
--    overlapping leave requests. Closed with a DB-level exclusion
--    constraint mirroring the app's own overlap semantics exactly (same
--    employee, overlapping [from_date, to_date], status still
--    draft/pending/approved — see ACTIVE_STATUSES in leaveValidation.ts).
--
-- This migration re-declares act_on_approval() in full (function body
-- replacement is all-or-nothing) — everything below except the new
-- "deduct leave balance" block is unchanged from 0028's version.
--
-- c) audit_row_change() (0030) resolves organization_id via
--    current_organization_id(), which depends on auth.uid() — null for any
--    write made outside an authenticated app session (this migration's own
--    backfill below included). audit_logs.organization_id is not-null, so
--    that trigger firing during a migration/admin-context write on any of
--    the 19 audited tables would hard-fail the whole statement. Made
--    non-fatal: skip the audit row (nothing meaningful to attribute it to)
--    instead of raising.

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

  if _org_id is null then
    return coalesce(new, old);
  end if;

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

create extension if not exists btree_gist;

alter table public.leave_requests
  add constraint leave_requests_no_overlap
  exclude using gist (
    employee_id with =,
    daterange(from_date, to_date, '[]') with &&
  )
  where (status in ('draft', 'pending', 'approved'));

create or replace function public.act_on_approval(
  _request_type text,
  _request_id uuid,
  _action text,
  _remarks text default null
)
returns void
language plpgsql security definer set search_path = public as $$
declare
  _owner_id uuid;
  _actor_id uuid := public.current_employee_id();
  _org_id uuid;
  _old_status text;
  _workflow_id uuid;
  _instance_id uuid;
  _recipient_user uuid;
  _notification_type text;
  _title text;
  _leave_type_id uuid;
  _duration numeric(5,2);
  _from_date date;
  _balance_id uuid;
  _remaining numeric(6,2);
begin
  if _action not in ('approved', 'rejected') then
    raise exception 'act_on_approval: action must be ''approved'' or ''rejected'', got %', _action;
  end if;

  _owner_id := public.request_owner_employee_id(_request_type, _request_id);
  if _owner_id is null then
    raise exception 'act_on_approval: request % / % not found', _request_type, _request_id;
  end if;

  if _actor_id is null or not (public.is_hr_or_admin() or public.is_manager_of(_owner_id)) then
    raise exception 'act_on_approval: not authorized to act on this request';
  end if;

  select organization_id into _org_id from public.employees where id = _owner_id;

  if _request_type = 'leave_request' then
    select status into _old_status from public.leave_requests where id = _request_id;
    update public.leave_requests
      set status = _action, approval_remarks = _remarks
      where id = _request_id and status = 'pending'
      returning leave_type_id, duration_days, from_date into _leave_type_id, _duration, _from_date;
  elsif _request_type = 'permission_request' then
    select status into _old_status from public.permission_requests where id = _request_id;
    update public.permission_requests
      set status = _action, approval_remarks = _remarks
      where id = _request_id and status = 'pending';
  elsif _request_type = 'attendance_regularization' then
    select status into _old_status from public.attendance_regularizations where id = _request_id;
    update public.attendance_regularizations
      set status = _action, approval_remarks = _remarks, approver_id = _actor_id
      where id = _request_id and status = 'pending';
  elsif _request_type = 'onduty_request' then
    select status into _old_status from public.onduty_requests where id = _request_id;
    update public.onduty_requests
      set status = _action, approval_remarks = _remarks
      where id = _request_id and status = 'pending';
  elsif _request_type = 'other_request' then
    select status into _old_status from public.other_requests where id = _request_id;
    update public.other_requests
      set status = _action, approval_remarks = _remarks
      where id = _request_id and status = 'pending';
  else
    raise exception 'act_on_approval: unsupported request type %', _request_type;
  end if;

  if not found then
    raise exception 'act_on_approval: request is not pending (already actioned?)';
  end if;

  -- Deduct the matching leave-balance period on approval only. Locks the row
  -- (select ... for update) so two concurrent approvals for the same
  -- employee/leave-type can't both read a stale balance and both pass the
  -- negative-balance check.
  if _request_type = 'leave_request' and _action = 'approved' then
    select id, balance into _balance_id, _remaining
      from public.leave_balances
      where employee_id = _owner_id
        and leave_type_id = _leave_type_id
        and period_start <= _from_date and period_end >= _from_date
      for update;

    if _balance_id is not null then
      if _remaining - _duration < 0 then
        raise exception 'act_on_approval: approving this request would drive leave type % balance negative (% available, % requested)',
          _leave_type_id, _remaining, _duration;
      end if;
      update public.leave_balances
        set used = used + _duration, balance = balance - _duration
        where id = _balance_id;
    end if;
    -- No matching balance period is left un-deducted rather than blocking
    -- the approval outright — leave types with accrual_frequency = 'none'
    -- (e.g. unpaid/compensatory) may legitimately have no leave_balances row.
  end if;

  insert into public.audit_logs (organization_id, actor_user_id, action, module, record_id, old_value, new_value)
    values (
      _org_id, auth.uid(), (case when _action = 'approved' then 'approval' else 'rejection' end),
      'manager_self_service', _request_id,
      jsonb_build_object('request_type', _request_type, 'status', _old_status),
      jsonb_build_object('request_type', _request_type, 'status', _action, 'remarks', _remarks)
    );

  select id into _workflow_id from public.approval_workflows
    where organization_id = _org_id and request_type = _request_type and is_active
    order by created_at limit 1;

  if _workflow_id is not null then
    insert into public.approval_instances (workflow_id, request_type, request_id, status, current_step_order)
      values (_workflow_id, _request_type, _request_id, _action, 1)
      on conflict (request_type, request_id) do update set status = excluded.status
      returning id into _instance_id;

    insert into public.approval_actions (approval_instance_id, step_order, actor_employee_id, action, remarks)
      values (_instance_id, 1, _actor_id, _action, _remarks);
  end if;

  _notification_type := case _request_type
    when 'leave_request' then (case when _action = 'approved' then 'leave_approved' else 'leave_rejected' end)
    when 'permission_request' then (case when _action = 'approved' then 'permission_approved' else 'permission_rejected' end)
    when 'attendance_regularization' then (case when _action = 'approved' then 'regularization_approved' else 'regularization_rejected' end)
    when 'onduty_request' then (case when _action = 'approved' then 'onduty_approved' else 'onduty_rejected' end)
    when 'other_request' then (case when _action = 'approved' then 'other_request_approved' else 'other_request_rejected' end)
  end;
  _title := case when _action = 'approved' then 'Your request has been approved' else 'Your request has been rejected' end;

  select user_id into _recipient_user from public.employees where id = _owner_id;
  if _recipient_user is not null then
    insert into public.notifications (organization_id, recipient_user_id, notification_type, title, body, link_path)
      values (_org_id, _recipient_user, _notification_type, _title, _remarks, '/attendance/event-request');
  end if;
end;
$$;

grant execute on function public.act_on_approval(text, uuid, text, text) to authenticated;

-- Fix pre-existing seed data inconsistency found alongside this bug: seeded
-- leave_balances always show used = 0 even for the seeded employee's 5
-- already-'approved' leave requests (see supabase/seed/seed.sql). Backfill
-- `used`/`balance` for any currently-'approved' leave_requests row whose
-- balance period was never decremented, so existing data matches what
-- act_on_approval() will now maintain going forward.
do $$
declare
  r record;
begin
  for r in
    select lr.employee_id, lr.leave_type_id, lr.duration_days, lr.from_date
    from public.leave_requests lr
    where lr.status = 'approved'
  loop
    update public.leave_balances
      set used = used + r.duration_days, balance = balance - r.duration_days
      where employee_id = r.employee_id
        and leave_type_id = r.leave_type_id
        and period_start <= r.from_date and period_end >= r.from_date;
  end loop;
end;
$$;

-- ============================================================
-- 0032_regularization_applies_to_attendance.sql
-- ============================================================
-- Real bug found during a production-readiness audit: approving an
-- attendance_regularizations row only ever flipped that row's own `status`
-- column. The actual `attendance` table — the one every other screen reads
-- (calendar, in/out records, reports, team attendance) — was never touched.
-- An employee could submit "I missed my punch, I was really in at 9:15",
-- have their manager approve it, and their attendance record would remain
-- exactly as wrong as before. `attendance.is_regularized` has existed since
-- 0006 and was never set by anything — confirms this was never wired up.
--
-- This migration re-declares act_on_approval() in full again (as 0031 did)
-- — everything below except the new "apply regularization to attendance"
-- block is unchanged from 0031's version.

create or replace function public.act_on_approval(
  _request_type text,
  _request_id uuid,
  _action text,
  _remarks text default null
)
returns void
language plpgsql security definer set search_path = public as $$
declare
  _owner_id uuid;
  _actor_id uuid := public.current_employee_id();
  _org_id uuid;
  _old_status text;
  _workflow_id uuid;
  _instance_id uuid;
  _recipient_user uuid;
  _notification_type text;
  _title text;
  _leave_type_id uuid;
  _duration numeric(5,2);
  _from_date date;
  _balance_id uuid;
  _remaining numeric(6,2);
  -- Regularization -> attendance sync
  _reg_date date;
  _reg_check_in timestamptz;
  _reg_check_out timestamptz;
  _existing_check_in timestamptz;
  _existing_check_out timestamptz;
  _shift_id uuid;
  _shift_start time;
  _shift_end time;
  _grace int;
  _half_day_hours numeric;
  _full_day_hours numeric;
  _check_in_minutes int;
  _check_out_minutes int;
  _shift_start_minutes int;
  _shift_end_minutes int;
  _effective_minutes int;
  _late_minutes int;
  _early_going_minutes int;
  _excess_stay_minutes int;
  _shortfall_minutes int;
  _day_status text;
begin
  if _action not in ('approved', 'rejected') then
    raise exception 'act_on_approval: action must be ''approved'' or ''rejected'', got %', _action;
  end if;

  _owner_id := public.request_owner_employee_id(_request_type, _request_id);
  if _owner_id is null then
    raise exception 'act_on_approval: request % / % not found', _request_type, _request_id;
  end if;

  if _actor_id is null or not (public.is_hr_or_admin() or public.is_manager_of(_owner_id)) then
    raise exception 'act_on_approval: not authorized to act on this request';
  end if;

  select organization_id into _org_id from public.employees where id = _owner_id;

  if _request_type = 'leave_request' then
    select status into _old_status from public.leave_requests where id = _request_id;
    update public.leave_requests
      set status = _action, approval_remarks = _remarks
      where id = _request_id and status = 'pending'
      returning leave_type_id, duration_days, from_date into _leave_type_id, _duration, _from_date;
  elsif _request_type = 'permission_request' then
    select status into _old_status from public.permission_requests where id = _request_id;
    update public.permission_requests
      set status = _action, approval_remarks = _remarks
      where id = _request_id and status = 'pending';
  elsif _request_type = 'attendance_regularization' then
    select status into _old_status from public.attendance_regularizations where id = _request_id;
    update public.attendance_regularizations
      set status = _action, approval_remarks = _remarks, approver_id = _actor_id
      where id = _request_id and status = 'pending'
      returning attendance_date, requested_check_in, requested_check_out
        into _reg_date, _reg_check_in, _reg_check_out;
  elsif _request_type = 'onduty_request' then
    select status into _old_status from public.onduty_requests where id = _request_id;
    update public.onduty_requests
      set status = _action, approval_remarks = _remarks
      where id = _request_id and status = 'pending';
  elsif _request_type = 'other_request' then
    select status into _old_status from public.other_requests where id = _request_id;
    update public.other_requests
      set status = _action, approval_remarks = _remarks
      where id = _request_id and status = 'pending';
  else
    raise exception 'act_on_approval: unsupported request type %', _request_type;
  end if;

  if not found then
    raise exception 'act_on_approval: request is not pending (already actioned?)';
  end if;

  -- Deduct the matching leave-balance period on approval only (0031).
  if _request_type = 'leave_request' and _action = 'approved' then
    select id, balance into _balance_id, _remaining
      from public.leave_balances
      where employee_id = _owner_id
        and leave_type_id = _leave_type_id
        and period_start <= _from_date and period_end >= _from_date
      for update;

    if _balance_id is not null then
      if _remaining - _duration < 0 then
        raise exception 'act_on_approval: approving this request would drive leave type % balance negative (% available, % requested)',
          _leave_type_id, _remaining, _duration;
      end if;
      update public.leave_balances
        set used = used + _duration, balance = balance - _duration
        where id = _balance_id;
    end if;
  end if;

  -- Apply an approved regularization to the actual attendance row. Resolve
  -- the shift from the existing attendance row if one exists, else from the
  -- employee's active shift_assignments as of the attendance date (mirrors
  -- how seed.sql assigns shifts). Falls back to marking the day 'present'
  -- with is_regularized = true (no shift-relative metrics) if no shift can
  -- be resolved at all, rather than silently doing nothing.
  if _request_type = 'attendance_regularization' and _action = 'approved' then
    select check_in, check_out, shift_id into _existing_check_in, _existing_check_out, _shift_id
      from public.attendance where employee_id = _owner_id and attendance_date = _reg_date;

    if _shift_id is null then
      select shift_id into _shift_id from public.shift_assignments
        where employee_id = _owner_id and effective_from <= _reg_date
        order by effective_from desc limit 1;
    end if;

    _reg_check_in := coalesce(_reg_check_in, _existing_check_in);
    _reg_check_out := coalesce(_reg_check_out, _existing_check_out);

    if _shift_id is not null then
      select start_time, end_time, grace_minutes, half_day_hours, full_day_hours
        into _shift_start, _shift_end, _grace, _half_day_hours, _full_day_hours
        from public.shifts where id = _shift_id;
    end if;

    if _reg_check_in is not null and _reg_check_out is not null and _shift_id is not null then
      _check_in_minutes := extract(hour from _reg_check_in)::int * 60 + extract(minute from _reg_check_in)::int;
      _check_out_minutes := extract(hour from _reg_check_out)::int * 60 + extract(minute from _reg_check_out)::int;
      if _check_out_minutes < _check_in_minutes then
        _check_out_minutes := _check_out_minutes + 1440; -- overnight shift/punch
      end if;

      _shift_start_minutes := extract(hour from _shift_start)::int * 60 + extract(minute from _shift_start)::int;
      _shift_end_minutes := extract(hour from _shift_end)::int * 60 + extract(minute from _shift_end)::int;
      if _shift_end_minutes <= _shift_start_minutes then
        _shift_end_minutes := _shift_end_minutes + 1440;
      end if;

      _effective_minutes := _check_out_minutes - _check_in_minutes;
      _late_minutes := greatest(0, _check_in_minutes - (_shift_start_minutes + coalesce(_grace, 0)));
      _early_going_minutes := greatest(0, _shift_end_minutes - _check_out_minutes);
      _excess_stay_minutes := greatest(0, _check_out_minutes - _shift_end_minutes);
      _shortfall_minutes := greatest(0, (coalesce(_full_day_hours, 8) * 60)::int - _effective_minutes);
      _day_status := case when _effective_minutes >= (coalesce(_half_day_hours, 4.5) * 60)::int then 'present' else 'half_day' end;

      insert into public.attendance (
        organization_id, employee_id, attendance_date, shift_id, check_in, check_out,
        effective_minutes, late_minutes, early_going_minutes, excess_stay_minutes, shortfall_minutes,
        day_status, validation_status, is_regularized, remarks
      ) values (
        _org_id, _owner_id, _reg_date, _shift_id, _reg_check_in, _reg_check_out,
        _effective_minutes, _late_minutes, _early_going_minutes, _excess_stay_minutes, _shortfall_minutes,
        _day_status, 'completed', true, _remarks
      )
      on conflict (employee_id, attendance_date) do update set
        shift_id = excluded.shift_id,
        check_in = excluded.check_in,
        check_out = excluded.check_out,
        effective_minutes = excluded.effective_minutes,
        late_minutes = excluded.late_minutes,
        early_going_minutes = excluded.early_going_minutes,
        excess_stay_minutes = excluded.excess_stay_minutes,
        shortfall_minutes = excluded.shortfall_minutes,
        day_status = excluded.day_status,
        validation_status = 'completed',
        is_regularized = true,
        remarks = coalesce(excluded.remarks, public.attendance.remarks);
    else
      -- No punch times and/or no resolvable shift (e.g. a plain
      -- present_correction with nothing but "I was present" and a reason) —
      -- still record the correction rather than silently dropping it.
      insert into public.attendance (organization_id, employee_id, attendance_date, shift_id, day_status, validation_status, is_regularized, remarks)
      values (_org_id, _owner_id, _reg_date, _shift_id, 'present', 'completed', true, _remarks)
      on conflict (employee_id, attendance_date) do update set
        day_status = 'present',
        validation_status = 'completed',
        is_regularized = true,
        remarks = coalesce(excluded.remarks, public.attendance.remarks);
    end if;
  end if;

  insert into public.audit_logs (organization_id, actor_user_id, action, module, record_id, old_value, new_value)
    values (
      _org_id, auth.uid(), (case when _action = 'approved' then 'approval' else 'rejection' end),
      'manager_self_service', _request_id,
      jsonb_build_object('request_type', _request_type, 'status', _old_status),
      jsonb_build_object('request_type', _request_type, 'status', _action, 'remarks', _remarks)
    );

  select id into _workflow_id from public.approval_workflows
    where organization_id = _org_id and request_type = _request_type and is_active
    order by created_at limit 1;

  if _workflow_id is not null then
    insert into public.approval_instances (workflow_id, request_type, request_id, status, current_step_order)
      values (_workflow_id, _request_type, _request_id, _action, 1)
      on conflict (request_type, request_id) do update set status = excluded.status
      returning id into _instance_id;

    insert into public.approval_actions (approval_instance_id, step_order, actor_employee_id, action, remarks)
      values (_instance_id, 1, _actor_id, _action, _remarks);
  end if;

  _notification_type := case _request_type
    when 'leave_request' then (case when _action = 'approved' then 'leave_approved' else 'leave_rejected' end)
    when 'permission_request' then (case when _action = 'approved' then 'permission_approved' else 'permission_rejected' end)
    when 'attendance_regularization' then (case when _action = 'approved' then 'regularization_approved' else 'regularization_rejected' end)
    when 'onduty_request' then (case when _action = 'approved' then 'onduty_approved' else 'onduty_rejected' end)
    when 'other_request' then (case when _action = 'approved' then 'other_request_approved' else 'other_request_rejected' end)
  end;
  _title := case when _action = 'approved' then 'Your request has been approved' else 'Your request has been rejected' end;

  select user_id into _recipient_user from public.employees where id = _owner_id;
  if _recipient_user is not null then
    insert into public.notifications (organization_id, recipient_user_id, notification_type, title, body, link_path)
      values (_org_id, _recipient_user, _notification_type, _title, _remarks, '/attendance/event-request');
  end if;
end;
$$;

grant execute on function public.act_on_approval(text, uuid, text, text) to authenticated;

-- ============================================================
-- 0033_permission_overlap_guard.sql
-- ============================================================
-- Real gap found during a production-readiness audit: unlike leave_requests
-- (0031), permission_requests had no overlap protection at all — neither
-- client-side nor DB-level — even though the spec explicitly calls out
-- "Overlapping permission" as a required check. Mirrors 0031's leave
-- exclusion constraint: same employee, overlapping [from_time, to_time) on
-- the same date, status still draft/pending/approved.

alter table public.permission_requests
  add constraint permission_requests_no_overlap
  exclude using gist (
    employee_id with =,
    tsrange(permission_date + from_time, permission_date + to_time, '[)') with &&
  )
  where (status in ('draft', 'pending', 'approved'));

-- ============================================================
-- 0034_regularization_duplicate_guard.sql
-- ============================================================
-- Real gap found during a production-readiness audit's "duplicate records"
-- check: attendance_regularizations has no protection against an employee
-- submitting more than one active (draft/pending) regularization for the
-- same date — RegularizationForm.tsx doesn't check for an existing request
-- before submitting, and there was no DB constraint either. Once one is
-- approved/rejected/cancelled, resubmitting for that same date is still
-- allowed (the partial index only covers draft/pending), matching how a
-- real employee would legitimately reapply after a rejection.

create unique index attendance_regularizations_one_active_per_day
  on public.attendance_regularizations (employee_id, attendance_date)
  where (status in ('draft', 'pending'));

-- ============================================================
-- 0035_exit_request_duplicate_guard.sql
-- ============================================================
-- Real gap found during a production-readiness audit's "duplicate records"
-- check, same class as 0034's attendance_regularizations fix: an employee
-- can only have one active resignation in flight per
-- ResignationEntryPage.tsx's client-side `activeRequest` check (blocks the
-- submit form while one exists), but nothing enforced this at the DB level
-- — a direct client insert could create a second active exit_requests row
-- for the same employee. Matches the exact active-status set the UI
-- already uses (ACTIVE_STATUSES in ResignationEntryPage.tsx).

create unique index exit_requests_one_active_per_employee
  on public.exit_requests (employee_id)
  where (status in ('submitted', 'manager_approved', 'hr_approved'));

-- ============================================================
-- 0036_fk_index_coverage.sql
-- ============================================================
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

-- ============================================================
-- 0037_wfh_and_leave_attendance_sync.sql
-- ============================================================
-- Two real gaps found while implementing the Work From Home workflow:
--
-- a) Approving a leave_request never touched the attendance table either —
--    same class of bug as 0032's regularization fix, just never noticed
--    because leave and attendance are read from different screens. An
--    approved leave day shows as a blank/missing attendance row today,
--    which would make a future "missing attendance" report wrongly flag a
--    legitimately-on-leave day as a missing punch. Fixed the same way:
--    approving a leave_request now upserts attendance.day_status = 'leave'
--    for every day in [from_date, to_date].
--
-- b) onduty_requests (on_duty / work_from_home) had no overlap protection
--    (mirrors 0031/0033's leave/permission fixes) and, once WFH gets a real
--    submission form, needs the same attendance sync: approving marks each
--    day in range as day_status = 'present' (the employee worked, just not
--    from the office) with a remark noting which type.
--
-- Cancellation reversing attendance impact (named in the WFH spec) is a
-- no-op by construction, not an unhandled case: canCancel() in
-- requestStatus.ts only allows cancelling a draft/pending request, and
-- act_on_approval() only transitions requests that are still 'pending' — so
-- there is no reachable state where an already-approved (attendance-synced)
-- request can be cancelled through the app. If that ever changes, the
-- reversal logic would need to null the attendance fields this migration
-- sets, keyed off the same date range.

alter table public.onduty_requests
  add constraint onduty_requests_no_overlap
  exclude using gist (
    employee_id with =,
    daterange(from_date, to_date, '[]') with &&
  )
  where (status in ('draft', 'pending', 'approved'));

create or replace function public.act_on_approval(
  _request_type text,
  _request_id uuid,
  _action text,
  _remarks text default null
)
returns void
language plpgsql security definer set search_path = public as $$
declare
  _owner_id uuid;
  _actor_id uuid := public.current_employee_id();
  _org_id uuid;
  _old_status text;
  _workflow_id uuid;
  _instance_id uuid;
  _recipient_user uuid;
  _notification_type text;
  _title text;
  _leave_type_id uuid;
  _leave_type_name text;
  _duration numeric(5,2);
  _from_date date;
  _to_date date;
  _balance_id uuid;
  _remaining numeric(6,2);
  -- Regularization -> attendance sync
  _reg_date date;
  _reg_check_in timestamptz;
  _reg_check_out timestamptz;
  _existing_check_in timestamptz;
  _existing_check_out timestamptz;
  _shift_id uuid;
  _shift_start time;
  _shift_end time;
  _grace int;
  _half_day_hours numeric;
  _full_day_hours numeric;
  _check_in_minutes int;
  _check_out_minutes int;
  _shift_start_minutes int;
  _shift_end_minutes int;
  _effective_minutes int;
  _late_minutes int;
  _early_going_minutes int;
  _excess_stay_minutes int;
  _shortfall_minutes int;
  _day_status text;
  -- Leave / onduty -> attendance sync
  _onduty_type text;
  _loop_date date;
  _onduty_remark text;
begin
  if _action not in ('approved', 'rejected') then
    raise exception 'act_on_approval: action must be ''approved'' or ''rejected'', got %', _action;
  end if;

  _owner_id := public.request_owner_employee_id(_request_type, _request_id);
  if _owner_id is null then
    raise exception 'act_on_approval: request % / % not found', _request_type, _request_id;
  end if;

  if _actor_id is null or not (public.is_hr_or_admin() or public.is_manager_of(_owner_id)) then
    raise exception 'act_on_approval: not authorized to act on this request';
  end if;

  select organization_id into _org_id from public.employees where id = _owner_id;

  if _request_type = 'leave_request' then
    select status into _old_status from public.leave_requests where id = _request_id;
    update public.leave_requests
      set status = _action, approval_remarks = _remarks
      where id = _request_id and status = 'pending'
      returning leave_type_id, duration_days, from_date, to_date into _leave_type_id, _duration, _from_date, _to_date;
  elsif _request_type = 'permission_request' then
    select status into _old_status from public.permission_requests where id = _request_id;
    update public.permission_requests
      set status = _action, approval_remarks = _remarks
      where id = _request_id and status = 'pending';
  elsif _request_type = 'attendance_regularization' then
    select status into _old_status from public.attendance_regularizations where id = _request_id;
    update public.attendance_regularizations
      set status = _action, approval_remarks = _remarks, approver_id = _actor_id
      where id = _request_id and status = 'pending'
      returning attendance_date, requested_check_in, requested_check_out
        into _reg_date, _reg_check_in, _reg_check_out;
  elsif _request_type = 'onduty_request' then
    select status into _old_status from public.onduty_requests where id = _request_id;
    update public.onduty_requests
      set status = _action, approval_remarks = _remarks
      where id = _request_id and status = 'pending'
      returning from_date, to_date, onduty_type into _from_date, _to_date, _onduty_type;
  elsif _request_type = 'other_request' then
    select status into _old_status from public.other_requests where id = _request_id;
    update public.other_requests
      set status = _action, approval_remarks = _remarks
      where id = _request_id and status = 'pending';
  else
    raise exception 'act_on_approval: unsupported request type %', _request_type;
  end if;

  if not found then
    raise exception 'act_on_approval: request is not pending (already actioned?)';
  end if;

  -- Deduct the matching leave-balance period on approval only (0031).
  if _request_type = 'leave_request' and _action = 'approved' then
    select id, balance into _balance_id, _remaining
      from public.leave_balances
      where employee_id = _owner_id
        and leave_type_id = _leave_type_id
        and period_start <= _from_date and period_end >= _from_date
      for update;

    if _balance_id is not null then
      if _remaining - _duration < 0 then
        raise exception 'act_on_approval: approving this request would drive leave type % balance negative (% available, % requested)',
          _leave_type_id, _remaining, _duration;
      end if;
      update public.leave_balances
        set used = used + _duration, balance = balance - _duration
        where id = _balance_id;
    end if;
  end if;

  -- (a) Apply an approved leave to the attendance table: every day in range
  -- becomes day_status = 'leave'. Overwrites whatever was there before
  -- (e.g. a stale seeded 'absent' guess) — the approved leave is now the
  -- authoritative status for that day.
  if _request_type = 'leave_request' and _action = 'approved' then
    select name into _leave_type_name from public.leave_types where id = _leave_type_id;
    _loop_date := _from_date;
    while _loop_date <= _to_date loop
      insert into public.attendance (organization_id, employee_id, attendance_date, day_status, validation_status, remarks)
      values (_org_id, _owner_id, _loop_date, 'leave', 'completed', coalesce(_leave_type_name, 'Leave'))
      on conflict (employee_id, attendance_date) do update set
        day_status = 'leave',
        validation_status = 'completed',
        remarks = coalesce(excluded.remarks, public.attendance.remarks);
      _loop_date := _loop_date + 1;
    end loop;
  end if;

  -- (b) Apply an approved on-duty/WFH request the same way: every day in
  -- range becomes day_status = 'present' (the employee worked, just not
  -- from a punch-tracked location), with a remark noting which type.
  if _request_type = 'onduty_request' and _action = 'approved' then
    _onduty_remark := case when _onduty_type = 'work_from_home' then 'Work From Home' else 'On Duty' end;
    _loop_date := _from_date;
    while _loop_date <= _to_date loop
      insert into public.attendance (organization_id, employee_id, attendance_date, day_status, validation_status, remarks)
      values (_org_id, _owner_id, _loop_date, 'present', 'completed', _onduty_remark)
      on conflict (employee_id, attendance_date) do update set
        day_status = 'present',
        validation_status = 'completed',
        remarks = coalesce(excluded.remarks, public.attendance.remarks);
      _loop_date := _loop_date + 1;
    end loop;
  end if;

  -- Apply an approved regularization to the actual attendance row. Resolve
  -- the shift from the existing attendance row if one exists, else from the
  -- employee's active shift_assignments as of the attendance date (mirrors
  -- how seed.sql assigns shifts). Falls back to marking the day 'present'
  -- with is_regularized = true (no shift-relative metrics) if no shift can
  -- be resolved at all, rather than silently doing nothing.
  if _request_type = 'attendance_regularization' and _action = 'approved' then
    select check_in, check_out, shift_id into _existing_check_in, _existing_check_out, _shift_id
      from public.attendance where employee_id = _owner_id and attendance_date = _reg_date;

    if _shift_id is null then
      select shift_id into _shift_id from public.shift_assignments
        where employee_id = _owner_id and effective_from <= _reg_date
        order by effective_from desc limit 1;
    end if;

    _reg_check_in := coalesce(_reg_check_in, _existing_check_in);
    _reg_check_out := coalesce(_reg_check_out, _existing_check_out);

    if _shift_id is not null then
      select start_time, end_time, grace_minutes, half_day_hours, full_day_hours
        into _shift_start, _shift_end, _grace, _half_day_hours, _full_day_hours
        from public.shifts where id = _shift_id;
    end if;

    if _reg_check_in is not null and _reg_check_out is not null and _shift_id is not null then
      _check_in_minutes := extract(hour from _reg_check_in)::int * 60 + extract(minute from _reg_check_in)::int;
      _check_out_minutes := extract(hour from _reg_check_out)::int * 60 + extract(minute from _reg_check_out)::int;
      if _check_out_minutes < _check_in_minutes then
        _check_out_minutes := _check_out_minutes + 1440; -- overnight shift/punch
      end if;

      _shift_start_minutes := extract(hour from _shift_start)::int * 60 + extract(minute from _shift_start)::int;
      _shift_end_minutes := extract(hour from _shift_end)::int * 60 + extract(minute from _shift_end)::int;
      if _shift_end_minutes <= _shift_start_minutes then
        _shift_end_minutes := _shift_end_minutes + 1440;
      end if;

      _effective_minutes := _check_out_minutes - _check_in_minutes;
      _late_minutes := greatest(0, _check_in_minutes - (_shift_start_minutes + coalesce(_grace, 0)));
      _early_going_minutes := greatest(0, _shift_end_minutes - _check_out_minutes);
      _excess_stay_minutes := greatest(0, _check_out_minutes - _shift_end_minutes);
      _shortfall_minutes := greatest(0, (coalesce(_full_day_hours, 8) * 60)::int - _effective_minutes);
      _day_status := case when _effective_minutes >= (coalesce(_half_day_hours, 4.5) * 60)::int then 'present' else 'half_day' end;

      insert into public.attendance (
        organization_id, employee_id, attendance_date, shift_id, check_in, check_out,
        effective_minutes, late_minutes, early_going_minutes, excess_stay_minutes, shortfall_minutes,
        day_status, validation_status, is_regularized, remarks
      ) values (
        _org_id, _owner_id, _reg_date, _shift_id, _reg_check_in, _reg_check_out,
        _effective_minutes, _late_minutes, _early_going_minutes, _excess_stay_minutes, _shortfall_minutes,
        _day_status, 'completed', true, _remarks
      )
      on conflict (employee_id, attendance_date) do update set
        shift_id = excluded.shift_id,
        check_in = excluded.check_in,
        check_out = excluded.check_out,
        effective_minutes = excluded.effective_minutes,
        late_minutes = excluded.late_minutes,
        early_going_minutes = excluded.early_going_minutes,
        excess_stay_minutes = excluded.excess_stay_minutes,
        shortfall_minutes = excluded.shortfall_minutes,
        day_status = excluded.day_status,
        validation_status = 'completed',
        is_regularized = true,
        remarks = coalesce(excluded.remarks, public.attendance.remarks);
    else
      -- No punch times and/or no resolvable shift (e.g. a plain
      -- present_correction with nothing but "I was present" and a reason) —
      -- still record the correction rather than silently dropping it.
      insert into public.attendance (organization_id, employee_id, attendance_date, shift_id, day_status, validation_status, is_regularized, remarks)
      values (_org_id, _owner_id, _reg_date, _shift_id, 'present', 'completed', true, _remarks)
      on conflict (employee_id, attendance_date) do update set
        day_status = 'present',
        validation_status = 'completed',
        is_regularized = true,
        remarks = coalesce(excluded.remarks, public.attendance.remarks);
    end if;
  end if;

  insert into public.audit_logs (organization_id, actor_user_id, action, module, record_id, old_value, new_value)
    values (
      _org_id, auth.uid(), (case when _action = 'approved' then 'approval' else 'rejection' end),
      'manager_self_service', _request_id,
      jsonb_build_object('request_type', _request_type, 'status', _old_status),
      jsonb_build_object('request_type', _request_type, 'status', _action, 'remarks', _remarks)
    );

  select id into _workflow_id from public.approval_workflows
    where organization_id = _org_id and request_type = _request_type and is_active
    order by created_at limit 1;

  if _workflow_id is not null then
    insert into public.approval_instances (workflow_id, request_type, request_id, status, current_step_order)
      values (_workflow_id, _request_type, _request_id, _action, 1)
      on conflict (request_type, request_id) do update set status = excluded.status
      returning id into _instance_id;

    insert into public.approval_actions (approval_instance_id, step_order, actor_employee_id, action, remarks)
      values (_instance_id, 1, _actor_id, _action, _remarks);
  end if;

  _notification_type := case _request_type
    when 'leave_request' then (case when _action = 'approved' then 'leave_approved' else 'leave_rejected' end)
    when 'permission_request' then (case when _action = 'approved' then 'permission_approved' else 'permission_rejected' end)
    when 'attendance_regularization' then (case when _action = 'approved' then 'regularization_approved' else 'regularization_rejected' end)
    when 'onduty_request' then (case when _action = 'approved' then 'onduty_approved' else 'onduty_rejected' end)
    when 'other_request' then (case when _action = 'approved' then 'other_request_approved' else 'other_request_rejected' end)
  end;
  _title := case when _action = 'approved' then 'Your request has been approved' else 'Your request has been rejected' end;

  select user_id into _recipient_user from public.employees where id = _owner_id;
  if _recipient_user is not null then
    insert into public.notifications (organization_id, recipient_user_id, notification_type, title, body, link_path)
      values (_org_id, _recipient_user, _notification_type, _title, _remarks, '/attendance/event-request');
  end if;
end;
$$;

grant execute on function public.act_on_approval(text, uuid, text, text) to authenticated;

-- ============================================================
-- 0038_permission_balance.sql
-- ============================================================
-- Implements the "Permission Balance" concept flagged as a gap during the
-- production-readiness audit: the schema had no entitlement/balance concept
-- for permission requests at all (unlike leave), so BalancePage.tsx's
-- Permission row always showed hardcoded '00:00'/'-' placeholders no matter
-- how many permission requests were approved.
--
-- Durations are stored as integer minutes throughout (matching
-- permission_requests.duration_minutes, already the existing convention) —
-- never decimal hours — and formatted as HH:MM in the UI via the existing
-- formatHoursMinutes() in src/lib/dateFormat.ts. "01:30" is stored as 90,
-- not 1.30.
--
-- Monthly periods, mirroring leave_balances' period_start/period_end shape
-- exactly, so month-wise and year-wise reporting can both be built on top
-- (year-wise = sum of that year's monthly rows for an employee).

create table public.permission_balances (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  opening_minutes integer not null default 0,
  credited_minutes integer not null default 0,
  used_minutes integer not null default 0,
  balance_minutes integer not null default 0,
  updated_at timestamptz not null default now(),
  unique (employee_id, period_start)
);
create trigger trg_permission_balances_updated_at before update on public.permission_balances
  for each row execute function public.set_updated_at();
create index idx_permission_balances_employee on public.permission_balances(employee_id, period_start);

alter table public.permission_balances enable row level security;
create policy permission_balances_select on public.permission_balances for select
  using (employee_id = public.current_employee_id() or public.is_manager_of(employee_id) or public.is_hr_or_admin());
create policy permission_balances_write on public.permission_balances for all
  using (public.is_hr_or_admin()) with check (public.is_hr_or_admin());

-- Opening balance for the current month, every active employee: 3 hours
-- (180 minutes), matching the reference app's "03:00" example. Real
-- deployments would drive this from a configurable policy the same way
-- leave_policies does for leave — flagged as a follow-up, not invented here
-- to avoid a second, unused config screen no one asked for.
insert into public.permission_balances (employee_id, period_start, period_end, opening_minutes, credited_minutes, used_minutes, balance_minutes)
select
  e.id,
  date_trunc('month', current_date)::date,
  (date_trunc('month', current_date) + interval '1 month - 1 day')::date,
  180, 0, 0, 180
from public.employees e
where e.employment_status = 'active'
on conflict (employee_id, period_start) do nothing;

-- Backfill: sync used/balance for any permission_requests already approved
-- this month before this migration ran (same reasoning as 0031's leave
-- backfill).
update public.permission_balances pb
set used_minutes = pb.used_minutes + approved.total_minutes,
    balance_minutes = pb.balance_minutes - approved.total_minutes
from (
  select employee_id, sum(duration_minutes) as total_minutes
  from public.permission_requests
  where status = 'approved'
    and permission_date >= date_trunc('month', current_date)::date
    and permission_date <= (date_trunc('month', current_date) + interval '1 month - 1 day')::date
  group by employee_id
) as approved
where pb.employee_id = approved.employee_id
  and pb.period_start = date_trunc('month', current_date)::date;

-- Deduct permission balance on approval, mirroring 0031's leave-balance
-- block exactly (row lock, negative-balance guard). Only the new permission
-- block is added here — everything else is unchanged from 0037's version.
create or replace function public.act_on_approval(
  _request_type text,
  _request_id uuid,
  _action text,
  _remarks text default null
)
returns void
language plpgsql security definer set search_path = public as $$
declare
  _owner_id uuid;
  _actor_id uuid := public.current_employee_id();
  _org_id uuid;
  _old_status text;
  _workflow_id uuid;
  _instance_id uuid;
  _recipient_user uuid;
  _notification_type text;
  _title text;
  _leave_type_id uuid;
  _leave_type_name text;
  _duration numeric(5,2);
  _from_date date;
  _to_date date;
  _balance_id uuid;
  _remaining numeric(6,2);
  -- Regularization -> attendance sync
  _reg_date date;
  _reg_check_in timestamptz;
  _reg_check_out timestamptz;
  _existing_check_in timestamptz;
  _existing_check_out timestamptz;
  _shift_id uuid;
  _shift_start time;
  _shift_end time;
  _grace int;
  _half_day_hours numeric;
  _full_day_hours numeric;
  _check_in_minutes int;
  _check_out_minutes int;
  _shift_start_minutes int;
  _shift_end_minutes int;
  _effective_minutes int;
  _late_minutes int;
  _early_going_minutes int;
  _excess_stay_minutes int;
  _shortfall_minutes int;
  _day_status text;
  -- Leave / onduty -> attendance sync
  _onduty_type text;
  _loop_date date;
  _onduty_remark text;
  -- Permission balance
  _permission_date date;
  _permission_minutes int;
  _perm_balance_id uuid;
  _perm_remaining int;
begin
  if _action not in ('approved', 'rejected') then
    raise exception 'act_on_approval: action must be ''approved'' or ''rejected'', got %', _action;
  end if;

  _owner_id := public.request_owner_employee_id(_request_type, _request_id);
  if _owner_id is null then
    raise exception 'act_on_approval: request % / % not found', _request_type, _request_id;
  end if;

  if _actor_id is null or not (public.is_hr_or_admin() or public.is_manager_of(_owner_id)) then
    raise exception 'act_on_approval: not authorized to act on this request';
  end if;

  select organization_id into _org_id from public.employees where id = _owner_id;

  if _request_type = 'leave_request' then
    select status into _old_status from public.leave_requests where id = _request_id;
    update public.leave_requests
      set status = _action, approval_remarks = _remarks
      where id = _request_id and status = 'pending'
      returning leave_type_id, duration_days, from_date, to_date into _leave_type_id, _duration, _from_date, _to_date;
  elsif _request_type = 'permission_request' then
    select status into _old_status from public.permission_requests where id = _request_id;
    update public.permission_requests
      set status = _action, approval_remarks = _remarks
      where id = _request_id and status = 'pending'
      returning permission_date, duration_minutes into _permission_date, _permission_minutes;
  elsif _request_type = 'attendance_regularization' then
    select status into _old_status from public.attendance_regularizations where id = _request_id;
    update public.attendance_regularizations
      set status = _action, approval_remarks = _remarks, approver_id = _actor_id
      where id = _request_id and status = 'pending'
      returning attendance_date, requested_check_in, requested_check_out
        into _reg_date, _reg_check_in, _reg_check_out;
  elsif _request_type = 'onduty_request' then
    select status into _old_status from public.onduty_requests where id = _request_id;
    update public.onduty_requests
      set status = _action, approval_remarks = _remarks
      where id = _request_id and status = 'pending'
      returning from_date, to_date, onduty_type into _from_date, _to_date, _onduty_type;
  elsif _request_type = 'other_request' then
    select status into _old_status from public.other_requests where id = _request_id;
    update public.other_requests
      set status = _action, approval_remarks = _remarks
      where id = _request_id and status = 'pending';
  else
    raise exception 'act_on_approval: unsupported request type %', _request_type;
  end if;

  if not found then
    raise exception 'act_on_approval: request is not pending (already actioned?)';
  end if;

  -- Deduct the matching leave-balance period on approval only (0031).
  if _request_type = 'leave_request' and _action = 'approved' then
    select id, balance into _balance_id, _remaining
      from public.leave_balances
      where employee_id = _owner_id
        and leave_type_id = _leave_type_id
        and period_start <= _from_date and period_end >= _from_date
      for update;

    if _balance_id is not null then
      if _remaining - _duration < 0 then
        raise exception 'act_on_approval: approving this request would drive leave type % balance negative (% available, % requested)',
          _leave_type_id, _remaining, _duration;
      end if;
      update public.leave_balances
        set used = used + _duration, balance = balance - _duration
        where id = _balance_id;
    end if;
  end if;

  -- Deduct the matching permission-balance period on approval only.
  if _request_type = 'permission_request' and _action = 'approved' then
    select id, balance_minutes into _perm_balance_id, _perm_remaining
      from public.permission_balances
      where employee_id = _owner_id
        and period_start <= _permission_date and period_end >= _permission_date
      for update;

    if _perm_balance_id is not null then
      if _perm_remaining - _permission_minutes < 0 then
        raise exception 'act_on_approval: approving this request would drive permission balance negative (% minutes available, % requested)',
          _perm_remaining, _permission_minutes;
      end if;
      update public.permission_balances
        set used_minutes = used_minutes + _permission_minutes, balance_minutes = balance_minutes - _permission_minutes
        where id = _perm_balance_id;
    end if;
    -- No matching period is left un-deducted rather than blocking the
    -- approval outright, same reasoning as the leave-balance block above.
  end if;

  -- (a) Apply an approved leave to the attendance table: every day in range
  -- becomes day_status = 'leave'. Overwrites whatever was there before
  -- (e.g. a stale seeded 'absent' guess) — the approved leave is now the
  -- authoritative status for that day.
  if _request_type = 'leave_request' and _action = 'approved' then
    select name into _leave_type_name from public.leave_types where id = _leave_type_id;
    _loop_date := _from_date;
    while _loop_date <= _to_date loop
      insert into public.attendance (organization_id, employee_id, attendance_date, day_status, validation_status, remarks)
      values (_org_id, _owner_id, _loop_date, 'leave', 'completed', coalesce(_leave_type_name, 'Leave'))
      on conflict (employee_id, attendance_date) do update set
        day_status = 'leave',
        validation_status = 'completed',
        remarks = coalesce(excluded.remarks, public.attendance.remarks);
      _loop_date := _loop_date + 1;
    end loop;
  end if;

  -- (b) Apply an approved on-duty/WFH request the same way: every day in
  -- range becomes day_status = 'present' (the employee worked, just not
  -- from a punch-tracked location), with a remark noting which type.
  if _request_type = 'onduty_request' and _action = 'approved' then
    _onduty_remark := case when _onduty_type = 'work_from_home' then 'Work From Home' else 'On Duty' end;
    _loop_date := _from_date;
    while _loop_date <= _to_date loop
      insert into public.attendance (organization_id, employee_id, attendance_date, day_status, validation_status, remarks)
      values (_org_id, _owner_id, _loop_date, 'present', 'completed', _onduty_remark)
      on conflict (employee_id, attendance_date) do update set
        day_status = 'present',
        validation_status = 'completed',
        remarks = coalesce(excluded.remarks, public.attendance.remarks);
      _loop_date := _loop_date + 1;
    end loop;
  end if;

  -- Apply an approved regularization to the actual attendance row. Resolve
  -- the shift from the existing attendance row if one exists, else from the
  -- employee's active shift_assignments as of the attendance date (mirrors
  -- how seed.sql assigns shifts). Falls back to marking the day 'present'
  -- with is_regularized = true (no shift-relative metrics) if no shift can
  -- be resolved at all, rather than silently doing nothing.
  if _request_type = 'attendance_regularization' and _action = 'approved' then
    select check_in, check_out, shift_id into _existing_check_in, _existing_check_out, _shift_id
      from public.attendance where employee_id = _owner_id and attendance_date = _reg_date;

    if _shift_id is null then
      select shift_id into _shift_id from public.shift_assignments
        where employee_id = _owner_id and effective_from <= _reg_date
        order by effective_from desc limit 1;
    end if;

    _reg_check_in := coalesce(_reg_check_in, _existing_check_in);
    _reg_check_out := coalesce(_reg_check_out, _existing_check_out);

    if _shift_id is not null then
      select start_time, end_time, grace_minutes, half_day_hours, full_day_hours
        into _shift_start, _shift_end, _grace, _half_day_hours, _full_day_hours
        from public.shifts where id = _shift_id;
    end if;

    if _reg_check_in is not null and _reg_check_out is not null and _shift_id is not null then
      _check_in_minutes := extract(hour from _reg_check_in)::int * 60 + extract(minute from _reg_check_in)::int;
      _check_out_minutes := extract(hour from _reg_check_out)::int * 60 + extract(minute from _reg_check_out)::int;
      if _check_out_minutes < _check_in_minutes then
        _check_out_minutes := _check_out_minutes + 1440; -- overnight shift/punch
      end if;

      _shift_start_minutes := extract(hour from _shift_start)::int * 60 + extract(minute from _shift_start)::int;
      _shift_end_minutes := extract(hour from _shift_end)::int * 60 + extract(minute from _shift_end)::int;
      if _shift_end_minutes <= _shift_start_minutes then
        _shift_end_minutes := _shift_end_minutes + 1440;
      end if;

      _effective_minutes := _check_out_minutes - _check_in_minutes;
      _late_minutes := greatest(0, _check_in_minutes - (_shift_start_minutes + coalesce(_grace, 0)));
      _early_going_minutes := greatest(0, _shift_end_minutes - _check_out_minutes);
      _excess_stay_minutes := greatest(0, _check_out_minutes - _shift_end_minutes);
      _shortfall_minutes := greatest(0, (coalesce(_full_day_hours, 8) * 60)::int - _effective_minutes);
      _day_status := case when _effective_minutes >= (coalesce(_half_day_hours, 4.5) * 60)::int then 'present' else 'half_day' end;

      insert into public.attendance (
        organization_id, employee_id, attendance_date, shift_id, check_in, check_out,
        effective_minutes, late_minutes, early_going_minutes, excess_stay_minutes, shortfall_minutes,
        day_status, validation_status, is_regularized, remarks
      ) values (
        _org_id, _owner_id, _reg_date, _shift_id, _reg_check_in, _reg_check_out,
        _effective_minutes, _late_minutes, _early_going_minutes, _excess_stay_minutes, _shortfall_minutes,
        _day_status, 'completed', true, _remarks
      )
      on conflict (employee_id, attendance_date) do update set
        shift_id = excluded.shift_id,
        check_in = excluded.check_in,
        check_out = excluded.check_out,
        effective_minutes = excluded.effective_minutes,
        late_minutes = excluded.late_minutes,
        early_going_minutes = excluded.early_going_minutes,
        excess_stay_minutes = excluded.excess_stay_minutes,
        shortfall_minutes = excluded.shortfall_minutes,
        day_status = excluded.day_status,
        validation_status = 'completed',
        is_regularized = true,
        remarks = coalesce(excluded.remarks, public.attendance.remarks);
    else
      -- No punch times and/or no resolvable shift (e.g. a plain
      -- present_correction with nothing but "I was present" and a reason) —
      -- still record the correction rather than silently dropping it.
      insert into public.attendance (organization_id, employee_id, attendance_date, shift_id, day_status, validation_status, is_regularized, remarks)
      values (_org_id, _owner_id, _reg_date, _shift_id, 'present', 'completed', true, _remarks)
      on conflict (employee_id, attendance_date) do update set
        day_status = 'present',
        validation_status = 'completed',
        is_regularized = true,
        remarks = coalesce(excluded.remarks, public.attendance.remarks);
    end if;
  end if;

  insert into public.audit_logs (organization_id, actor_user_id, action, module, record_id, old_value, new_value)
    values (
      _org_id, auth.uid(), (case when _action = 'approved' then 'approval' else 'rejection' end),
      'manager_self_service', _request_id,
      jsonb_build_object('request_type', _request_type, 'status', _old_status),
      jsonb_build_object('request_type', _request_type, 'status', _action, 'remarks', _remarks)
    );

  select id into _workflow_id from public.approval_workflows
    where organization_id = _org_id and request_type = _request_type and is_active
    order by created_at limit 1;

  if _workflow_id is not null then
    insert into public.approval_instances (workflow_id, request_type, request_id, status, current_step_order)
      values (_workflow_id, _request_type, _request_id, _action, 1)
      on conflict (request_type, request_id) do update set status = excluded.status
      returning id into _instance_id;

    insert into public.approval_actions (approval_instance_id, step_order, actor_employee_id, action, remarks)
      values (_instance_id, 1, _actor_id, _action, _remarks);
  end if;

  _notification_type := case _request_type
    when 'leave_request' then (case when _action = 'approved' then 'leave_approved' else 'leave_rejected' end)
    when 'permission_request' then (case when _action = 'approved' then 'permission_approved' else 'permission_rejected' end)
    when 'attendance_regularization' then (case when _action = 'approved' then 'regularization_approved' else 'regularization_rejected' end)
    when 'onduty_request' then (case when _action = 'approved' then 'onduty_approved' else 'onduty_rejected' end)
    when 'other_request' then (case when _action = 'approved' then 'other_request_approved' else 'other_request_rejected' end)
  end;
  _title := case when _action = 'approved' then 'Your request has been approved' else 'Your request has been rejected' end;

  select user_id into _recipient_user from public.employees where id = _owner_id;
  if _recipient_user is not null then
    insert into public.notifications (organization_id, recipient_user_id, notification_type, title, body, link_path)
      values (_org_id, _recipient_user, _notification_type, _title, _remarks, '/attendance/event-request');
  end if;
end;
$$;

grant execute on function public.act_on_approval(text, uuid, text, text) to authenticated;

-- ============================================================
-- 0039_missing_attendance_report.sql
-- ============================================================
-- Implements the "Missing Attendance / Missing Punch" report flagged as a
-- gap during the production-readiness audit. Previously the only "Absent"
-- report (ReportsPage.tsx/TeamReportsPage.tsx) filtered on
-- attendance.day_status = 'absent' — an explicit, already-adjudicated
-- status. It could never surface the different, more urgent problem this
-- report targets: a working day with NO attendance row at all (device
-- failure, forgotten to be marked), or a 'present'/'half_day' row missing
-- one side of its punch. This function depends on 0037/0038's attendance
-- sync fixes (approved leave/WFH/on-duty now always produce a real
-- attendance row) to avoid false positives — without those fixes, every
-- approved leave day would have wrongly shown up here as "missing".
--
-- Scope follows the same self/manager/HR pattern used throughout the RLS
-- layer: a plain employee sees only their own rows, a manager sees their
-- reporting chain (is_manager_of), HR/admin sees the whole organization.
-- Only past-or-today dates are considered — a future day isn't "missing"
-- yet, it just hasn't happened.

create or replace function public.get_missing_attendance(_from_date date, _to_date date)
returns table (
  employee_id uuid,
  employee_code text,
  employee_name text,
  department_name text,
  location_name text,
  attendance_date date,
  shift_name text,
  shift_start_time time,
  shift_end_time time,
  missing_in boolean,
  missing_out boolean,
  day_status text,
  regularization_status text
)
language plpgsql stable security definer set search_path = public as $$
begin
  return query
  with scoped_employees as (
    select
      e.id,
      e.employee_code,
      (e.first_name || coalesce(' ' || e.last_name, '')) as full_name,
      d.name as dept_name,
      l.name as loc_name,
      e.organization_id
    from public.employees e
    left join public.departments d on d.id = e.department_id
    left join public.locations l on l.id = e.location_id
    where e.employment_status = 'active'
      and e.organization_id = public.current_organization_id()
      and (
        e.id = public.current_employee_id()
        or public.is_manager_of(e.id)
        or public.is_hr_or_admin()
      )
  ),
  calendar as (
    select se.*, gs.cal_date::date as cal_date
    from scoped_employees se
    cross join lateral generate_series(_from_date, least(_to_date, current_date), interval '1 day') as gs(cal_date)
  ),
  with_shift as (
    select
      c.*,
      s.name as shift_name,
      s.start_time,
      s.end_time,
      s.weekoff_days
    from calendar c
    left join lateral (
      select shift_id from public.shift_assignments
      where employee_id = c.id and effective_from <= c.cal_date
      order by effective_from desc limit 1
    ) sa on true
    left join public.shifts s on s.id = sa.shift_id
  ),
  candidates as (
    select ws.*
    from with_shift ws
    where not exists (
      select 1 from public.holidays h
      where h.organization_id = ws.organization_id and h.holiday_date = ws.cal_date
    )
    and (ws.weekoff_days is null or not (extract(dow from ws.cal_date)::int = any(ws.weekoff_days)))
  )
  select
    c.id,
    c.employee_code,
    c.full_name,
    c.dept_name,
    c.loc_name,
    c.cal_date,
    c.shift_name,
    c.start_time,
    c.end_time,
    (a.id is null or (a.day_status in ('present', 'half_day') and a.check_in is null)) as missing_in,
    (a.id is null or (a.day_status in ('present', 'half_day') and a.check_out is null)) as missing_out,
    coalesce(a.day_status, 'no_record'),
    ar.status
  from candidates c
  left join public.attendance a on a.employee_id = c.id and a.attendance_date = c.cal_date
  left join public.attendance_regularizations ar
    on ar.employee_id = c.id and ar.attendance_date = c.cal_date and ar.status = 'pending'
  where a.id is null
     or (a.day_status in ('present', 'half_day') and (a.check_in is null or a.check_out is null))
  order by c.cal_date desc, c.employee_code;
end;
$$;

grant execute on function public.get_missing_attendance(date, date) to authenticated;

-- ============================================================
-- 0040_notifications_select_hr_bypass.sql
-- ============================================================
-- Real bug found while live-testing Notifications compose: notifications_select
-- (0021) only ever allowed recipient_user_id = auth.uid() — no HR/admin
-- bypass. HR can compose (notifications_insert already checks
-- is_hr_or_admin()) but could never read back what they sent to anyone
-- else, since every row's recipient is someone other than the sender.
-- Confirmed live: composing to 2 recipients returns 201 with the correct
-- payload, but useSentAnnouncements() (a plain table select, subject to
-- this same RLS) always returns zero rows for HR — "Sent History" was
-- silently empty for every real broadcast. notifications_update (marking
-- one's own notification read) is unaffected and correctly stays self-only.

drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications for select
  using (recipient_user_id = auth.uid() or public.is_hr_or_admin());

-- ============================================================
-- 0041_fix_missing_attendance_ambiguous_column.sql
-- ============================================================
-- Real bug found while live-verifying 0039: get_missing_attendance()'s
-- RETURNS TABLE(employee_id uuid, ...) implicitly declares an `employee_id`
-- plpgsql variable visible throughout the function body. The shift
-- resolution subquery's `where employee_id = c.id` was unqualified, so
-- Postgres couldn't tell whether that meant the OUT parameter or
-- shift_assignments.employee_id — confirmed live: calling the function
-- returned "column reference \"employee_id\" is ambiguous" (42702) instead
-- of ever executing. Fixed by qualifying it. No other logic changes.

create or replace function public.get_missing_attendance(_from_date date, _to_date date)
returns table (
  employee_id uuid,
  employee_code text,
  employee_name text,
  department_name text,
  location_name text,
  attendance_date date,
  shift_name text,
  shift_start_time time,
  shift_end_time time,
  missing_in boolean,
  missing_out boolean,
  day_status text,
  regularization_status text
)
language plpgsql stable security definer set search_path = public as $$
begin
  return query
  with scoped_employees as (
    select
      e.id,
      e.employee_code,
      (e.first_name || coalesce(' ' || e.last_name, '')) as full_name,
      d.name as dept_name,
      l.name as loc_name,
      e.organization_id
    from public.employees e
    left join public.departments d on d.id = e.department_id
    left join public.locations l on l.id = e.location_id
    where e.employment_status = 'active'
      and e.organization_id = public.current_organization_id()
      and (
        e.id = public.current_employee_id()
        or public.is_manager_of(e.id)
        or public.is_hr_or_admin()
      )
  ),
  calendar as (
    select se.*, gs.cal_date::date as cal_date
    from scoped_employees se
    cross join lateral generate_series(_from_date, least(_to_date, current_date), interval '1 day') as gs(cal_date)
  ),
  with_shift as (
    select
      c.*,
      s.name as shift_name,
      s.start_time,
      s.end_time,
      s.weekoff_days
    from calendar c
    left join lateral (
      select sa_inner.shift_id from public.shift_assignments sa_inner
      where sa_inner.employee_id = c.id and sa_inner.effective_from <= c.cal_date
      order by sa_inner.effective_from desc limit 1
    ) sa on true
    left join public.shifts s on s.id = sa.shift_id
  ),
  candidates as (
    select ws.*
    from with_shift ws
    where not exists (
      select 1 from public.holidays h
      where h.organization_id = ws.organization_id and h.holiday_date = ws.cal_date
    )
    and (ws.weekoff_days is null or not (extract(dow from ws.cal_date)::int = any(ws.weekoff_days)))
  )
  select
    c.id,
    c.employee_code,
    c.full_name,
    c.dept_name,
    c.loc_name,
    c.cal_date,
    c.shift_name,
    c.start_time,
    c.end_time,
    (a.id is null or (a.day_status in ('present', 'half_day') and a.check_in is null)) as missing_in,
    (a.id is null or (a.day_status in ('present', 'half_day') and a.check_out is null)) as missing_out,
    coalesce(a.day_status, 'no_record'),
    ar.status
  from candidates c
  left join public.attendance a on a.employee_id = c.id and a.attendance_date = c.cal_date
  left join public.attendance_regularizations ar
    on ar.employee_id = c.id and ar.attendance_date = c.cal_date and ar.status = 'pending'
  where a.id is null
     or (a.day_status in ('present', 'half_day') and (a.check_in is null or a.check_out is null))
  order by c.cal_date desc, c.employee_code;
end;
$$;

grant execute on function public.get_missing_attendance(date, date) to authenticated;

-- ============================================================
-- 0042_monthly_leave_balance_periods.sql
-- ============================================================
-- Matches the reference app's Balance screen exactly (confirmed against
-- real screenshots): monthly-accrual leave types (Casual Leave, Sick
-- Leave — leave_types.accrual_frequency = 'monthly') show a full year of
-- individual monthly opening/used/balance rows when expanded, not one flat
-- annual row. Yearly/none-accrual types (Privilege Leave, Earned Leave,
-- LOP, etc.) are unaffected — they keep their single annual row, matching
-- the reference's collapsed single-row summary for those types.
--
-- leave_balances already supports this (unique(employee_id, leave_type_id,
-- period_start) — the schema was never the blocker, only the seeding was).
-- This migration replaces each employee's single annual row for a
-- monthly-accrual type with 12 monthly rows, splitting the annual opening
-- evenly and re-deriving each month's `used`/`balance` from the actual
-- approved leave_requests that fall in it — not just zeroing everything out
-- and losing the real usage history 0031 already backfilled once.
--
-- act_on_approval()'s leave-balance deduction block (0031/0037/0038) needs
-- no change: it already looks up the balance row by
-- `period_start <= from_date and period_end >= from_date`, which works
-- identically whether that period is a year or a month.

do $$
declare
  _lt record;
  _emp record;
  _monthly_opening numeric(6,2);
  _m int;
  _period_start date;
  _period_end date;
  _month_used numeric(6,2);
  _yr int := extract(year from current_date)::int;
begin
  for _lt in select id from public.leave_types where accrual_frequency = 'monthly' loop
    for _emp in
      select employee_id, opening as annual_opening
      from public.leave_balances
      where leave_type_id = _lt.id
    loop
      _monthly_opening := round(_emp.annual_opening / 12, 2);

      delete from public.leave_balances where employee_id = _emp.employee_id and leave_type_id = _lt.id;

      for _m in 1..12 loop
        _period_start := make_date(_yr, _m, 1);
        _period_end := (_period_start + interval '1 month - 1 day')::date;

        select coalesce(sum(duration_days), 0) into _month_used
          from public.leave_requests
          where employee_id = _emp.employee_id
            and leave_type_id = _lt.id
            and status = 'approved'
            and from_date >= _period_start and from_date <= _period_end;

        insert into public.leave_balances (employee_id, leave_type_id, period_start, period_end, opening, credited, used, balance)
        values (_emp.employee_id, _lt.id, _period_start, _period_end, _monthly_opening, 0, _month_used, _monthly_opening - _month_used)
        on conflict (employee_id, leave_type_id, period_start) do update set
          opening = excluded.opening, used = excluded.used, balance = excluded.balance;
      end loop;
    end loop;
  end loop;
end;
$$;

-- ============================================================
-- 0043_cumulative_leave_balance_deduction.sql
-- ============================================================
-- Real bug found while diagnosing "Insufficient leave balance" reports for
-- Casual/Sick Leave: monthly-accrual types (0042) carry 12 leave_balances
-- rows a year, and both the client's balance check (leaveValidation.ts) and
-- this function's deduction only ever looked at the single row matching the
-- request's from_date. A 2-day CL request in a month whose row only holds
-- 1 day was rejected even though the employee had unused balance sitting in
-- other months — the type's balance was never actually exhausted, just
-- fragmented across rows the check never added up.
--
-- Client-side (LeaveRequestForm.tsx) now sums every period row for the
-- leave type via totalLeaveBalance() instead of matching a single month.
-- This migration makes the server-side deduction agree: instead of reading
-- and updating one row, it checks the SUM across all of the employee's
-- periods for that leave type, then draws the approved duration from the
-- earliest period with remaining balance first (so older unused days are
-- spent before newer ones), spilling into later periods as needed. Yearly/
-- none-accrual types are unaffected — they still have exactly one row, so
-- "sum across all periods" and "the one row" are the same value.
--
-- Everything else in this function is unchanged from 0038's version.

create or replace function public.act_on_approval(
  _request_type text,
  _request_id uuid,
  _action text,
  _remarks text default null
)
returns void
language plpgsql security definer set search_path = public as $$
declare
  _owner_id uuid;
  _actor_id uuid := public.current_employee_id();
  _org_id uuid;
  _old_status text;
  _workflow_id uuid;
  _instance_id uuid;
  _recipient_user uuid;
  _notification_type text;
  _title text;
  _leave_type_id uuid;
  _leave_type_name text;
  _duration numeric(5,2);
  _from_date date;
  _to_date date;
  _remaining numeric(6,2);
  _remaining_to_deduct numeric(5,2);
  _deduct_amount numeric(5,2);
  _period_row record;
  -- Regularization -> attendance sync
  _reg_date date;
  _reg_check_in timestamptz;
  _reg_check_out timestamptz;
  _existing_check_in timestamptz;
  _existing_check_out timestamptz;
  _shift_id uuid;
  _shift_start time;
  _shift_end time;
  _grace int;
  _half_day_hours numeric;
  _full_day_hours numeric;
  _check_in_minutes int;
  _check_out_minutes int;
  _shift_start_minutes int;
  _shift_end_minutes int;
  _effective_minutes int;
  _late_minutes int;
  _early_going_minutes int;
  _excess_stay_minutes int;
  _shortfall_minutes int;
  _day_status text;
  -- Leave / onduty -> attendance sync
  _onduty_type text;
  _loop_date date;
  _onduty_remark text;
  -- Permission balance
  _permission_date date;
  _permission_minutes int;
  _perm_balance_id uuid;
  _perm_remaining int;
begin
  if _action not in ('approved', 'rejected') then
    raise exception 'act_on_approval: action must be ''approved'' or ''rejected'', got %', _action;
  end if;

  _owner_id := public.request_owner_employee_id(_request_type, _request_id);
  if _owner_id is null then
    raise exception 'act_on_approval: request % / % not found', _request_type, _request_id;
  end if;

  if _actor_id is null or not (public.is_hr_or_admin() or public.is_manager_of(_owner_id)) then
    raise exception 'act_on_approval: not authorized to act on this request';
  end if;

  select organization_id into _org_id from public.employees where id = _owner_id;

  if _request_type = 'leave_request' then
    select status into _old_status from public.leave_requests where id = _request_id;
    update public.leave_requests
      set status = _action, approval_remarks = _remarks
      where id = _request_id and status = 'pending'
      returning leave_type_id, duration_days, from_date, to_date into _leave_type_id, _duration, _from_date, _to_date;
  elsif _request_type = 'permission_request' then
    select status into _old_status from public.permission_requests where id = _request_id;
    update public.permission_requests
      set status = _action, approval_remarks = _remarks
      where id = _request_id and status = 'pending'
      returning permission_date, duration_minutes into _permission_date, _permission_minutes;
  elsif _request_type = 'attendance_regularization' then
    select status into _old_status from public.attendance_regularizations where id = _request_id;
    update public.attendance_regularizations
      set status = _action, approval_remarks = _remarks, approver_id = _actor_id
      where id = _request_id and status = 'pending'
      returning attendance_date, requested_check_in, requested_check_out
        into _reg_date, _reg_check_in, _reg_check_out;
  elsif _request_type = 'onduty_request' then
    select status into _old_status from public.onduty_requests where id = _request_id;
    update public.onduty_requests
      set status = _action, approval_remarks = _remarks
      where id = _request_id and status = 'pending'
      returning from_date, to_date, onduty_type into _from_date, _to_date, _onduty_type;
  elsif _request_type = 'other_request' then
    select status into _old_status from public.other_requests where id = _request_id;
    update public.other_requests
      set status = _action, approval_remarks = _remarks
      where id = _request_id and status = 'pending';
  else
    raise exception 'act_on_approval: unsupported request type %', _request_type;
  end if;

  if not found then
    raise exception 'act_on_approval: request is not pending (already actioned?)';
  end if;

  -- Deduct across every leave_balances period for this employee/leave-type
  -- (cumulative model): check the sum first, then spend from the earliest
  -- period with remaining balance forward, so a request isn't blocked just
  -- because the specific month it falls in has too small a slice.
  if _request_type = 'leave_request' and _action = 'approved' then
    select coalesce(sum(balance), 0) into _remaining
      from public.leave_balances
      where employee_id = _owner_id and leave_type_id = _leave_type_id;

    if _remaining - _duration < 0 then
      raise exception 'act_on_approval: approving this request would drive leave type % balance negative (% available, % requested)',
        _leave_type_id, _remaining, _duration;
    end if;

    _remaining_to_deduct := _duration;
    for _period_row in
      select id, balance from public.leave_balances
      where employee_id = _owner_id and leave_type_id = _leave_type_id and balance > 0
      order by period_start
      for update
    loop
      exit when _remaining_to_deduct <= 0;
      _deduct_amount := least(_period_row.balance, _remaining_to_deduct);
      update public.leave_balances
        set used = used + _deduct_amount, balance = balance - _deduct_amount
        where id = _period_row.id;
      _remaining_to_deduct := _remaining_to_deduct - _deduct_amount;
    end loop;
    -- No balance rows at all is left un-deducted rather than blocking the
    -- approval outright — leave types with accrual_frequency = 'none'
    -- (e.g. unpaid/compensatory) may legitimately have no leave_balances row.
  end if;

  -- Deduct the matching permission-balance period on approval only.
  if _request_type = 'permission_request' and _action = 'approved' then
    select id, balance_minutes into _perm_balance_id, _perm_remaining
      from public.permission_balances
      where employee_id = _owner_id
        and period_start <= _permission_date and period_end >= _permission_date
      for update;

    if _perm_balance_id is not null then
      if _perm_remaining - _permission_minutes < 0 then
        raise exception 'act_on_approval: approving this request would drive permission balance negative (% minutes available, % requested)',
          _perm_remaining, _permission_minutes;
      end if;
      update public.permission_balances
        set used_minutes = used_minutes + _permission_minutes, balance_minutes = balance_minutes - _permission_minutes
        where id = _perm_balance_id;
    end if;
    -- No matching period is left un-deducted rather than blocking the
    -- approval outright, same reasoning as the leave-balance block above.
  end if;

  -- (a) Apply an approved leave to the attendance table: every day in range
  -- becomes day_status = 'leave'. Overwrites whatever was there before
  -- (e.g. a stale seeded 'absent' guess) — the approved leave is now the
  -- authoritative status for that day.
  if _request_type = 'leave_request' and _action = 'approved' then
    select name into _leave_type_name from public.leave_types where id = _leave_type_id;
    _loop_date := _from_date;
    while _loop_date <= _to_date loop
      insert into public.attendance (organization_id, employee_id, attendance_date, day_status, validation_status, remarks)
      values (_org_id, _owner_id, _loop_date, 'leave', 'completed', coalesce(_leave_type_name, 'Leave'))
      on conflict (employee_id, attendance_date) do update set
        day_status = 'leave',
        validation_status = 'completed',
        remarks = coalesce(excluded.remarks, public.attendance.remarks);
      _loop_date := _loop_date + 1;
    end loop;
  end if;

  -- (b) Apply an approved on-duty/WFH request the same way: every day in
  -- range becomes day_status = 'present' (the employee worked, just not
  -- from a punch-tracked location), with a remark noting which type.
  if _request_type = 'onduty_request' and _action = 'approved' then
    _onduty_remark := case when _onduty_type = 'work_from_home' then 'Work From Home' else 'On Duty' end;
    _loop_date := _from_date;
    while _loop_date <= _to_date loop
      insert into public.attendance (organization_id, employee_id, attendance_date, day_status, validation_status, remarks)
      values (_org_id, _owner_id, _loop_date, 'present', 'completed', _onduty_remark)
      on conflict (employee_id, attendance_date) do update set
        day_status = 'present',
        validation_status = 'completed',
        remarks = coalesce(excluded.remarks, public.attendance.remarks);
      _loop_date := _loop_date + 1;
    end loop;
  end if;

  -- Apply an approved regularization to the actual attendance row. Resolve
  -- the shift from the existing attendance row if one exists, else from the
  -- employee's active shift_assignments as of the attendance date (mirrors
  -- how seed.sql assigns shifts). Falls back to marking the day 'present'
  -- with is_regularized = true (no shift-relative metrics) if no shift can
  -- be resolved at all, rather than silently doing nothing.
  if _request_type = 'attendance_regularization' and _action = 'approved' then
    select check_in, check_out, shift_id into _existing_check_in, _existing_check_out, _shift_id
      from public.attendance where employee_id = _owner_id and attendance_date = _reg_date;

    if _shift_id is null then
      select shift_id into _shift_id from public.shift_assignments
        where employee_id = _owner_id and effective_from <= _reg_date
        order by effective_from desc limit 1;
    end if;

    _reg_check_in := coalesce(_reg_check_in, _existing_check_in);
    _reg_check_out := coalesce(_reg_check_out, _existing_check_out);

    if _shift_id is not null then
      select start_time, end_time, grace_minutes, half_day_hours, full_day_hours
        into _shift_start, _shift_end, _grace, _half_day_hours, _full_day_hours
        from public.shifts where id = _shift_id;
    end if;

    if _reg_check_in is not null and _reg_check_out is not null and _shift_id is not null then
      _check_in_minutes := extract(hour from _reg_check_in)::int * 60 + extract(minute from _reg_check_in)::int;
      _check_out_minutes := extract(hour from _reg_check_out)::int * 60 + extract(minute from _reg_check_out)::int;
      if _check_out_minutes < _check_in_minutes then
        _check_out_minutes := _check_out_minutes + 1440; -- overnight shift/punch
      end if;

      _shift_start_minutes := extract(hour from _shift_start)::int * 60 + extract(minute from _shift_start)::int;
      _shift_end_minutes := extract(hour from _shift_end)::int * 60 + extract(minute from _shift_end)::int;
      if _shift_end_minutes <= _shift_start_minutes then
        _shift_end_minutes := _shift_end_minutes + 1440;
      end if;

      _effective_minutes := _check_out_minutes - _check_in_minutes;
      _late_minutes := greatest(0, _check_in_minutes - (_shift_start_minutes + coalesce(_grace, 0)));
      _early_going_minutes := greatest(0, _shift_end_minutes - _check_out_minutes);
      _excess_stay_minutes := greatest(0, _check_out_minutes - _shift_end_minutes);
      _shortfall_minutes := greatest(0, (coalesce(_full_day_hours, 8) * 60)::int - _effective_minutes);
      _day_status := case when _effective_minutes >= (coalesce(_half_day_hours, 4.5) * 60)::int then 'present' else 'half_day' end;

      insert into public.attendance (
        organization_id, employee_id, attendance_date, shift_id, check_in, check_out,
        effective_minutes, late_minutes, early_going_minutes, excess_stay_minutes, shortfall_minutes,
        day_status, validation_status, is_regularized, remarks
      ) values (
        _org_id, _owner_id, _reg_date, _shift_id, _reg_check_in, _reg_check_out,
        _effective_minutes, _late_minutes, _early_going_minutes, _excess_stay_minutes, _shortfall_minutes,
        _day_status, 'completed', true, _remarks
      )
      on conflict (employee_id, attendance_date) do update set
        shift_id = excluded.shift_id,
        check_in = excluded.check_in,
        check_out = excluded.check_out,
        effective_minutes = excluded.effective_minutes,
        late_minutes = excluded.late_minutes,
        early_going_minutes = excluded.early_going_minutes,
        excess_stay_minutes = excluded.excess_stay_minutes,
        shortfall_minutes = excluded.shortfall_minutes,
        day_status = excluded.day_status,
        validation_status = 'completed',
        is_regularized = true,
        remarks = coalesce(excluded.remarks, public.attendance.remarks);
    else
      -- No punch times and/or no resolvable shift (e.g. a plain
      -- present_correction with nothing but "I was present" and a reason) —
      -- still record the correction rather than silently dropping it.
      insert into public.attendance (organization_id, employee_id, attendance_date, shift_id, day_status, validation_status, is_regularized, remarks)
      values (_org_id, _owner_id, _reg_date, _shift_id, 'present', 'completed', true, _remarks)
      on conflict (employee_id, attendance_date) do update set
        day_status = 'present',
        validation_status = 'completed',
        is_regularized = true,
        remarks = coalesce(excluded.remarks, public.attendance.remarks);
    end if;
  end if;

  insert into public.audit_logs (organization_id, actor_user_id, action, module, record_id, old_value, new_value)
    values (
      _org_id, auth.uid(), (case when _action = 'approved' then 'approval' else 'rejection' end),
      'manager_self_service', _request_id,
      jsonb_build_object('request_type', _request_type, 'status', _old_status),
      jsonb_build_object('request_type', _request_type, 'status', _action, 'remarks', _remarks)
    );

  select id into _workflow_id from public.approval_workflows
    where organization_id = _org_id and request_type = _request_type and is_active
    order by created_at limit 1;

  if _workflow_id is not null then
    insert into public.approval_instances (workflow_id, request_type, request_id, status, current_step_order)
      values (_workflow_id, _request_type, _request_id, _action, 1)
      on conflict (request_type, request_id) do update set status = excluded.status
      returning id into _instance_id;

    insert into public.approval_actions (approval_instance_id, step_order, actor_employee_id, action, remarks)
      values (_instance_id, 1, _actor_id, _action, _remarks);
  end if;

  _notification_type := case _request_type
    when 'leave_request' then (case when _action = 'approved' then 'leave_approved' else 'leave_rejected' end)
    when 'permission_request' then (case when _action = 'approved' then 'permission_approved' else 'permission_rejected' end)
    when 'attendance_regularization' then (case when _action = 'approved' then 'regularization_approved' else 'regularization_rejected' end)
    when 'onduty_request' then (case when _action = 'approved' then 'onduty_approved' else 'onduty_rejected' end)
    when 'other_request' then (case when _action = 'approved' then 'other_request_approved' else 'other_request_rejected' end)
  end;
  _title := case when _action = 'approved' then 'Your request has been approved' else 'Your request has been rejected' end;

  select user_id into _recipient_user from public.employees where id = _owner_id;
  if _recipient_user is not null then
    insert into public.notifications (organization_id, recipient_user_id, notification_type, title, body, link_path)
      values (_org_id, _recipient_user, _notification_type, _title, _remarks, '/attendance/event-request');
  end if;
end;
$$;

grant execute on function public.act_on_approval(text, uuid, text, text) to authenticated;

-- ============================================================
-- 0044_effective_hours_engine.sql
-- ============================================================
-- Effective Hours must be the sum of every valid IN/OUT session in a day
-- (e.g. 10:00-11:00 + 11:15-18:30 = 08:15), not a single check_out - check_in
-- subtraction. Today it's the latter, computed independently (and
-- duplicated) in three places: src/lib/attendanceCalc.ts, this function's
-- old regularization branch, and supabase/seed/seed.sql. Meanwhile
-- `attendance_punches` (the raw multi-punch log) has existed since 0006 but
-- nothing has ever aggregated it into `attendance` — it's only ever been
-- read for the "Raw In/Out Records" report. AttendanceRulesPage.tsx even has
-- a banner admitting "attendance computation does not read them yet."
--
-- This migration adds `recompute_attendance_day()`: the one function that
-- reads `attendance_punches` for a given employee/day, pairs sequential
-- in->out punches (ignoring duplicate/orphan punches, per the spec's
-- explicit requirement to handle multiple/missing/duplicate/invalid-sequence
-- punches), sums the closed pairs as effective_minutes, and derives gross
-- duration, break duration (the gaps between sessions), first-in, last-out,
-- missing-in/missing-out flags, shortfall, and the corrected excess-stay
-- formula (Effective - Required, matching the spec's worked example --
-- today's excess_stay_minutes is wrongly time-of-day-based:
-- checkout - shift_end). It never overwrites a day already claimed by an
-- override status (leave/holiday/weekoff/on_duty/permission/WFH), which is
-- what makes the spec's attendance-priority order hold structurally.
--
-- Two callers feed it: act_on_approval()'s regularization branch (writes the
-- approved correction as a synthetic 'manual' punch pair instead of
-- recomputing metrics inline) and the reseeded supabase/seed/seed.sql.
--
-- get_missing_attendance() (0039/0041) is also fixed here: it recomputed
-- "missing" via `check_in is null`/`check_out is null`, which flagged every
-- approved WFH/On-Duty day (day_status='present', check_in/check_out both
-- null by design, per 0037) as a missing punch. It now reads the stored
-- missing_in/missing_out columns instead -- since leave/WFH/on-duty days
-- never go through recompute_attendance_day, those flags stay false by
-- construction, fixing the false positive at the root.

alter table public.attendance
  add column if not exists gross_minutes integer not null default 0,
  add column if not exists break_minutes integer not null default 0,
  add column if not exists missing_in boolean not null default false,
  add column if not exists missing_out boolean not null default false;

-- Informational reference value only (spec's "Standard break = 01:00"
-- default) -- the break actually shown/used is always the computed sum of
-- gaps between real sessions, not this configured number.
alter table public.shifts
  add column if not exists standard_break_minutes smallint not null default 60;

create or replace function public.recompute_attendance_day(_employee_id uuid, _attendance_date date)
returns void
language plpgsql security definer set search_path = public as $$
declare
  _org_id uuid;
  _shift_id uuid;
  _shift_start time;
  _shift_end time;
  _grace int;
  _half_day_hours numeric;
  _full_day_hours numeric;
  _shift_start_minutes int;
  _shift_end_minutes int;
  _existing_status text;
  _existing_remarks text;
  _existing_check_in timestamptz;
  _existing_check_out timestamptz;
  _rec record;
  _open_in timestamptz;
  _first_in timestamptz;
  _last_out timestamptz;
  _effective_minutes int := 0;
  _gross_minutes int := 0;
  _break_minutes int := 0;
  _missing_in boolean := false;
  _missing_out boolean := false;
  _has_any_punch boolean := false;
  _check_in_minutes int;
  _check_out_minutes int;
  _late_minutes int := 0;
  _early_going_minutes int := 0;
  _excess_stay_minutes int := 0;
  _shortfall_minutes int := 0;
  _half_day_minutes int;
  _full_day_minutes int;
  _day_status text;
begin
  select organization_id into _org_id from public.employees where id = _employee_id;
  if _org_id is null then
    return;
  end if;

  -- Never overwrite a day already claimed by an override status -- holiday/
  -- weekoff/leave/on_duty/permission always win over punches, and an
  -- approved WFH/On-Duty day (stored as day_status='present' with
  -- check_in/check_out both null, per 0037) must stay that way too, not be
  -- flipped to 'absent' just because there are no punches to aggregate.
  select day_status, remarks, check_in, check_out
    into _existing_status, _existing_remarks, _existing_check_in, _existing_check_out
    from public.attendance where employee_id = _employee_id and attendance_date = _attendance_date;

  if _existing_status in ('leave', 'holiday', 'weekoff', 'on_duty', 'permission') then
    return;
  end if;
  if _existing_status = 'present' and _existing_remarks in ('Work From Home', 'On Duty')
     and _existing_check_in is null and _existing_check_out is null then
    return;
  end if;

  -- Resolve the employee's shift as of this date (same lookup as the old
  -- regularization branch / seed.sql).
  select shift_id into _shift_id from public.shift_assignments
    where employee_id = _employee_id and effective_from <= _attendance_date
    order by effective_from desc limit 1;

  if _shift_id is not null then
    select start_time, end_time, grace_minutes, half_day_hours, full_day_hours
      into _shift_start, _shift_end, _grace, _half_day_hours, _full_day_hours
      from public.shifts where id = _shift_id;
    _shift_start_minutes := extract(hour from _shift_start)::int * 60 + extract(minute from _shift_start)::int;
    _shift_end_minutes := extract(hour from _shift_end)::int * 60 + extract(minute from _shift_end)::int;
    if _shift_end_minutes <= _shift_start_minutes then
      _shift_end_minutes := _shift_end_minutes + 1440; -- overnight shift
    end if;
  end if;

  -- Walk punches for this day in time order, pairing sequential in->out.
  -- `attendance_punches.punch_date` is always the shift's logical start day
  -- (the seed/regularization convention -- an overnight punch_time still
  -- rolls into the real next calendar day, but punch_date stays put), so no
  -- day+1 lookahead is needed; ordering by the real punch_time timestamptz
  -- keeps chronological order regardless.
  --
  -- A second consecutive 'in' before a matching 'out' is a duplicate --
  -- ignored, the earlier 'in' stays open. An 'out' with no open 'in' is an
  -- orphan/invalid-sequence punch -- ignored. This is the spec's explicit
  -- multiple/missing/duplicate/invalid-sequence handling.
  for _rec in
    select punch_time, punch_type from public.attendance_punches
    where employee_id = _employee_id and punch_date = _attendance_date
    order by punch_time
  loop
    _has_any_punch := true;
    if _rec.punch_type = 'in' then
      if _first_in is null then
        _first_in := _rec.punch_time;
      end if;
      if _open_in is null then
        _open_in := _rec.punch_time;
      end if;
    else -- 'out'
      -- Track the latest 'out' seen regardless of whether it closes a valid
      -- pair, so an orphan out (no open 'in') still counts for missing_in
      -- detection and the "Last OUT" display -- only effective_minutes
      -- requires a real closed pair.
      _last_out := _rec.punch_time;
      if _open_in is not null then
        _effective_minutes := _effective_minutes + round(extract(epoch from (_rec.punch_time - _open_in)) / 60)::int;
        _open_in := null;
      end if;
    end if;
  end loop;

  _missing_out := _open_in is not null;
  _missing_in := _first_in is null and _last_out is not null;

  if _first_in is not null and _last_out is not null then
    _gross_minutes := greatest(0, round(extract(epoch from (_last_out - _first_in)) / 60)::int);
  end if;
  _break_minutes := greatest(0, _gross_minutes - _effective_minutes);

  _half_day_minutes := (coalesce(_half_day_hours, 4.5) * 60)::int;
  _full_day_minutes := (coalesce(_full_day_hours, 8) * 60)::int;

  if _first_in is not null and _shift_id is not null then
    _check_in_minutes := extract(hour from _first_in)::int * 60 + extract(minute from _first_in)::int;
    _late_minutes := greatest(0, _check_in_minutes - (_shift_start_minutes + coalesce(_grace, 0)));
  end if;
  if _last_out is not null and _shift_id is not null then
    _check_out_minutes := extract(hour from _last_out)::int * 60 + extract(minute from _last_out)::int;
    if _check_in_minutes is not null and _check_out_minutes < _check_in_minutes then
      _check_out_minutes := _check_out_minutes + 1440; -- rolled past midnight
    end if;
    _early_going_minutes := greatest(0, _shift_end_minutes - _check_out_minutes);
  end if;

  _shortfall_minutes := greatest(0, _full_day_minutes - _effective_minutes);
  _excess_stay_minutes := greatest(0, _effective_minutes - _full_day_minutes);

  if not _has_any_punch then
    _day_status := 'absent';
  elsif _effective_minutes >= _half_day_minutes then
    _day_status := 'present';
  else
    -- Any real punch activity that isn't (yet) a complete, full-day pair --
    -- including an unmatched open 'in' with zero effective minutes -- stays
    -- visible to get_missing_attendance() (which only reports
    -- present/half_day rows), rather than disappearing into 'absent'.
    _day_status := 'half_day';
  end if;

  insert into public.attendance (
    organization_id, employee_id, attendance_date, shift_id, check_in, check_out,
    gross_minutes, break_minutes, effective_minutes, late_minutes, early_going_minutes,
    excess_stay_minutes, shortfall_minutes, missing_in, missing_out, day_status, validation_status
  ) values (
    _org_id, _employee_id, _attendance_date, _shift_id, _first_in, _last_out,
    _gross_minutes, _break_minutes, _effective_minutes, _late_minutes, _early_going_minutes,
    _excess_stay_minutes, _shortfall_minutes, _missing_in, _missing_out, _day_status, 'completed'
  )
  on conflict (employee_id, attendance_date) do update set
    shift_id = excluded.shift_id,
    check_in = excluded.check_in,
    check_out = excluded.check_out,
    gross_minutes = excluded.gross_minutes,
    break_minutes = excluded.break_minutes,
    effective_minutes = excluded.effective_minutes,
    late_minutes = excluded.late_minutes,
    early_going_minutes = excluded.early_going_minutes,
    excess_stay_minutes = excluded.excess_stay_minutes,
    shortfall_minutes = excluded.shortfall_minutes,
    missing_in = excluded.missing_in,
    missing_out = excluded.missing_out,
    day_status = excluded.day_status,
    validation_status = 'completed';
end;
$$;

grant execute on function public.recompute_attendance_day(uuid, date) to authenticated;

-- Defensive backfill: every pre-existing present/half_day row was written by
-- the old single-pair formula, which always set check_in and check_out
-- together (or neither) -- except the WFH/On-Duty rows this migration's fix
-- targets, which must stay excluded (false). Harmless no-op for rows this
-- doesn't apply to.
update public.attendance
  set missing_in = (check_in is null), missing_out = (check_out is null)
  where day_status in ('present', 'half_day')
    and not (remarks in ('Work From Home', 'On Duty') and check_in is null and check_out is null);

-- Full redeclare required (see 0037/0038/0043 -- create or replace function
-- needs the whole body every time). Every branch is unchanged from 0043
-- except the regularization arm, which now writes the approved correction
-- as synthetic 'manual' punches and delegates to recompute_attendance_day()
-- instead of computing shift-relative metrics inline -- so a regularization
-- composes correctly with any other real punches that day instead of
-- overwriting the whole day's numbers, and shares the exact same
-- multi-session/duplicate/invalid-sequence handling as everywhere else.
create or replace function public.act_on_approval(
  _request_type text,
  _request_id uuid,
  _action text,
  _remarks text default null
)
returns void
language plpgsql security definer set search_path = public as $$
declare
  _owner_id uuid;
  _actor_id uuid := public.current_employee_id();
  _org_id uuid;
  _old_status text;
  _workflow_id uuid;
  _instance_id uuid;
  _recipient_user uuid;
  _notification_type text;
  _title text;
  _leave_type_id uuid;
  _leave_type_name text;
  _duration numeric(5,2);
  _from_date date;
  _to_date date;
  _remaining numeric(6,2);
  _remaining_to_deduct numeric(5,2);
  _deduct_amount numeric(5,2);
  _period_row record;
  -- Regularization -> attendance sync
  _reg_date date;
  _reg_check_in timestamptz;
  _reg_check_out timestamptz;
  -- Leave / onduty -> attendance sync
  _onduty_type text;
  _loop_date date;
  _onduty_remark text;
  -- Permission balance
  _permission_date date;
  _permission_minutes int;
  _perm_balance_id uuid;
  _perm_remaining int;
begin
  if _action not in ('approved', 'rejected') then
    raise exception 'act_on_approval: action must be ''approved'' or ''rejected'', got %', _action;
  end if;

  _owner_id := public.request_owner_employee_id(_request_type, _request_id);
  if _owner_id is null then
    raise exception 'act_on_approval: request % / % not found', _request_type, _request_id;
  end if;

  if _actor_id is null or not (public.is_hr_or_admin() or public.is_manager_of(_owner_id)) then
    raise exception 'act_on_approval: not authorized to act on this request';
  end if;

  select organization_id into _org_id from public.employees where id = _owner_id;

  if _request_type = 'leave_request' then
    select status into _old_status from public.leave_requests where id = _request_id;
    update public.leave_requests
      set status = _action, approval_remarks = _remarks
      where id = _request_id and status = 'pending'
      returning leave_type_id, duration_days, from_date, to_date into _leave_type_id, _duration, _from_date, _to_date;
  elsif _request_type = 'permission_request' then
    select status into _old_status from public.permission_requests where id = _request_id;
    update public.permission_requests
      set status = _action, approval_remarks = _remarks
      where id = _request_id and status = 'pending'
      returning permission_date, duration_minutes into _permission_date, _permission_minutes;
  elsif _request_type = 'attendance_regularization' then
    select status into _old_status from public.attendance_regularizations where id = _request_id;
    update public.attendance_regularizations
      set status = _action, approval_remarks = _remarks, approver_id = _actor_id
      where id = _request_id and status = 'pending'
      returning attendance_date, requested_check_in, requested_check_out
        into _reg_date, _reg_check_in, _reg_check_out;
  elsif _request_type = 'onduty_request' then
    select status into _old_status from public.onduty_requests where id = _request_id;
    update public.onduty_requests
      set status = _action, approval_remarks = _remarks
      where id = _request_id and status = 'pending'
      returning from_date, to_date, onduty_type into _from_date, _to_date, _onduty_type;
  elsif _request_type = 'other_request' then
    select status into _old_status from public.other_requests where id = _request_id;
    update public.other_requests
      set status = _action, approval_remarks = _remarks
      where id = _request_id and status = 'pending';
  else
    raise exception 'act_on_approval: unsupported request type %', _request_type;
  end if;

  if not found then
    raise exception 'act_on_approval: request is not pending (already actioned?)';
  end if;

  -- Deduct across every leave_balances period for this employee/leave-type
  -- (cumulative model): check the sum first, then spend from the earliest
  -- period with remaining balance forward, so a request isn't blocked just
  -- because the specific month it falls in has too small a slice.
  if _request_type = 'leave_request' and _action = 'approved' then
    select coalesce(sum(balance), 0) into _remaining
      from public.leave_balances
      where employee_id = _owner_id and leave_type_id = _leave_type_id;

    if _remaining - _duration < 0 then
      raise exception 'act_on_approval: approving this request would drive leave type % balance negative (% available, % requested)',
        _leave_type_id, _remaining, _duration;
    end if;

    _remaining_to_deduct := _duration;
    for _period_row in
      select id, balance from public.leave_balances
      where employee_id = _owner_id and leave_type_id = _leave_type_id and balance > 0
      order by period_start
      for update
    loop
      exit when _remaining_to_deduct <= 0;
      _deduct_amount := least(_period_row.balance, _remaining_to_deduct);
      update public.leave_balances
        set used = used + _deduct_amount, balance = balance - _deduct_amount
        where id = _period_row.id;
      _remaining_to_deduct := _remaining_to_deduct - _deduct_amount;
    end loop;
    -- No balance rows at all is left un-deducted rather than blocking the
    -- approval outright -- leave types with accrual_frequency = 'none'
    -- (e.g. unpaid/compensatory) may legitimately have no leave_balances row.
  end if;

  -- Deduct the matching permission-balance period on approval only.
  if _request_type = 'permission_request' and _action = 'approved' then
    select id, balance_minutes into _perm_balance_id, _perm_remaining
      from public.permission_balances
      where employee_id = _owner_id
        and period_start <= _permission_date and period_end >= _permission_date
      for update;

    if _perm_balance_id is not null then
      if _perm_remaining - _permission_minutes < 0 then
        raise exception 'act_on_approval: approving this request would drive permission balance negative (% minutes available, % requested)',
          _perm_remaining, _permission_minutes;
      end if;
      update public.permission_balances
        set used_minutes = used_minutes + _permission_minutes, balance_minutes = balance_minutes - _permission_minutes
        where id = _perm_balance_id;
    end if;
    -- No matching period is left un-deducted rather than blocking the
    -- approval outright, same reasoning as the leave-balance block above.
  end if;

  -- (a) Apply an approved leave to the attendance table: every day in range
  -- becomes day_status = 'leave'. Overwrites whatever was there before
  -- (e.g. a stale seeded 'absent' guess) -- the approved leave is now the
  -- authoritative status for that day.
  if _request_type = 'leave_request' and _action = 'approved' then
    select name into _leave_type_name from public.leave_types where id = _leave_type_id;
    _loop_date := _from_date;
    while _loop_date <= _to_date loop
      insert into public.attendance (organization_id, employee_id, attendance_date, day_status, validation_status, remarks)
      values (_org_id, _owner_id, _loop_date, 'leave', 'completed', coalesce(_leave_type_name, 'Leave'))
      on conflict (employee_id, attendance_date) do update set
        day_status = 'leave',
        validation_status = 'completed',
        remarks = coalesce(excluded.remarks, public.attendance.remarks);
      _loop_date := _loop_date + 1;
    end loop;
  end if;

  -- (b) Apply an approved on-duty/WFH request the same way: every day in
  -- range becomes day_status = 'present' (the employee worked, just not
  -- from a punch-tracked location), with a remark noting which type.
  -- recompute_attendance_day() recognizes this remark and refuses to
  -- overwrite it if punches are ever recomputed for the same date.
  if _request_type = 'onduty_request' and _action = 'approved' then
    _onduty_remark := case when _onduty_type = 'work_from_home' then 'Work From Home' else 'On Duty' end;
    _loop_date := _from_date;
    while _loop_date <= _to_date loop
      insert into public.attendance (organization_id, employee_id, attendance_date, day_status, validation_status, remarks)
      values (_org_id, _owner_id, _loop_date, 'present', 'completed', _onduty_remark)
      on conflict (employee_id, attendance_date) do update set
        day_status = 'present',
        validation_status = 'completed',
        remarks = coalesce(excluded.remarks, public.attendance.remarks);
      _loop_date := _loop_date + 1;
    end loop;
  end if;

  -- Apply an approved regularization by writing the correction as
  -- synthetic 'manual' punches and letting recompute_attendance_day() do
  -- the actual shift-relative math -- the same engine every other punch
  -- (biometric, mobile, web) goes through. A prior 'manual' punch of the
  -- same type for this date is replaced, not stacked, so re-approving a
  -- corrected regularization doesn't accumulate duplicate synthetic punches.
  if _request_type = 'attendance_regularization' and _action = 'approved' then
    if _reg_check_in is not null or _reg_check_out is not null then
      if _reg_check_in is not null then
        delete from public.attendance_punches
          where employee_id = _owner_id and punch_date = _reg_date and source = 'manual' and punch_type = 'in';
        insert into public.attendance_punches (organization_id, employee_id, punch_date, punch_time, punch_type, source)
          values (_org_id, _owner_id, _reg_date, _reg_check_in, 'in', 'manual');
      end if;
      if _reg_check_out is not null then
        delete from public.attendance_punches
          where employee_id = _owner_id and punch_date = _reg_date and source = 'manual' and punch_type = 'out';
        insert into public.attendance_punches (organization_id, employee_id, punch_date, punch_time, punch_type, source)
          values (_org_id, _owner_id, _reg_date, _reg_check_out, 'out', 'manual');
      end if;

      perform public.recompute_attendance_day(_owner_id, _reg_date);

      update public.attendance
        set is_regularized = true, remarks = coalesce(_remarks, remarks)
        where employee_id = _owner_id and attendance_date = _reg_date;
    else
      -- No punch times at all (e.g. a plain present_correction with nothing
      -- but "I was present" and a reason) -- still record the correction
      -- rather than silently dropping it, same fallback as before.
      insert into public.attendance (organization_id, employee_id, attendance_date, day_status, validation_status, is_regularized, remarks)
      values (_org_id, _owner_id, _reg_date, 'present', 'completed', true, _remarks)
      on conflict (employee_id, attendance_date) do update set
        day_status = 'present',
        validation_status = 'completed',
        is_regularized = true,
        remarks = coalesce(excluded.remarks, public.attendance.remarks);
    end if;
  end if;

  insert into public.audit_logs (organization_id, actor_user_id, action, module, record_id, old_value, new_value)
    values (
      _org_id, auth.uid(), (case when _action = 'approved' then 'approval' else 'rejection' end),
      'manager_self_service', _request_id,
      jsonb_build_object('request_type', _request_type, 'status', _old_status),
      jsonb_build_object('request_type', _request_type, 'status', _action, 'remarks', _remarks)
    );

  select id into _workflow_id from public.approval_workflows
    where organization_id = _org_id and request_type = _request_type and is_active
    order by created_at limit 1;

  if _workflow_id is not null then
    insert into public.approval_instances (workflow_id, request_type, request_id, status, current_step_order)
      values (_workflow_id, _request_type, _request_id, _action, 1)
      on conflict (request_type, request_id) do update set status = excluded.status
      returning id into _instance_id;

    insert into public.approval_actions (approval_instance_id, step_order, actor_employee_id, action, remarks)
      values (_instance_id, 1, _actor_id, _action, _remarks);
  end if;

  _notification_type := case _request_type
    when 'leave_request' then (case when _action = 'approved' then 'leave_approved' else 'leave_rejected' end)
    when 'permission_request' then (case when _action = 'approved' then 'permission_approved' else 'permission_rejected' end)
    when 'attendance_regularization' then (case when _action = 'approved' then 'regularization_approved' else 'regularization_rejected' end)
    when 'onduty_request' then (case when _action = 'approved' then 'onduty_approved' else 'onduty_rejected' end)
    when 'other_request' then (case when _action = 'approved' then 'other_request_approved' else 'other_request_rejected' end)
  end;
  _title := case when _action = 'approved' then 'Your request has been approved' else 'Your request has been rejected' end;

  select user_id into _recipient_user from public.employees where id = _owner_id;
  if _recipient_user is not null then
    insert into public.notifications (organization_id, recipient_user_id, notification_type, title, body, link_path)
      values (_org_id, _recipient_user, _notification_type, _title, _remarks, '/attendance/event-request');
  end if;
end;
$$;

grant execute on function public.act_on_approval(text, uuid, text, text) to authenticated;

-- Full redeclare from 0041 -- only the missing_in/missing_out computation
-- changes (reads the stored columns instead of recomputing null-checks),
-- which is the actual fix for the WFH/On-Duty false-positive bug described
-- above. Everything else (scoping, holiday/weekoff exclusion, ordering) is
-- unchanged.
create or replace function public.get_missing_attendance(_from_date date, _to_date date)
returns table (
  employee_id uuid,
  employee_code text,
  employee_name text,
  department_name text,
  location_name text,
  attendance_date date,
  shift_name text,
  shift_start_time time,
  shift_end_time time,
  missing_in boolean,
  missing_out boolean,
  day_status text,
  regularization_status text
)
language plpgsql stable security definer set search_path = public as $$
begin
  return query
  with scoped_employees as (
    select
      e.id,
      e.employee_code,
      (e.first_name || coalesce(' ' || e.last_name, '')) as full_name,
      d.name as dept_name,
      l.name as loc_name,
      e.organization_id
    from public.employees e
    left join public.departments d on d.id = e.department_id
    left join public.locations l on l.id = e.location_id
    where e.employment_status = 'active'
      and e.organization_id = public.current_organization_id()
      and (
        e.id = public.current_employee_id()
        or public.is_manager_of(e.id)
        or public.is_hr_or_admin()
      )
  ),
  calendar as (
    select se.*, gs.cal_date::date as cal_date
    from scoped_employees se
    cross join lateral generate_series(_from_date, least(_to_date, current_date), interval '1 day') as gs(cal_date)
  ),
  with_shift as (
    select
      c.*,
      s.name as shift_name,
      s.start_time,
      s.end_time,
      s.weekoff_days
    from calendar c
    left join lateral (
      select sa_inner.shift_id from public.shift_assignments sa_inner
      where sa_inner.employee_id = c.id and sa_inner.effective_from <= c.cal_date
      order by sa_inner.effective_from desc limit 1
    ) sa on true
    left join public.shifts s on s.id = sa.shift_id
  ),
  candidates as (
    select ws.*
    from with_shift ws
    where not exists (
      select 1 from public.holidays h
      where h.organization_id = ws.organization_id and h.holiday_date = ws.cal_date
    )
    and (ws.weekoff_days is null or not (extract(dow from ws.cal_date)::int = any(ws.weekoff_days)))
  )
  select
    c.id,
    c.employee_code,
    c.full_name,
    c.dept_name,
    c.loc_name,
    c.cal_date,
    c.shift_name,
    c.start_time,
    c.end_time,
    coalesce(a.missing_in, true) as missing_in,
    coalesce(a.missing_out, true) as missing_out,
    coalesce(a.day_status, 'no_record'),
    ar.status
  from candidates c
  left join public.attendance a on a.employee_id = c.id and a.attendance_date = c.cal_date
  left join public.attendance_regularizations ar
    on ar.employee_id = c.id and ar.attendance_date = c.cal_date and ar.status = 'pending'
  where a.id is null
     or (a.day_status in ('present', 'half_day') and (a.missing_in or a.missing_out))
  order by c.cal_date desc, c.employee_code;
end;
$$;

grant execute on function public.get_missing_attendance(date, date) to authenticated;

-- ============================================================
-- 0045_configurable_break_policy.sql
-- ============================================================
-- recompute_attendance_day() (0044) computed break as "gross - effective",
-- which is the same "every gap is a break" assumption the spec explicitly
-- warns against: a 5-minute gap between two punches (a quick device hiccup)
-- was deducted exactly the same as a real 1-hour lunch. Break handling must
-- be a configurable policy, not a blind gap subtraction:
--
--   - minBreakMinutes: a gap shorter than this isn't a formal break at all
--     -- it's bridged back into effective time.
--   - maxBreakMinutes: a gap longer than this doesn't change the arithmetic
--     (it's still fully excluded from effective time either way) but flags
--     the day for review rather than being silently absorbed.
--   - standardBreakMinutes (already added in 0044 as an unused reference
--     value -- now operationally used): when deductionMode = 'standard',
--     once any qualifying break occurs, exactly this much is deducted
--     regardless of how long the gap actually measured.
--   - breakPaid: a paid break doesn't cost the employee credit toward
--     required hours even though it isn't work time; an unpaid break does.
--
-- src/lib/attendanceCalc.ts's computeSessionsFromPunches/derivePayableMinutes
-- mirror this exact logic (see that file for the TS-side tests proving the
-- worked examples: a 5-min gap bridged, a 1-hour lunch deducted, a 3-hour
-- gap flagged against a 2-hour max, standard-mode deducting a flat amount).

alter table public.shifts
  add column if not exists min_break_minutes smallint not null default 10,
  add column if not exists max_break_minutes smallint not null default 120,
  add column if not exists break_paid boolean not null default false,
  add column if not exists break_deduction_mode text not null default 'actual'
    check (break_deduction_mode in ('actual', 'standard'));

alter table public.attendance
  add column if not exists payable_minutes integer not null default 0,
  add column if not exists has_excess_break boolean not null default false;

-- Full redeclare (see 0044's own note on why -- create or replace function
-- needs the whole body every time). Only the gap-handling and
-- shortfall/excess sections change; everything else (shift resolution,
-- pairing/duplicate/orphan handling, missing-in/out detection, day_status,
-- the override-day guard) is unchanged from 0044.
create or replace function public.recompute_attendance_day(_employee_id uuid, _attendance_date date)
returns void
language plpgsql security definer set search_path = public as $$
declare
  _org_id uuid;
  _shift_id uuid;
  _shift_start time;
  _shift_end time;
  _grace int;
  _half_day_hours numeric;
  _full_day_hours numeric;
  _shift_start_minutes int;
  _shift_end_minutes int;
  _min_break_minutes int := 10;
  _max_break_minutes int := 120;
  _break_paid boolean := false;
  _break_deduction_mode text := 'actual';
  _standard_break_minutes int := 60;
  _existing_status text;
  _existing_remarks text;
  _existing_check_in timestamptz;
  _existing_check_out timestamptz;
  _rec record;
  _open_in timestamptz;
  _first_in timestamptz;
  _last_out timestamptz;
  _prev_session_close timestamptz;
  _gap_minutes int;
  _measured_break_minutes int := 0;
  _has_excess_break boolean := false;
  _gross_minutes int := 0;
  _break_minutes int := 0;
  _effective_minutes int := 0;
  _payable_minutes int := 0;
  _missing_in boolean := false;
  _missing_out boolean := false;
  _has_any_punch boolean := false;
  _check_in_minutes int;
  _check_out_minutes int;
  _late_minutes int := 0;
  _early_going_minutes int := 0;
  _excess_stay_minutes int := 0;
  _shortfall_minutes int := 0;
  _half_day_minutes int;
  _full_day_minutes int;
  _day_status text;
begin
  select organization_id into _org_id from public.employees where id = _employee_id;
  if _org_id is null then
    return;
  end if;

  -- Never overwrite a day already claimed by an override status -- holiday/
  -- weekoff/leave/on_duty/permission always win over punches, and an
  -- approved WFH/On-Duty day (stored as day_status='present' with
  -- check_in/check_out both null, per 0037) must stay that way too, not be
  -- flipped to 'absent' just because there are no punches to aggregate.
  select day_status, remarks, check_in, check_out
    into _existing_status, _existing_remarks, _existing_check_in, _existing_check_out
    from public.attendance where employee_id = _employee_id and attendance_date = _attendance_date;

  if _existing_status in ('leave', 'holiday', 'weekoff', 'on_duty', 'permission') then
    return;
  end if;
  if _existing_status = 'present' and _existing_remarks in ('Work From Home', 'On Duty')
     and _existing_check_in is null and _existing_check_out is null then
    return;
  end if;

  -- Resolve the employee's shift as of this date (same lookup as the old
  -- regularization branch / seed.sql). Falling back to the declared
  -- defaults above when no shift is resolvable.
  select shift_id into _shift_id from public.shift_assignments
    where employee_id = _employee_id and effective_from <= _attendance_date
    order by effective_from desc limit 1;

  if _shift_id is not null then
    select start_time, end_time, grace_minutes, half_day_hours, full_day_hours,
           min_break_minutes, max_break_minutes, break_paid, break_deduction_mode, standard_break_minutes
      into _shift_start, _shift_end, _grace, _half_day_hours, _full_day_hours,
           _min_break_minutes, _max_break_minutes, _break_paid, _break_deduction_mode, _standard_break_minutes
      from public.shifts where id = _shift_id;
    _shift_start_minutes := extract(hour from _shift_start)::int * 60 + extract(minute from _shift_start)::int;
    _shift_end_minutes := extract(hour from _shift_end)::int * 60 + extract(minute from _shift_end)::int;
    if _shift_end_minutes <= _shift_start_minutes then
      _shift_end_minutes := _shift_end_minutes + 1440; -- overnight shift
    end if;
  end if;

  -- Walk punches for this day in time order, pairing sequential in->out.
  -- `attendance_punches.punch_date` is always the shift's logical start day
  -- (the seed/regularization convention -- an overnight punch_time still
  -- rolls into the real next calendar day, but punch_date stays put), so no
  -- day+1 lookahead is needed; ordering by the real punch_time timestamptz
  -- keeps chronological order regardless.
  --
  -- A second consecutive 'in' before a matching 'out' is a duplicate --
  -- ignored, the earlier 'in' stays open. An 'out' with no open 'in' is an
  -- orphan/invalid-sequence punch -- ignored. The gap between two
  -- consecutive *closed* sessions is classified against the break policy
  -- (not blindly deducted): too short -> bridged (not deducted at all);
  -- otherwise -> a qualifying break, and flagged if it exceeds the maximum.
  for _rec in
    select punch_time, punch_type from public.attendance_punches
    where employee_id = _employee_id and punch_date = _attendance_date
    order by punch_time
  loop
    _has_any_punch := true;
    if _rec.punch_type = 'in' then
      if _first_in is null then
        _first_in := _rec.punch_time;
      end if;
      if _open_in is null then
        _open_in := _rec.punch_time;
      end if;
    else -- 'out'
      -- Track the latest 'out' seen regardless of whether it closes a valid
      -- pair, so an orphan out (no open 'in') still counts for missing_in
      -- detection and the "Last OUT" display.
      _last_out := _rec.punch_time;
      if _open_in is not null then
        if _prev_session_close is not null then
          _gap_minutes := round(extract(epoch from (_open_in - _prev_session_close)) / 60)::int;
          if _gap_minutes < _min_break_minutes then
            null; -- too short to be a formal break -- bridged, not deducted
          else
            _measured_break_minutes := _measured_break_minutes + _gap_minutes;
            if _gap_minutes > _max_break_minutes then
              _has_excess_break := true;
            end if;
          end if;
        end if;
        _prev_session_close := _rec.punch_time;
        _open_in := null;
      end if;
    end if;
  end loop;

  _missing_out := _open_in is not null;
  _missing_in := _first_in is null and _last_out is not null;

  if _first_in is not null and _last_out is not null then
    _gross_minutes := greatest(0, round(extract(epoch from (_last_out - _first_in)) / 60)::int);
  end if;

  if _break_deduction_mode = 'standard' then
    _break_minutes := case when _measured_break_minutes > 0 then _standard_break_minutes else 0 end;
  else
    _break_minutes := _measured_break_minutes;
  end if;
  _effective_minutes := greatest(0, _gross_minutes - _break_minutes);
  _payable_minutes := case when _break_paid then _effective_minutes + _break_minutes else _effective_minutes end;

  _half_day_minutes := (coalesce(_half_day_hours, 4.5) * 60)::int;
  _full_day_minutes := (coalesce(_full_day_hours, 8) * 60)::int;

  if _first_in is not null and _shift_id is not null then
    _check_in_minutes := extract(hour from _first_in)::int * 60 + extract(minute from _first_in)::int;
    _late_minutes := greatest(0, _check_in_minutes - (_shift_start_minutes + coalesce(_grace, 0)));
  end if;
  if _last_out is not null and _shift_id is not null then
    _check_out_minutes := extract(hour from _last_out)::int * 60 + extract(minute from _last_out)::int;
    if _check_in_minutes is not null and _check_out_minutes < _check_in_minutes then
      _check_out_minutes := _check_out_minutes + 1440; -- rolled past midnight
    end if;
    _early_going_minutes := greatest(0, _shift_end_minutes - _check_out_minutes);
  end if;

  -- Shortfall/Excess Stay compare against payable minutes, not raw worked
  -- minutes -- a paid break still counts toward satisfying required hours.
  _shortfall_minutes := greatest(0, _full_day_minutes - _payable_minutes);
  _excess_stay_minutes := greatest(0, _payable_minutes - _full_day_minutes);

  if not _has_any_punch then
    _day_status := 'absent';
  elsif _effective_minutes >= _half_day_minutes then
    _day_status := 'present';
  else
    -- Any real punch activity that isn't (yet) a complete, full-day pair --
    -- including an unmatched open 'in' with zero effective minutes -- stays
    -- visible to get_missing_attendance() (which only reports
    -- present/half_day rows), rather than disappearing into 'absent'.
    _day_status := 'half_day';
  end if;

  insert into public.attendance (
    organization_id, employee_id, attendance_date, shift_id, check_in, check_out,
    gross_minutes, break_minutes, effective_minutes, payable_minutes, has_excess_break,
    late_minutes, early_going_minutes, excess_stay_minutes, shortfall_minutes,
    missing_in, missing_out, day_status, validation_status
  ) values (
    _org_id, _employee_id, _attendance_date, _shift_id, _first_in, _last_out,
    _gross_minutes, _break_minutes, _effective_minutes, _payable_minutes, _has_excess_break,
    _late_minutes, _early_going_minutes, _excess_stay_minutes, _shortfall_minutes,
    _missing_in, _missing_out, _day_status, 'completed'
  )
  on conflict (employee_id, attendance_date) do update set
    shift_id = excluded.shift_id,
    check_in = excluded.check_in,
    check_out = excluded.check_out,
    gross_minutes = excluded.gross_minutes,
    break_minutes = excluded.break_minutes,
    effective_minutes = excluded.effective_minutes,
    payable_minutes = excluded.payable_minutes,
    has_excess_break = excluded.has_excess_break,
    late_minutes = excluded.late_minutes,
    early_going_minutes = excluded.early_going_minutes,
    excess_stay_minutes = excluded.excess_stay_minutes,
    shortfall_minutes = excluded.shortfall_minutes,
    missing_in = excluded.missing_in,
    missing_out = excluded.missing_out,
    day_status = excluded.day_status,
    validation_status = 'completed';
end;
$$;

grant execute on function public.recompute_attendance_day(uuid, date) to authenticated;

-- Defensive backfill: every existing attendance row was computed before
-- payable_minutes existed -- for an unpaid break (the default), payable
-- equals effective, so this is safe and correct for the overwhelming
-- majority of rows without needing a full recompute pass.
update public.attendance set payable_minutes = effective_minutes where payable_minutes = 0 and effective_minutes > 0;

-- ============================================================
-- 0046_fix_gross_duration_duplicate_out.sql
-- ============================================================
-- Real bug found while building comprehensive tests for the TS mirror
-- (src/lib/attendanceCalc.ts's computeSessionsFromPunches): gross_minutes
-- was computed as `_last_out - _first_in`, where `_last_out` is updated on
-- *every* OUT punch seen -- including a spurious duplicate/orphan OUT that
-- doesn't close any session (e.g. a card reader double-scanning on exit:
-- IN 09:30, OUT 18:30, OUT 18:35). That extra 5 minutes was silently
-- inflating gross_minutes (and, since effective_minutes = gross - break,
-- effective_minutes too) even though no work happened in that window and no
-- break was measured for it either -- the gross/effective/break identity
-- quietly broke for exactly this duplicate-punch case.
--
-- Fix: gross_minutes now spans to the last punch that actually *closed* a
-- session (_prev_session_close's final value), not the raw last OUT seen.
-- check_in/check_out (used for "First IN"/"Last OUT" display) are
-- unchanged -- they still show the raw last punch, since that's real
-- evidence worth surfacing even when it's anomalous; only the gross/
-- effective/break arithmetic is corrected.

create or replace function public.recompute_attendance_day(_employee_id uuid, _attendance_date date)
returns void
language plpgsql security definer set search_path = public as $$
declare
  _org_id uuid;
  _shift_id uuid;
  _shift_start time;
  _shift_end time;
  _grace int;
  _half_day_hours numeric;
  _full_day_hours numeric;
  _shift_start_minutes int;
  _shift_end_minutes int;
  _min_break_minutes int := 10;
  _max_break_minutes int := 120;
  _break_paid boolean := false;
  _break_deduction_mode text := 'actual';
  _standard_break_minutes int := 60;
  _existing_status text;
  _existing_remarks text;
  _existing_check_in timestamptz;
  _existing_check_out timestamptz;
  _rec record;
  _open_in timestamptz;
  _first_in timestamptz;
  _last_out timestamptz;
  _prev_session_close timestamptz;
  _gap_minutes int;
  _measured_break_minutes int := 0;
  _has_excess_break boolean := false;
  _gross_minutes int := 0;
  _break_minutes int := 0;
  _effective_minutes int := 0;
  _payable_minutes int := 0;
  _missing_in boolean := false;
  _missing_out boolean := false;
  _has_any_punch boolean := false;
  _check_in_minutes int;
  _check_out_minutes int;
  _late_minutes int := 0;
  _early_going_minutes int := 0;
  _excess_stay_minutes int := 0;
  _shortfall_minutes int := 0;
  _half_day_minutes int;
  _full_day_minutes int;
  _day_status text;
begin
  select organization_id into _org_id from public.employees where id = _employee_id;
  if _org_id is null then
    return;
  end if;

  -- Never overwrite a day already claimed by an override status -- holiday/
  -- weekoff/leave/on_duty/permission always win over punches, and an
  -- approved WFH/On-Duty day (stored as day_status='present' with
  -- check_in/check_out both null, per 0037) must stay that way too, not be
  -- flipped to 'absent' just because there are no punches to aggregate.
  select day_status, remarks, check_in, check_out
    into _existing_status, _existing_remarks, _existing_check_in, _existing_check_out
    from public.attendance where employee_id = _employee_id and attendance_date = _attendance_date;

  if _existing_status in ('leave', 'holiday', 'weekoff', 'on_duty', 'permission') then
    return;
  end if;
  if _existing_status = 'present' and _existing_remarks in ('Work From Home', 'On Duty')
     and _existing_check_in is null and _existing_check_out is null then
    return;
  end if;

  -- Resolve the employee's shift as of this date (same lookup as the old
  -- regularization branch / seed.sql). Falling back to the declared
  -- defaults above when no shift is resolvable.
  select shift_id into _shift_id from public.shift_assignments
    where employee_id = _employee_id and effective_from <= _attendance_date
    order by effective_from desc limit 1;

  if _shift_id is not null then
    select start_time, end_time, grace_minutes, half_day_hours, full_day_hours,
           min_break_minutes, max_break_minutes, break_paid, break_deduction_mode, standard_break_minutes
      into _shift_start, _shift_end, _grace, _half_day_hours, _full_day_hours,
           _min_break_minutes, _max_break_minutes, _break_paid, _break_deduction_mode, _standard_break_minutes
      from public.shifts where id = _shift_id;
    _shift_start_minutes := extract(hour from _shift_start)::int * 60 + extract(minute from _shift_start)::int;
    _shift_end_minutes := extract(hour from _shift_end)::int * 60 + extract(minute from _shift_end)::int;
    if _shift_end_minutes <= _shift_start_minutes then
      _shift_end_minutes := _shift_end_minutes + 1440; -- overnight shift
    end if;
  end if;

  -- Walk punches for this day in time order, pairing sequential in->out.
  -- `attendance_punches.punch_date` is always the shift's logical start day
  -- (the seed/regularization convention -- an overnight punch_time still
  -- rolls into the real next calendar day, but punch_date stays put), so no
  -- day+1 lookahead is needed; ordering by the real punch_time timestamptz
  -- keeps chronological order regardless.
  --
  -- A second consecutive 'in' before a matching 'out' is a duplicate --
  -- ignored, the earlier 'in' stays open. An 'out' with no open 'in' is an
  -- orphan/invalid-sequence punch -- ignored. The gap between two
  -- consecutive *closed* sessions is classified against the break policy
  -- (not blindly deducted): too short -> bridged (not deducted at all);
  -- otherwise -> a qualifying break, and flagged if it exceeds the maximum.
  for _rec in
    select punch_time, punch_type from public.attendance_punches
    where employee_id = _employee_id and punch_date = _attendance_date
    order by punch_time
  loop
    _has_any_punch := true;
    if _rec.punch_type = 'in' then
      if _first_in is null then
        _first_in := _rec.punch_time;
      end if;
      if _open_in is null then
        _open_in := _rec.punch_time;
      end if;
    else -- 'out'
      -- Track the latest 'out' seen regardless of whether it closes a valid
      -- pair, so an orphan out (no open 'in') still counts for missing_in
      -- detection and the "Last OUT" display.
      _last_out := _rec.punch_time;
      if _open_in is not null then
        if _prev_session_close is not null then
          _gap_minutes := round(extract(epoch from (_open_in - _prev_session_close)) / 60)::int;
          if _gap_minutes < _min_break_minutes then
            null; -- too short to be a formal break -- bridged, not deducted
          else
            _measured_break_minutes := _measured_break_minutes + _gap_minutes;
            if _gap_minutes > _max_break_minutes then
              _has_excess_break := true;
            end if;
          end if;
        end if;
        _prev_session_close := _rec.punch_time;
        _open_in := null;
      end if;
    end if;
  end loop;

  _missing_out := _open_in is not null;
  _missing_in := _first_in is null and _last_out is not null;

  -- Gross duration spans to the last punch that actually closed a session
  -- (_prev_session_close), not the raw last OUT seen -- see this
  -- migration's header comment for why.
  if _first_in is not null and _prev_session_close is not null then
    _gross_minutes := greatest(0, round(extract(epoch from (_prev_session_close - _first_in)) / 60)::int);
  end if;

  if _break_deduction_mode = 'standard' then
    _break_minutes := case when _measured_break_minutes > 0 then _standard_break_minutes else 0 end;
  else
    _break_minutes := _measured_break_minutes;
  end if;
  _effective_minutes := greatest(0, _gross_minutes - _break_minutes);
  _payable_minutes := case when _break_paid then _effective_minutes + _break_minutes else _effective_minutes end;

  _half_day_minutes := (coalesce(_half_day_hours, 4.5) * 60)::int;
  _full_day_minutes := (coalesce(_full_day_hours, 8) * 60)::int;

  if _first_in is not null and _shift_id is not null then
    _check_in_minutes := extract(hour from _first_in)::int * 60 + extract(minute from _first_in)::int;
    _late_minutes := greatest(0, _check_in_minutes - (_shift_start_minutes + coalesce(_grace, 0)));
  end if;
  if _last_out is not null and _shift_id is not null then
    _check_out_minutes := extract(hour from _last_out)::int * 60 + extract(minute from _last_out)::int;
    if _check_in_minutes is not null and _check_out_minutes < _check_in_minutes then
      _check_out_minutes := _check_out_minutes + 1440; -- rolled past midnight
    end if;
    _early_going_minutes := greatest(0, _shift_end_minutes - _check_out_minutes);
  end if;

  -- Shortfall/Excess Stay compare against payable minutes, not raw worked
  -- minutes -- a paid break still counts toward satisfying required hours.
  _shortfall_minutes := greatest(0, _full_day_minutes - _payable_minutes);
  _excess_stay_minutes := greatest(0, _payable_minutes - _full_day_minutes);

  if not _has_any_punch then
    _day_status := 'absent';
  elsif _effective_minutes >= _half_day_minutes then
    _day_status := 'present';
  else
    -- Any real punch activity that isn't (yet) a complete, full-day pair --
    -- including an unmatched open 'in' with zero effective minutes -- stays
    -- visible to get_missing_attendance() (which only reports
    -- present/half_day rows), rather than disappearing into 'absent'.
    _day_status := 'half_day';
  end if;

  insert into public.attendance (
    organization_id, employee_id, attendance_date, shift_id, check_in, check_out,
    gross_minutes, break_minutes, effective_minutes, payable_minutes, has_excess_break,
    late_minutes, early_going_minutes, excess_stay_minutes, shortfall_minutes,
    missing_in, missing_out, day_status, validation_status
  ) values (
    _org_id, _employee_id, _attendance_date, _shift_id, _first_in, _last_out,
    _gross_minutes, _break_minutes, _effective_minutes, _payable_minutes, _has_excess_break,
    _late_minutes, _early_going_minutes, _excess_stay_minutes, _shortfall_minutes,
    _missing_in, _missing_out, _day_status, 'completed'
  )
  on conflict (employee_id, attendance_date) do update set
    shift_id = excluded.shift_id,
    check_in = excluded.check_in,
    check_out = excluded.check_out,
    gross_minutes = excluded.gross_minutes,
    break_minutes = excluded.break_minutes,
    effective_minutes = excluded.effective_minutes,
    payable_minutes = excluded.payable_minutes,
    has_excess_break = excluded.has_excess_break,
    late_minutes = excluded.late_minutes,
    early_going_minutes = excluded.early_going_minutes,
    excess_stay_minutes = excluded.excess_stay_minutes,
    shortfall_minutes = excluded.shortfall_minutes,
    missing_in = excluded.missing_in,
    missing_out = excluded.missing_out,
    day_status = excluded.day_status,
    validation_status = 'completed';
end;
$$;

grant execute on function public.recompute_attendance_day(uuid, date) to authenticated;

-- ============================================================
-- 0047_email_notification_engine.sql
-- ============================================================
-- Centralized HR Email Notification Engine. Every module (Leave, WFH,
-- Permission, Comp-Off, On-Duty, Flexi Holiday, Attendance) queues an email
-- through the *same* function, queue_templated_email() -- no module renders
-- its own subject/body or resolves its own recipients. Two things feed it
-- today, both centralized rather than per-module:
--
--   1. trg_queue_approval_request_email() -- one generic trigger function
--      (same to_jsonb(NEW)/TG_TABLE_NAME pattern as the existing generic
--      audit_row_change() trigger from 0030) attached to all five request
--      tables' `after insert`. Fires the 'approval_request' template to the
--      reporting manager the moment any request is submitted, regardless of
--      which module submitted it.
--   2. act_on_approval() (already the single shared approval-decision
--      function) now also queues 'approval_approved'/'approval_rejected' to
--      the requesting employee, right alongside the existing in-app
--      notification insert.
--
-- The remaining 7 template types (Missing Punch, Early Going, WFH Weekly
-- Alert, Comp-Off Expiry, Attendance Closure Reminder, Reconciliation Alert,
-- System Notification) are fully supported by the engine -- templates,
-- rendering, queueing, retry, delivery logs -- and callable via
-- queue_templated_email() from anywhere, but nothing in this codebase
-- generates those *source events* on a schedule yet (several depend on
-- features -- Comp-Off, Attendance Closure, Reconciliation -- that don't
-- exist yet; Missing Punch/Early Going/WFH Weekly Alert would naturally be
-- triggered by a scheduled job, which needs pg_cron or an external
-- scheduler wired to the edge function below, not built in this migration).
-- Not claiming those are live today -- only that the shared engine they'll
-- plug into already is.
--
-- Actual SMTP delivery cannot happen in Postgres itself -- see
-- supabase/functions/process-email-queue/ (a Deno edge function, reading
-- SMTP credentials only from its own environment via `supabase secrets
-- set`, never from this database or any UI). This migration's job is the
-- queue + templates + delivery log + retry bookkeeping; the edge function
-- drains the queue. src/lib/emailEngine.ts is the tested TS mirror of the
-- rendering/recipient-resolution/retry-decision logic here, the same
-- TS-mirrors-SQL convention as src/lib/attendanceCalc.ts.

create table public.email_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  template_key text not null check (template_key in (
    'approval_request', 'approval_approved', 'approval_rejected', 'missing_punch', 'early_going',
    'wfh_weekly_alert', 'comp_off_expiry', 'attendance_closure_reminder', 'reconciliation_alert', 'system_notification'
  )),
  name text not null,
  subject text not null,
  body text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.employees(id),
  updated_by uuid references public.employees(id)
);
create trigger trg_email_templates_updated_at before update on public.email_templates
  for each row execute function public.set_updated_at();
create index idx_email_templates_org_key on public.email_templates(organization_id, template_key);
-- At most one ACTIVE template per (org, key) -- queue_templated_email()
-- always has an unambiguous template to pick, and enabling a second one
-- for the same key must first disable the one currently active.
create unique index uq_email_templates_active_key on public.email_templates(organization_id, template_key) where is_active;

alter table public.email_templates enable row level security;
create policy email_templates_select on public.email_templates for select
  using (organization_id = public.current_organization_id() and public.is_hr_or_admin());
create policy email_templates_write on public.email_templates for all
  using (organization_id = public.current_organization_id() and public.is_hr_or_admin())
  with check (organization_id = public.current_organization_id() and public.is_hr_or_admin());

create table public.email_delivery_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  -- Kept even if the template row is later deleted (on delete set null) --
  -- template_key alone still makes the log entry meaningful.
  template_id uuid references public.email_templates(id) on delete set null,
  template_key text not null,
  recipient_email text not null,
  cc text[] not null default '{}',
  bcc text[] not null default '{}',
  subject text,
  body text,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'retrying')),
  error_message text,
  -- Free-form business reference (e.g. 'leave_requests:<uuid>') so a log
  -- entry can be traced back to the request/event that caused it.
  reference_id text,
  attempt_count int not null default 0,
  max_attempts int not null default 3,
  next_retry_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index idx_email_delivery_logs_org_created on public.email_delivery_logs(organization_id, created_at desc);
create index idx_email_delivery_logs_pending on public.email_delivery_logs(status, next_retry_at) where status in ('pending', 'retrying');
create index idx_email_delivery_logs_reference on public.email_delivery_logs(reference_id);

alter table public.email_delivery_logs enable row level security;
create policy email_delivery_logs_select on public.email_delivery_logs for select
  using (organization_id = public.current_organization_id() and public.is_hr_or_admin());
-- No insert/update policy for regular clients -- every row is written by
-- queue_templated_email() (security definer) or the edge function (service
-- role), matching audit_logs' append-only-via-privileged-path convention.

-- SQL-side mirror of src/lib/emailEngine.ts's renderTemplate(): replaces
-- every {{key}} present in `_variables` and blanks out any placeholder left
-- over (an unsupplied or genuinely unknown variable), rather than leaking
-- the raw `{{...}}` into a sent email.
create or replace function public.render_email_template(_subject text, _body text, _variables jsonb)
returns table (subject text, body text)
language plpgsql immutable as $$
declare
  _key text;
  _value text;
  _rendered_subject text := _subject;
  _rendered_body text := _body;
begin
  for _key, _value in select * from jsonb_each_text(coalesce(_variables, '{}'::jsonb)) loop
    _rendered_subject := replace(_rendered_subject, '{{' || _key || '}}', coalesce(_value, ''));
    _rendered_body := replace(_rendered_body, '{{' || _key || '}}', coalesce(_value, ''));
  end loop;
  _rendered_subject := regexp_replace(_rendered_subject, '\{\{\s*[a-zA-Z0-9_]+\s*\}\}', '', 'g');
  _rendered_body := regexp_replace(_rendered_body, '\{\{\s*[a-zA-Z0-9_]+\s*\}\}', '', 'g');
  return query select _rendered_subject, _rendered_body;
end;
$$;

-- The one reusable notification service every module calls. Looks up the
-- active template for _template_key, renders it, and writes a delivery-log
-- row (status='pending') for the edge function to actually send. A missing
-- or disabled template is logged as a failed delivery with a clear error
-- instead of being silently dropped -- mirrors
-- src/lib/emailEngine.ts's decideQueueOutcome() exactly.
create or replace function public.queue_templated_email(
  _template_key text,
  _recipient_email text,
  _variables jsonb default '{}'::jsonb,
  _reference_id text default null,
  _cc text[] default '{}',
  _bcc text[] default '{}'
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  _org_id uuid := public.current_organization_id();
  _template record;
  _rendered record;
  _log_id uuid;
begin
  select id, subject, body into _template
    from public.email_templates
    where organization_id = _org_id and template_key = _template_key and is_active
    order by updated_at desc limit 1;

  if _template.id is null then
    insert into public.email_delivery_logs (
      organization_id, template_id, template_key, recipient_email, cc, bcc, status, error_message, reference_id
    ) values (
      _org_id, null, _template_key, _recipient_email, coalesce(_cc, '{}'), coalesce(_bcc, '{}'),
      'failed', 'No active template configured for this template_key', _reference_id
    )
    returning id into _log_id;
    return _log_id;
  end if;

  select * into _rendered from public.render_email_template(_template.subject, _template.body, _variables);

  insert into public.email_delivery_logs (
    organization_id, template_id, template_key, recipient_email, cc, bcc, subject, body, status, reference_id
  ) values (
    _org_id, _template.id, _template_key, _recipient_email, coalesce(_cc, '{}'), coalesce(_bcc, '{}'),
    _rendered.subject, _rendered.body, 'pending', _reference_id
  )
  returning id into _log_id;

  return _log_id;
end;
$$;

grant execute on function public.queue_templated_email(text, text, jsonb, text, text[], text[]) to authenticated;

-- Generic "approval request submitted" trigger -- one function, attached to
-- all five request tables, instead of each module queueing its own email.
-- to_jsonb(NEW)/TG_TABLE_NAME is the same pattern the existing generic
-- audit_row_change() trigger (0030) already uses for the same reason.
create or replace function public.trg_queue_approval_request_email()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  _row jsonb := to_jsonb(new);
  _manager_id uuid := nullif(_row->>'reporting_manager_id', '')::uuid;
  _org_id uuid;
  _employee_name text;
  _employee_code text;
  _manager_name text;
  _manager_email text;
  _request_type text;
  _from_date text;
  _to_date text;
  _duration text;
begin
  if new.status <> 'pending' then
    return new;
  end if;

  select organization_id, (first_name || coalesce(' ' || last_name, '')), employee_code
    into _org_id, _employee_name, _employee_code
    from public.employees where id = new.employee_id;

  if _manager_id is not null then
    select (first_name || coalesce(' ' || last_name, '')), official_email
      into _manager_name, _manager_email
      from public.employees where id = _manager_id;
  end if;

  if _manager_email is null then
    return new; -- no manager on record to notify
  end if;

  _request_type := case TG_TABLE_NAME
    when 'leave_requests' then 'Leave'
    when 'permission_requests' then 'Permission'
    when 'attendance_regularizations' then 'Attendance Regularization'
    when 'onduty_requests' then (case when _row->>'onduty_type' = 'work_from_home' then 'Work From Home' else 'On Duty' end)
    when 'other_requests' then coalesce(_row->>'request_title', 'Other Request')
    else TG_TABLE_NAME
  end;

  _from_date := coalesce(_row->>'from_date', _row->>'attendance_date', _row->>'permission_date', _row->>'request_date');
  _to_date := coalesce(_row->>'to_date', _from_date);
  _duration := case
    when _row ? 'duration_days' then (_row->>'duration_days') || ' day(s)'
    when _row ? 'duration_minutes' then (_row->>'duration_minutes') || ' min'
    else '-'
  end;

  perform public.queue_templated_email(
    'approval_request',
    _manager_email,
    jsonb_build_object(
      'employee_name', _employee_name,
      'employee_id', _employee_code,
      'manager_name', _manager_name,
      'request_type', _request_type,
      'from_date', _from_date,
      'to_date', _to_date,
      'duration', _duration,
      'reason', coalesce(_row->>'reason', ''),
      'application_id', new.id::text
    ),
    TG_TABLE_NAME || ':' || new.id::text
  );

  return new;
end;
$$;

create trigger trg_leave_requests_queue_approval_email after insert on public.leave_requests
  for each row execute function public.trg_queue_approval_request_email();
create trigger trg_permission_requests_queue_approval_email after insert on public.permission_requests
  for each row execute function public.trg_queue_approval_request_email();
create trigger trg_attendance_regularizations_queue_approval_email after insert on public.attendance_regularizations
  for each row execute function public.trg_queue_approval_request_email();
create trigger trg_onduty_requests_queue_approval_email after insert on public.onduty_requests
  for each row execute function public.trg_queue_approval_request_email();
create trigger trg_other_requests_queue_approval_email after insert on public.other_requests
  for each row execute function public.trg_queue_approval_request_email();

-- Full redeclare (see every prior act_on_approval migration's note on why).
-- Every branch is unchanged from 0046 except a new block right after the
-- existing in-app notification insert, which now also queues
-- 'approval_approved'/'approval_rejected' to the requesting employee via
-- the same central engine -- not a second, module-specific email path.
create or replace function public.act_on_approval(
  _request_type text,
  _request_id uuid,
  _action text,
  _remarks text default null
)
returns void
language plpgsql security definer set search_path = public as $$
declare
  _owner_id uuid;
  _actor_id uuid := public.current_employee_id();
  _org_id uuid;
  _old_status text;
  _workflow_id uuid;
  _instance_id uuid;
  _recipient_user uuid;
  _notification_type text;
  _title text;
  _leave_type_id uuid;
  _leave_type_name text;
  _duration numeric(5,2);
  _from_date date;
  _to_date date;
  _remaining numeric(6,2);
  _remaining_to_deduct numeric(5,2);
  _deduct_amount numeric(5,2);
  _period_row record;
  -- Regularization -> attendance sync
  _reg_date date;
  _reg_check_in timestamptz;
  _reg_check_out timestamptz;
  -- Leave / onduty -> attendance sync
  _onduty_type text;
  _loop_date date;
  _onduty_remark text;
  -- Permission balance
  _permission_date date;
  _permission_minutes int;
  _perm_balance_id uuid;
  _perm_remaining int;
  -- Approval-decision email
  _owner_email text;
  _owner_name text;
  _owner_code text;
  _actor_name text;
  _email_request_type text;
  _email_from_date text;
  _email_to_date text;
  _email_duration text;
begin
  if _action not in ('approved', 'rejected') then
    raise exception 'act_on_approval: action must be ''approved'' or ''rejected'', got %', _action;
  end if;

  _owner_id := public.request_owner_employee_id(_request_type, _request_id);
  if _owner_id is null then
    raise exception 'act_on_approval: request % / % not found', _request_type, _request_id;
  end if;

  if _actor_id is null or not (public.is_hr_or_admin() or public.is_manager_of(_owner_id)) then
    raise exception 'act_on_approval: not authorized to act on this request';
  end if;

  select organization_id into _org_id from public.employees where id = _owner_id;

  if _request_type = 'leave_request' then
    select status into _old_status from public.leave_requests where id = _request_id;
    update public.leave_requests
      set status = _action, approval_remarks = _remarks
      where id = _request_id and status = 'pending'
      returning leave_type_id, duration_days, from_date, to_date into _leave_type_id, _duration, _from_date, _to_date;
  elsif _request_type = 'permission_request' then
    select status into _old_status from public.permission_requests where id = _request_id;
    update public.permission_requests
      set status = _action, approval_remarks = _remarks
      where id = _request_id and status = 'pending'
      returning permission_date, duration_minutes into _permission_date, _permission_minutes;
  elsif _request_type = 'attendance_regularization' then
    select status into _old_status from public.attendance_regularizations where id = _request_id;
    update public.attendance_regularizations
      set status = _action, approval_remarks = _remarks, approver_id = _actor_id
      where id = _request_id and status = 'pending'
      returning attendance_date, requested_check_in, requested_check_out
        into _reg_date, _reg_check_in, _reg_check_out;
  elsif _request_type = 'onduty_request' then
    select status into _old_status from public.onduty_requests where id = _request_id;
    update public.onduty_requests
      set status = _action, approval_remarks = _remarks
      where id = _request_id and status = 'pending'
      returning from_date, to_date, onduty_type into _from_date, _to_date, _onduty_type;
  elsif _request_type = 'other_request' then
    select status into _old_status from public.other_requests where id = _request_id;
    update public.other_requests
      set status = _action, approval_remarks = _remarks
      where id = _request_id and status = 'pending';
  else
    raise exception 'act_on_approval: unsupported request type %', _request_type;
  end if;

  if not found then
    raise exception 'act_on_approval: request is not pending (already actioned?)';
  end if;

  -- Deduct across every leave_balances period for this employee/leave-type
  -- (cumulative model): check the sum first, then spend from the earliest
  -- period with remaining balance forward, so a request isn't blocked just
  -- because the specific month it falls in has too small a slice.
  if _request_type = 'leave_request' and _action = 'approved' then
    select coalesce(sum(balance), 0) into _remaining
      from public.leave_balances
      where employee_id = _owner_id and leave_type_id = _leave_type_id;

    if _remaining - _duration < 0 then
      raise exception 'act_on_approval: approving this request would drive leave type % balance negative (% available, % requested)',
        _leave_type_id, _remaining, _duration;
    end if;

    _remaining_to_deduct := _duration;
    for _period_row in
      select id, balance from public.leave_balances
      where employee_id = _owner_id and leave_type_id = _leave_type_id and balance > 0
      order by period_start
      for update
    loop
      exit when _remaining_to_deduct <= 0;
      _deduct_amount := least(_period_row.balance, _remaining_to_deduct);
      update public.leave_balances
        set used = used + _deduct_amount, balance = balance - _deduct_amount
        where id = _period_row.id;
      _remaining_to_deduct := _remaining_to_deduct - _deduct_amount;
    end loop;
    -- No balance rows at all is left un-deducted rather than blocking the
    -- approval outright -- leave types with accrual_frequency = 'none'
    -- (e.g. unpaid/compensatory) may legitimately have no leave_balances row.
  end if;

  -- Deduct the matching permission-balance period on approval only.
  if _request_type = 'permission_request' and _action = 'approved' then
    select id, balance_minutes into _perm_balance_id, _perm_remaining
      from public.permission_balances
      where employee_id = _owner_id
        and period_start <= _permission_date and period_end >= _permission_date
      for update;

    if _perm_balance_id is not null then
      if _perm_remaining - _permission_minutes < 0 then
        raise exception 'act_on_approval: approving this request would drive permission balance negative (% minutes available, % requested)',
          _perm_remaining, _permission_minutes;
      end if;
      update public.permission_balances
        set used_minutes = used_minutes + _permission_minutes, balance_minutes = balance_minutes - _permission_minutes
        where id = _perm_balance_id;
    end if;
    -- No matching period is left un-deducted rather than blocking the
    -- approval outright, same reasoning as the leave-balance block above.
  end if;

  -- (a) Apply an approved leave to the attendance table: every day in range
  -- becomes day_status = 'leave'. Overwrites whatever was there before
  -- (e.g. a stale seeded 'absent' guess) -- the approved leave is now the
  -- authoritative status for that day.
  if _request_type = 'leave_request' and _action = 'approved' then
    select name into _leave_type_name from public.leave_types where id = _leave_type_id;
    _loop_date := _from_date;
    while _loop_date <= _to_date loop
      insert into public.attendance (organization_id, employee_id, attendance_date, day_status, validation_status, remarks)
      values (_org_id, _owner_id, _loop_date, 'leave', 'completed', coalesce(_leave_type_name, 'Leave'))
      on conflict (employee_id, attendance_date) do update set
        day_status = 'leave',
        validation_status = 'completed',
        remarks = coalesce(excluded.remarks, public.attendance.remarks);
      _loop_date := _loop_date + 1;
    end loop;
  end if;

  -- (b) Apply an approved on-duty/WFH request the same way: every day in
  -- range becomes day_status = 'present' (the employee worked, just not
  -- from a punch-tracked location), with a remark noting which type.
  -- recompute_attendance_day() recognizes this remark and refuses to
  -- overwrite it if punches are ever recomputed for the same date.
  if _request_type = 'onduty_request' and _action = 'approved' then
    _onduty_remark := case when _onduty_type = 'work_from_home' then 'Work From Home' else 'On Duty' end;
    _loop_date := _from_date;
    while _loop_date <= _to_date loop
      insert into public.attendance (organization_id, employee_id, attendance_date, day_status, validation_status, remarks)
      values (_org_id, _owner_id, _loop_date, 'present', 'completed', _onduty_remark)
      on conflict (employee_id, attendance_date) do update set
        day_status = 'present',
        validation_status = 'completed',
        remarks = coalesce(excluded.remarks, public.attendance.remarks);
      _loop_date := _loop_date + 1;
    end loop;
  end if;

  -- Apply an approved regularization by writing the correction as
  -- synthetic 'manual' punches and letting recompute_attendance_day() do
  -- the actual shift-relative math -- the same engine every other punch
  -- (biometric, mobile, web) goes through. A prior 'manual' punch of the
  -- same type for this date is replaced, not stacked, so re-approving a
  -- corrected regularization doesn't accumulate duplicate synthetic punches.
  if _request_type = 'attendance_regularization' and _action = 'approved' then
    if _reg_check_in is not null or _reg_check_out is not null then
      if _reg_check_in is not null then
        delete from public.attendance_punches
          where employee_id = _owner_id and punch_date = _reg_date and source = 'manual' and punch_type = 'in';
        insert into public.attendance_punches (organization_id, employee_id, punch_date, punch_time, punch_type, source)
          values (_org_id, _owner_id, _reg_date, _reg_check_in, 'in', 'manual');
      end if;
      if _reg_check_out is not null then
        delete from public.attendance_punches
          where employee_id = _owner_id and punch_date = _reg_date and source = 'manual' and punch_type = 'out';
        insert into public.attendance_punches (organization_id, employee_id, punch_date, punch_time, punch_type, source)
          values (_org_id, _owner_id, _reg_date, _reg_check_out, 'out', 'manual');
      end if;

      perform public.recompute_attendance_day(_owner_id, _reg_date);

      update public.attendance
        set is_regularized = true, remarks = coalesce(_remarks, remarks)
        where employee_id = _owner_id and attendance_date = _reg_date;
    else
      -- No punch times at all (e.g. a plain present_correction with nothing
      -- but "I was present" and a reason) -- still record the correction
      -- rather than silently dropping it, same fallback as before.
      insert into public.attendance (organization_id, employee_id, attendance_date, day_status, validation_status, is_regularized, remarks)
      values (_org_id, _owner_id, _reg_date, 'present', 'completed', true, _remarks)
      on conflict (employee_id, attendance_date) do update set
        day_status = 'present',
        validation_status = 'completed',
        is_regularized = true,
        remarks = coalesce(excluded.remarks, public.attendance.remarks);
    end if;
  end if;

  insert into public.audit_logs (organization_id, actor_user_id, action, module, record_id, old_value, new_value)
    values (
      _org_id, auth.uid(), (case when _action = 'approved' then 'approval' else 'rejection' end),
      'manager_self_service', _request_id,
      jsonb_build_object('request_type', _request_type, 'status', _old_status),
      jsonb_build_object('request_type', _request_type, 'status', _action, 'remarks', _remarks)
    );

  select id into _workflow_id from public.approval_workflows
    where organization_id = _org_id and request_type = _request_type and is_active
    order by created_at limit 1;

  if _workflow_id is not null then
    insert into public.approval_instances (workflow_id, request_type, request_id, status, current_step_order)
      values (_workflow_id, _request_type, _request_id, _action, 1)
      on conflict (request_type, request_id) do update set status = excluded.status
      returning id into _instance_id;

    insert into public.approval_actions (approval_instance_id, step_order, actor_employee_id, action, remarks)
      values (_instance_id, 1, _actor_id, _action, _remarks);
  end if;

  _notification_type := case _request_type
    when 'leave_request' then (case when _action = 'approved' then 'leave_approved' else 'leave_rejected' end)
    when 'permission_request' then (case when _action = 'approved' then 'permission_approved' else 'permission_rejected' end)
    when 'attendance_regularization' then (case when _action = 'approved' then 'regularization_approved' else 'regularization_rejected' end)
    when 'onduty_request' then (case when _action = 'approved' then 'onduty_approved' else 'onduty_rejected' end)
    when 'other_request' then (case when _action = 'approved' then 'other_request_approved' else 'other_request_rejected' end)
  end;
  _title := case when _action = 'approved' then 'Your request has been approved' else 'Your request has been rejected' end;

  select user_id into _recipient_user from public.employees where id = _owner_id;
  if _recipient_user is not null then
    insert into public.notifications (organization_id, recipient_user_id, notification_type, title, body, link_path)
      values (_org_id, _recipient_user, _notification_type, _title, _remarks, '/attendance/event-request');
  end if;

  -- Queue the decision email to the requesting employee via the same
  -- central engine every other module uses -- not a bespoke send here.
  select official_email, (first_name || coalesce(' ' || last_name, '')), employee_code
    into _owner_email, _owner_name, _owner_code
    from public.employees where id = _owner_id;

  if _owner_email is not null then
    select (first_name || coalesce(' ' || last_name, '')) into _actor_name from public.employees where id = _actor_id;

    _email_request_type := case _request_type
      when 'leave_request' then 'Leave'
      when 'permission_request' then 'Permission'
      when 'attendance_regularization' then 'Attendance Regularization'
      when 'onduty_request' then (case when _onduty_type = 'work_from_home' then 'Work From Home' else 'On Duty' end)
      when 'other_request' then 'Other Request'
    end;
    _email_from_date := coalesce(_from_date::text, _reg_date::text, _permission_date::text);
    _email_to_date := coalesce(_to_date::text, _email_from_date);
    _email_duration := case
      when _duration is not null then _duration::text || ' day(s)'
      when _permission_minutes is not null then _permission_minutes::text || ' min'
      else '-'
    end;

    perform public.queue_templated_email(
      case when _action = 'approved' then 'approval_approved' else 'approval_rejected' end,
      _owner_email,
      jsonb_build_object(
        'employee_name', _owner_name,
        'employee_id', _owner_code,
        'manager_name', _actor_name,
        'request_type', _email_request_type,
        'from_date', _email_from_date,
        'to_date', _email_to_date,
        'duration', _email_duration,
        'remarks', coalesce(_remarks, ''),
        'status', _action,
        'application_id', _request_id::text
      ),
      _request_type || ':' || _request_id::text
    );
  end if;
end;
$$;

grant execute on function public.act_on_approval(text, uuid, text, text) to authenticated;

-- ============================================================
-- 0048_hr_admin_compliance_modules.sql
-- ============================================================
-- HR Administration and Compliance: Biometric Reader Configuration, Email
-- Configuration, Audit Log extensions, and Attendance Reconciliation. All
-- four are HR/Admin-only (is_hr_or_admin()), matching every other
-- HR-configuration surface in this schema.

-- ============================================================
-- a) Audit Log extensions -- Role, Employee, Result
-- ============================================================
-- audit_logs already existed (0016) and is already append-only (no
-- update/delete policy exists at all, per supabase/DATABASE.md). It was
-- missing three of the requested fields: the actor's role at the time of
-- the action, which employee record the action concerns (distinct from
-- record_id, which is the affected row's own id -- e.g. a leave_requests
-- row's id, not the employee's id), and a Result outcome.

alter table public.audit_logs
  add column if not exists actor_role text,
  add column if not exists employee_id uuid references public.employees(id),
  add column if not exists result text not null default 'success' check (result in ('success', 'failure'));

create index if not exists idx_audit_logs_employee on public.audit_logs(employee_id);

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
  _employee_id uuid;
  _actor_role text;
begin
  _row := to_jsonb(coalesce(new, old));
  _action := case TG_OP when 'INSERT' then 'create' when 'UPDATE' then 'update' when 'DELETE' then 'delete' end;
  _record_id := case TG_OP when 'DELETE' then old.id else new.id end;
  _org_id := case
    when _row ? 'organization_id' and _row->>'organization_id' is not null then (_row->>'organization_id')::uuid
    else public.current_organization_id()
  end;
  -- The row itself is the employee for the employees table; every other
  -- tracked table that concerns a specific employee carries employee_id
  -- directly. Org-structure/config tables (shifts, system_settings, ...)
  -- have neither, so employee_id stays null there -- correctly, since the
  -- action isn't about any one employee.
  _employee_id := case
    when TG_TABLE_NAME = 'employees' then _record_id
    when _row ? 'employee_id' and _row->>'employee_id' is not null then (_row->>'employee_id')::uuid
    else null
  end;

  select r.name into _actor_role
    from public.user_roles ur join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid()
    order by case r.name when 'super_admin' then 1 when 'hr_admin' then 2 when 'manager' then 3 else 4 end
    limit 1;

  insert into public.audit_logs (organization_id, actor_user_id, actor_role, employee_id, action, module, record_id, old_value, new_value, result)
  values (
    _org_id,
    auth.uid(),
    _actor_role,
    _employee_id,
    _action,
    TG_TABLE_NAME,
    _record_id,
    case when TG_OP <> 'INSERT' then to_jsonb(old) else null end,
    case when TG_OP <> 'DELETE' then to_jsonb(new) else null end,
    'success'
  );

  return coalesce(new, old);
end;
$$;

-- Note: the audit-trigger re-attach DO block that used to run here is moved
-- to the end of this file -- it references biometric_readers,
-- email_configuration, and attendance_reconciliation_findings, none of
-- which exist yet until sections (b)/(c)/(d) below create them.

-- ============================================================
-- b) Biometric Reader Configuration
-- ============================================================

create table public.biometric_readers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  device_id text not null,
  reader_type text not null default 'biometric' check (reader_type in ('biometric', 'rfid', 'face_recognition', 'hybrid')),
  ip_address inet not null,
  port integer not null default 4370,
  location text,
  department_id uuid references public.departments(id),
  is_active boolean not null default true,
  sync_interval_minutes integer not null default 15,
  last_sync_at timestamptz,
  last_sync_status text not null default 'never' check (last_sync_status in ('success', 'failed', 'never')),
  last_error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.employees(id),
  updated_by uuid references public.employees(id),
  unique (organization_id, device_id)
);
create trigger trg_biometric_readers_updated_at before update on public.biometric_readers
  for each row execute function public.set_updated_at();
create index idx_biometric_readers_org on public.biometric_readers(organization_id);

alter table public.biometric_readers enable row level security;
create policy biometric_readers_select on public.biometric_readers for select
  using (organization_id = public.current_organization_id() and public.is_hr_or_admin());
create policy biometric_readers_write on public.biometric_readers for all
  using (organization_id = public.current_organization_id() and public.is_hr_or_admin())
  with check (organization_id = public.current_organization_id() and public.is_hr_or_admin());

create table public.biometric_sync_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  reader_id uuid not null references public.biometric_readers(id) on delete cascade,
  event_type text not null check (event_type in (
    'created', 'updated', 'enabled', 'disabled', 'test_connection', 'sync_started', 'sync_completed', 'sync_failed'
  )),
  status text not null check (status in ('success', 'failed', 'in_progress')),
  records_synced integer,
  error_message text,
  triggered_by uuid references public.employees(id),
  created_at timestamptz not null default now()
);
create index idx_biometric_sync_logs_reader on public.biometric_sync_logs(reader_id, created_at desc);

alter table public.biometric_sync_logs enable row level security;
create policy biometric_sync_logs_select on public.biometric_sync_logs for select
  using (organization_id = public.current_organization_id() and public.is_hr_or_admin());
-- No direct write policy -- every row is written by
-- record_biometric_sync_event() (security definer) so status/last-sync
-- bookkeeping on the reader stays consistent with the log, not two
-- independently-writable surfaces that can drift apart.

-- Connection tests and sync runs are recorded through this one function --
-- the admin UI's Test/Sync buttons (via the biometric-reader-action edge
-- function, since Postgres itself cannot open a TCP connection to a
-- reader) and any future real biometric integration both call it, rather
-- than each writing its own ad hoc log/status update.
create or replace function public.record_biometric_sync_event(
  _reader_id uuid,
  _event_type text,
  _status text,
  _records_synced int default null,
  _error_message text default null
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  _org_id uuid;
  _log_id uuid;
begin
  select organization_id into _org_id from public.biometric_readers where id = _reader_id;
  if _org_id is null then
    raise exception 'record_biometric_sync_event: reader % not found', _reader_id;
  end if;
  if not public.is_hr_or_admin() then
    raise exception 'record_biometric_sync_event: not authorized';
  end if;

  insert into public.biometric_sync_logs (organization_id, reader_id, event_type, status, records_synced, error_message, triggered_by)
  values (_org_id, _reader_id, _event_type, _status, _records_synced, _error_message, public.current_employee_id())
  returning id into _log_id;

  if _event_type in ('sync_completed', 'sync_failed', 'test_connection') then
    update public.biometric_readers
      set last_sync_at = case when _event_type = 'sync_completed' then now() else last_sync_at end,
          last_sync_status = case when _status = 'success' then 'success' else 'failed' end,
          last_error_message = _error_message
      where id = _reader_id;
  end if;

  return _log_id;
end;
$$;
grant execute on function public.record_biometric_sync_event(uuid, text, text, int, text) to authenticated;

-- ============================================================
-- c) Email Configuration (SMTP)
-- ============================================================
-- Non-secret fields are readable by any HR/admin. The password is never
-- stored in plaintext and never leaves this database in decrypted form
-- except to the service-role-only get_smtp_credentials() below --
-- pgp_sym_encrypt/pgp_sym_decrypt (pgcrypto, enabled since 0001) with a key
-- that lives only in a Postgres configuration parameter set once via:
--   ALTER DATABASE postgres SET app.settings.smtp_encryption_key = '<a long random value>';
-- (run once in the Supabase SQL editor by a project owner -- the same kind
-- of one-time manual step every migration in this project already needs).
-- If that key is never set, the password is simply never encrypted/stored
-- and every SMTP-dependent feature degrades to "not configured" rather
-- than silently storing an unencrypted secret.

create table public.email_configuration (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  host text,
  port integer default 587,
  encryption text default 'tls' check (encryption in ('none', 'tls', 'ssl')),
  username text,
  password_encrypted bytea,
  has_password boolean generated always as (password_encrypted is not null) stored,
  from_name text,
  from_email text,
  reply_to text,
  is_active boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.employees(id),
  unique (organization_id)
);
create trigger trg_email_configuration_updated_at before update on public.email_configuration
  for each row execute function public.set_updated_at();

alter table public.email_configuration enable row level security;
create policy email_configuration_select on public.email_configuration for select
  using (organization_id = public.current_organization_id() and public.is_hr_or_admin());
-- No direct write policy -- every write goes through set_email_configuration()
-- so the password is only ever handled server-side via pgcrypto.

create or replace function public.set_email_configuration(
  _host text,
  _port int,
  _encryption text,
  _username text,
  _from_name text,
  _from_email text,
  _reply_to text,
  _is_active boolean,
  _password text default null
)
returns void
language plpgsql security definer set search_path = public as $$
declare
  _org_id uuid := public.current_organization_id();
  _key text := current_setting('app.settings.smtp_encryption_key', true);
begin
  if not public.is_hr_or_admin() then
    raise exception 'set_email_configuration: not authorized';
  end if;

  insert into public.email_configuration (
    organization_id, host, port, encryption, username, from_name, from_email, reply_to, is_active,
    password_encrypted, updated_by
  ) values (
    _org_id, _host, _port, _encryption, _username, _from_name, _from_email, _reply_to, _is_active,
    case when _password is not null and _key is not null then pgp_sym_encrypt(_password, _key) else null end,
    public.current_employee_id()
  )
  on conflict (organization_id) do update set
    host = excluded.host,
    port = excluded.port,
    encryption = excluded.encryption,
    username = excluded.username,
    from_name = excluded.from_name,
    from_email = excluded.from_email,
    reply_to = excluded.reply_to,
    is_active = excluded.is_active,
    -- A blank password in the update means "keep the existing secret" --
    -- HR isn't forced to re-enter it on every unrelated field edit.
    password_encrypted = case
      when _password is not null and _key is not null then excluded.password_encrypted
      else public.email_configuration.password_encrypted
    end,
    updated_by = excluded.updated_by;
end;
$$;
grant execute on function public.set_email_configuration(text, int, text, text, text, text, text, boolean, text) to authenticated;

-- Decrypted credentials -- granted ONLY to service_role. Even an HR
-- admin's authenticated browser session can never retrieve the plaintext
-- password through the app; only the server-side email-sending edge
-- function can, because it alone holds the service-role key. This is the
-- actual security boundary, not the RLS policy above (which only gates the
-- ciphertext column, never selected by the UI anyway).
create or replace function public.get_smtp_credentials(_organization_id uuid)
returns table (
  host text, port int, encryption text, username text, password text,
  from_name text, from_email text, reply_to text, is_active boolean
)
language plpgsql security definer set search_path = public as $$
declare
  _key text := current_setting('app.settings.smtp_encryption_key', true);
begin
  return query
  select
    c.host, c.port, c.encryption, c.username,
    case when c.password_encrypted is not null and _key is not null then pgp_sym_decrypt(c.password_encrypted, _key) else null end,
    c.from_name, c.from_email, c.reply_to, c.is_active
  from public.email_configuration c
  where c.organization_id = _organization_id;
end;
$$;
revoke all on function public.get_smtp_credentials(uuid) from public, authenticated, anon;
grant execute on function public.get_smtp_credentials(uuid) to service_role;

-- ============================================================
-- d) Attendance Reconciliation
-- ============================================================

create table public.attendance_reconciliation_findings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  finding_date date not null,
  mismatch_type text not null check (mismatch_type in (
    'biometric_present_but_leave', 'wfh_with_biometric_present', 'unexplained_absence',
    'onduty_marked_absent', 'missing_in', 'missing_out', 'duplicate_punch', 'invalid_punch_sequence'
  )),
  biometric_status text,
  hr_status text,
  expected_status text,
  resolution_status text not null default 'open' check (resolution_status in ('open', 'resolved', 'accepted', 'overridden')),
  resolved_by uuid references public.employees(id),
  resolved_at timestamptz,
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (employee_id, finding_date, mismatch_type)
);
create trigger trg_attendance_reconciliation_findings_updated_at before update on public.attendance_reconciliation_findings
  for each row execute function public.set_updated_at();
create index idx_reconciliation_findings_org_date on public.attendance_reconciliation_findings(organization_id, finding_date desc);
create index idx_reconciliation_findings_status on public.attendance_reconciliation_findings(resolution_status);

alter table public.attendance_reconciliation_findings enable row level security;
create policy reconciliation_findings_select on public.attendance_reconciliation_findings for select
  using (organization_id = public.current_organization_id() and public.is_hr_or_admin());
-- Plain RLS-gated writes (not an RPC) for resolution -- HR updating
-- resolution_status/remarks directly is exactly what the generic audit
-- trigger above (now covering this table) is for: every manual resolution
-- is an ordinary UPDATE, which the trigger audits automatically, rather
-- than a bespoke "record this as audited" call the UI could forget to make.
create policy reconciliation_findings_write on public.attendance_reconciliation_findings for update
  using (organization_id = public.current_organization_id() and public.is_hr_or_admin())
  with check (organization_id = public.current_organization_id() and public.is_hr_or_admin());

-- Scans a date range for every employee and upserts findings -- re-running
-- it is safe (on conflict do update), so an already-resolved finding whose
-- underlying mismatch condition still holds is NOT reset to 'open' by a
-- later scan (only its status snapshot fields refresh); resolution state
-- is only ever changed by an explicit HR action on the row itself.
create or replace function public.run_attendance_reconciliation(_from_date date, _to_date date)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  _org_id uuid := public.current_organization_id();
  _found integer := 0;
  _rec record;
begin
  if not public.is_hr_or_admin() then
    raise exception 'run_attendance_reconciliation: not authorized';
  end if;

  for _rec in
    select
      e.id as employee_id,
      c.cal_date,
      exists (select 1 from public.attendance_punches p where p.employee_id = e.id and p.punch_date = c.cal_date) as has_punches,
      a.day_status,
      coalesce(a.missing_in, false) as missing_in,
      coalesce(a.missing_out, false) as missing_out,
      exists (
        select 1 from public.leave_requests lr
        where lr.employee_id = e.id and lr.status = 'approved' and c.cal_date between lr.from_date and lr.to_date
      ) as approved_leave,
      exists (
        select 1 from public.onduty_requests o
        where o.employee_id = e.id and o.status = 'approved' and o.onduty_type = 'work_from_home'
          and c.cal_date between o.from_date and o.to_date
      ) as approved_wfh,
      exists (
        select 1 from public.onduty_requests o
        where o.employee_id = e.id and o.status = 'approved' and o.onduty_type = 'on_duty'
          and c.cal_date between o.from_date and o.to_date
      ) as approved_onduty,
      exists (
        select 1 from public.holidays h where h.organization_id = e.organization_id and h.holiday_date = c.cal_date
      ) as is_holiday,
      coalesce(ws.weekoff_days is not null and extract(dow from c.cal_date)::int = any(ws.weekoff_days), false) as is_weekoff
    from public.employees e
    cross join lateral generate_series(_from_date, least(_to_date, current_date), interval '1 day') as c(cal_date)
    left join public.attendance a on a.employee_id = e.id and a.attendance_date = c.cal_date
    left join lateral (
      select sa_inner.shift_id from public.shift_assignments sa_inner
      where sa_inner.employee_id = e.id and sa_inner.effective_from <= c.cal_date
      order by sa_inner.effective_from desc limit 1
    ) sa on true
    left join public.shifts ws on ws.id = sa.shift_id
    where e.organization_id = _org_id and e.employment_status = 'active'
  loop
    if _rec.has_punches and _rec.approved_leave then
      insert into public.attendance_reconciliation_findings (organization_id, employee_id, finding_date, mismatch_type, biometric_status, hr_status, expected_status)
      values (_org_id, _rec.employee_id, _rec.cal_date, 'biometric_present_but_leave', 'present', coalesce(_rec.day_status, 'no_record'), 'leave')
      on conflict (employee_id, finding_date, mismatch_type) do update set
        biometric_status = excluded.biometric_status, hr_status = excluded.hr_status, expected_status = excluded.expected_status, updated_at = now();
      _found := _found + 1;
    end if;

    if _rec.has_punches and _rec.approved_wfh then
      insert into public.attendance_reconciliation_findings (organization_id, employee_id, finding_date, mismatch_type, biometric_status, hr_status, expected_status)
      values (_org_id, _rec.employee_id, _rec.cal_date, 'wfh_with_biometric_present', 'present', coalesce(_rec.day_status, 'no_record'), 'work_from_home')
      on conflict (employee_id, finding_date, mismatch_type) do update set
        biometric_status = excluded.biometric_status, hr_status = excluded.hr_status, expected_status = excluded.expected_status, updated_at = now();
      _found := _found + 1;
    end if;

    if _rec.approved_onduty and _rec.day_status = 'absent' then
      insert into public.attendance_reconciliation_findings (organization_id, employee_id, finding_date, mismatch_type, biometric_status, hr_status, expected_status)
      values (_org_id, _rec.employee_id, _rec.cal_date, 'onduty_marked_absent', 'absent', 'absent', 'on_duty')
      on conflict (employee_id, finding_date, mismatch_type) do update set
        biometric_status = excluded.biometric_status, hr_status = excluded.hr_status, expected_status = excluded.expected_status, updated_at = now();
      _found := _found + 1;
    end if;

    if not _rec.has_punches and not _rec.approved_leave and not _rec.approved_wfh and not _rec.approved_onduty
       and not _rec.is_holiday and not _rec.is_weekoff
       and coalesce(_rec.day_status, 'no_record') in ('absent', 'no_record') then
      insert into public.attendance_reconciliation_findings (organization_id, employee_id, finding_date, mismatch_type, biometric_status, hr_status, expected_status)
      values (_org_id, _rec.employee_id, _rec.cal_date, 'unexplained_absence', 'absent', coalesce(_rec.day_status, 'no_record'), 'present')
      on conflict (employee_id, finding_date, mismatch_type) do update set
        biometric_status = excluded.biometric_status, hr_status = excluded.hr_status, expected_status = excluded.expected_status, updated_at = now();
      _found := _found + 1;
    end if;

    if _rec.missing_in then
      insert into public.attendance_reconciliation_findings (organization_id, employee_id, finding_date, mismatch_type, biometric_status, hr_status, expected_status)
      values (_org_id, _rec.employee_id, _rec.cal_date, 'missing_in', coalesce(_rec.day_status, 'no_record'), coalesce(_rec.day_status, 'no_record'), 'complete_punch_pair')
      on conflict (employee_id, finding_date, mismatch_type) do update set updated_at = now();
      _found := _found + 1;
    end if;

    if _rec.missing_out then
      insert into public.attendance_reconciliation_findings (organization_id, employee_id, finding_date, mismatch_type, biometric_status, hr_status, expected_status)
      values (_org_id, _rec.employee_id, _rec.cal_date, 'missing_out', coalesce(_rec.day_status, 'no_record'), coalesce(_rec.day_status, 'no_record'), 'complete_punch_pair')
      on conflict (employee_id, finding_date, mismatch_type) do update set updated_at = now();
      _found := _found + 1;
    end if;
  end loop;

  return _found;
end;
$$;
grant execute on function public.run_attendance_reconciliation(date, date) to authenticated;

-- ============================================================
-- e) Audit trigger re-attach (moved here from section a) -- must run after
-- b/c/d have created biometric_readers, email_configuration, and
-- attendance_reconciliation_findings, since this DO block references them.
-- ============================================================
-- Full re-attach (idempotent per table -- drop-if-exists then re-create) so
-- every table this codebase has added since 0030, including this
-- migration's own new tables, gets audit coverage.
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
    'bank_detail_change_requests', 'leave_balances',
    'email_templates', 'biometric_readers', 'email_configuration',
    'attendance_reconciliation_findings'
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
-- 0049_monthly_attendance_analysis.sql
-- ============================================================
-- Monthly Attendance Analysis. One row per employee for the selected
-- month, aggregated from already-computed attendance columns --
-- effective/late/early/missing/shortfall/excess-stay all come straight
-- from recompute_attendance_day() (0044-0046), never recomputed here. This
-- mirrors src/lib/monthlyAnalysisEngine.ts's aggregateMonthlyAttendance()
-- exactly (see that file's tests, validated against a realistic 15-day
-- attendance record set): Working Days = calendar days that are neither a
-- holiday nor a weekly off; Present = day_status in ('present','half_day');
-- WFH/On-Duty are read via the distinguishing remark on a 'present' row,
-- matching the live schema (no separate 'wfh' status exists -- see 0037).
--
-- Comp-Off Earned/Used are returned as 0 -- Comp-Off does not exist as a
-- feature in this schema yet (a later phase). Not fabricated, flagged
-- rather than guessed at.

create or replace function public.get_monthly_attendance_summary(
  _year int,
  _month int,
  _employee_id uuid default null,
  _department_id uuid default null,
  _manager_id uuid default null,
  _location_id uuid default null
)
returns table (
  employee_id uuid,
  employee_code text,
  employee_name text,
  department_name text,
  location_name text,
  manager_name text,
  working_days int,
  present_days int,
  absent_days int,
  leave_days int,
  wfh_days int,
  on_duty_days int,
  permission_count int,
  permission_minutes int,
  late_days int,
  early_going_days int,
  missing_punch_days int,
  effective_minutes bigint,
  required_minutes bigint,
  shortfall_minutes bigint,
  excess_stay_minutes bigint,
  comp_off_earned numeric,
  comp_off_used numeric
)
language plpgsql stable security definer set search_path = public as $$
declare
  _from_date date := make_date(_year, _month, 1);
  _to_date date := (make_date(_year, _month, 1) + interval '1 month - 1 day')::date;
begin
  return query
  with scoped_employees as (
    select
      e.id, e.employee_code,
      (e.first_name || coalesce(' ' || e.last_name, '')) as full_name,
      d.name as dept_name, l.name as loc_name, e.organization_id,
      (m.first_name || coalesce(' ' || m.last_name, '')) as mgr_name
    from public.employees e
    left join public.departments d on d.id = e.department_id
    left join public.locations l on l.id = e.location_id
    left join public.employees m on m.id = e.reporting_manager_id
    where e.employment_status = 'active'
      and e.organization_id = public.current_organization_id()
      and (e.id = public.current_employee_id() or public.is_manager_of(e.id) or public.is_hr_or_admin())
      and (_employee_id is null or e.id = _employee_id)
      and (_department_id is null or e.department_id = _department_id)
      and (_manager_id is null or e.reporting_manager_id = _manager_id)
      and (_location_id is null or e.location_id = _location_id)
  ),
  calendar as (
    select se.*, gs.cal_date::date as cal_date
    from scoped_employees se
    cross join lateral generate_series(_from_date, least(_to_date, current_date), interval '1 day') as gs(cal_date)
  ),
  with_shift as (
    select c.*, s.weekoff_days, s.full_day_hours
    from calendar c
    left join lateral (
      select sa_inner.shift_id from public.shift_assignments sa_inner
      where sa_inner.employee_id = c.id and sa_inner.effective_from <= c.cal_date
      order by sa_inner.effective_from desc limit 1
    ) sa on true
    left join public.shifts s on s.id = sa.shift_id
  ),
  day_rows as (
    select
      ws.*,
      exists(select 1 from public.holidays h where h.organization_id = ws.organization_id and h.holiday_date = ws.cal_date) as is_holiday,
      coalesce(ws.weekoff_days is not null and extract(dow from ws.cal_date)::int = any(ws.weekoff_days), false) as is_weekoff,
      a.day_status, a.remarks, a.late_minutes, a.early_going_minutes,
      a.missing_in, a.missing_out, a.effective_minutes, a.shortfall_minutes, a.excess_stay_minutes
    from with_shift ws
    left join public.attendance a on a.employee_id = ws.id and a.attendance_date = ws.cal_date
  ),
  with_required as (
    select dr.*,
      case when not dr.is_holiday and not dr.is_weekoff then (coalesce(dr.full_day_hours, 8) * 60)::int else 0 end as required_minutes_for_day
    from day_rows dr
  ),
  permission_agg as (
    select pr.employee_id, count(*) as permission_count, sum(pr.duration_minutes) as permission_minutes
    from public.permission_requests pr
    where pr.status = 'approved' and pr.permission_date between _from_date and _to_date
    group by pr.employee_id
  )
  select
    wr.id,
    wr.employee_code,
    wr.full_name,
    wr.dept_name,
    wr.loc_name,
    wr.mgr_name,
    count(*) filter (where not wr.is_holiday and not wr.is_weekoff)::int as working_days,
    count(*) filter (where wr.day_status in ('present', 'half_day'))::int as present_days,
    count(*) filter (where wr.day_status = 'absent')::int as absent_days,
    count(*) filter (where wr.day_status = 'leave')::int as leave_days,
    count(*) filter (where wr.day_status = 'present' and wr.remarks = 'Work From Home')::int as wfh_days,
    count(*) filter (where wr.day_status = 'on_duty' or (wr.day_status = 'present' and wr.remarks = 'On Duty'))::int as on_duty_days,
    coalesce(max(pa.permission_count), 0)::int as permission_count,
    coalesce(max(pa.permission_minutes), 0)::int as permission_minutes,
    count(*) filter (where coalesce(wr.late_minutes, 0) > 0)::int as late_days,
    count(*) filter (where coalesce(wr.early_going_minutes, 0) > 0)::int as early_going_days,
    count(*) filter (where coalesce(wr.missing_in, false) or coalesce(wr.missing_out, false))::int as missing_punch_days,
    coalesce(sum(wr.effective_minutes), 0)::bigint as effective_minutes,
    coalesce(sum(wr.required_minutes_for_day), 0)::bigint as required_minutes,
    coalesce(sum(wr.shortfall_minutes), 0)::bigint as shortfall_minutes,
    coalesce(sum(wr.excess_stay_minutes), 0)::bigint as excess_stay_minutes,
    0::numeric as comp_off_earned,
    0::numeric as comp_off_used
  from with_required wr
  left join permission_agg pa on pa.employee_id = wr.id
  group by wr.id, wr.employee_code, wr.full_name, wr.dept_name, wr.loc_name, wr.mgr_name
  order by wr.full_name;
end;
$$;

grant execute on function public.get_monthly_attendance_summary(int, int, uuid, uuid, uuid, uuid) to authenticated;

-- ============================================================
-- 0050_fix_audit_trigger_non_id_primary_key.sql
-- ============================================================
-- Real bug found while applying this project's full migration set + seed
-- data live for the first time (previous sessions never had a connection
-- that let them run the whole set end-to-end): audit_row_change() (0030)
-- hardcoded `old.id`/`new.id` direct field access. That fails outright --
-- "record \"old\"/\"new\" has no field \"id\"" -- for any table whose
-- primary key isn't literally named `id`. employee_profiles is exactly
-- that case (its PK is `employee_id`, a legitimate 1:1 extension-table
-- design), and it's been in the audited sensitive_tables list since 0030,
-- meaning this trigger has been unable to fire successfully on that table
-- since the very first migration that attached it -- not something this
-- session introduced, just the first time anyone actually exercised it
-- end-to-end against a live database.
--
-- Fixed generically (not with a per-table special case) by reading `id`
-- out of the already-computed `_row` jsonb instead of direct field access
-- -- jsonb key lookup returns null for a missing key instead of erroring,
-- so this is now safe for any current or future audited table regardless
-- of its primary key's column name. employee_profiles rows will have a
-- null record_id but a real employee_id (0048's new column) -- arguably
-- more useful for that table anyway, since "which employee's profile"
-- *is* the identity that matters there.

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
  _employee_id uuid;
  _actor_role text;
begin
  _row := to_jsonb(coalesce(new, old));
  _action := case TG_OP when 'INSERT' then 'create' when 'UPDATE' then 'update' when 'DELETE' then 'delete' end;
  _record_id := nullif(_row->>'id', '')::uuid;
  _org_id := case
    when _row ? 'organization_id' and _row->>'organization_id' is not null then (_row->>'organization_id')::uuid
    else public.current_organization_id()
  end;
  -- The row itself is the employee for the employees table; every other
  -- tracked table that concerns a specific employee carries employee_id
  -- directly. Org-structure/config tables (shifts, system_settings, ...)
  -- have neither, so employee_id stays null there -- correctly, since the
  -- action isn't about any one employee.
  _employee_id := case
    when TG_TABLE_NAME = 'employees' then _record_id
    when _row ? 'employee_id' and _row->>'employee_id' is not null then (_row->>'employee_id')::uuid
    else null
  end;

  select r.name into _actor_role
    from public.user_roles ur join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid()
    order by case r.name when 'super_admin' then 1 when 'hr_admin' then 2 when 'manager' then 3 else 4 end
    limit 1;

  insert into public.audit_logs (organization_id, actor_user_id, actor_role, employee_id, action, module, record_id, old_value, new_value, result)
  values (
    _org_id,
    auth.uid(),
    _actor_role,
    _employee_id,
    _action,
    TG_TABLE_NAME,
    _record_id,
    case when TG_OP <> 'INSERT' then to_jsonb(old) else null end,
    case when TG_OP <> 'DELETE' then to_jsonb(new) else null end,
    'success'
  );

  return coalesce(new, old);
end;
$$;

-- ============================================================
-- 0051_fix_audit_trigger_org_resolution.sql
-- ============================================================
-- Second real bug found in the same live run that found 0050's: 11 of the
-- 24 audited tables (bank_details, statutory_details, employee_profiles,
-- payslips, tax_declarations, previous_employer_declarations,
-- exit_settlements, exit_clearances, employee_documents,
-- bank_detail_change_requests, leave_balances) have no organization_id
-- column of their own. audit_row_change()'s only fallback was
-- current_organization_id(), which resolves via auth.uid() -- null for any
-- action taken outside an authenticated Supabase session (seed data
-- applied directly, a migration, a backend job). Since audit_logs.
-- organization_id is NOT NULL, that fallback failing aborted the entire
-- triggering transaction -- a logging side-effect was blocking the actual
-- business operation, exactly backwards from what an audit trail should do.
--
-- Fixed with a proper 3-tier resolution instead of a single session-based
-- fallback: (1) the row's own organization_id if it has one; (2) look up
-- via employees.organization_id through the row's employee_id, if it has
-- one -- correct regardless of session state, and covers 9 of the 11
-- exceptions; (3) current_organization_id() as before, for real app usage
-- with a live session. If all three come up empty (only possible for
-- exit_settlements/exit_clearances -- the two tables with neither column --
-- run outside an authenticated session), the audit insert is skipped
-- rather than failing the underlying operation. In real app usage this
-- skip path essentially never fires: every genuine user action has a
-- session, so current_organization_id() resolves.

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
  _employee_id uuid;
  _actor_role text;
begin
  _row := to_jsonb(coalesce(new, old));
  _action := case TG_OP when 'INSERT' then 'create' when 'UPDATE' then 'update' when 'DELETE' then 'delete' end;
  _record_id := nullif(_row->>'id', '')::uuid;
  _employee_id := case
    when TG_TABLE_NAME = 'employees' then _record_id
    when _row ? 'employee_id' and _row->>'employee_id' is not null then (_row->>'employee_id')::uuid
    else null
  end;

  if _row ? 'organization_id' and _row->>'organization_id' is not null then
    _org_id := (_row->>'organization_id')::uuid;
  elsif _employee_id is not null then
    select organization_id into _org_id from public.employees where id = _employee_id;
  end if;
  if _org_id is null then
    _org_id := public.current_organization_id();
  end if;

  -- A logging side-effect must never block the operation it's logging --
  -- if no organization can be resolved at all (only possible outside an
  -- authenticated session, for a table with neither organization_id nor
  -- employee_id), skip the audit row instead of raising.
  if _org_id is null then
    return coalesce(new, old);
  end if;

  select r.name into _actor_role
    from public.user_roles ur join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid()
    order by case r.name when 'super_admin' then 1 when 'hr_admin' then 2 when 'manager' then 3 else 4 end
    limit 1;

  insert into public.audit_logs (organization_id, actor_user_id, actor_role, employee_id, action, module, record_id, old_value, new_value, result)
  values (
    _org_id,
    auth.uid(),
    _actor_role,
    _employee_id,
    _action,
    TG_TABLE_NAME,
    _record_id,
    case when TG_OP <> 'INSERT' then to_jsonb(old) else null end,
    case when TG_OP <> 'DELETE' then to_jsonb(new) else null end,
    'success'
  );

  return coalesce(new, old);
end;
$$;

-- ============================================================
-- 0052_fix_queue_templated_email_org_resolution.sql
-- ============================================================
-- Third real bug in the same class, found continuing the same live run:
-- queue_templated_email() (0047) always resolved organization via
-- current_organization_id() (session/auth.uid()-based), even when called
-- from trg_queue_approval_request_email() -- a trigger fired by a plain
-- INSERT with no authenticated session (seed data, or any future
-- non-interactive writer). The trigger itself already resolves the
-- correct organization_id from the employee record before calling
-- queue_templated_email() -- that context was just never passed through,
-- so the callee re-derived it from session state and got null outside a
-- real request.
--
-- Fixed by accepting an optional _organization_id parameter: callers that
-- already know it (the trigger, act_on_approval()) pass it explicitly;
-- direct client calls (the admin UI's Send Test Email) omit it and fall
-- back to current_organization_id() as before, since those always run
-- inside a real authenticated session.

drop function if exists public.queue_templated_email(text, text, jsonb, text, text[], text[]);

create or replace function public.queue_templated_email(
  _template_key text,
  _recipient_email text,
  _variables jsonb default '{}'::jsonb,
  _reference_id text default null,
  _cc text[] default '{}',
  _bcc text[] default '{}',
  _organization_id uuid default null
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  _org_id uuid := coalesce(_organization_id, public.current_organization_id());
  _template record;
  _rendered record;
  _log_id uuid;
begin
  select id, subject, body into _template
    from public.email_templates
    where organization_id = _org_id and template_key = _template_key and is_active
    order by updated_at desc limit 1;

  if _template.id is null then
    insert into public.email_delivery_logs (
      organization_id, template_id, template_key, recipient_email, cc, bcc, status, error_message, reference_id
    ) values (
      _org_id, null, _template_key, _recipient_email, coalesce(_cc, '{}'), coalesce(_bcc, '{}'),
      'failed', 'No active template configured for this template_key', _reference_id
    )
    returning id into _log_id;
    return _log_id;
  end if;

  select * into _rendered from public.render_email_template(_template.subject, _template.body, _variables);

  insert into public.email_delivery_logs (
    organization_id, template_id, template_key, recipient_email, cc, bcc, subject, body, status, reference_id
  ) values (
    _org_id, _template.id, _template_key, _recipient_email, coalesce(_cc, '{}'), coalesce(_bcc, '{}'),
    _rendered.subject, _rendered.body, 'pending', _reference_id
  )
  returning id into _log_id;

  return _log_id;
end;
$$;

grant execute on function public.queue_templated_email(text, text, jsonb, text, text[], text[], uuid) to authenticated;

-- Pass the already-resolved organization through explicitly.
create or replace function public.trg_queue_approval_request_email()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  _row jsonb := to_jsonb(new);
  _manager_id uuid := nullif(_row->>'reporting_manager_id', '')::uuid;
  _org_id uuid;
  _employee_name text;
  _employee_code text;
  _manager_name text;
  _manager_email text;
  _request_type text;
  _from_date text;
  _to_date text;
  _duration text;
begin
  if new.status <> 'pending' then
    return new;
  end if;

  select organization_id, (first_name || coalesce(' ' || last_name, '')), employee_code
    into _org_id, _employee_name, _employee_code
    from public.employees where id = new.employee_id;

  if _manager_id is not null then
    select (first_name || coalesce(' ' || last_name, '')), official_email
      into _manager_name, _manager_email
      from public.employees where id = _manager_id;
  end if;

  if _manager_email is null then
    return new; -- no manager on record to notify
  end if;

  _request_type := case TG_TABLE_NAME
    when 'leave_requests' then 'Leave'
    when 'permission_requests' then 'Permission'
    when 'attendance_regularizations' then 'Attendance Regularization'
    when 'onduty_requests' then (case when _row->>'onduty_type' = 'work_from_home' then 'Work From Home' else 'On Duty' end)
    when 'other_requests' then coalesce(_row->>'request_title', 'Other Request')
    else TG_TABLE_NAME
  end;

  _from_date := coalesce(_row->>'from_date', _row->>'attendance_date', _row->>'permission_date', _row->>'request_date');
  _to_date := coalesce(_row->>'to_date', _from_date);
  _duration := case
    when _row ? 'duration_days' then (_row->>'duration_days') || ' day(s)'
    when _row ? 'duration_minutes' then (_row->>'duration_minutes') || ' min'
    else '-'
  end;

  perform public.queue_templated_email(
    'approval_request',
    _manager_email,
    jsonb_build_object(
      'employee_name', _employee_name,
      'employee_id', _employee_code,
      'manager_name', _manager_name,
      'request_type', _request_type,
      'from_date', _from_date,
      'to_date', _to_date,
      'duration', _duration,
      'reason', coalesce(_row->>'reason', ''),
      'application_id', new.id::text
    ),
    TG_TABLE_NAME || ':' || new.id::text,
    '{}',
    '{}',
    _org_id
  );

  return new;
end;
$$;

-- ============================================================
-- 0053_act_on_approval_pass_org_explicitly.sql
-- ============================================================
-- Consistency follow-up to 0052: act_on_approval() already computes _org_id
-- from the request owner early on -- pass it through explicitly to
-- queue_templated_email() too, rather than letting that call fall back to
-- session-based current_organization_id(). Not currently a live bug
-- (act_on_approval always runs inside an authenticated RPC call today, so
-- the session-based fallback has a real session to resolve), but it closes
-- the same class of latent gap 0050-0052 fixed elsewhere, in case this
-- function is ever invoked from a non-interactive context (a scheduled
-- job, a bulk-approval script) in the future. Every other branch is
-- unchanged from 0047.

create or replace function public.act_on_approval(
  _request_type text,
  _request_id uuid,
  _action text,
  _remarks text default null
)
returns void
language plpgsql security definer set search_path = public as $$
declare
  _owner_id uuid;
  _actor_id uuid := public.current_employee_id();
  _org_id uuid;
  _old_status text;
  _workflow_id uuid;
  _instance_id uuid;
  _recipient_user uuid;
  _notification_type text;
  _title text;
  _leave_type_id uuid;
  _leave_type_name text;
  _duration numeric(5,2);
  _from_date date;
  _to_date date;
  _remaining numeric(6,2);
  _remaining_to_deduct numeric(5,2);
  _deduct_amount numeric(5,2);
  _period_row record;
  -- Regularization -> attendance sync
  _reg_date date;
  _reg_check_in timestamptz;
  _reg_check_out timestamptz;
  -- Leave / onduty -> attendance sync
  _onduty_type text;
  _loop_date date;
  _onduty_remark text;
  -- Permission balance
  _permission_date date;
  _permission_minutes int;
  _perm_balance_id uuid;
  _perm_remaining int;
  -- Approval-decision email
  _owner_email text;
  _owner_name text;
  _owner_code text;
  _actor_name text;
  _email_request_type text;
  _email_from_date text;
  _email_to_date text;
  _email_duration text;
begin
  if _action not in ('approved', 'rejected') then
    raise exception 'act_on_approval: action must be ''approved'' or ''rejected'', got %', _action;
  end if;

  _owner_id := public.request_owner_employee_id(_request_type, _request_id);
  if _owner_id is null then
    raise exception 'act_on_approval: request % / % not found', _request_type, _request_id;
  end if;

  if _actor_id is null or not (public.is_hr_or_admin() or public.is_manager_of(_owner_id)) then
    raise exception 'act_on_approval: not authorized to act on this request';
  end if;

  select organization_id into _org_id from public.employees where id = _owner_id;

  if _request_type = 'leave_request' then
    select status into _old_status from public.leave_requests where id = _request_id;
    update public.leave_requests
      set status = _action, approval_remarks = _remarks
      where id = _request_id and status = 'pending'
      returning leave_type_id, duration_days, from_date, to_date into _leave_type_id, _duration, _from_date, _to_date;
  elsif _request_type = 'permission_request' then
    select status into _old_status from public.permission_requests where id = _request_id;
    update public.permission_requests
      set status = _action, approval_remarks = _remarks
      where id = _request_id and status = 'pending'
      returning permission_date, duration_minutes into _permission_date, _permission_minutes;
  elsif _request_type = 'attendance_regularization' then
    select status into _old_status from public.attendance_regularizations where id = _request_id;
    update public.attendance_regularizations
      set status = _action, approval_remarks = _remarks, approver_id = _actor_id
      where id = _request_id and status = 'pending'
      returning attendance_date, requested_check_in, requested_check_out
        into _reg_date, _reg_check_in, _reg_check_out;
  elsif _request_type = 'onduty_request' then
    select status into _old_status from public.onduty_requests where id = _request_id;
    update public.onduty_requests
      set status = _action, approval_remarks = _remarks
      where id = _request_id and status = 'pending'
      returning from_date, to_date, onduty_type into _from_date, _to_date, _onduty_type;
  elsif _request_type = 'other_request' then
    select status into _old_status from public.other_requests where id = _request_id;
    update public.other_requests
      set status = _action, approval_remarks = _remarks
      where id = _request_id and status = 'pending';
  else
    raise exception 'act_on_approval: unsupported request type %', _request_type;
  end if;

  if not found then
    raise exception 'act_on_approval: request is not pending (already actioned?)';
  end if;

  -- Deduct across every leave_balances period for this employee/leave-type
  -- (cumulative model): check the sum first, then spend from the earliest
  -- period with remaining balance forward, so a request isn't blocked just
  -- because the specific month it falls in has too small a slice.
  if _request_type = 'leave_request' and _action = 'approved' then
    select coalesce(sum(balance), 0) into _remaining
      from public.leave_balances
      where employee_id = _owner_id and leave_type_id = _leave_type_id;

    if _remaining - _duration < 0 then
      raise exception 'act_on_approval: approving this request would drive leave type % balance negative (% available, % requested)',
        _leave_type_id, _remaining, _duration;
    end if;

    _remaining_to_deduct := _duration;
    for _period_row in
      select id, balance from public.leave_balances
      where employee_id = _owner_id and leave_type_id = _leave_type_id and balance > 0
      order by period_start
      for update
    loop
      exit when _remaining_to_deduct <= 0;
      _deduct_amount := least(_period_row.balance, _remaining_to_deduct);
      update public.leave_balances
        set used = used + _deduct_amount, balance = balance - _deduct_amount
        where id = _period_row.id;
      _remaining_to_deduct := _remaining_to_deduct - _deduct_amount;
    end loop;
    -- No balance rows at all is left un-deducted rather than blocking the
    -- approval outright -- leave types with accrual_frequency = 'none'
    -- (e.g. unpaid/compensatory) may legitimately have no leave_balances row.
  end if;

  -- Deduct the matching permission-balance period on approval only.
  if _request_type = 'permission_request' and _action = 'approved' then
    select id, balance_minutes into _perm_balance_id, _perm_remaining
      from public.permission_balances
      where employee_id = _owner_id
        and period_start <= _permission_date and period_end >= _permission_date
      for update;

    if _perm_balance_id is not null then
      if _perm_remaining - _permission_minutes < 0 then
        raise exception 'act_on_approval: approving this request would drive permission balance negative (% minutes available, % requested)',
          _perm_remaining, _permission_minutes;
      end if;
      update public.permission_balances
        set used_minutes = used_minutes + _permission_minutes, balance_minutes = balance_minutes - _permission_minutes
        where id = _perm_balance_id;
    end if;
    -- No matching period is left un-deducted rather than blocking the
    -- approval outright, same reasoning as the leave-balance block above.
  end if;

  -- (a) Apply an approved leave to the attendance table: every day in range
  -- becomes day_status = 'leave'. Overwrites whatever was there before
  -- (e.g. a stale seeded 'absent' guess) -- the approved leave is now the
  -- authoritative status for that day.
  if _request_type = 'leave_request' and _action = 'approved' then
    select name into _leave_type_name from public.leave_types where id = _leave_type_id;
    _loop_date := _from_date;
    while _loop_date <= _to_date loop
      insert into public.attendance (organization_id, employee_id, attendance_date, day_status, validation_status, remarks)
      values (_org_id, _owner_id, _loop_date, 'leave', 'completed', coalesce(_leave_type_name, 'Leave'))
      on conflict (employee_id, attendance_date) do update set
        day_status = 'leave',
        validation_status = 'completed',
        remarks = coalesce(excluded.remarks, public.attendance.remarks);
      _loop_date := _loop_date + 1;
    end loop;
  end if;

  -- (b) Apply an approved on-duty/WFH request the same way: every day in
  -- range becomes day_status = 'present' (the employee worked, just not
  -- from a punch-tracked location), with a remark noting which type.
  -- recompute_attendance_day() recognizes this remark and refuses to
  -- overwrite it if punches are ever recomputed for the same date.
  if _request_type = 'onduty_request' and _action = 'approved' then
    _onduty_remark := case when _onduty_type = 'work_from_home' then 'Work From Home' else 'On Duty' end;
    _loop_date := _from_date;
    while _loop_date <= _to_date loop
      insert into public.attendance (organization_id, employee_id, attendance_date, day_status, validation_status, remarks)
      values (_org_id, _owner_id, _loop_date, 'present', 'completed', _onduty_remark)
      on conflict (employee_id, attendance_date) do update set
        day_status = 'present',
        validation_status = 'completed',
        remarks = coalesce(excluded.remarks, public.attendance.remarks);
      _loop_date := _loop_date + 1;
    end loop;
  end if;

  -- Apply an approved regularization by writing the correction as
  -- synthetic 'manual' punches and letting recompute_attendance_day() do
  -- the actual shift-relative math -- the same engine every other punch
  -- (biometric, mobile, web) goes through. A prior 'manual' punch of the
  -- same type for this date is replaced, not stacked, so re-approving a
  -- corrected regularization doesn't accumulate duplicate synthetic punches.
  if _request_type = 'attendance_regularization' and _action = 'approved' then
    if _reg_check_in is not null or _reg_check_out is not null then
      if _reg_check_in is not null then
        delete from public.attendance_punches
          where employee_id = _owner_id and punch_date = _reg_date and source = 'manual' and punch_type = 'in';
        insert into public.attendance_punches (organization_id, employee_id, punch_date, punch_time, punch_type, source)
          values (_org_id, _owner_id, _reg_date, _reg_check_in, 'in', 'manual');
      end if;
      if _reg_check_out is not null then
        delete from public.attendance_punches
          where employee_id = _owner_id and punch_date = _reg_date and source = 'manual' and punch_type = 'out';
        insert into public.attendance_punches (organization_id, employee_id, punch_date, punch_time, punch_type, source)
          values (_org_id, _owner_id, _reg_date, _reg_check_out, 'out', 'manual');
      end if;

      perform public.recompute_attendance_day(_owner_id, _reg_date);

      update public.attendance
        set is_regularized = true, remarks = coalesce(_remarks, remarks)
        where employee_id = _owner_id and attendance_date = _reg_date;
    else
      -- No punch times at all (e.g. a plain present_correction with nothing
      -- but "I was present" and a reason) -- still record the correction
      -- rather than silently dropping it, same fallback as before.
      insert into public.attendance (organization_id, employee_id, attendance_date, day_status, validation_status, is_regularized, remarks)
      values (_org_id, _owner_id, _reg_date, 'present', 'completed', true, _remarks)
      on conflict (employee_id, attendance_date) do update set
        day_status = 'present',
        validation_status = 'completed',
        is_regularized = true,
        remarks = coalesce(excluded.remarks, public.attendance.remarks);
    end if;
  end if;

  insert into public.audit_logs (organization_id, actor_user_id, action, module, record_id, old_value, new_value)
    values (
      _org_id, auth.uid(), (case when _action = 'approved' then 'approval' else 'rejection' end),
      'manager_self_service', _request_id,
      jsonb_build_object('request_type', _request_type, 'status', _old_status),
      jsonb_build_object('request_type', _request_type, 'status', _action, 'remarks', _remarks)
    );

  select id into _workflow_id from public.approval_workflows
    where organization_id = _org_id and request_type = _request_type and is_active
    order by created_at limit 1;

  if _workflow_id is not null then
    insert into public.approval_instances (workflow_id, request_type, request_id, status, current_step_order)
      values (_workflow_id, _request_type, _request_id, _action, 1)
      on conflict (request_type, request_id) do update set status = excluded.status
      returning id into _instance_id;

    insert into public.approval_actions (approval_instance_id, step_order, actor_employee_id, action, remarks)
      values (_instance_id, 1, _actor_id, _action, _remarks);
  end if;

  _notification_type := case _request_type
    when 'leave_request' then (case when _action = 'approved' then 'leave_approved' else 'leave_rejected' end)
    when 'permission_request' then (case when _action = 'approved' then 'permission_approved' else 'permission_rejected' end)
    when 'attendance_regularization' then (case when _action = 'approved' then 'regularization_approved' else 'regularization_rejected' end)
    when 'onduty_request' then (case when _action = 'approved' then 'onduty_approved' else 'onduty_rejected' end)
    when 'other_request' then (case when _action = 'approved' then 'other_request_approved' else 'other_request_rejected' end)
  end;
  _title := case when _action = 'approved' then 'Your request has been approved' else 'Your request has been rejected' end;

  select user_id into _recipient_user from public.employees where id = _owner_id;
  if _recipient_user is not null then
    insert into public.notifications (organization_id, recipient_user_id, notification_type, title, body, link_path)
      values (_org_id, _recipient_user, _notification_type, _title, _remarks, '/attendance/event-request');
  end if;

  -- Queue the decision email to the requesting employee via the same
  -- central engine every other module uses -- not a bespoke send here.
  select official_email, (first_name || coalesce(' ' || last_name, '')), employee_code
    into _owner_email, _owner_name, _owner_code
    from public.employees where id = _owner_id;

  if _owner_email is not null then
    select (first_name || coalesce(' ' || last_name, '')) into _actor_name from public.employees where id = _actor_id;

    _email_request_type := case _request_type
      when 'leave_request' then 'Leave'
      when 'permission_request' then 'Permission'
      when 'attendance_regularization' then 'Attendance Regularization'
      when 'onduty_request' then (case when _onduty_type = 'work_from_home' then 'Work From Home' else 'On Duty' end)
      when 'other_request' then 'Other Request'
    end;
    _email_from_date := coalesce(_from_date::text, _reg_date::text, _permission_date::text);
    _email_to_date := coalesce(_to_date::text, _email_from_date);
    _email_duration := case
      when _duration is not null then _duration::text || ' day(s)'
      when _permission_minutes is not null then _permission_minutes::text || ' min'
      else '-'
    end;

    perform public.queue_templated_email(
      case when _action = 'approved' then 'approval_approved' else 'approval_rejected' end,
      _owner_email,
      jsonb_build_object(
        'employee_name', _owner_name,
        'employee_id', _owner_code,
        'manager_name', _actor_name,
        'request_type', _email_request_type,
        'from_date', _email_from_date,
        'to_date', _email_to_date,
        'duration', _email_duration,
        'remarks', coalesce(_remarks, ''),
        'status', _action,
        'application_id', _request_id::text
      ),
      _request_type || ':' || _request_id::text,
      _organization_id => _org_id
    );
  end if;
end;
$$;

-- ============================================================
-- 0054_smtp_password_via_vault.sql
-- ============================================================
-- Real design flaw found while actually trying to complete the one-time
-- setup step 0048 documented: `ALTER DATABASE postgres SET app.settings.
-- smtp_encryption_key = '...'` fails with "permission denied to set
-- parameter" on Supabase's managed Postgres, for the `postgres` role AND
-- via `ALTER ROLE` -- customers don't get the privilege to set arbitrary
-- custom GUC namespaces at that level on this platform. The whole
-- pgcrypto + custom-GUC-key design in 0048 was unworkable as written; it
-- was never actually exercised end-to-end before now.
--
-- Rebuilt on supabase_vault (already enabled on this project, and
-- available on every Supabase project by default) -- the platform's actual
-- supported mechanism for exactly this: application secrets encrypted at
-- rest with a key Supabase itself manages, no manual setup step at all.
-- `email_configuration.password_encrypted` (bytea, pgp_sym_encrypt) is
-- replaced with `password_secret_id` (a vault.secrets id); the plaintext
-- is only ever readable via `vault.decrypted_secrets`, which -- like
-- get_smtp_credentials() itself -- is granted to `service_role` only.

alter table public.email_configuration
  add column if not exists password_secret_id uuid;

alter table public.email_configuration
  drop column if exists has_password;

alter table public.email_configuration
  add column has_password boolean generated always as (password_secret_id is not null) stored;

alter table public.email_configuration
  drop column if exists password_encrypted;

create or replace function public.set_email_configuration(
  _host text,
  _port int,
  _encryption text,
  _username text,
  _from_name text,
  _from_email text,
  _reply_to text,
  _is_active boolean,
  _password text default null
)
returns void
language plpgsql security definer set search_path = public as $$
declare
  _org_id uuid := public.current_organization_id();
  _existing_secret_id uuid;
  _secret_id uuid;
begin
  if not public.is_hr_or_admin() then
    raise exception 'set_email_configuration: not authorized';
  end if;

  select password_secret_id into _existing_secret_id
    from public.email_configuration where organization_id = _org_id;

  if _password is not null then
    if _existing_secret_id is not null then
      perform vault.update_secret(_existing_secret_id, _password);
      _secret_id := _existing_secret_id;
    else
      _secret_id := vault.create_secret(_password, 'smtp_password_' || _org_id::text, 'SMTP password for email_configuration');
    end if;
  else
    -- Blank password in the update means "keep the existing secret" -- HR
    -- isn't forced to re-enter it on every unrelated field edit.
    _secret_id := _existing_secret_id;
  end if;

  insert into public.email_configuration (
    organization_id, host, port, encryption, username, from_name, from_email, reply_to, is_active,
    password_secret_id, updated_by
  ) values (
    _org_id, _host, _port, _encryption, _username, _from_name, _from_email, _reply_to, _is_active,
    _secret_id, public.current_employee_id()
  )
  on conflict (organization_id) do update set
    host = excluded.host,
    port = excluded.port,
    encryption = excluded.encryption,
    username = excluded.username,
    from_name = excluded.from_name,
    from_email = excluded.from_email,
    reply_to = excluded.reply_to,
    is_active = excluded.is_active,
    password_secret_id = excluded.password_secret_id,
    updated_by = excluded.updated_by;
end;
$$;

create or replace function public.get_smtp_credentials(_organization_id uuid)
returns table (
  host text, port int, encryption text, username text, password text,
  from_name text, from_email text, reply_to text, is_active boolean
)
language plpgsql security definer set search_path = public as $$
begin
  return query
  select
    c.host, c.port, c.encryption, c.username,
    ds.decrypted_secret,
    c.from_name, c.from_email, c.reply_to, c.is_active
  from public.email_configuration c
  left join vault.decrypted_secrets ds on ds.id = c.password_secret_id
  where c.organization_id = _organization_id;
end;
$$;
revoke all on function public.get_smtp_credentials(uuid) from public, authenticated, anon;
grant execute on function public.get_smtp_credentials(uuid) to service_role;

-- ============================================================
-- 0055_fix_audit_role_priority_code.sql
-- ============================================================
-- Real bug found while creating login credentials and inspecting the live
-- `roles` table: audit_row_change() (0048/0050/0051) ordered by
-- `case r.name when 'super_admin' then 1 ...` but `roles.name` holds
-- display strings ('Super Administrator', 'HR Administrator', ...) -- the
-- lowercase slug lives in `roles.code` (what the frontend actually reads,
-- src/auth/AuthProvider.tsx: `role:roles(code)`). The case never matched
-- anything, so actor_role priority ordering silently always fell through
-- to `else 4` for every role -- audit_logs.actor_role still got set to
-- *a* role name for a multi-role user, just not reliably the highest-
-- privilege one. Fixed by ordering on r.code instead.

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
  _employee_id uuid;
  _actor_role text;
begin
  _row := to_jsonb(coalesce(new, old));
  _action := case TG_OP when 'INSERT' then 'create' when 'UPDATE' then 'update' when 'DELETE' then 'delete' end;
  _record_id := nullif(_row->>'id', '')::uuid;
  _employee_id := case
    when TG_TABLE_NAME = 'employees' then _record_id
    when _row ? 'employee_id' and _row->>'employee_id' is not null then (_row->>'employee_id')::uuid
    else null
  end;

  if _row ? 'organization_id' and _row->>'organization_id' is not null then
    _org_id := (_row->>'organization_id')::uuid;
  elsif _employee_id is not null then
    select organization_id into _org_id from public.employees where id = _employee_id;
  end if;
  if _org_id is null then
    _org_id := public.current_organization_id();
  end if;

  if _org_id is null then
    return coalesce(new, old);
  end if;

  select r.code into _actor_role
    from public.user_roles ur join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid()
    order by case r.code when 'super_admin' then 1 when 'hr_admin' then 2 when 'manager' then 3 else 4 end
    limit 1;

  insert into public.audit_logs (organization_id, actor_user_id, actor_role, employee_id, action, module, record_id, old_value, new_value, result)
  values (
    _org_id,
    auth.uid(),
    _actor_role,
    _employee_id,
    _action,
    TG_TABLE_NAME,
    _record_id,
    case when TG_OP <> 'INSERT' then to_jsonb(old) else null end,
    case when TG_OP <> 'DELETE' then to_jsonb(new) else null end,
    'success'
  );

  return coalesce(new, old);
end;
$$;

-- ============================================================
-- 0056_grant_base_table_privileges.sql
-- ============================================================
-- The single most consequential bug found this session, discovered only by
-- actually logging into the running app for the first time: every one of
-- this schema's 58 public tables was missing base SELECT/INSERT/UPDATE/
-- DELETE grants for anon/authenticated/service_role entirely -- only
-- REFERENCES/TRIGGER/TRUNCATE existed (confirmed live via
-- information_schema.role_table_grants). PostgREST/RLS only ever gets a
-- chance to filter rows *after* Postgres's coarser table-level GRANT check
-- already permits the operation -- with that GRANT missing, every RLS
-- policy this project has ever written (0018 onward) has been completely
-- unreachable. The app's login redirected correctly (Supabase Auth itself
-- doesn't touch these tables), but every very first PostgREST query after
-- that failed with 42501 "permission denied for table employees".
--
-- Root cause: Supabase's platform-level default privileges (confirmed live
-- via pg_default_acl) only auto-grant full CRUD to anon/authenticated/
-- service_role for tables *created by the supabase_admin role*. Every
-- table in this schema was created by `postgres` (every migration in this
-- project runs as postgres), whose own default ACL for this schema only
-- included REFERENCES/TRIGGER/TRUNCATE -- not SELECT/INSERT/UPDATE/DELETE.
-- This was never caught before because no prior session had a live
-- Supabase connection to actually run the full migration set against a
-- truly fresh project and then log in -- every previous round of "live
-- testing" mentioned in this project's history must have run against a
-- project where these grants already existed some other way.
--
-- Fixed two ways: (1) grant the missing privileges on every existing
-- table now; (2) set this project's default privileges for future
-- `postgres`-created tables to match, so no future migration needs to
-- repeat this. RLS remains the real access-control layer exactly as every
-- policy in this project already assumes -- this only restores the
-- coarser "is this operation even attemptable" gate PostgREST expects,
-- matching the same grant shape Supabase's own platform default already
-- applies automatically for supabase_admin-owned tables.

grant select, insert, update, delete on all tables in schema public to anon, authenticated, service_role;
grant usage, select on all sequences in schema public to anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  grant select, insert, update, delete on tables to anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  grant usage, select on sequences to anon, authenticated, service_role;

-- ============================================================
-- 0057_web_checkin.sql
-- ============================================================
-- Web check-in/out for Work From Home days. Employees already have a
-- 'web' source in attendance_punches (0006) and shifts are already
-- recomputed centrally by recompute_attendance_day() (0044-0046) -- this
-- migration wires a real employee-facing self-punch action into that
-- existing engine instead of adding a separate calculation path, per this
-- project's "centralized engine, no duplicate logic" convention.
--
-- Access is per-employee (not a single org-wide switch): HR/Admin turns
-- web_checkin_enabled on only for employees who are actually WFH-eligible,
-- toggled from the existing Employees admin screen the same way biometric
-- readers are enabled/disabled (0048's toggleable is_active pattern).
--
-- The action itself is further restricted to days already marked as an
-- approved WFH day (attendance.day_status = 'present' and
-- remarks = 'Work From Home', set by act_on_approval()'s onduty_request
-- branch, 0037) -- this is not a general-purpose self-punch button for
-- every day, only for WFH days, per the requested scope.

alter table public.employees
  add column web_checkin_enabled boolean not null default false;

-- ---------------------------------------------------------------------
-- recompute_attendance_day(): fix a guard that would silently swallow web
-- punches on a WFH day. The existing guard (0044-0046) skips recompute
-- entirely for a 'present'/'Work From Home' day whenever attendance.
-- check_in and check_out are both still null -- which was fine when WFH
-- days never had punches at all, but with web check-in now writing real
-- attendance_punches rows for exactly these days, that guard would fire on
-- the very first web punch (attendance.check_in is still null until this
-- function runs) and return before ever aggregating it, so the punch would
-- never show up as effective hours. Fixed by checking for the *existence*
-- of punch rows instead of the aggregated columns: an untouched WFH day
-- (no punches yet) still short-circuits and stays a clean override; a WFH
-- day with real web punches now falls through to the normal computation,
-- exactly like every other punch-tracked day. Full redeclare per this
-- project's convention (0044 -> 0045 -> 0046); only the guard changed.
create or replace function public.recompute_attendance_day(_employee_id uuid, _attendance_date date)
returns void
language plpgsql security definer set search_path = public as $
declare
  _org_id uuid;
  _shift_id uuid;
  _shift_start time;
  _shift_end time;
  _grace int;
  _half_day_hours numeric;
  _full_day_hours numeric;
  _shift_start_minutes int;
  _shift_end_minutes int;
  _min_break_minutes int := 10;
  _max_break_minutes int := 120;
  _break_paid boolean := false;
  _break_deduction_mode text := 'actual';
  _standard_break_minutes int := 60;
  _existing_status text;
  _existing_remarks text;
  _has_existing_punches boolean;
  _rec record;
  _open_in timestamptz;
  _first_in timestamptz;
  _last_out timestamptz;
  _prev_session_close timestamptz;
  _gap_minutes int;
  _measured_break_minutes int := 0;
  _has_excess_break boolean := false;
  _gross_minutes int := 0;
  _break_minutes int := 0;
  _effective_minutes int := 0;
  _payable_minutes int := 0;
  _missing_in boolean := false;
  _missing_out boolean := false;
  _has_any_punch boolean := false;
  _check_in_minutes int;
  _check_out_minutes int;
  _late_minutes int := 0;
  _early_going_minutes int := 0;
  _excess_stay_minutes int := 0;
  _shortfall_minutes int := 0;
  _half_day_minutes int;
  _full_day_minutes int;
  _day_status text;
begin
  select organization_id into _org_id from public.employees where id = _employee_id;
  if _org_id is null then
    return;
  end if;

  -- Never overwrite a day already claimed by an override status -- holiday/
  -- weekoff/leave/on_duty/permission always win over punches. An approved
  -- WFH/On-Duty day (day_status='present', remarks in ('Work From Home',
  -- 'On Duty')) also wins, but only while it has no real punches recorded
  -- yet -- once web check-in/out writes actual attendance_punches rows for
  -- that day, this falls through to the normal computation below so those
  -- punches actually count.
  select day_status, remarks
    into _existing_status, _existing_remarks
    from public.attendance where employee_id = _employee_id and attendance_date = _attendance_date;

  if _existing_status in ('leave', 'holiday', 'weekoff', 'on_duty', 'permission') then
    return;
  end if;
  if _existing_status = 'present' and _existing_remarks in ('Work From Home', 'On Duty') then
    select exists (
      select 1 from public.attendance_punches
      where employee_id = _employee_id and punch_date = _attendance_date
    ) into _has_existing_punches;
    if not _has_existing_punches then
      return;
    end if;
  end if;

  -- Resolve the employee's shift as of this date (same lookup as the old
  -- regularization branch / seed.sql). Falling back to the declared
  -- defaults above when no shift is resolvable.
  select shift_id into _shift_id from public.shift_assignments
    where employee_id = _employee_id and effective_from <= _attendance_date
    order by effective_from desc limit 1;

  if _shift_id is not null then
    select start_time, end_time, grace_minutes, half_day_hours, full_day_hours,
           min_break_minutes, max_break_minutes, break_paid, break_deduction_mode, standard_break_minutes
      into _shift_start, _shift_end, _grace, _half_day_hours, _full_day_hours,
           _min_break_minutes, _max_break_minutes, _break_paid, _break_deduction_mode, _standard_break_minutes
      from public.shifts where id = _shift_id;
    _shift_start_minutes := extract(hour from _shift_start)::int * 60 + extract(minute from _shift_start)::int;
    _shift_end_minutes := extract(hour from _shift_end)::int * 60 + extract(minute from _shift_end)::int;
    if _shift_end_minutes <= _shift_start_minutes then
      _shift_end_minutes := _shift_end_minutes + 1440; -- overnight shift
    end if;
  end if;

  -- Walk punches for this day in time order, pairing sequential in->out.
  -- `attendance_punches.punch_date` is always the shift's logical start day
  -- (the seed/regularization convention -- an overnight punch_time still
  -- rolls into the real next calendar day, but punch_date stays put), so no
  -- day+1 lookahead is needed; ordering by the real punch_time timestamptz
  -- keeps chronological order regardless.
  --
  -- A second consecutive 'in' before a matching 'out' is a duplicate --
  -- ignored, the earlier 'in' stays open. An 'out' with no open 'in' is an
  -- orphan/invalid-sequence punch -- ignored. The gap between two
  -- consecutive *closed* sessions is classified against the break policy
  -- (not blindly deducted): too short -> bridged (not deducted at all);
  -- otherwise -> a qualifying break, and flagged if it exceeds the maximum.
  for _rec in
    select punch_time, punch_type from public.attendance_punches
    where employee_id = _employee_id and punch_date = _attendance_date
    order by punch_time
  loop
    _has_any_punch := true;
    if _rec.punch_type = 'in' then
      if _first_in is null then
        _first_in := _rec.punch_time;
      end if;
      if _open_in is null then
        _open_in := _rec.punch_time;
      end if;
    else -- 'out'
      -- Track the latest 'out' seen regardless of whether it closes a valid
      -- pair, so an orphan out (no open 'in') still counts for missing_in
      -- detection and the "Last OUT" display.
      _last_out := _rec.punch_time;
      if _open_in is not null then
        if _prev_session_close is not null then
          _gap_minutes := round(extract(epoch from (_open_in - _prev_session_close)) / 60)::int;
          if _gap_minutes < _min_break_minutes then
            null; -- too short to be a formal break -- bridged, not deducted
          else
            _measured_break_minutes := _measured_break_minutes + _gap_minutes;
            if _gap_minutes > _max_break_minutes then
              _has_excess_break := true;
            end if;
          end if;
        end if;
        _prev_session_close := _rec.punch_time;
        _open_in := null;
      end if;
    end if;
  end loop;

  _missing_out := _open_in is not null;
  _missing_in := _first_in is null and _last_out is not null;

  -- Gross duration spans to the last punch that actually closed a session
  -- (_prev_session_close), not the raw last OUT seen -- see 0046's header
  -- comment for why.
  if _first_in is not null and _prev_session_close is not null then
    _gross_minutes := greatest(0, round(extract(epoch from (_prev_session_close - _first_in)) / 60)::int);
  end if;

  if _break_deduction_mode = 'standard' then
    _break_minutes := case when _measured_break_minutes > 0 then _standard_break_minutes else 0 end;
  else
    _break_minutes := _measured_break_minutes;
  end if;
  _effective_minutes := greatest(0, _gross_minutes - _break_minutes);
  _payable_minutes := case when _break_paid then _effective_minutes + _break_minutes else _effective_minutes end;

  _half_day_minutes := (coalesce(_half_day_hours, 4.5) * 60)::int;
  _full_day_minutes := (coalesce(_full_day_hours, 8) * 60)::int;

  if _first_in is not null and _shift_id is not null then
    _check_in_minutes := extract(hour from _first_in)::int * 60 + extract(minute from _first_in)::int;
    _late_minutes := greatest(0, _check_in_minutes - (_shift_start_minutes + coalesce(_grace, 0)));
  end if;
  if _last_out is not null and _shift_id is not null then
    _check_out_minutes := extract(hour from _last_out)::int * 60 + extract(minute from _last_out)::int;
    if _check_in_minutes is not null and _check_out_minutes < _check_in_minutes then
      _check_out_minutes := _check_out_minutes + 1440; -- rolled past midnight
    end if;
    _early_going_minutes := greatest(0, _shift_end_minutes - _check_out_minutes);
  end if;

  -- Shortfall/Excess Stay compare against payable minutes, not raw worked
  -- minutes -- a paid break still counts toward satisfying required hours.
  _shortfall_minutes := greatest(0, _full_day_minutes - _payable_minutes);
  _excess_stay_minutes := greatest(0, _payable_minutes - _full_day_minutes);

  if not _has_any_punch then
    _day_status := 'absent';
  elsif _effective_minutes >= _half_day_minutes then
    _day_status := 'present';
  else
    -- Any real punch activity that isn't (yet) a complete, full-day pair --
    -- including an unmatched open 'in' with zero effective minutes -- stays
    -- visible to get_missing_attendance() (which only reports
    -- present/half_day rows), rather than disappearing into 'absent'.
    _day_status := 'half_day';
  end if;

  insert into public.attendance (
    organization_id, employee_id, attendance_date, shift_id, check_in, check_out,
    gross_minutes, break_minutes, effective_minutes, payable_minutes, has_excess_break,
    late_minutes, early_going_minutes, excess_stay_minutes, shortfall_minutes,
    missing_in, missing_out, day_status, validation_status
  ) values (
    _org_id, _employee_id, _attendance_date, _shift_id, _first_in, _last_out,
    _gross_minutes, _break_minutes, _effective_minutes, _payable_minutes, _has_excess_break,
    _late_minutes, _early_going_minutes, _excess_stay_minutes, _shortfall_minutes,
    _missing_in, _missing_out, _day_status, 'completed'
  )
  on conflict (employee_id, attendance_date) do update set
    shift_id = excluded.shift_id,
    check_in = excluded.check_in,
    check_out = excluded.check_out,
    gross_minutes = excluded.gross_minutes,
    break_minutes = excluded.break_minutes,
    effective_minutes = excluded.effective_minutes,
    payable_minutes = excluded.payable_minutes,
    has_excess_break = excluded.has_excess_break,
    late_minutes = excluded.late_minutes,
    early_going_minutes = excluded.early_going_minutes,
    excess_stay_minutes = excluded.excess_stay_minutes,
    shortfall_minutes = excluded.shortfall_minutes,
    missing_in = excluded.missing_in,
    missing_out = excluded.missing_out,
    day_status = excluded.day_status,
    validation_status = 'completed';
end;
$;

grant execute on function public.recompute_attendance_day(uuid, date) to authenticated;

-- ---------------------------------------------------------------------
-- Read side: everything the dashboard widget needs in one round trip --
-- whether this employee has web check-in access, whether today is an
-- approved WFH day, and their current punch state for today (so the UI
-- can show "Check In" vs "Check Out" and today's running effective time).
create or replace function public.get_web_checkin_status()
returns table (
  web_checkin_enabled boolean,
  is_wfh_today boolean,
  attendance_date date,
  last_punch_type text,
  last_punch_time timestamptz,
  effective_minutes int
)
language plpgsql stable security definer set search_path = public as $
declare
  _employee_id uuid := public.current_employee_id();
  _today date := current_date;
begin
  if _employee_id is null then
    raise exception 'get_web_checkin_status: no employee linked to the current user';
  end if;

  return query
  select
    e.web_checkin_enabled,
    coalesce(a.day_status = 'present' and a.remarks = 'Work From Home', false),
    _today,
    lp.punch_type,
    lp.punch_time,
    coalesce(a.effective_minutes, 0)
  from public.employees e
  left join public.attendance a on a.employee_id = e.id and a.attendance_date = _today
  left join lateral (
    select punch_type, punch_time from public.attendance_punches
    where employee_id = e.id and punch_date = _today
    order by punch_time desc limit 1
  ) lp on true
  where e.id = _employee_id;
end;
$;

grant execute on function public.get_web_checkin_status() to authenticated;

-- ---------------------------------------------------------------------
-- Write side: the actual self check-in/out action. Re-validates access and
-- WFH-day eligibility server-side (the client-side check mirrors this only
-- for instant button state, never as the real gate) and enforces a strict
-- in/out alternation from the last punch of the day, then delegates to
-- recompute_attendance_day() -- this function never touches attendance
-- columns directly.
create or replace function public.web_checkin_punch(_punch_type text)
returns void
language plpgsql security definer set search_path = public as $
declare
  _employee_id uuid := public.current_employee_id();
  _org_id uuid;
  _today date := current_date;
  _enabled boolean;
  _is_wfh boolean;
  _last_type text;
begin
  if _employee_id is null then
    raise exception 'web_checkin_punch: no employee linked to the current user';
  end if;
  if _punch_type not in ('in', 'out') then
    raise exception 'web_checkin_punch: _punch_type must be ''in'' or ''out''';
  end if;

  select organization_id, web_checkin_enabled into _org_id, _enabled
    from public.employees where id = _employee_id;

  if not coalesce(_enabled, false) then
    raise exception 'Web check-in is not enabled for your account. Contact HR.';
  end if;

  select coalesce(day_status = 'present' and remarks = 'Work From Home', false) into _is_wfh
    from public.attendance where employee_id = _employee_id and attendance_date = _today;

  if not coalesce(_is_wfh, false) then
    raise exception 'Web check-in/out is only available on an approved Work From Home day.';
  end if;

  select punch_type into _last_type from public.attendance_punches
    where employee_id = _employee_id and punch_date = _today
    order by punch_time desc limit 1;

  if _punch_type = 'in' and _last_type = 'in' then
    raise exception 'You are already checked in.';
  end if;
  if _punch_type = 'out' and (_last_type is null or _last_type = 'out') then
    raise exception 'You need to check in before checking out.';
  end if;

  insert into public.attendance_punches (organization_id, employee_id, punch_date, punch_time, punch_type, source)
  values (_org_id, _employee_id, _today, now(), _punch_type, 'web');

  perform public.recompute_attendance_day(_employee_id, _today);
end;
$;

grant execute on function public.web_checkin_punch(text) to authenticated;

-- ============================================================
-- 0058_fix_web_checkin_wfh_eligibility.sql
-- ============================================================
-- Real bug found live-testing 0057's web check-in feature for the first
-- time: get_web_checkin_status() and web_checkin_punch() both gated WFH-day
-- eligibility on `day_status = 'present' and remarks = 'Work From Home'`.
-- That combination breaks the instant an employee actually checks in --
-- recompute_attendance_day() correctly reclassifies the day as 'half_day'
-- while effective minutes are still below the half-day threshold (exactly
-- as it does for every other employee), but remarks stays 'Work From Home'
-- untouched (recompute never writes that column). So the very next call --
-- checking back in to look at status, or checking out later -- saw
-- day_status='half_day' and reported "not an approved WFH day", locking the
-- employee out of ever checking out again for the rest of the day.
--
-- Fixed by dropping the day_status requirement: remarks = 'Work From Home'
-- alone is the stable, authoritative WFH-day tag (set once by
-- act_on_approval()'s onduty_request branch, 0037, never touched by
-- recompute_attendance_day() after that) -- day_status is allowed to move
-- between 'present' and 'half_day' around it as real hours accumulate,
-- same as it already does for every punch-tracked employee.

create or replace function public.get_web_checkin_status()
returns table (
  web_checkin_enabled boolean,
  is_wfh_today boolean,
  attendance_date date,
  last_punch_type text,
  last_punch_time timestamptz,
  effective_minutes int
)
language plpgsql stable security definer set search_path = public as $
declare
  _employee_id uuid := public.current_employee_id();
  _today date := current_date;
begin
  if _employee_id is null then
    raise exception 'get_web_checkin_status: no employee linked to the current user';
  end if;

  return query
  select
    e.web_checkin_enabled,
    coalesce(a.remarks = 'Work From Home', false),
    _today,
    lp.punch_type,
    lp.punch_time,
    coalesce(a.effective_minutes, 0)
  from public.employees e
  left join public.attendance a on a.employee_id = e.id and a.attendance_date = _today
  left join lateral (
    select punch_type, punch_time from public.attendance_punches
    where employee_id = e.id and punch_date = _today
    order by punch_time desc limit 1
  ) lp on true
  where e.id = _employee_id;
end;
$;

grant execute on function public.get_web_checkin_status() to authenticated;

create or replace function public.web_checkin_punch(_punch_type text)
returns void
language plpgsql security definer set search_path = public as $
declare
  _employee_id uuid := public.current_employee_id();
  _org_id uuid;
  _today date := current_date;
  _enabled boolean;
  _is_wfh boolean;
  _last_type text;
begin
  if _employee_id is null then
    raise exception 'web_checkin_punch: no employee linked to the current user';
  end if;
  if _punch_type not in ('in', 'out') then
    raise exception 'web_checkin_punch: _punch_type must be ''in'' or ''out''';
  end if;

  select organization_id, web_checkin_enabled into _org_id, _enabled
    from public.employees where id = _employee_id;

  if not coalesce(_enabled, false) then
    raise exception 'Web check-in is not enabled for your account. Contact HR.';
  end if;

  select coalesce(remarks = 'Work From Home', false) into _is_wfh
    from public.attendance where employee_id = _employee_id and attendance_date = _today;

  if not coalesce(_is_wfh, false) then
    raise exception 'Web check-in/out is only available on an approved Work From Home day.';
  end if;

  select punch_type into _last_type from public.attendance_punches
    where employee_id = _employee_id and punch_date = _today
    order by punch_time desc limit 1;

  if _punch_type = 'in' and _last_type = 'in' then
    raise exception 'You are already checked in.';
  end if;
  if _punch_type = 'out' and (_last_type is null or _last_type = 'out') then
    raise exception 'You need to check in before checking out.';
  end if;

  insert into public.attendance_punches (organization_id, employee_id, punch_date, punch_time, punch_type, source)
  values (_org_id, _employee_id, _today, now(), _punch_type, 'web');

  perform public.recompute_attendance_day(_employee_id, _today);
end;
$;

grant execute on function public.web_checkin_punch(text) to authenticated;

-- ============================================================
-- seed/seed.sql
-- ============================================================
-- Demo reference + organization data for local development.
-- Run after all migrations: `supabase db reset` (applies migrations then this file
-- automatically), or `psql ... -f supabase/seed/seed.sql` directly.
--
-- Employee rows are created with user_id = NULL. To let a real person log
-- in as one of them: create a Supabase Auth user (dashboard, or
-- `supabase.auth.admin.createUser`), then
--   update public.employees set user_id = '<auth-user-uuid>' where employee_code = 'EMP0001';
--   insert into public.profiles (id, organization_id, email) values ('<auth-user-uuid>', '11111111-1111-1111-1111-111111111111', '<email>');
--   insert into public.user_roles (user_id, role_id, organization_id)
--     select '<auth-user-uuid>', id, '11111111-1111-1111-1111-111111111111' from public.roles where code = 'employee';
-- No real personal data appears below — names/emails are fictitious placeholders.

begin;

insert into public.organizations (id, name, short_code, timezone) values
  ('11111111-1111-1111-1111-111111111111', 'Demo Organization Pvt Ltd', 'DEMOORG', 'Asia/Kolkata');

insert into public.locations (id, organization_id, name, city, state) values
  ('11111111-1111-1111-1111-100000000001', '11111111-1111-1111-1111-111111111111', 'Chennai', 'Chennai', 'Tamil Nadu'),
  ('11111111-1111-1111-1111-100000000002', '11111111-1111-1111-1111-111111111111', 'Bengaluru', 'Bengaluru', 'Karnataka'),
  ('11111111-1111-1111-1111-100000000003', '11111111-1111-1111-1111-111111111111', 'Hyderabad', 'Hyderabad', 'Telangana');

insert into public.departments (id, organization_id, name, code) values
  ('11111111-1111-1111-1111-200000000001', '11111111-1111-1111-1111-111111111111', 'Software', 'SW'),
  ('11111111-1111-1111-1111-200000000002', '11111111-1111-1111-1111-111111111111', 'Human Resources', 'HR'),
  ('11111111-1111-1111-1111-200000000003', '11111111-1111-1111-1111-111111111111', 'Finance', 'FIN'),
  ('11111111-1111-1111-1111-200000000004', '11111111-1111-1111-1111-111111111111', 'Sales', 'SAL'),
  ('11111111-1111-1111-1111-200000000005', '11111111-1111-1111-1111-111111111111', 'Leadership', 'LDR');

insert into public.designations (id, organization_id, name) values
  ('11111111-1111-1111-1111-300000000001', '11111111-1111-1111-1111-111111111111', 'Software Engineer'),
  ('11111111-1111-1111-1111-300000000002', '11111111-1111-1111-1111-111111111111', 'Senior Software Engineer'),
  ('11111111-1111-1111-1111-300000000003', '11111111-1111-1111-1111-111111111111', 'Engineering Manager'),
  ('11111111-1111-1111-1111-300000000004', '11111111-1111-1111-1111-111111111111', 'HR Administrator'),
  ('11111111-1111-1111-1111-300000000005', '11111111-1111-1111-1111-111111111111', 'Finance Analyst'),
  ('11111111-1111-1111-1111-300000000006', '11111111-1111-1111-1111-111111111111', 'Sales Executive'),
  ('11111111-1111-1111-1111-300000000007', '11111111-1111-1111-1111-111111111111', 'VP Engineering');

insert into public.grades (id, organization_id, name, rank) values
  ('11111111-1111-1111-1111-400000000001', '11111111-1111-1111-1111-111111111111', 'G2', 2),
  ('11111111-1111-1111-1111-400000000002', '11111111-1111-1111-1111-111111111111', 'G4', 4),
  ('11111111-1111-1111-1111-400000000003', '11111111-1111-1111-1111-111111111111', 'G5', 5),
  ('11111111-1111-1111-1111-400000000004', '11111111-1111-1111-1111-111111111111', 'G6', 6),
  ('11111111-1111-1111-1111-400000000005', '11111111-1111-1111-1111-111111111111', 'G8', 8);

insert into public.shifts (id, organization_id, name, start_time, end_time, grace_minutes) values
  ('11111111-1111-1111-1111-500000000001', '11111111-1111-1111-1111-111111111111', 'General Shift', '09:30', '18:30', 15),
  ('11111111-1111-1111-1111-500000000002', '11111111-1111-1111-1111-111111111111', 'Morning Shift', '07:00', '16:00', 10),
  ('11111111-1111-1111-1111-500000000003', '11111111-1111-1111-1111-111111111111', 'Night Shift', '22:00', '07:00', 10);

insert into public.leave_types (id, organization_id, code, name, is_paid, accrual_frequency) values
  ('11111111-1111-1111-1111-600000000001', '11111111-1111-1111-1111-111111111111', 'CL', 'Casual Leave', true, 'monthly'),
  ('11111111-1111-1111-1111-600000000002', '11111111-1111-1111-1111-111111111111', 'SL', 'Sick Leave', true, 'monthly'),
  ('11111111-1111-1111-1111-600000000003', '11111111-1111-1111-1111-111111111111', 'PL', 'Privilege Leave', true, 'yearly'),
  ('11111111-1111-1111-1111-600000000004', '11111111-1111-1111-1111-111111111111', 'EL', 'Earned Leave', true, 'yearly'),
  ('11111111-1111-1111-1111-600000000005', '11111111-1111-1111-1111-111111111111', 'LOP', 'Loss of Pay', false, 'none'),
  ('11111111-1111-1111-1111-600000000006', '11111111-1111-1111-1111-111111111111', 'ML', 'Maternity Leave', true, 'none'),
  ('11111111-1111-1111-1111-600000000007', '11111111-1111-1111-1111-111111111111', 'PTL', 'Paternity Leave', true, 'none'),
  ('11111111-1111-1111-1111-600000000008', '11111111-1111-1111-1111-111111111111', 'SPL', 'Special Leave', true, 'none');

-- Holidays: current + next year, generated dynamically so the seed never goes stale.
insert into public.holidays (organization_id, holiday_date, name, holiday_type)
select '11111111-1111-1111-1111-111111111111', d, name, 'public' from (values
  (make_date(extract(year from now())::int, 1, 26), 'Republic Day'),
  (make_date(extract(year from now())::int, 8, 15), 'Independence Day'),
  (make_date(extract(year from now())::int, 10, 2), 'Gandhi Jayanti'),
  (make_date(extract(year from now())::int, 12, 25), 'Christmas'),
  (make_date(extract(year from now())::int + 1, 1, 26), 'Republic Day'),
  (make_date(extract(year from now())::int + 1, 8, 15), 'Independence Day')
) as h(d, name);

-- Employees. Reporting chain: EMP0004 (VP) -> EMP0002 (Eng Manager) -> EMP0001.
-- EMP0003 (HR Admin) reports directly to EMP0004.
insert into public.employees (
  id, organization_id, employee_code, first_name, last_name, gender, date_of_joining,
  official_email, official_mobile, department_id, designation_id, location_id, grade_id,
  reporting_manager_id, employment_type, employment_status
) values
  ('11111111-1111-1111-1111-700000000004', '11111111-1111-1111-1111-111111111111', 'EMP0004', 'Karthik', 'Subramanian', 'male', '2015-01-15',
   'karthik.s@example.com', '9800000004', '11111111-1111-1111-1111-200000000005', '11111111-1111-1111-1111-300000000007',
   '11111111-1111-1111-1111-100000000002', '11111111-1111-1111-1111-400000000005', null, 'full_time', 'active'),
  ('11111111-1111-1111-1111-700000000002', '11111111-1111-1111-1111-111111111111', 'EMP0002', 'Priya', 'Nandakumar', 'female', '2018-03-12',
   'priya.n@example.com', '9800000002', '11111111-1111-1111-1111-200000000001', '11111111-1111-1111-1111-300000000003',
   '11111111-1111-1111-1111-100000000001', '11111111-1111-1111-1111-400000000004', '11111111-1111-1111-1111-700000000004', 'full_time', 'active'),
  ('11111111-1111-1111-1111-700000000003', '11111111-1111-1111-1111-111111111111', 'EMP0003', 'Divya', 'Krishnan', 'female', '2019-07-01',
   'divya.k@example.com', '9800000003', '11111111-1111-1111-1111-200000000002', '11111111-1111-1111-1111-300000000004',
   '11111111-1111-1111-1111-100000000002', '11111111-1111-1111-1111-400000000003', '11111111-1111-1111-1111-700000000004', 'full_time', 'active'),
  ('11111111-1111-1111-1111-700000000001', '11111111-1111-1111-1111-111111111111', 'EMP0001', 'Arjun', 'Rao', 'male', '2021-05-26',
   'arjun.rao@example.com', '9800000001', '11111111-1111-1111-1111-200000000001', '11111111-1111-1111-1111-300000000002',
   '11111111-1111-1111-1111-100000000001', '11111111-1111-1111-1111-400000000002', '11111111-1111-1111-1111-700000000002', 'full_time', 'active'),
  ('11111111-1111-1111-1111-700000000005', '11111111-1111-1111-1111-111111111111', 'EMP0005', 'Meena', 'Iyer', 'female', '2022-02-14',
   'meena.i@example.com', '9800000005', '11111111-1111-1111-1111-200000000001', '11111111-1111-1111-1111-300000000001',
   '11111111-1111-1111-1111-100000000001', '11111111-1111-1111-1111-400000000001', '11111111-1111-1111-1111-700000000002', 'full_time', 'active'),
  ('11111111-1111-1111-1111-700000000006', '11111111-1111-1111-1111-111111111111', 'EMP0006', 'Rahul', 'Verma', 'male', '2020-09-01',
   'rahul.v@example.com', '9800000006', '11111111-1111-1111-1111-200000000001', '11111111-1111-1111-1111-300000000002',
   '11111111-1111-1111-1111-100000000001', '11111111-1111-1111-1111-400000000002', '11111111-1111-1111-1111-700000000002', 'full_time', 'active'),
  ('11111111-1111-1111-1111-700000000007', '11111111-1111-1111-1111-111111111111', 'EMP0007', 'Sneha', 'Reddy', 'female', '2021-11-08',
   'sneha.r@example.com', '9800000007', '11111111-1111-1111-1111-200000000003', '11111111-1111-1111-1111-300000000005',
   '11111111-1111-1111-1111-100000000003', '11111111-1111-1111-1111-400000000001', '11111111-1111-1111-1111-700000000004', 'full_time', 'active'),
  ('11111111-1111-1111-1111-700000000008', '11111111-1111-1111-1111-111111111111', 'EMP0008', 'Vikram', 'Nair', 'male', '2023-01-20',
   'vikram.n@example.com', '9800000008', '11111111-1111-1111-1111-200000000004', '11111111-1111-1111-1111-300000000006',
   '11111111-1111-1111-1111-100000000002', '11111111-1111-1111-1111-400000000001', '11111111-1111-1111-1111-700000000004', 'full_time', 'active'),
  ('11111111-1111-1111-1111-700000000009', '11111111-1111-1111-1111-111111111111', 'EMP0009', 'Anita', 'Das', 'female', '2022-06-06',
   'anita.d@example.com', '9800000009', '11111111-1111-1111-1111-200000000004', '11111111-1111-1111-1111-300000000006',
   '11111111-1111-1111-1111-100000000003', '11111111-1111-1111-1111-400000000001', '11111111-1111-1111-1111-700000000004', 'full_time', 'active'),
  ('11111111-1111-1111-1111-700000000010', '11111111-1111-1111-1111-111111111111', 'EMP0010', 'Suresh', 'Pillai', 'male', '2023-08-15',
   'suresh.p@example.com', '9800000010', '11111111-1111-1111-1111-200000000003', '11111111-1111-1111-1111-300000000005',
   '11111111-1111-1111-1111-100000000001', '11111111-1111-1111-1111-400000000001', '11111111-1111-1111-1111-700000000004', 'full_time', 'active');

insert into public.employee_profiles (employee_id, marital_status, nationality, personal_email, city, state, country)
select id, 'single', 'Indian', lower(employee_code) || '.personal@example.com', 'Chennai', 'Tamil Nadu', 'India'
from public.employees where organization_id = '11111111-1111-1111-1111-111111111111';

insert into public.shift_assignments (employee_id, shift_id, effective_from)
select id, '11111111-1111-1111-1111-500000000001', date_of_joining
from public.employees where organization_id = '11111111-1111-1111-1111-111111111111';

-- EMP0006 actually works Night Shift -- override the blanket General Shift
-- assignment above so recompute_attendance_day() (and every other
-- shift_assignments-based lookup, e.g. get_missing_attendance()) resolves
-- the shift this employee's overnight demo data below is generated against.
insert into public.shift_assignments (employee_id, shift_id, effective_from)
values ('11111111-1111-1111-1111-700000000006', '11111111-1111-1111-1111-500000000003', current_date - 90);

-- Opening leave balances for the current year, per employee per leave type.
-- Yearly/none-accrual types (PL, EL, LOP, ML, PTL, SPL) get one annual row.
-- Monthly-accrual types (CL, SL) get 12 monthly rows instead — matches the
-- reference app's Balance screen exactly, which shows a full year of
-- individual monthly opening/used/balance rows for Casual Leave/Sick Leave
-- when expanded, not one flat annual row (see 0042_monthly_leave_balance_periods.sql).
insert into public.leave_balances (employee_id, leave_type_id, period_start, period_end, opening, credited, used, balance)
select
  e.id,
  lt.id,
  make_date(extract(year from now())::int, 1, 1),
  make_date(extract(year from now())::int, 12, 31),
  case lt.code when 'PL' then 18 when 'EL' then 12 else 0 end,
  0, 0,
  case lt.code when 'PL' then 18 when 'EL' then 12 else 0 end
from public.employees e
cross join public.leave_types lt
where e.organization_id = '11111111-1111-1111-1111-111111111111'
  and lt.organization_id = '11111111-1111-1111-1111-111111111111'
  and lt.accrual_frequency <> 'monthly';

insert into public.leave_balances (employee_id, leave_type_id, period_start, period_end, opening, credited, used, balance)
select
  e.id,
  lt.id,
  make_date(extract(year from now())::int, months.m, 1),
  (make_date(extract(year from now())::int, months.m, 1) + interval '1 month - 1 day')::date,
  1, 0, 0, 1
from public.employees e
cross join public.leave_types lt
cross join generate_series(1, 12) as months(m)
where e.organization_id = '11111111-1111-1111-1111-111111111111'
  and lt.organization_id = '11111111-1111-1111-1111-111111111111'
  and lt.accrual_frequency = 'monthly';

-- Default single-step (reporting manager) approval workflows for the three
-- request types the Attendance module raises. HR/admin can always act too
-- via is_hr_or_admin() in act_on_approval(), independent of workflow steps.
insert into public.approval_workflows (id, organization_id, request_type, name, is_active) values
  ('11111111-1111-1111-1111-800000000001', '11111111-1111-1111-1111-111111111111', 'leave_request', 'Leave Approval', true),
  ('11111111-1111-1111-1111-800000000002', '11111111-1111-1111-1111-111111111111', 'permission_request', 'Permission Approval', true),
  ('11111111-1111-1111-1111-800000000003', '11111111-1111-1111-1111-111111111111', 'attendance_regularization', 'Regularization Approval', true);

insert into public.approval_steps (workflow_id, step_order, approver_type, is_final) values
  ('11111111-1111-1111-1111-800000000001', 1, 'reporting_manager', true),
  ('11111111-1111-1111-1111-800000000002', 1, 'reporting_manager', true),
  ('11111111-1111-1111-1111-800000000003', 1, 'reporting_manager', true);

-- Default active email template per template_key (0047), so the Email
-- Templates admin screen has real, previewable/test-sendable content out
-- of the box instead of an empty list.
-- E'...' escape-string syntax is required for \n to actually become a
-- newline -- a plain '...' string treats backslash literally (confirmed
-- live: the Email Templates preview rendered a literal "\n\n" instead of a
-- line break with plain-quoted strings).
insert into public.email_templates (organization_id, template_key, name, subject, body, is_active) values
  ('11111111-1111-1111-1111-111111111111', 'approval_request', 'Approval Request (default)',
   'Approval needed: {{request_type}} from {{employee_name}}',
   E'Hi {{manager_name}},\n\n{{employee_name}} ({{employee_id}}) has requested {{request_type}} from {{from_date}} to {{to_date}} ({{duration}}).\n\nReason: {{reason}}\n\nApplication ID: {{application_id}}\nReview: {{approval_url}}',
   true),
  ('11111111-1111-1111-1111-111111111111', 'approval_approved', 'Approval Approved (default)',
   'Your {{request_type}} request has been approved',
   E'Hi {{employee_name}},\n\nYour {{request_type}} request ({{application_id}}) from {{from_date}} to {{to_date}} ({{duration}}) has been approved by {{manager_name}}.\n\nRemarks: {{remarks}}',
   true),
  ('11111111-1111-1111-1111-111111111111', 'approval_rejected', 'Approval Rejected (default)',
   'Your {{request_type}} request has been rejected',
   E'Hi {{employee_name}},\n\nYour {{request_type}} request ({{application_id}}) from {{from_date}} to {{to_date}} ({{duration}}) has been rejected by {{manager_name}}.\n\nRemarks: {{remarks}}',
   true),
  ('11111111-1111-1111-1111-111111111111', 'missing_punch', 'Missing Punch (default)',
   'Missing attendance punch for {{employee_name}} on {{from_date}}',
   E'Hi {{manager_name}},\n\n{{employee_name}} ({{employee_id}}) has a missing punch on {{from_date}}. Status: {{status}}.',
   true),
  ('11111111-1111-1111-1111-111111111111', 'early_going', 'Early Going (default)',
   'Early going recorded for {{employee_name}} on {{from_date}}',
   E'Hi {{manager_name}},\n\n{{employee_name}} ({{employee_id}}) left early on {{from_date}}. Remarks: {{remarks}}',
   true),
  ('11111111-1111-1111-1111-111111111111', 'wfh_weekly_alert', 'WFH Weekly Alert (default)',
   'WFH threshold exceeded for {{employee_name}}',
   E'Hi {{manager_name}},\n\n{{employee_name}} ({{employee_id}}) has taken WFH for {{duration}} this week ({{from_date}} to {{to_date}}), above the configured threshold.',
   true),
  ('11111111-1111-1111-1111-111111111111', 'comp_off_expiry', 'Comp-Off Expiry (default)',
   'Your Comp-Off credit is expiring soon',
   E'Hi {{employee_name}},\n\nYour Comp-Off earned on {{from_date}} will expire on {{to_date}} if unused. Remarks: {{remarks}}',
   true),
  ('11111111-1111-1111-1111-111111111111', 'attendance_closure_reminder', 'Attendance Closure Reminder (default)',
   'Attendance closure approaching for {{from_date}} to {{to_date}}',
   E'Hi {{employee_name}},\n\nThe attendance period {{from_date}} to {{to_date}} closes soon. Please resolve any pending attendance issues before then.',
   true),
  ('11111111-1111-1111-1111-111111111111', 'reconciliation_alert', 'Reconciliation Alert (default)',
   'Attendance reconciliation mismatch for {{employee_name}} on {{from_date}}',
   E'Hi {{manager_name}},\n\nA reconciliation mismatch was found for {{employee_name}} ({{employee_id}}) on {{from_date}}. Status: {{status}}. Remarks: {{remarks}}',
   true),
  ('11111111-1111-1111-1111-111111111111', 'system_notification', 'System Notification (default)',
   '{{request_type}}',
   E'Hi {{employee_name}},\n\n{{remarks}}',
   true);

-- Attendance history: last ~60 days for every seeded employee. Weekoffs and
-- holidays are marked from the rows inserted above; everything else is
-- randomized punches around each employee's actual assigned shift (General
-- Shift for most; Night Shift 22:00-07:00 for EMP0006, giving a real example
-- of the "10 PM -> 6 AM is 8 hours, not negative" overnight rule), fed
-- through attendance_punches + recompute_attendance_day() -- the same
-- multi-session engine every other punch source uses -- instead of writing
-- attendance's metric columns directly. A majority of days get a lunch-break
-- split into two sessions rather than a single in/out pair, so the demo data
-- itself exercises the "sum of sessions, not first-in to final-out" rule
-- (src/lib/attendanceCalc.ts's computeSessionsFromPunches mirrors this).
do $$
declare
  emp record;
  d date;
  is_weekoff boolean;
  holiday_name text;
  roll numeric;
  emp_shift_id uuid;
  shift_start time;
  shift_end time;
  shift_start_minutes int;
  shift_end_minutes int; -- normalized so it's always > shift_start_minutes, even overnight
  first_in_minutes int;
  last_out_minutes int;
  lunch_out_minutes int;
  lunch_in_minutes int;
  has_lunch_break boolean;
  today constant date := current_date;
  start_date date := current_date - 60;
  org_id constant uuid := '11111111-1111-1111-1111-111111111111';
begin
  for emp in select id from public.employees where organization_id = org_id loop
    select sa.shift_id, s.start_time, s.end_time into emp_shift_id, shift_start, shift_end
      from public.shift_assignments sa
      join public.shifts s on s.id = sa.shift_id
      where sa.employee_id = emp.id and sa.effective_from <= today
      order by sa.effective_from desc limit 1;

    continue when emp_shift_id is null; -- no shift assigned -- nothing to seed

    shift_start_minutes := extract(hour from shift_start)::int * 60 + extract(minute from shift_start)::int;
    shift_end_minutes := extract(hour from shift_end)::int * 60 + extract(minute from shift_end)::int;
    if shift_end_minutes <= shift_start_minutes then
      shift_end_minutes := shift_end_minutes + 1440; -- overnight shift
    end if;

    d := start_date;
    while d <= today loop
      is_weekoff := extract(dow from d) in (0, 6);
      select name into holiday_name from public.holidays where organization_id = org_id and holiday_date = d;

      if is_weekoff then
        insert into public.attendance (organization_id, employee_id, attendance_date, shift_id, day_status, validation_status)
        values (org_id, emp.id, d, emp_shift_id, 'weekoff', 'completed')
        on conflict (employee_id, attendance_date) do nothing;
      elsif holiday_name is not null then
        insert into public.attendance (organization_id, employee_id, attendance_date, shift_id, day_status, validation_status, remarks)
        values (org_id, emp.id, d, emp_shift_id, 'holiday', 'completed', holiday_name)
        on conflict (employee_id, attendance_date) do nothing;
      else
        delete from public.attendance_punches where employee_id = emp.id and punch_date = d;

        roll := random();
        if roll >= 0.04 then
          first_in_minutes := round(shift_start_minutes - 10 + random() * 95)::int; -- up to slightly early, or up to ~85 min late
          last_out_minutes := round(shift_end_minutes - 30 + random() * 160)::int; -- around shift end, sometimes well past it
          has_lunch_break := random() < 0.6 and (last_out_minutes - first_in_minutes) > 180;

          if has_lunch_break then
            lunch_out_minutes := round((first_in_minutes + last_out_minutes) / 2.0 - 30)::int;
            lunch_in_minutes := lunch_out_minutes + 15 + round(random() * 45)::int; -- 15-60 min break

            insert into public.attendance_punches (organization_id, employee_id, punch_date, punch_time, punch_type, device, location, source)
            values
              (org_id, emp.id, d, d + (first_in_minutes || ' minutes')::interval, 'in',
               case when random() < 0.5 then 'Biometric-Gate1' else 'Biometric-Gate2' end, 'Chennai Office',
               case when random() < 0.85 then 'biometric' else 'mobile' end),
              (org_id, emp.id, d, d + (lunch_out_minutes || ' minutes')::interval, 'out',
               case when random() < 0.5 then 'Biometric-Gate1' else 'Biometric-Gate2' end, 'Chennai Office',
               case when random() < 0.85 then 'biometric' else 'mobile' end),
              (org_id, emp.id, d, d + (lunch_in_minutes || ' minutes')::interval, 'in',
               case when random() < 0.5 then 'Biometric-Gate1' else 'Biometric-Gate2' end, 'Chennai Office',
               case when random() < 0.85 then 'biometric' else 'mobile' end),
              (org_id, emp.id, d, d + (last_out_minutes || ' minutes')::interval, 'out',
               case when random() < 0.5 then 'Biometric-Gate1' else 'Biometric-Gate2' end, 'Chennai Office',
               case when random() < 0.85 then 'biometric' else 'mobile' end);
          else
            insert into public.attendance_punches (organization_id, employee_id, punch_date, punch_time, punch_type, device, location, source)
            values
              (org_id, emp.id, d, d + (first_in_minutes || ' minutes')::interval, 'in',
               case when random() < 0.5 then 'Biometric-Gate1' else 'Biometric-Gate2' end, 'Chennai Office',
               case when random() < 0.85 then 'biometric' else 'mobile' end),
              (org_id, emp.id, d, d + (last_out_minutes || ' minutes')::interval, 'out',
               case when random() < 0.5 then 'Biometric-Gate1' else 'Biometric-Gate2' end, 'Chennai Office',
               case when random() < 0.85 then 'biometric' else 'mobile' end);
          end if;
        end if;
        -- roll < 0.04: no punches inserted at all -- recompute_attendance_day
        -- below correctly derives day_status = 'absent' from zero punches.

        perform public.recompute_attendance_day(emp.id, d);
      end if;

      d := d + 1;
    end loop;
  end loop;
end $$;

-- Sample request history for EMP0001, so Event Request / Balance screens
-- have something to show on a fresh install.
insert into public.leave_requests (
  organization_id, employee_id, leave_type_id, reporting_manager_id, entry_by,
  from_date, to_date, duration_days, reason, status, approval_remarks, applied_on
)
select
  '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-700000000001',
  (select id from public.leave_types where organization_id = '11111111-1111-1111-1111-111111111111' and code = v.code),
  '11111111-1111-1111-1111-700000000002', '11111111-1111-1111-1111-700000000001',
  v.from_date::date, v.to_date::date, v.duration_days, v.reason, v.status, v.approval_remarks, v.applied_on::timestamptz
from (values
  ('SL', '2026-07-09', '2026-07-10', 2, 'Going to native for mother''s treatment', 'approved', null, '2026-07-06T11:53:00Z'),
  ('CL', '2026-06-11', '2026-06-12', 2, 'Going to native', 'approved', null, '2026-06-10T10:51:00Z'),
  ('SL', '2026-04-24', '2026-04-24', 1, 'Going to native', 'approved', null, '2026-04-22T16:09:00Z'),
  ('CL', '2026-03-30', '2026-03-31', 2, 'Grandmother death in native', 'approved', null, '2026-04-01T12:07:00Z'),
  ('PL', '2026-03-12', '2026-03-13', 2, 'Parents health issue', 'approved', null, '2026-03-12T15:39:00Z'),
  ('CL', '2026-08-20', '2026-08-20', 1, 'Personal work', 'pending', null, '2026-08-13T09:15:00Z'),
  ('SL', '2026-08-05', '2026-08-05', 1, 'Fever', 'rejected', 'Please regularize as WFH instead', '2026-08-04T08:30:00Z')
) as v(code, from_date, to_date, duration_days, reason, status, approval_remarks, applied_on);

-- The leave_balances rows above were inserted with a full opening balance
-- and used = 0 before any leave_requests existed; sync used/balance now
-- that the approved requests above exist, so a fresh install's Balance
-- screen isn't inconsistent with its own request history from day one.
-- (act_on_approval(), as of 0031, keeps this in sync for anything approved
-- through the app after seeding.) Grouped by each request's own from_date
-- against the matching period row (not just "today"'s period) — CL/SL now
-- have 12 monthly rows each, so a request from any month must land in that
-- month's row, not have every month's usage collapsed into whichever
-- period happens to contain the seed's run date.
update public.leave_balances lb
set used = lb.used + approved.total_days,
    balance = lb.balance - approved.total_days
from (
  select employee_id, leave_type_id, from_date, sum(duration_days) as total_days
  from public.leave_requests
  where status = 'approved'
  group by employee_id, leave_type_id, from_date
) as approved
where lb.employee_id = approved.employee_id
  and lb.leave_type_id = approved.leave_type_id
  and lb.period_start <= approved.from_date and lb.period_end >= approved.from_date;

insert into public.permission_requests (
  organization_id, employee_id, reporting_manager_id, entry_by,
  permission_date, from_time, to_time, duration_minutes, reason, status, approval_remarks, applied_on
)
select
  '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-700000000001',
  '11111111-1111-1111-1111-700000000002', '11111111-1111-1111-1111-700000000001',
  v.permission_date::date, v.from_time::time, v.to_time::time, v.duration_minutes, v.reason, v.status, v.approval_remarks, v.applied_on::timestamptz
from (values
  ('2026-06-10', '09:30', '11:00', 90, 'Going to native', 'approved', null, '2026-06-10T18:56:00Z'),
  ('2026-05-22', '09:30', '11:00', 90, 'Went to Bank', 'approved', null, '2026-05-22T18:49:00Z'),
  ('2026-05-09', '09:30', '11:00', 90, 'Going to native', 'rejected', 'Wrong date mentioned', '2026-05-09T20:28:00Z'),
  ('2026-05-08', '09:30', '11:00', 90, 'Going to native', 'approved', null, '2026-05-12T15:45:00Z'),
  ('2026-08-10', '10:00', '11:30', 90, 'Went to hospital', 'pending', null, '2026-08-09T09:03:00Z')
) as v(permission_date, from_time, to_time, duration_minutes, reason, status, approval_remarks, applied_on);

insert into public.attendance_regularizations (
  organization_id, employee_id, approver_id, attendance_date, regularization_type, reason, status, approval_remarks, applied_on
)
select
  '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-700000000001',
  case when v.status = 'pending' then null else '11111111-1111-1111-1111-700000000002'::uuid end,
  v.attendance_date::date, v.regularization_type, v.reason, v.status, v.approval_remarks, v.applied_on::timestamptz
from (values
  ('2026-03-11', 'missed_punch', 'Checkout time was not updated', 'approved', null, '2026-03-27T15:04:00Z'),
  ('2026-02-23', 'work_from_home', 'Work From Home', 'approved', null, '2026-02-27T12:38:00Z'),
  ('2026-01-14', 'work_from_home', 'Work from Home', 'approved', null, '2026-01-17T08:38:00Z'),
  ('2026-01-08', 'present_correction', 'Presented on that day', 'approved', null, '2025-12-31T17:18:00Z'),
  ('2026-07-25', 'missed_punch', 'Missed out punch', 'rejected', 'Need to check with security log', '2026-07-26T15:12:00Z'),
  ('2026-08-11', 'missed_punch', 'Forgot to punch in the morning', 'pending', null, '2026-08-12T09:20:00Z')
) as v(attendance_date, regularization_type, reason, status, approval_remarks, applied_on);

-- Reflect the approved leave above in EMP0001's balances.
update public.leave_balances b
set used = t.used_days, balance = b.opening - t.used_days
from (
  select lt.id as leave_type_id, sum(lr.duration_days) as used_days
  from public.leave_requests lr
  join public.leave_types lt on lt.id = lr.leave_type_id
  where lr.employee_id = '11111111-1111-1111-1111-700000000001' and lr.status = 'approved'
  group by lt.id
) t
where b.employee_id = '11111111-1111-1111-1111-700000000001' and b.leave_type_id = t.leave_type_id;

-- ============================================================
-- EIP module: document catalog, statutory/bank details, payslip
-- history, and EMP0001's academic/employment/family/asset records.
-- Note: employee_documents and policy_documents are intentionally NOT
-- seeded here — their file_path would point at nothing in Storage, and a
-- "Download" that 404s is worse than an honest empty state. Upload a real
-- file through the app (Documents Upload tab / Policies page) instead.
-- ============================================================

insert into public.documents (organization_id, code, name, is_required) values
  ('11111111-1111-1111-1111-111111111111', 'ID_PROOF', 'ID Proof', true),
  ('11111111-1111-1111-1111-111111111111', 'ADDRESS_PROOF', 'Address Proof', true),
  ('11111111-1111-1111-1111-111111111111', 'EDUCATION', 'Education', false),
  ('11111111-1111-1111-1111-111111111111', 'EXPERIENCE', 'Experience', false),
  ('11111111-1111-1111-1111-111111111111', 'PAN', 'PAN', true),
  ('11111111-1111-1111-1111-111111111111', 'BANK', 'Bank', true),
  ('11111111-1111-1111-1111-111111111111', 'OTHER', 'Other', false);

-- Statutory + bank details for every seeded employee (fictitious values —
-- masked at read time by get_my_statutory_details()/get_my_bank_details()).
with numbered_employees as (
  select e.id, e.first_name, e.last_name, row_number() over (order by e.employee_code) as rn
  from public.employees e
  where e.organization_id = '11111111-1111-1111-1111-111111111111'
)
insert into public.statutory_details (employee_id, pan_number, aadhaar_number, uan_number, pf_number, esi_number, tax_regime)
select
  id,
  'ABCPX' || lpad(rn::text, 4, '0') || 'F',
  lpad((200000000000 + rn * 111111)::text, 12, '0'),
  '100100' || lpad(rn::text, 4, '0'),
  'PF' || lpad(rn::text, 6, '0'),
  case when rn % 3 = 0 then 'ESI' || lpad(rn::text, 6, '0') else null end,
  case when rn % 2 = 0 then 'new' else 'old' end
from numbered_employees;

with numbered_employees as (
  select e.id, e.first_name, e.last_name, row_number() over (order by e.employee_code) as rn
  from public.employees e
  where e.organization_id = '11111111-1111-1111-1111-111111111111'
)
insert into public.bank_details (employee_id, bank_name, account_number, ifsc_code, branch, account_holder_name)
select
  id,
  (array['State Bank of India', 'HDFC Bank', 'ICICI Bank', 'Axis Bank', 'Kotak Mahindra Bank'])[1 + (rn % 5)],
  lpad((100000000000 + rn * 987654)::text, 14, '0'),
  (array['SBIN0001234', 'HDFC0000456', 'ICIC0000789', 'UTIB0001122', 'KKBK0003344'])[1 + (rn % 5)],
  'Main Branch',
  trim(first_name || ' ' || coalesce(last_name, ''))
from numbered_employees;

-- Six months of payslip history for every employee, scaled off grade rank.
do $$
declare
  emp record;
  m int;
  target_date date;
  monthly_gross numeric;
  basic numeric;
  hra numeric;
  allowances numeric;
  pf numeric;
  esi numeric;
  pt constant numeric := 200;
  tds numeric;
  gross numeric;
  total_ded numeric;
  net numeric;
  org_id constant uuid := '11111111-1111-1111-1111-111111111111';
begin
  for emp in
    select e.id, coalesce(g.rank, 2) as grade_rank
    from public.employees e
    left join public.grades g on g.id = e.grade_id
    where e.organization_id = org_id
  loop
    monthly_gross := 30000 + emp.grade_rank * 15000;
    basic := round(monthly_gross * 0.5, 2);
    hra := round(monthly_gross * 0.2, 2);
    allowances := round(monthly_gross * 0.3, 2);
    pf := round(basic * 0.12, 2);
    esi := 0;
    tds := round(monthly_gross * 0.05, 2);
    gross := basic + hra + allowances;
    total_ded := pf + esi + pt + tds;
    net := gross - total_ded;

    for m in 0..5 loop
      target_date := date_trunc('month', current_date) - (m || ' months')::interval;
      insert into public.payslips (
        employee_id, pay_period_month, pay_period_year,
        basic_pay, hra, other_allowances, gross_earnings,
        pf_employee_contribution, esi_employee_contribution, professional_tax, tds,
        total_deductions, net_pay
      ) values (
        emp.id, extract(month from target_date)::int, extract(year from target_date)::int,
        basic, hra, allowances, gross,
        pf, esi, pt, tds,
        total_ded, net
      )
      on conflict (employee_id, pay_period_year, pay_period_month) do nothing;
    end loop;
  end loop;
end $$;

-- Richer profile data for EMP0001 (the primary demo account) so every
-- profile tab has something real to show.
insert into public.family_members (employee_id, name, relationship, date_of_birth, gender, occupation, is_dependent, contact_number) values
  ('11111111-1111-1111-1111-700000000001', 'Kavya Rao', 'Spouse', '1993-04-12', 'female', 'Teacher', true, '9900011111'),
  ('11111111-1111-1111-1111-700000000001', 'Aditya Rao', 'Son', '2020-09-03', 'male', null, true, null);

insert into public.education_records (employee_id, qualification, specialization, institution, university, year_of_passing, score_type, score) values
  ('11111111-1111-1111-1111-700000000001', 'B.Tech', 'Computer Science', 'Anna University', 'Anna University', 2018, 'cgpa', 8.4),
  ('11111111-1111-1111-1111-700000000001', 'Higher Secondary', null, 'Chennai Public School', 'State Board', 2014, 'percentage', 91.2);

insert into public.previous_employment (employee_id, company_name, designation, start_date, end_date, total_experience_years, reason_for_leaving) values
  ('11111111-1111-1111-1111-700000000001', 'Infosys Ltd', 'Software Engineer', '2018-07-01', '2021-05-20', 2.9, 'Career growth');

insert into public.employee_assets (employee_id, asset_code, asset_type, asset_name, serial_number, issued_date, status) values
  ('11111111-1111-1111-1111-700000000001', 'AST-1001', 'Laptop', 'Dell Latitude 5420', 'DL5420-88213', '2021-05-26', 'assigned'),
  ('11111111-1111-1111-1111-700000000001', 'AST-1002', 'Access Card', 'Office ID Card', 'ID-70001', '2021-05-26', 'assigned');

insert into public.previous_employer_declarations (employee_id, financial_year, employer_name, income_earned, tds_deducted, pf_contribution, status) values
  ('11111111-1111-1111-1111-700000000001', '2021-22', 'Infosys Ltd', 450000, 12000, 21600, 'submitted');

-- ============================================================
-- Exit module: HR-configurable interview questionnaire (9 sections) and
-- two sample resignations — one withdrawn (EMP0001, so the primary demo
-- login shows real history without permanently looking "resigned"), one
-- HR-approved and mid-clearance (EMP0010, so the manager/HR-facing screens
-- have a real in-progress pipeline to review).
-- ============================================================

insert into public.exit_interview_questions (organization_id, category, question_text, response_type, display_order) values
  ('11111111-1111-1111-1111-111111111111', 'job_satisfaction', 'Overall, how satisfied were you with your job?', 'rating', 1),
  ('11111111-1111-1111-1111-111111111111', 'job_satisfaction', 'Did your role match what was described during hiring?', 'yes_no', 2),
  ('11111111-1111-1111-1111-111111111111', 'management', 'How would you rate your relationship with your manager?', 'rating', 1),
  ('11111111-1111-1111-1111-111111111111', 'management', 'What could your manager have done better?', 'text', 2),
  ('11111111-1111-1111-1111-111111111111', 'work_environment', 'How would you rate the overall work environment?', 'rating', 1),
  ('11111111-1111-1111-1111-111111111111', 'work_environment', 'Did you feel safe and comfortable at work?', 'yes_no', 2),
  ('11111111-1111-1111-1111-111111111111', 'compensation', 'How satisfied were you with your salary and benefits?', 'rating', 1),
  ('11111111-1111-1111-1111-111111111111', 'compensation', 'Was your compensation competitive with the market?', 'yes_no', 2),
  ('11111111-1111-1111-1111-111111111111', 'career_growth', 'How would you rate the career growth opportunities here?', 'rating', 1),
  ('11111111-1111-1111-1111-111111111111', 'career_growth', 'What career growth could have kept you here?', 'text', 2),
  ('11111111-1111-1111-1111-111111111111', 'learning', 'How would you rate the learning and development opportunities?', 'rating', 1),
  ('11111111-1111-1111-1111-111111111111', 'learning', 'Did you receive adequate training for your role?', 'yes_no', 2),
  ('11111111-1111-1111-1111-111111111111', 'company_culture', 'How would you rate the company culture?', 'rating', 1),
  ('11111111-1111-1111-1111-111111111111', 'company_culture', 'Would you recommend this company as a place to work?', 'yes_no', 2),
  ('11111111-1111-1111-1111-111111111111', 'reason_for_leaving', 'What is the primary reason for your resignation?', 'text', 1),
  ('11111111-1111-1111-1111-111111111111', 'reason_for_leaving', 'Was this move triggered by a specific event?', 'yes_no', 2),
  ('11111111-1111-1111-1111-111111111111', 'suggestions', 'What suggestions do you have for improving the organization?', 'text', 1),
  ('11111111-1111-1111-1111-111111111111', 'suggestions', 'Any other comments you''d like to share?', 'text', 2);

-- EMP0001: submitted, then withdrawn before the manager acted.
insert into public.exit_requests (
  id, organization_id, employee_id, resignation_date, proposed_last_working_date, notice_period_days,
  expected_last_working_date, reason, detailed_comments, status, manager_id
) values (
  '11111111-1111-1111-1111-900000000001', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-700000000001',
  '2026-06-01', '2026-07-01', 30, '2026-07-01', 'Exploring an external opportunity',
  'Reconsidered after discussing growth options with my manager.', 'withdrawn', '11111111-1111-1111-1111-700000000002'
);

-- EMP0010: HR-approved and now mid-clearance (manager/HR/admin cleared; IT and Finance still pending).
insert into public.exit_requests (
  id, organization_id, employee_id, resignation_date, proposed_last_working_date, notice_period_days,
  expected_last_working_date, reason, detailed_comments, status,
  manager_id, manager_approved_at, manager_remarks,
  hr_approver_id, hr_approved_at, hr_remarks
) values (
  '11111111-1111-1111-1111-900000000002', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-700000000010',
  '2026-07-01', '2026-08-15', 45, '2026-08-15', 'Better career opportunity',
  'Accepted an offer closer to family. Happy to assist with a smooth handover.', 'hr_approved',
  '11111111-1111-1111-1111-700000000004', '2026-07-03T10:15:00Z', 'Approved — please complete handover documentation.',
  '11111111-1111-1111-1111-700000000004', '2026-07-05T09:00:00Z', 'Approved by HR. Coordinating clearance with all departments.'
);

insert into public.exit_clearances (exit_request_id, department, status, cleared_by, cleared_at, remarks) values
  ('11111111-1111-1111-1111-900000000002', 'manager', 'cleared', '11111111-1111-1111-1111-700000000004', '2026-07-06T11:00:00Z', 'Handover plan received.'),
  ('11111111-1111-1111-1111-900000000002', 'hr', 'cleared', '11111111-1111-1111-1111-700000000004', '2026-07-06T12:00:00Z', 'Exit formalities briefed.'),
  ('11111111-1111-1111-1111-900000000002', 'admin', 'cleared', '11111111-1111-1111-1111-700000000004', '2026-07-07T09:30:00Z', 'ID card and access cards to be returned on last day.'),
  ('11111111-1111-1111-1111-900000000002', 'it', 'pending', null, null, null),
  ('11111111-1111-1111-1111-900000000002', 'finance', 'pending', null, null, null);

insert into public.exit_interviews (exit_request_id, employee_id, status) values
  ('11111111-1111-1111-1111-900000000002', '11111111-1111-1111-1111-700000000010', 'pending');

-- Real Supabase Auth login credentials for every seeded employee -- without
-- this, the seed data above has no way to actually log into the app.
-- `postgres` has INSERT on auth.users/auth.identities on every Supabase
-- project (confirmed live, this is the standard documented technique for
-- seeding auth users directly via SQL, not something project-specific).
-- Password is the same for every seeded account: Demo@12345
-- Username on the login screen is the employee_code (EMP0001, ...) --
-- resolve_login_email() (0023) maps that to official_email.
-- Role codes are looked up dynamically (not hardcoded UUIDs), since
-- roles.id is gen_random_uuid() and differs per project.
do $$
declare
  emp record;
  new_user_id uuid;
  role_code text;
  role_id uuid;
  org_id constant uuid := '11111111-1111-1111-1111-111111111111';
  password constant text := 'Demo@12345';
  extra_roles jsonb := jsonb_build_object(
    'EMP0002', jsonb_build_array('manager'),
    'EMP0003', jsonb_build_array('hr_admin'),
    'EMP0004', jsonb_build_array('manager', 'super_admin')
  );
begin
  for emp in select id, employee_code, official_email from public.employees where user_id is null order by employee_code loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change,
      email_change_token_current, reauthentication_token
    ) values (
      '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
      emp.official_email, crypt(password, gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(),
      '', '', '', '', '', ''
    )
    returning id into new_user_id;

    insert into auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (
      gen_random_uuid(), new_user_id::text, new_user_id,
      jsonb_build_object('sub', new_user_id::text, 'email', emp.official_email),
      'email', now(), now(), now()
    );

    update public.employees set user_id = new_user_id where id = emp.id;

    insert into public.user_roles (id, user_id, role_id, organization_id)
      select gen_random_uuid(), new_user_id, r.id, org_id from public.roles r where r.code = 'employee';

    for role_code in select jsonb_array_elements_text(coalesce(extra_roles->emp.employee_code, '[]'::jsonb)) loop
      select id into role_id from public.roles where code = role_code;
      if role_id is not null then
        insert into public.user_roles (id, user_id, role_id, organization_id)
          values (gen_random_uuid(), new_user_id, role_id, org_id);
      end if;
    end loop;
  end loop;
end;
$$;

commit;
