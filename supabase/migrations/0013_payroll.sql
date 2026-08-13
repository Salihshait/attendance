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
