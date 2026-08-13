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
