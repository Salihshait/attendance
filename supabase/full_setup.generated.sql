-- GENERATED FILE — do not hand-edit.
-- This is supabase/migrations/0001..0031 + supabase/seed/seed.sql concatenated
-- in order, for a one-paste setup in the Supabase SQL Editor. The source of
-- truth is the individual files; regenerate this one from them if they change.
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

-- Opening leave balances for the current year, per employee per leave type.
insert into public.leave_balances (employee_id, leave_type_id, period_start, period_end, opening, credited, used, balance)
select
  e.id,
  lt.id,
  make_date(extract(year from now())::int, 1, 1),
  make_date(extract(year from now())::int, 12, 31),
  case lt.code when 'PL' then 18 when 'EL' then 12 when 'CL' then 12 when 'SL' then 12 else 0 end,
  0, 0,
  case lt.code when 'PL' then 18 when 'EL' then 12 when 'CL' then 12 when 'SL' then 12 else 0 end
from public.employees e
cross join public.leave_types lt
where e.organization_id = '11111111-1111-1111-1111-111111111111'
  and lt.organization_id = '11111111-1111-1111-1111-111111111111';

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

-- Attendance history: last ~60 days for every seeded employee. Weekoffs and
-- holidays are marked from the rows inserted above; everything else is a
-- randomized present/absent day around the General Shift (09:30-18:30).
do $$
declare
  emp record;
  d date;
  is_weekoff boolean;
  holiday_name text;
  roll numeric;
  check_in_minutes int;
  check_out_minutes int;
  effective_minutes int;
  late_minutes int;
  early_going_minutes int;
  excess_stay_minutes int;
  shortfall_minutes int;
  shift_start_minutes constant int := 9 * 60 + 30;
  shift_end_minutes constant int := 18 * 60 + 30;
  grace_minutes constant int := 15;
  full_day_minutes constant int := 9 * 60;
  today constant date := current_date;
  start_date date := current_date - 60;
  org_id constant uuid := '11111111-1111-1111-1111-111111111111';
  shift_id constant uuid := '11111111-1111-1111-1111-500000000001';
begin
  for emp in select id from public.employees where organization_id = org_id loop
    d := start_date;
    while d <= today loop
      is_weekoff := extract(dow from d) in (0, 6);
      select name into holiday_name from public.holidays where organization_id = org_id and holiday_date = d;

      if is_weekoff then
        insert into public.attendance (organization_id, employee_id, attendance_date, shift_id, day_status, validation_status)
        values (org_id, emp.id, d, shift_id, 'weekoff', 'completed')
        on conflict (employee_id, attendance_date) do nothing;
      elsif holiday_name is not null then
        insert into public.attendance (organization_id, employee_id, attendance_date, shift_id, day_status, validation_status, remarks)
        values (org_id, emp.id, d, shift_id, 'holiday', 'completed', holiday_name)
        on conflict (employee_id, attendance_date) do nothing;
      else
        roll := random();
        if roll < 0.04 then
          insert into public.attendance (organization_id, employee_id, attendance_date, shift_id, day_status, validation_status)
          values (org_id, emp.id, d, shift_id, 'absent', 'completed')
          on conflict (employee_id, attendance_date) do nothing;
        else
          check_in_minutes := round(570 + random() * 85)::int;
          check_out_minutes := round(1080 + random() * 160)::int;
          effective_minutes := check_out_minutes - check_in_minutes;
          late_minutes := greatest(0, check_in_minutes - (shift_start_minutes + grace_minutes));
          early_going_minutes := greatest(0, shift_end_minutes - check_out_minutes);
          excess_stay_minutes := greatest(0, check_out_minutes - shift_end_minutes);
          shortfall_minutes := greatest(0, full_day_minutes - effective_minutes);

          insert into public.attendance (
            organization_id, employee_id, attendance_date, shift_id, check_in, check_out,
            effective_minutes, late_minutes, early_going_minutes, excess_stay_minutes, shortfall_minutes,
            day_status, validation_status
          ) values (
            org_id, emp.id, d, shift_id,
            d + (check_in_minutes || ' minutes')::interval,
            d + (check_out_minutes || ' minutes')::interval,
            effective_minutes, late_minutes, early_going_minutes, excess_stay_minutes, shortfall_minutes,
            case when effective_minutes < 300 then 'half_day' else 'present' end,
            'completed'
          )
          on conflict (employee_id, attendance_date) do nothing;

          -- Raw in/out punches backing the attendance row above, for the
          -- Raw In/Out Records report. Device/source vary so the demo data
          -- isn't monotonous.
          insert into public.attendance_punches (organization_id, employee_id, punch_date, punch_time, punch_type, device, location, source)
          values
            (org_id, emp.id, d, d + (check_in_minutes || ' minutes')::interval, 'in',
             case when random() < 0.5 then 'Biometric-Gate1' else 'Biometric-Gate2' end, 'Chennai Office',
             case when random() < 0.85 then 'biometric' else 'mobile' end),
            (org_id, emp.id, d, d + (check_out_minutes || ' minutes')::interval, 'out',
             case when random() < 0.5 then 'Biometric-Gate1' else 'Biometric-Gate2' end, 'Chennai Office',
             case when random() < 0.85 then 'biometric' else 'mobile' end);
        end if;
      end if;

      d := d + 1;
    end loop;
  end loop;
end $$;

-- Overnight-shift demo data for EMP0006 (Night Shift, 22:00 -> 07:00) so the
-- calendar/reports have a real example of the "10 PM -> 6 AM is 8 hours, not
-- negative" rule (see src/lib/attendanceCalc.ts) instead of only General
-- Shift rows.
do $$
declare
  d date;
  check_in_minutes int;
  check_out_minutes int; -- minutes into the *next* day, before normalization
  effective_minutes int;
  late_minutes int;
  early_going_minutes int;
  excess_stay_minutes int;
  shortfall_minutes int;
  shift_start_minutes constant int := 22 * 60;
  shift_end_minutes constant int := 7 * 60; -- wraps past midnight
  shift_end_normalized constant int := shift_end_minutes + 24 * 60;
  grace_minutes constant int := 10;
  full_day_minutes constant int := 8 * 60;
  org_id constant uuid := '11111111-1111-1111-1111-111111111111';
  emp_id constant uuid := '11111111-1111-1111-1111-700000000006';
  night_shift_id constant uuid := '11111111-1111-1111-1111-500000000003';
  today constant date := current_date;
begin
  for i in 1..5 loop
    d := today - i;
    continue when extract(dow from d) in (0, 6);

    check_in_minutes := round(shift_start_minutes + random() * 20)::int; -- ~22:00-22:20
    check_out_minutes := round(shift_end_normalized - 20 + random() * 40)::int; -- ~06:40-07:20 next day

    effective_minutes := check_out_minutes - check_in_minutes;
    late_minutes := greatest(0, check_in_minutes - (shift_start_minutes + grace_minutes));
    early_going_minutes := greatest(0, shift_end_normalized - check_out_minutes);
    excess_stay_minutes := greatest(0, check_out_minutes - shift_end_normalized);
    shortfall_minutes := greatest(0, full_day_minutes - effective_minutes);

    insert into public.attendance (
      organization_id, employee_id, attendance_date, shift_id, check_in, check_out,
      effective_minutes, late_minutes, early_going_minutes, excess_stay_minutes, shortfall_minutes,
      day_status, validation_status
    ) values (
      org_id, emp_id, d, night_shift_id,
      d + (check_in_minutes || ' minutes')::interval,
      d + (check_out_minutes || ' minutes')::interval, -- interval > 24h rolls into the next calendar day, as intended
      effective_minutes, late_minutes, early_going_minutes, excess_stay_minutes, shortfall_minutes,
      case when effective_minutes < 300 then 'half_day' else 'present' end,
      'completed'
    )
    on conflict (employee_id, attendance_date) do update set
      shift_id = excluded.shift_id, check_in = excluded.check_in, check_out = excluded.check_out,
      effective_minutes = excluded.effective_minutes, late_minutes = excluded.late_minutes,
      early_going_minutes = excluded.early_going_minutes, excess_stay_minutes = excluded.excess_stay_minutes,
      shortfall_minutes = excluded.shortfall_minutes, day_status = excluded.day_status;

    -- Replace whatever General Shift punches the main loop above generated
    -- for this employee/date so Raw In/Out Records shows a clean pair.
    delete from public.attendance_punches where employee_id = emp_id and punch_date = d;
    insert into public.attendance_punches (organization_id, employee_id, punch_date, punch_time, punch_type, device, location, source)
    values
      (org_id, emp_id, d, d + (check_in_minutes || ' minutes')::interval, 'in', 'Biometric-Gate1', 'Chennai Office', 'biometric'),
      (org_id, emp_id, d, d + (check_out_minutes || ' minutes')::interval, 'out', 'Biometric-Gate1', 'Chennai Office', 'biometric');
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
-- through the app after seeding.)
update public.leave_balances lb
set used = lb.used + approved.total_days,
    balance = lb.balance - approved.total_days
from (
  select employee_id, leave_type_id, sum(duration_days) as total_days
  from public.leave_requests
  where status = 'approved'
  group by employee_id, leave_type_id
) as approved
where lb.employee_id = approved.employee_id
  and lb.leave_type_id = approved.leave_type_id
  and lb.period_start <= current_date and lb.period_end >= current_date;

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

commit;
