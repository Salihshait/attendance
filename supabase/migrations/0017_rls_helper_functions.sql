-- RLS helper functions. All SECURITY DEFINER + stable so they can be used
-- freely inside policy USING/WITH CHECK clauses without recursive RLS checks
-- on the tables they read.

create or replace function public.current_employee_id()
returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.employees where user_id = auth.uid() limit 1;
$$;

create or replace function public.current_organization_id()
returns uuid
language sql stable security definer set search_path = public as $$
  select organization_id from public.employees where user_id = auth.uid() limit 1;
$$;

create or replace function public.has_role(_role_code text)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid() and r.code = _role_code
  );
$$;

create or replace function public.is_hr_or_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_role('hr_admin') or public.has_role('super_admin');
$$;

-- Walks the reporting_manager_id chain upward from _employee_id (bounded to
-- 12 levels) to test whether the current user's employee sits above it.
create or replace function public.is_manager_of(_employee_id uuid)
returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  _me uuid := public.current_employee_id();
  _walk uuid := _employee_id;
  _depth int := 0;
begin
  if _me is null or _employee_id is null then
    return false;
  end if;

  while _walk is not null and _depth < 12 loop
    select reporting_manager_id into _walk from public.employees where id = _walk;
    if _walk = _me then
      return true;
    end if;
    _depth := _depth + 1;
  end loop;

  return false;
end;
$$;

-- Polymorphic lookup: which employee owns a given approval-engine request.
-- Extend the CASE list here whenever a new request_type is added to
-- approval_workflows / approval_instances.
create or replace function public.request_owner_employee_id(_request_type text, _request_id uuid)
returns uuid
language sql stable security definer set search_path = public as $$
  select case _request_type
    when 'leave_request' then (select employee_id from public.leave_requests where id = _request_id)
    when 'permission_request' then (select employee_id from public.permission_requests where id = _request_id)
    when 'onduty_request' then (select employee_id from public.onduty_requests where id = _request_id)
    when 'attendance_regularization' then (select employee_id from public.attendance_regularizations where id = _request_id)
    when 'exit_request' then (select employee_id from public.exit_requests where id = _request_id)
    when 'bank_detail_change_request' then (select employee_id from public.bank_detail_change_requests where id = _request_id)
    else null
  end;
$$;
