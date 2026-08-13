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
