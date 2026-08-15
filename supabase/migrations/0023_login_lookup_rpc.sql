-- Lets the login page's "Username" field accept an employee code (matching
-- the reference app's login UX, e.g. "EMP0001") in addition to a plain
-- email — Supabase Auth itself only ever signs in by email. SECURITY
-- DEFINER so an unauthenticated client can resolve code -> email before
-- calling signInWithPassword; returns null on no match, and is scoped to
-- exactly one column so it can't be used to pull anything else out of
-- public.employees.
create or replace function public.resolve_login_email(_username text)
returns text
language sql stable security definer set search_path = public as $$
  select official_email
  from public.employees
  where lower(employee_code) = lower(trim(_username))
  limit 1;
$$;

grant execute on function public.resolve_login_email(text) to anon, authenticated;
