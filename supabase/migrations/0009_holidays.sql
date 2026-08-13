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
