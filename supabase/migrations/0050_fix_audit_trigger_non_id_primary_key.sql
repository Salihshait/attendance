-- Real bug found while applying this project's full migration set + seed
-- data live for the first time (previous sessions never had a connection
-- that let them run the whole set end-to-end): audit_row_change() (0030)
-- hardcoded `old.id`/`new.id` direct field access. That fails outright --
-- "record \"old\"/\"new\" has no field \"id\"" -- for any table whose
-- primary key isn't literally named `id`. employee_profiles is exactly
-- that case (its PK is `employee_id`, a legitimate 1:1 extension-table
-- design), and it's been in the audited sensitive_tables list since 0030,
-- meaning this trigger has been unable to fire successfully on that table
-- since the very first migration that attached it -- not something this
-- session introduced, just the first time anyone actually exercised it
-- end-to-end against a live database.
--
-- Fixed generically (not with a per-table special case) by reading `id`
-- out of the already-computed `_row` jsonb instead of direct field access
-- -- jsonb key lookup returns null for a missing key instead of erroring,
-- so this is now safe for any current or future audited table regardless
-- of its primary key's column name. employee_profiles rows will have a
-- null record_id but a real employee_id (0048's new column) -- arguably
-- more useful for that table anyway, since "which employee's profile"
-- *is* the identity that matters there.

create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _row jsonb;
  _org_id uuid;
  _action text;
  _record_id uuid;
  _employee_id uuid;
  _actor_role text;
begin
  _row := to_jsonb(coalesce(new, old));
  _action := case TG_OP when 'INSERT' then 'create' when 'UPDATE' then 'update' when 'DELETE' then 'delete' end;
  _record_id := nullif(_row->>'id', '')::uuid;
  _org_id := case
    when _row ? 'organization_id' and _row->>'organization_id' is not null then (_row->>'organization_id')::uuid
    else public.current_organization_id()
  end;
  -- The row itself is the employee for the employees table; every other
  -- tracked table that concerns a specific employee carries employee_id
  -- directly. Org-structure/config tables (shifts, system_settings, ...)
  -- have neither, so employee_id stays null there -- correctly, since the
  -- action isn't about any one employee.
  _employee_id := case
    when TG_TABLE_NAME = 'employees' then _record_id
    when _row ? 'employee_id' and _row->>'employee_id' is not null then (_row->>'employee_id')::uuid
    else null
  end;

  select r.name into _actor_role
    from public.user_roles ur join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid()
    order by case r.name when 'super_admin' then 1 when 'hr_admin' then 2 when 'manager' then 3 else 4 end
    limit 1;

  insert into public.audit_logs (organization_id, actor_user_id, actor_role, employee_id, action, module, record_id, old_value, new_value, result)
  values (
    _org_id,
    auth.uid(),
    _actor_role,
    _employee_id,
    _action,
    TG_TABLE_NAME,
    _record_id,
    case when TG_OP <> 'INSERT' then to_jsonb(old) else null end,
    case when TG_OP <> 'DELETE' then to_jsonb(new) else null end,
    'success'
  );

  return coalesce(new, old);
end;
$$;
