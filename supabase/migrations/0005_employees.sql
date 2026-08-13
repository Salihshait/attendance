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
