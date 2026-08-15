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
