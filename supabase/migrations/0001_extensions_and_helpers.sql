-- Extensions
create extension if not exists "pgcrypto";

-- Generic updated_at trigger, reused by every table below.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'Stamps updated_at = now() on every UPDATE. Attached as a BEFORE UPDATE trigger per table.';
