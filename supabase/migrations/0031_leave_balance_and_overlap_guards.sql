-- Two real gaps found during a production-readiness audit, both against the
-- already-live leave workflow (act_on_approval(), most recently rewritten
-- by 0028 to cover 5 request types + write an audit_logs row):
--
-- a) act_on_approval() flips leave_requests.status to 'approved' but never
--    touches leave_balances — the Balance screen (BalancePage.tsx) never
--    reflects an approved leave's usage, no matter how many requests are
--    approved. Fixed by deducting duration_days from the matching period's
--    `used`/`balance` inside the same transaction as the approval, with a
--    guard against driving balance negative (defense in depth — the app
--    already blocks this client-side in leaveValidation.ts, but a raw
--    approval racing two overlapping requests could still get here).
--
-- b) Overlap protection (leaveValidation.ts) only ever ran in the browser;
--    a direct client insert bypassing the app could still create
--    overlapping leave requests. Closed with a DB-level exclusion
--    constraint mirroring the app's own overlap semantics exactly (same
--    employee, overlapping [from_date, to_date], status still
--    draft/pending/approved — see ACTIVE_STATUSES in leaveValidation.ts).
--
-- This migration re-declares act_on_approval() in full (function body
-- replacement is all-or-nothing) — everything below except the new
-- "deduct leave balance" block is unchanged from 0028's version.

create extension if not exists btree_gist;

alter table public.leave_requests
  add constraint leave_requests_no_overlap
  exclude using gist (
    employee_id with =,
    daterange(from_date, to_date, '[]') with &&
  )
  where (status in ('draft', 'pending', 'approved'));

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
  _leave_type_id uuid;
  _duration numeric(5,2);
  _from_date date;
  _balance_id uuid;
  _remaining numeric(6,2);
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
      where id = _request_id and status = 'pending'
      returning leave_type_id, duration_days, from_date into _leave_type_id, _duration, _from_date;
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

  -- Deduct the matching leave-balance period on approval only. Locks the row
  -- (select ... for update) so two concurrent approvals for the same
  -- employee/leave-type can't both read a stale balance and both pass the
  -- negative-balance check.
  if _request_type = 'leave_request' and _action = 'approved' then
    select id, balance into _balance_id, _remaining
      from public.leave_balances
      where employee_id = _owner_id
        and leave_type_id = _leave_type_id
        and period_start <= _from_date and period_end >= _from_date
      for update;

    if _balance_id is not null then
      if _remaining - _duration < 0 then
        raise exception 'act_on_approval: approving this request would drive leave type % balance negative (% available, % requested)',
          _leave_type_id, _remaining, _duration;
      end if;
      update public.leave_balances
        set used = used + _duration, balance = balance - _duration
        where id = _balance_id;
    end if;
    -- No matching balance period is left un-deducted rather than blocking
    -- the approval outright — leave types with accrual_frequency = 'none'
    -- (e.g. unpaid/compensatory) may legitimately have no leave_balances row.
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

-- Fix pre-existing seed data inconsistency found alongside this bug: seeded
-- leave_balances always show used = 0 even for the seeded employee's 5
-- already-'approved' leave requests (see supabase/seed/seed.sql). Backfill
-- `used`/`balance` for any currently-'approved' leave_requests row whose
-- balance period was never decremented, so existing data matches what
-- act_on_approval() will now maintain going forward.
do $$
declare
  r record;
begin
  for r in
    select lr.employee_id, lr.leave_type_id, lr.duration_days, lr.from_date
    from public.leave_requests lr
    where lr.status = 'approved'
  loop
    update public.leave_balances
      set used = used + r.duration_days, balance = balance - r.duration_days
      where employee_id = r.employee_id
        and leave_type_id = r.leave_type_id
        and period_start <= r.from_date and period_end >= r.from_date;
  end loop;
end;
$$;
