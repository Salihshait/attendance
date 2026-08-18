-- Consistency follow-up to 0052: act_on_approval() already computes _org_id
-- from the request owner early on -- pass it through explicitly to
-- queue_templated_email() too, rather than letting that call fall back to
-- session-based current_organization_id(). Not currently a live bug
-- (act_on_approval always runs inside an authenticated RPC call today, so
-- the session-based fallback has a real session to resolve), but it closes
-- the same class of latent gap 0050-0052 fixed elsewhere, in case this
-- function is ever invoked from a non-interactive context (a scheduled
-- job, a bulk-approval script) in the future. Every other branch is
-- unchanged from 0047.

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
  _leave_type_name text;
  _duration numeric(5,2);
  _from_date date;
  _to_date date;
  _remaining numeric(6,2);
  _remaining_to_deduct numeric(5,2);
  _deduct_amount numeric(5,2);
  _period_row record;
  -- Regularization -> attendance sync
  _reg_date date;
  _reg_check_in timestamptz;
  _reg_check_out timestamptz;
  -- Leave / onduty -> attendance sync
  _onduty_type text;
  _loop_date date;
  _onduty_remark text;
  -- Permission balance
  _permission_date date;
  _permission_minutes int;
  _perm_balance_id uuid;
  _perm_remaining int;
  -- Approval-decision email
  _owner_email text;
  _owner_name text;
  _owner_code text;
  _actor_name text;
  _email_request_type text;
  _email_from_date text;
  _email_to_date text;
  _email_duration text;
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
      returning leave_type_id, duration_days, from_date, to_date into _leave_type_id, _duration, _from_date, _to_date;
  elsif _request_type = 'permission_request' then
    select status into _old_status from public.permission_requests where id = _request_id;
    update public.permission_requests
      set status = _action, approval_remarks = _remarks
      where id = _request_id and status = 'pending'
      returning permission_date, duration_minutes into _permission_date, _permission_minutes;
  elsif _request_type = 'attendance_regularization' then
    select status into _old_status from public.attendance_regularizations where id = _request_id;
    update public.attendance_regularizations
      set status = _action, approval_remarks = _remarks, approver_id = _actor_id
      where id = _request_id and status = 'pending'
      returning attendance_date, requested_check_in, requested_check_out
        into _reg_date, _reg_check_in, _reg_check_out;
  elsif _request_type = 'onduty_request' then
    select status into _old_status from public.onduty_requests where id = _request_id;
    update public.onduty_requests
      set status = _action, approval_remarks = _remarks
      where id = _request_id and status = 'pending'
      returning from_date, to_date, onduty_type into _from_date, _to_date, _onduty_type;
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

  -- Deduct across every leave_balances period for this employee/leave-type
  -- (cumulative model): check the sum first, then spend from the earliest
  -- period with remaining balance forward, so a request isn't blocked just
  -- because the specific month it falls in has too small a slice.
  if _request_type = 'leave_request' and _action = 'approved' then
    select coalesce(sum(balance), 0) into _remaining
      from public.leave_balances
      where employee_id = _owner_id and leave_type_id = _leave_type_id;

    if _remaining - _duration < 0 then
      raise exception 'act_on_approval: approving this request would drive leave type % balance negative (% available, % requested)',
        _leave_type_id, _remaining, _duration;
    end if;

    _remaining_to_deduct := _duration;
    for _period_row in
      select id, balance from public.leave_balances
      where employee_id = _owner_id and leave_type_id = _leave_type_id and balance > 0
      order by period_start
      for update
    loop
      exit when _remaining_to_deduct <= 0;
      _deduct_amount := least(_period_row.balance, _remaining_to_deduct);
      update public.leave_balances
        set used = used + _deduct_amount, balance = balance - _deduct_amount
        where id = _period_row.id;
      _remaining_to_deduct := _remaining_to_deduct - _deduct_amount;
    end loop;
    -- No balance rows at all is left un-deducted rather than blocking the
    -- approval outright -- leave types with accrual_frequency = 'none'
    -- (e.g. unpaid/compensatory) may legitimately have no leave_balances row.
  end if;

  -- Deduct the matching permission-balance period on approval only.
  if _request_type = 'permission_request' and _action = 'approved' then
    select id, balance_minutes into _perm_balance_id, _perm_remaining
      from public.permission_balances
      where employee_id = _owner_id
        and period_start <= _permission_date and period_end >= _permission_date
      for update;

    if _perm_balance_id is not null then
      if _perm_remaining - _permission_minutes < 0 then
        raise exception 'act_on_approval: approving this request would drive permission balance negative (% minutes available, % requested)',
          _perm_remaining, _permission_minutes;
      end if;
      update public.permission_balances
        set used_minutes = used_minutes + _permission_minutes, balance_minutes = balance_minutes - _permission_minutes
        where id = _perm_balance_id;
    end if;
    -- No matching period is left un-deducted rather than blocking the
    -- approval outright, same reasoning as the leave-balance block above.
  end if;

  -- (a) Apply an approved leave to the attendance table: every day in range
  -- becomes day_status = 'leave'. Overwrites whatever was there before
  -- (e.g. a stale seeded 'absent' guess) -- the approved leave is now the
  -- authoritative status for that day.
  if _request_type = 'leave_request' and _action = 'approved' then
    select name into _leave_type_name from public.leave_types where id = _leave_type_id;
    _loop_date := _from_date;
    while _loop_date <= _to_date loop
      insert into public.attendance (organization_id, employee_id, attendance_date, day_status, validation_status, remarks)
      values (_org_id, _owner_id, _loop_date, 'leave', 'completed', coalesce(_leave_type_name, 'Leave'))
      on conflict (employee_id, attendance_date) do update set
        day_status = 'leave',
        validation_status = 'completed',
        remarks = coalesce(excluded.remarks, public.attendance.remarks);
      _loop_date := _loop_date + 1;
    end loop;
  end if;

  -- (b) Apply an approved on-duty/WFH request the same way: every day in
  -- range becomes day_status = 'present' (the employee worked, just not
  -- from a punch-tracked location), with a remark noting which type.
  -- recompute_attendance_day() recognizes this remark and refuses to
  -- overwrite it if punches are ever recomputed for the same date.
  if _request_type = 'onduty_request' and _action = 'approved' then
    _onduty_remark := case when _onduty_type = 'work_from_home' then 'Work From Home' else 'On Duty' end;
    _loop_date := _from_date;
    while _loop_date <= _to_date loop
      insert into public.attendance (organization_id, employee_id, attendance_date, day_status, validation_status, remarks)
      values (_org_id, _owner_id, _loop_date, 'present', 'completed', _onduty_remark)
      on conflict (employee_id, attendance_date) do update set
        day_status = 'present',
        validation_status = 'completed',
        remarks = coalesce(excluded.remarks, public.attendance.remarks);
      _loop_date := _loop_date + 1;
    end loop;
  end if;

  -- Apply an approved regularization by writing the correction as
  -- synthetic 'manual' punches and letting recompute_attendance_day() do
  -- the actual shift-relative math -- the same engine every other punch
  -- (biometric, mobile, web) goes through. A prior 'manual' punch of the
  -- same type for this date is replaced, not stacked, so re-approving a
  -- corrected regularization doesn't accumulate duplicate synthetic punches.
  if _request_type = 'attendance_regularization' and _action = 'approved' then
    if _reg_check_in is not null or _reg_check_out is not null then
      if _reg_check_in is not null then
        delete from public.attendance_punches
          where employee_id = _owner_id and punch_date = _reg_date and source = 'manual' and punch_type = 'in';
        insert into public.attendance_punches (organization_id, employee_id, punch_date, punch_time, punch_type, source)
          values (_org_id, _owner_id, _reg_date, _reg_check_in, 'in', 'manual');
      end if;
      if _reg_check_out is not null then
        delete from public.attendance_punches
          where employee_id = _owner_id and punch_date = _reg_date and source = 'manual' and punch_type = 'out';
        insert into public.attendance_punches (organization_id, employee_id, punch_date, punch_time, punch_type, source)
          values (_org_id, _owner_id, _reg_date, _reg_check_out, 'out', 'manual');
      end if;

      perform public.recompute_attendance_day(_owner_id, _reg_date);

      update public.attendance
        set is_regularized = true, remarks = coalesce(_remarks, remarks)
        where employee_id = _owner_id and attendance_date = _reg_date;
    else
      -- No punch times at all (e.g. a plain present_correction with nothing
      -- but "I was present" and a reason) -- still record the correction
      -- rather than silently dropping it, same fallback as before.
      insert into public.attendance (organization_id, employee_id, attendance_date, day_status, validation_status, is_regularized, remarks)
      values (_org_id, _owner_id, _reg_date, 'present', 'completed', true, _remarks)
      on conflict (employee_id, attendance_date) do update set
        day_status = 'present',
        validation_status = 'completed',
        is_regularized = true,
        remarks = coalesce(excluded.remarks, public.attendance.remarks);
    end if;
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

  -- Queue the decision email to the requesting employee via the same
  -- central engine every other module uses -- not a bespoke send here.
  select official_email, (first_name || coalesce(' ' || last_name, '')), employee_code
    into _owner_email, _owner_name, _owner_code
    from public.employees where id = _owner_id;

  if _owner_email is not null then
    select (first_name || coalesce(' ' || last_name, '')) into _actor_name from public.employees where id = _actor_id;

    _email_request_type := case _request_type
      when 'leave_request' then 'Leave'
      when 'permission_request' then 'Permission'
      when 'attendance_regularization' then 'Attendance Regularization'
      when 'onduty_request' then (case when _onduty_type = 'work_from_home' then 'Work From Home' else 'On Duty' end)
      when 'other_request' then 'Other Request'
    end;
    _email_from_date := coalesce(_from_date::text, _reg_date::text, _permission_date::text);
    _email_to_date := coalesce(_to_date::text, _email_from_date);
    _email_duration := case
      when _duration is not null then _duration::text || ' day(s)'
      when _permission_minutes is not null then _permission_minutes::text || ' min'
      else '-'
    end;

    perform public.queue_templated_email(
      case when _action = 'approved' then 'approval_approved' else 'approval_rejected' end,
      _owner_email,
      jsonb_build_object(
        'employee_name', _owner_name,
        'employee_id', _owner_code,
        'manager_name', _actor_name,
        'request_type', _email_request_type,
        'from_date', _email_from_date,
        'to_date', _email_to_date,
        'duration', _email_duration,
        'remarks', coalesce(_remarks, ''),
        'status', _action,
        'application_id', _request_id::text
      ),
      _request_type || ':' || _request_id::text,
      _organization_id => _org_id
    );
  end if;
end;
$$;
