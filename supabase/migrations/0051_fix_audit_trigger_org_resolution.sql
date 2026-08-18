-- Second real bug found in the same live run that found 0050's: 11 of the
-- 24 audited tables (bank_details, statutory_details, employee_profiles,
-- payslips, tax_declarations, previous_employer_declarations,
-- exit_settlements, exit_clearances, employee_documents,
-- bank_detail_change_requests, leave_balances) have no organization_id
-- column of their own. audit_row_change()'s only fallback was
-- current_organization_id(), which resolves via auth.uid() -- null for any
-- action taken outside an authenticated Supabase session (seed data
-- applied directly, a migration, a backend job). Since audit_logs.
-- organization_id is NOT NULL, that fallback failing aborted the entire
-- triggering transaction -- a logging side-effect was blocking the actual
-- business operation, exactly backwards from what an audit trail should do.
--
-- Fixed with a proper 3-tier resolution instead of a single session-based
-- fallback: (1) the row's own organization_id if it has one; (2) look up
-- via employees.organization_id through the row's employee_id, if it has
-- one -- correct regardless of session state, and covers 9 of the 11
-- exceptions; (3) current_organization_id() as before, for real app usage
-- with a live session. If all three come up empty (only possible for
-- exit_settlements/exit_clearances -- the two tables with neither column --
-- run outside an authenticated session), the audit insert is skipped
-- rather than failing the underlying operation. In real app usage this
-- skip path essentially never fires: every genuine user action has a
-- session, so current_organization_id() resolves.

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

  -- A logging side-effect must never block the operation it's logging --
  -- if no organization can be resolved at all (only possible outside an
  -- authenticated session, for a table with neither organization_id nor
  -- employee_id), skip the audit row instead of raising.
  if _org_id is null then
    return coalesce(new, old);
  end if;

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
