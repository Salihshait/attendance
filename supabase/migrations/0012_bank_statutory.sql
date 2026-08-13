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
