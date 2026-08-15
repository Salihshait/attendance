-- Correction: the UUIDs given were in the reverse order from the emails
-- (verified via a real login: divya.k@example.com's real auth UID is
-- 90e0fadd..., karthik.s@example.com's is f953dcfa...) — this re-links
-- everything correctly and cleans up the swapped rows from the first,
-- wrong run. Idempotent, safe to re-run.

update public.employees set user_id = '90e0fadd-d7e0-4cca-a06e-a81a1bd54a32'
  where employee_code = 'EMP0003' and organization_id = '11111111-1111-1111-1111-111111111111';

update public.employees set user_id = 'f953dcfa-c54d-4c07-b9f2-f593b4c97f97'
  where employee_code = 'EMP0004' and organization_id = '11111111-1111-1111-1111-111111111111';

insert into public.profiles (id, organization_id, email) values
  ('90e0fadd-d7e0-4cca-a06e-a81a1bd54a32', '11111111-1111-1111-1111-111111111111', 'divya.k@example.com'),
  ('f953dcfa-c54d-4c07-b9f2-f593b4c97f97', '11111111-1111-1111-1111-111111111111', 'karthik.s@example.com')
on conflict (id) do update set organization_id = excluded.organization_id, email = excluded.email;

-- Wipe the roles granted to each UUID in the previous (swapped) run, then
-- grant the correct set per account.
delete from public.user_roles where user_id in (
  '90e0fadd-d7e0-4cca-a06e-a81a1bd54a32', 'f953dcfa-c54d-4c07-b9f2-f593b4c97f97'
);

-- Divya (EMP0003): HR admin
insert into public.user_roles (user_id, role_id, organization_id)
  select '90e0fadd-d7e0-4cca-a06e-a81a1bd54a32', id, '11111111-1111-1111-1111-111111111111'
  from public.roles where code in ('employee', 'hr_admin')
  on conflict (user_id, role_id, organization_id) do nothing;

-- Karthik (EMP0004): VP Engineering, all four roles (matches demoUsers.ts)
insert into public.user_roles (user_id, role_id, organization_id)
  select 'f953dcfa-c54d-4c07-b9f2-f593b4c97f97', id, '11111111-1111-1111-1111-111111111111'
  from public.roles where code in ('employee', 'manager', 'hr_admin', 'super_admin')
  on conflict (user_id, role_id, organization_id) do nothing;
