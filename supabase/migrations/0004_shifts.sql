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
