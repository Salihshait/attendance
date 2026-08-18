-- Third real bug in the same class, found continuing the same live run:
-- queue_templated_email() (0047) always resolved organization via
-- current_organization_id() (session/auth.uid()-based), even when called
-- from trg_queue_approval_request_email() -- a trigger fired by a plain
-- INSERT with no authenticated session (seed data, or any future
-- non-interactive writer). The trigger itself already resolves the
-- correct organization_id from the employee record before calling
-- queue_templated_email() -- that context was just never passed through,
-- so the callee re-derived it from session state and got null outside a
-- real request.
--
-- Fixed by accepting an optional _organization_id parameter: callers that
-- already know it (the trigger, act_on_approval()) pass it explicitly;
-- direct client calls (the admin UI's Send Test Email) omit it and fall
-- back to current_organization_id() as before, since those always run
-- inside a real authenticated session.

drop function if exists public.queue_templated_email(text, text, jsonb, text, text[], text[]);

create or replace function public.queue_templated_email(
  _template_key text,
  _recipient_email text,
  _variables jsonb default '{}'::jsonb,
  _reference_id text default null,
  _cc text[] default '{}',
  _bcc text[] default '{}',
  _organization_id uuid default null
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  _org_id uuid := coalesce(_organization_id, public.current_organization_id());
  _template record;
  _rendered record;
  _log_id uuid;
begin
  select id, subject, body into _template
    from public.email_templates
    where organization_id = _org_id and template_key = _template_key and is_active
    order by updated_at desc limit 1;

  if _template.id is null then
    insert into public.email_delivery_logs (
      organization_id, template_id, template_key, recipient_email, cc, bcc, status, error_message, reference_id
    ) values (
      _org_id, null, _template_key, _recipient_email, coalesce(_cc, '{}'), coalesce(_bcc, '{}'),
      'failed', 'No active template configured for this template_key', _reference_id
    )
    returning id into _log_id;
    return _log_id;
  end if;

  select * into _rendered from public.render_email_template(_template.subject, _template.body, _variables);

  insert into public.email_delivery_logs (
    organization_id, template_id, template_key, recipient_email, cc, bcc, subject, body, status, reference_id
  ) values (
    _org_id, _template.id, _template_key, _recipient_email, coalesce(_cc, '{}'), coalesce(_bcc, '{}'),
    _rendered.subject, _rendered.body, 'pending', _reference_id
  )
  returning id into _log_id;

  return _log_id;
end;
$$;

grant execute on function public.queue_templated_email(text, text, jsonb, text, text[], text[], uuid) to authenticated;

-- Pass the already-resolved organization through explicitly.
create or replace function public.trg_queue_approval_request_email()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  _row jsonb := to_jsonb(new);
  _manager_id uuid := nullif(_row->>'reporting_manager_id', '')::uuid;
  _org_id uuid;
  _employee_name text;
  _employee_code text;
  _manager_name text;
  _manager_email text;
  _request_type text;
  _from_date text;
  _to_date text;
  _duration text;
begin
  if new.status <> 'pending' then
    return new;
  end if;

  select organization_id, (first_name || coalesce(' ' || last_name, '')), employee_code
    into _org_id, _employee_name, _employee_code
    from public.employees where id = new.employee_id;

  if _manager_id is not null then
    select (first_name || coalesce(' ' || last_name, '')), official_email
      into _manager_name, _manager_email
      from public.employees where id = _manager_id;
  end if;

  if _manager_email is null then
    return new; -- no manager on record to notify
  end if;

  _request_type := case TG_TABLE_NAME
    when 'leave_requests' then 'Leave'
    when 'permission_requests' then 'Permission'
    when 'attendance_regularizations' then 'Attendance Regularization'
    when 'onduty_requests' then (case when _row->>'onduty_type' = 'work_from_home' then 'Work From Home' else 'On Duty' end)
    when 'other_requests' then coalesce(_row->>'request_title', 'Other Request')
    else TG_TABLE_NAME
  end;

  _from_date := coalesce(_row->>'from_date', _row->>'attendance_date', _row->>'permission_date', _row->>'request_date');
  _to_date := coalesce(_row->>'to_date', _from_date);
  _duration := case
    when _row ? 'duration_days' then (_row->>'duration_days') || ' day(s)'
    when _row ? 'duration_minutes' then (_row->>'duration_minutes') || ' min'
    else '-'
  end;

  perform public.queue_templated_email(
    'approval_request',
    _manager_email,
    jsonb_build_object(
      'employee_name', _employee_name,
      'employee_id', _employee_code,
      'manager_name', _manager_name,
      'request_type', _request_type,
      'from_date', _from_date,
      'to_date', _to_date,
      'duration', _duration,
      'reason', coalesce(_row->>'reason', ''),
      'application_id', new.id::text
    ),
    TG_TABLE_NAME || ':' || new.id::text,
    '{}',
    '{}',
    _org_id
  );

  return new;
end;
$$;
