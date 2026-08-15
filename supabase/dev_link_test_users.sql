-- Not a numbered migration — this links specific Supabase Auth user UUIDs
-- (created manually in Dashboard -> Authentication -> Users) to existing
-- seeded employee rows, so those accounts can actually log in with the
-- right roles. Environment-specific, run once per project. Idempotent:
-- the employees update always overwrites cleanly, profiles upserts on
-- conflict, and user_roles has a unique(user_id, role_id, organization_id)
-- constraint so re-running with the same UUIDs won't duplicate rows.
--
-- Three steps per account, per seed.sql's own documented process (its
-- header comment names all three — only step 1 had been done before,
-- which let both accounts log in but left every live account stuck on the
-- 'employee' role fallback with no way to reach Manager/HR/Admin screens).

update public.employees set user_id = 'a7f058c1-553f-4528-98ab-8b24c15f6a55'
  where employee_code = 'EMP0001' and organization_id = '11111111-1111-1111-1111-111111111111';

update public.employees set user_id = '24fcdcd2-b1a3-4acf-bd01-93ecd0b06942'
  where employee_code = 'EMP0002' and organization_id = '11111111-1111-1111-1111-111111111111';

insert into public.profiles (id, organization_id, email) values
  ('a7f058c1-553f-4528-98ab-8b24c15f6a55', '11111111-1111-1111-1111-111111111111', 'arjun.rao@example.com'),
  ('24fcdcd2-b1a3-4acf-bd01-93ecd0b06942', '11111111-1111-1111-1111-111111111111', 'priya.n@example.com')
on conflict (id) do update set organization_id = excluded.organization_id, email = excluded.email;

insert into public.user_roles (user_id, role_id, organization_id)
  select 'a7f058c1-553f-4528-98ab-8b24c15f6a55', id, '11111111-1111-1111-1111-111111111111'
  from public.roles where code = 'employee'
  on conflict (user_id, role_id, organization_id) do nothing;

insert into public.user_roles (user_id, role_id, organization_id)
  select '24fcdcd2-b1a3-4acf-bd01-93ecd0b06942', id, '11111111-1111-1111-1111-111111111111'
  from public.roles where code in ('employee', 'manager')
  on conflict (user_id, role_id, organization_id) do nothing;
