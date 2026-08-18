-- The single most consequential bug found this session, discovered only by
-- actually logging into the running app for the first time: every one of
-- this schema's 58 public tables was missing base SELECT/INSERT/UPDATE/
-- DELETE grants for anon/authenticated/service_role entirely -- only
-- REFERENCES/TRIGGER/TRUNCATE existed (confirmed live via
-- information_schema.role_table_grants). PostgREST/RLS only ever gets a
-- chance to filter rows *after* Postgres's coarser table-level GRANT check
-- already permits the operation -- with that GRANT missing, every RLS
-- policy this project has ever written (0018 onward) has been completely
-- unreachable. The app's login redirected correctly (Supabase Auth itself
-- doesn't touch these tables), but every very first PostgREST query after
-- that failed with 42501 "permission denied for table employees".
--
-- Root cause: Supabase's platform-level default privileges (confirmed live
-- via pg_default_acl) only auto-grant full CRUD to anon/authenticated/
-- service_role for tables *created by the supabase_admin role*. Every
-- table in this schema was created by `postgres` (every migration in this
-- project runs as postgres), whose own default ACL for this schema only
-- included REFERENCES/TRIGGER/TRUNCATE -- not SELECT/INSERT/UPDATE/DELETE.
-- This was never caught before because no prior session had a live
-- Supabase connection to actually run the full migration set against a
-- truly fresh project and then log in -- every previous round of "live
-- testing" mentioned in this project's history must have run against a
-- project where these grants already existed some other way.
--
-- Fixed two ways: (1) grant the missing privileges on every existing
-- table now; (2) set this project's default privileges for future
-- `postgres`-created tables to match, so no future migration needs to
-- repeat this. RLS remains the real access-control layer exactly as every
-- policy in this project already assumes -- this only restores the
-- coarser "is this operation even attemptable" gate PostgREST expects,
-- matching the same grant shape Supabase's own platform default already
-- applies automatically for supabase_admin-owned tables.

grant select, insert, update, delete on all tables in schema public to anon, authenticated, service_role;
grant usage, select on all sequences in schema public to anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  grant select, insert, update, delete on tables to anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  grant usage, select on sequences to anon, authenticated, service_role;
