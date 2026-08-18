-- Real design flaw found while actually trying to complete the one-time
-- setup step 0048 documented: `ALTER DATABASE postgres SET app.settings.
-- smtp_encryption_key = '...'` fails with "permission denied to set
-- parameter" on Supabase's managed Postgres, for the `postgres` role AND
-- via `ALTER ROLE` -- customers don't get the privilege to set arbitrary
-- custom GUC namespaces at that level on this platform. The whole
-- pgcrypto + custom-GUC-key design in 0048 was unworkable as written; it
-- was never actually exercised end-to-end before now.
--
-- Rebuilt on supabase_vault (already enabled on this project, and
-- available on every Supabase project by default) -- the platform's actual
-- supported mechanism for exactly this: application secrets encrypted at
-- rest with a key Supabase itself manages, no manual setup step at all.
-- `email_configuration.password_encrypted` (bytea, pgp_sym_encrypt) is
-- replaced with `password_secret_id` (a vault.secrets id); the plaintext
-- is only ever readable via `vault.decrypted_secrets`, which -- like
-- get_smtp_credentials() itself -- is granted to `service_role` only.

alter table public.email_configuration
  add column if not exists password_secret_id uuid;

alter table public.email_configuration
  drop column if exists has_password;

alter table public.email_configuration
  add column has_password boolean generated always as (password_secret_id is not null) stored;

alter table public.email_configuration
  drop column if exists password_encrypted;

create or replace function public.set_email_configuration(
  _host text,
  _port int,
  _encryption text,
  _username text,
  _from_name text,
  _from_email text,
  _reply_to text,
  _is_active boolean,
  _password text default null
)
returns void
language plpgsql security definer set search_path = public as $$
declare
  _org_id uuid := public.current_organization_id();
  _existing_secret_id uuid;
  _secret_id uuid;
begin
  if not public.is_hr_or_admin() then
    raise exception 'set_email_configuration: not authorized';
  end if;

  select password_secret_id into _existing_secret_id
    from public.email_configuration where organization_id = _org_id;

  if _password is not null then
    if _existing_secret_id is not null then
      perform vault.update_secret(_existing_secret_id, _password);
      _secret_id := _existing_secret_id;
    else
      _secret_id := vault.create_secret(_password, 'smtp_password_' || _org_id::text, 'SMTP password for email_configuration');
    end if;
  else
    -- Blank password in the update means "keep the existing secret" -- HR
    -- isn't forced to re-enter it on every unrelated field edit.
    _secret_id := _existing_secret_id;
  end if;

  insert into public.email_configuration (
    organization_id, host, port, encryption, username, from_name, from_email, reply_to, is_active,
    password_secret_id, updated_by
  ) values (
    _org_id, _host, _port, _encryption, _username, _from_name, _from_email, _reply_to, _is_active,
    _secret_id, public.current_employee_id()
  )
  on conflict (organization_id) do update set
    host = excluded.host,
    port = excluded.port,
    encryption = excluded.encryption,
    username = excluded.username,
    from_name = excluded.from_name,
    from_email = excluded.from_email,
    reply_to = excluded.reply_to,
    is_active = excluded.is_active,
    password_secret_id = excluded.password_secret_id,
    updated_by = excluded.updated_by;
end;
$$;

create or replace function public.get_smtp_credentials(_organization_id uuid)
returns table (
  host text, port int, encryption text, username text, password text,
  from_name text, from_email text, reply_to text, is_active boolean
)
language plpgsql security definer set search_path = public as $$
begin
  return query
  select
    c.host, c.port, c.encryption, c.username,
    ds.decrypted_secret,
    c.from_name, c.from_email, c.reply_to, c.is_active
  from public.email_configuration c
  left join vault.decrypted_secrets ds on ds.id = c.password_secret_id
  where c.organization_id = _organization_id;
end;
$$;
revoke all on function public.get_smtp_credentials(uuid) from public, authenticated, anon;
grant execute on function public.get_smtp_credentials(uuid) to service_role;
