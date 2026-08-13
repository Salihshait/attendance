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
