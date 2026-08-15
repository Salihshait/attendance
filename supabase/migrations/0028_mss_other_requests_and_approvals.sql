-- Manager Self Service: adds the "Other Requests" category, extends the
-- approval engine to cover all 5 pending-approval categories (leave,
-- permission, attendance regularization, on duty/work-from-home, other), and
-- makes act_on_approval write a real audit_logs row on every decision.

-- 1. Other Requests table -----------------------------------------------

create table public.other_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  request_title text not null,
  request_date date not null,
  reason text not null,
  reporting_manager_id uuid references public.employees(id),
  entry_by uuid references public.employees(id),
  applied_on timestamptz not null default now(),
  status text not null default 'pending'
    check (status in ('draft', 'pending', 'approved', 'rejected', 'cancelled')),
  approval_remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_other_requests_updated_at before update on public.other_requests
  for each row execute function public.set_updated_at();
create index idx_other_requests_employee on public.other_requests(employee_id, request_date);
create index idx_other_requests_manager on public.other_requests(reporting_manager_id, status);

alter table public.other_requests enable row level security;
create policy other_requests_select on public.other_requests for select
  using (employee_id = public.current_employee_id() or public.is_manager_of(employee_id) or public.is_hr_or_admin());
create policy other_requests_insert on public.other_requests for insert
  with check (employee_id = public.current_employee_id() or public.is_hr_or_admin());
create policy other_requests_update on public.other_requests for update
  using (employee_id = public.current_employee_id() or public.is_manager_of(employee_id) or public.is_hr_or_admin());

-- 2. request_owner_employee_id(): add 'other_request' arm ---------------

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
    when 'other_request' then (select employee_id from public.other_requests where id = _request_id)
    else null
  end;
$$;

-- 3. approval_workflows.request_type: allow 'other_request' -------------

alter table public.approval_workflows
  drop constraint if exists approval_workflows_request_type_check,
  add constraint approval_workflows_request_type_check check (
    request_type in (
      'leave_request', 'permission_request', 'onduty_request',
      'attendance_regularization', 'exit_request', 'bank_detail_change_request',
      'other_request'
    )
  );

-- 4. notifications.notification_type: add onduty/other outcomes ---------

alter table public.notifications
  drop constraint if exists notifications_notification_type_check,
  add constraint notifications_notification_type_check check (
    notification_type in (
      'leave_approved', 'leave_rejected', 'permission_approved', 'permission_rejected',
      'regularization_approved', 'regularization_rejected',
      'onduty_approved', 'onduty_rejected',
      'other_request_approved', 'other_request_rejected',
      'new_approval', 'resignation_update', 'document_verification', 'system_announcement'
    )
  );

-- 5. act_on_approval: cover all 5 request types + write an audit_logs row

create or replace function public.act_on_approval(
  _request_type text,
  _request_id uuid,
  _action text,
  _remarks text default null
)
returns void
language plpgsql security definer set search_path = public as $$
declare
  _owner_id uuid;
  _actor_id uuid := public.current_employee_id();
  _org_id uuid;
  _old_status text;
  _workflow_id uuid;
  _instance_id uuid;
  _recipient_user uuid;
  _notification_type text;
  _title text;
begin
  if _action not in ('approved', 'rejected') then
    raise exception 'act_on_approval: action must be ''approved'' or ''rejected'', got %', _action;
  end if;

  _owner_id := public.request_owner_employee_id(_request_type, _request_id);
  if _owner_id is null then
    raise exception 'act_on_approval: request % / % not found', _request_type, _request_id;
  end if;

  if _actor_id is null or not (public.is_hr_or_admin() or public.is_manager_of(_owner_id)) then
    raise exception 'act_on_approval: not authorized to act on this request';
  end if;

  select organization_id into _org_id from public.employees where id = _owner_id;

  if _request_type = 'leave_request' then
    select status into _old_status from public.leave_requests where id = _request_id;
    update public.leave_requests
      set status = _action, approval_remarks = _remarks
      where id = _request_id and status = 'pending';
  elsif _request_type = 'permission_request' then
    select status into _old_status from public.permission_requests where id = _request_id;
    update public.permission_requests
      set status = _action, approval_remarks = _remarks
      where id = _request_id and status = 'pending';
  elsif _request_type = 'attendance_regularization' then
    select status into _old_status from public.attendance_regularizations where id = _request_id;
    update public.attendance_regularizations
      set status = _action, approval_remarks = _remarks, approver_id = _actor_id
      where id = _request_id and status = 'pending';
  elsif _request_type = 'onduty_request' then
    select status into _old_status from public.onduty_requests where id = _request_id;
    update public.onduty_requests
      set status = _action, approval_remarks = _remarks
      where id = _request_id and status = 'pending';
  elsif _request_type = 'other_request' then
    select status into _old_status from public.other_requests where id = _request_id;
    update public.other_requests
      set status = _action, approval_remarks = _remarks
      where id = _request_id and status = 'pending';
  else
    raise exception 'act_on_approval: unsupported request type %', _request_type;
  end if;

  if not found then
    raise exception 'act_on_approval: request is not pending (already actioned?)';
  end if;

  insert into public.audit_logs (organization_id, actor_user_id, action, module, record_id, old_value, new_value)
    values (
      _org_id, auth.uid(), (case when _action = 'approved' then 'approval' else 'rejection' end),
      'manager_self_service', _request_id,
      jsonb_build_object('request_type', _request_type, 'status', _old_status),
      jsonb_build_object('request_type', _request_type, 'status', _action, 'remarks', _remarks)
    );

  select id into _workflow_id from public.approval_workflows
    where organization_id = _org_id and request_type = _request_type and is_active
    order by created_at limit 1;

  if _workflow_id is not null then
    insert into public.approval_instances (workflow_id, request_type, request_id, status, current_step_order)
      values (_workflow_id, _request_type, _request_id, _action, 1)
      on conflict (request_type, request_id) do update set status = excluded.status
      returning id into _instance_id;

    insert into public.approval_actions (approval_instance_id, step_order, actor_employee_id, action, remarks)
      values (_instance_id, 1, _actor_id, _action, _remarks);
  end if;

  _notification_type := case _request_type
    when 'leave_request' then (case when _action = 'approved' then 'leave_approved' else 'leave_rejected' end)
    when 'permission_request' then (case when _action = 'approved' then 'permission_approved' else 'permission_rejected' end)
    when 'attendance_regularization' then (case when _action = 'approved' then 'regularization_approved' else 'regularization_rejected' end)
    when 'onduty_request' then (case when _action = 'approved' then 'onduty_approved' else 'onduty_rejected' end)
    when 'other_request' then (case when _action = 'approved' then 'other_request_approved' else 'other_request_rejected' end)
  end;
  _title := case when _action = 'approved' then 'Your request has been approved' else 'Your request has been rejected' end;

  select user_id into _recipient_user from public.employees where id = _owner_id;
  if _recipient_user is not null then
    insert into public.notifications (organization_id, recipient_user_id, notification_type, title, body, link_path)
      values (_org_id, _recipient_user, _notification_type, _title, _remarks, '/attendance/event-request');
  end if;
end;
$$;

grant execute on function public.act_on_approval(text, uuid, text, text) to authenticated;
