-- Real bug found while creating login credentials and inspecting the live
-- `roles` table: audit_row_change() (0048/0050/0051) ordered by
-- `case r.name when 'super_admin' then 1 ...` but `roles.name` holds
-- display strings ('Super Administrator', 'HR Administrator', ...) -- the
-- lowercase slug lives in `roles.code` (what the frontend actually reads,
-- src/auth/AuthProvider.tsx: `role:roles(code)`). The case never matched
-- anything, so actor_role priority ordering silently always fell through
-- to `else 4` for every role -- audit_logs.actor_role still got set to
-- *a* role name for a multi-role user, just not reliably the highest-
-- privilege one. Fixed by ordering on r.code instead.

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
  _employee_id := case
    when TG_TABLE_NAME = 'employees' then _record_id
    when _row ? 'employee_id' and _row->>'employee_id' is not null then (_row->>'employee_id')::uuid
    else null
  end;

  if _row ? 'organization_id' and _row->>'organization_id' is not null then
    _org_id := (_row->>'organization_id')::uuid;
  elsif _employee_id is not null then
    select organization_id into _org_id from public.employees where id = _employee_id;
  end if;
  if _org_id is null then
    _org_id := public.current_organization_id();
  end if;

  if _org_id is null then
    return coalesce(new, old);
  end if;

  select r.code into _actor_role
    from public.user_roles ur join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid()
    order by case r.code when 'super_admin' then 1 when 'hr_admin' then 2 when 'manager' then 3 else 4 end
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
