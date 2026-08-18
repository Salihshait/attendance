-- Demo reference + organization data for local development.
-- Run after all migrations: `supabase db reset` (applies migrations then this file
-- automatically), or `psql ... -f supabase/seed/seed.sql` directly.
--
-- Employee rows are created with user_id = NULL. To let a real person log
-- in as one of them: create a Supabase Auth user (dashboard, or
-- `supabase.auth.admin.createUser`), then
--   update public.employees set user_id = '<auth-user-uuid>' where employee_code = 'EMP0001';
--   insert into public.profiles (id, organization_id, email) values ('<auth-user-uuid>', '11111111-1111-1111-1111-111111111111', '<email>');
--   insert into public.user_roles (user_id, role_id, organization_id)
--     select '<auth-user-uuid>', id, '11111111-1111-1111-1111-111111111111' from public.roles where code = 'employee';
-- No real personal data appears below — names/emails are fictitious placeholders.

begin;

insert into public.organizations (id, name, short_code, timezone) values
  ('11111111-1111-1111-1111-111111111111', 'Demo Organization Pvt Ltd', 'DEMOORG', 'Asia/Kolkata');

insert into public.locations (id, organization_id, name, city, state) values
  ('11111111-1111-1111-1111-100000000001', '11111111-1111-1111-1111-111111111111', 'Chennai', 'Chennai', 'Tamil Nadu'),
  ('11111111-1111-1111-1111-100000000002', '11111111-1111-1111-1111-111111111111', 'Bengaluru', 'Bengaluru', 'Karnataka'),
  ('11111111-1111-1111-1111-100000000003', '11111111-1111-1111-1111-111111111111', 'Hyderabad', 'Hyderabad', 'Telangana');

insert into public.departments (id, organization_id, name, code) values
  ('11111111-1111-1111-1111-200000000001', '11111111-1111-1111-1111-111111111111', 'Software', 'SW'),
  ('11111111-1111-1111-1111-200000000002', '11111111-1111-1111-1111-111111111111', 'Human Resources', 'HR'),
  ('11111111-1111-1111-1111-200000000003', '11111111-1111-1111-1111-111111111111', 'Finance', 'FIN'),
  ('11111111-1111-1111-1111-200000000004', '11111111-1111-1111-1111-111111111111', 'Sales', 'SAL'),
  ('11111111-1111-1111-1111-200000000005', '11111111-1111-1111-1111-111111111111', 'Leadership', 'LDR');

insert into public.designations (id, organization_id, name) values
  ('11111111-1111-1111-1111-300000000001', '11111111-1111-1111-1111-111111111111', 'Software Engineer'),
  ('11111111-1111-1111-1111-300000000002', '11111111-1111-1111-1111-111111111111', 'Senior Software Engineer'),
  ('11111111-1111-1111-1111-300000000003', '11111111-1111-1111-1111-111111111111', 'Engineering Manager'),
  ('11111111-1111-1111-1111-300000000004', '11111111-1111-1111-1111-111111111111', 'HR Administrator'),
  ('11111111-1111-1111-1111-300000000005', '11111111-1111-1111-1111-111111111111', 'Finance Analyst'),
  ('11111111-1111-1111-1111-300000000006', '11111111-1111-1111-1111-111111111111', 'Sales Executive'),
  ('11111111-1111-1111-1111-300000000007', '11111111-1111-1111-1111-111111111111', 'VP Engineering');

insert into public.grades (id, organization_id, name, rank) values
  ('11111111-1111-1111-1111-400000000001', '11111111-1111-1111-1111-111111111111', 'G2', 2),
  ('11111111-1111-1111-1111-400000000002', '11111111-1111-1111-1111-111111111111', 'G4', 4),
  ('11111111-1111-1111-1111-400000000003', '11111111-1111-1111-1111-111111111111', 'G5', 5),
  ('11111111-1111-1111-1111-400000000004', '11111111-1111-1111-1111-111111111111', 'G6', 6),
  ('11111111-1111-1111-1111-400000000005', '11111111-1111-1111-1111-111111111111', 'G8', 8);

insert into public.shifts (id, organization_id, name, start_time, end_time, grace_minutes) values
  ('11111111-1111-1111-1111-500000000001', '11111111-1111-1111-1111-111111111111', 'General Shift', '09:30', '18:30', 15),
  ('11111111-1111-1111-1111-500000000002', '11111111-1111-1111-1111-111111111111', 'Morning Shift', '07:00', '16:00', 10),
  ('11111111-1111-1111-1111-500000000003', '11111111-1111-1111-1111-111111111111', 'Night Shift', '22:00', '07:00', 10);

insert into public.leave_types (id, organization_id, code, name, is_paid, accrual_frequency) values
  ('11111111-1111-1111-1111-600000000001', '11111111-1111-1111-1111-111111111111', 'CL', 'Casual Leave', true, 'monthly'),
  ('11111111-1111-1111-1111-600000000002', '11111111-1111-1111-1111-111111111111', 'SL', 'Sick Leave', true, 'monthly'),
  ('11111111-1111-1111-1111-600000000003', '11111111-1111-1111-1111-111111111111', 'PL', 'Privilege Leave', true, 'yearly'),
  ('11111111-1111-1111-1111-600000000004', '11111111-1111-1111-1111-111111111111', 'EL', 'Earned Leave', true, 'yearly'),
  ('11111111-1111-1111-1111-600000000005', '11111111-1111-1111-1111-111111111111', 'LOP', 'Loss of Pay', false, 'none'),
  ('11111111-1111-1111-1111-600000000006', '11111111-1111-1111-1111-111111111111', 'ML', 'Maternity Leave', true, 'none'),
  ('11111111-1111-1111-1111-600000000007', '11111111-1111-1111-1111-111111111111', 'PTL', 'Paternity Leave', true, 'none'),
  ('11111111-1111-1111-1111-600000000008', '11111111-1111-1111-1111-111111111111', 'SPL', 'Special Leave', true, 'none');

-- Holidays: current + next year, generated dynamically so the seed never goes stale.
insert into public.holidays (organization_id, holiday_date, name, holiday_type)
select '11111111-1111-1111-1111-111111111111', d, name, 'public' from (values
  (make_date(extract(year from now())::int, 1, 26), 'Republic Day'),
  (make_date(extract(year from now())::int, 8, 15), 'Independence Day'),
  (make_date(extract(year from now())::int, 10, 2), 'Gandhi Jayanti'),
  (make_date(extract(year from now())::int, 12, 25), 'Christmas'),
  (make_date(extract(year from now())::int + 1, 1, 26), 'Republic Day'),
  (make_date(extract(year from now())::int + 1, 8, 15), 'Independence Day')
) as h(d, name);

-- Employees. Reporting chain: EMP0004 (VP) -> EMP0002 (Eng Manager) -> EMP0001.
-- EMP0003 (HR Admin) reports directly to EMP0004.
insert into public.employees (
  id, organization_id, employee_code, first_name, last_name, gender, date_of_joining,
  official_email, official_mobile, department_id, designation_id, location_id, grade_id,
  reporting_manager_id, employment_type, employment_status
) values
  ('11111111-1111-1111-1111-700000000004', '11111111-1111-1111-1111-111111111111', 'EMP0004', 'Karthik', 'Subramanian', 'male', '2015-01-15',
   'karthik.s@example.com', '9800000004', '11111111-1111-1111-1111-200000000005', '11111111-1111-1111-1111-300000000007',
   '11111111-1111-1111-1111-100000000002', '11111111-1111-1111-1111-400000000005', null, 'full_time', 'active'),
  ('11111111-1111-1111-1111-700000000002', '11111111-1111-1111-1111-111111111111', 'EMP0002', 'Priya', 'Nandakumar', 'female', '2018-03-12',
   'priya.n@example.com', '9800000002', '11111111-1111-1111-1111-200000000001', '11111111-1111-1111-1111-300000000003',
   '11111111-1111-1111-1111-100000000001', '11111111-1111-1111-1111-400000000004', '11111111-1111-1111-1111-700000000004', 'full_time', 'active'),
  ('11111111-1111-1111-1111-700000000003', '11111111-1111-1111-1111-111111111111', 'EMP0003', 'Divya', 'Krishnan', 'female', '2019-07-01',
   'divya.k@example.com', '9800000003', '11111111-1111-1111-1111-200000000002', '11111111-1111-1111-1111-300000000004',
   '11111111-1111-1111-1111-100000000002', '11111111-1111-1111-1111-400000000003', '11111111-1111-1111-1111-700000000004', 'full_time', 'active'),
  ('11111111-1111-1111-1111-700000000001', '11111111-1111-1111-1111-111111111111', 'EMP0001', 'Arjun', 'Rao', 'male', '2021-05-26',
   'arjun.rao@example.com', '9800000001', '11111111-1111-1111-1111-200000000001', '11111111-1111-1111-1111-300000000002',
   '11111111-1111-1111-1111-100000000001', '11111111-1111-1111-1111-400000000002', '11111111-1111-1111-1111-700000000002', 'full_time', 'active'),
  ('11111111-1111-1111-1111-700000000005', '11111111-1111-1111-1111-111111111111', 'EMP0005', 'Meena', 'Iyer', 'female', '2022-02-14',
   'meena.i@example.com', '9800000005', '11111111-1111-1111-1111-200000000001', '11111111-1111-1111-1111-300000000001',
   '11111111-1111-1111-1111-100000000001', '11111111-1111-1111-1111-400000000001', '11111111-1111-1111-1111-700000000002', 'full_time', 'active'),
  ('11111111-1111-1111-1111-700000000006', '11111111-1111-1111-1111-111111111111', 'EMP0006', 'Rahul', 'Verma', 'male', '2020-09-01',
   'rahul.v@example.com', '9800000006', '11111111-1111-1111-1111-200000000001', '11111111-1111-1111-1111-300000000002',
   '11111111-1111-1111-1111-100000000001', '11111111-1111-1111-1111-400000000002', '11111111-1111-1111-1111-700000000002', 'full_time', 'active'),
  ('11111111-1111-1111-1111-700000000007', '11111111-1111-1111-1111-111111111111', 'EMP0007', 'Sneha', 'Reddy', 'female', '2021-11-08',
   'sneha.r@example.com', '9800000007', '11111111-1111-1111-1111-200000000003', '11111111-1111-1111-1111-300000000005',
   '11111111-1111-1111-1111-100000000003', '11111111-1111-1111-1111-400000000001', '11111111-1111-1111-1111-700000000004', 'full_time', 'active'),
  ('11111111-1111-1111-1111-700000000008', '11111111-1111-1111-1111-111111111111', 'EMP0008', 'Vikram', 'Nair', 'male', '2023-01-20',
   'vikram.n@example.com', '9800000008', '11111111-1111-1111-1111-200000000004', '11111111-1111-1111-1111-300000000006',
   '11111111-1111-1111-1111-100000000002', '11111111-1111-1111-1111-400000000001', '11111111-1111-1111-1111-700000000004', 'full_time', 'active'),
  ('11111111-1111-1111-1111-700000000009', '11111111-1111-1111-1111-111111111111', 'EMP0009', 'Anita', 'Das', 'female', '2022-06-06',
   'anita.d@example.com', '9800000009', '11111111-1111-1111-1111-200000000004', '11111111-1111-1111-1111-300000000006',
   '11111111-1111-1111-1111-100000000003', '11111111-1111-1111-1111-400000000001', '11111111-1111-1111-1111-700000000004', 'full_time', 'active'),
  ('11111111-1111-1111-1111-700000000010', '11111111-1111-1111-1111-111111111111', 'EMP0010', 'Suresh', 'Pillai', 'male', '2023-08-15',
   'suresh.p@example.com', '9800000010', '11111111-1111-1111-1111-200000000003', '11111111-1111-1111-1111-300000000005',
   '11111111-1111-1111-1111-100000000001', '11111111-1111-1111-1111-400000000001', '11111111-1111-1111-1111-700000000004', 'full_time', 'active');

insert into public.employee_profiles (employee_id, marital_status, nationality, personal_email, city, state, country)
select id, 'single', 'Indian', lower(employee_code) || '.personal@example.com', 'Chennai', 'Tamil Nadu', 'India'
from public.employees where organization_id = '11111111-1111-1111-1111-111111111111';

insert into public.shift_assignments (employee_id, shift_id, effective_from)
select id, '11111111-1111-1111-1111-500000000001', date_of_joining
from public.employees where organization_id = '11111111-1111-1111-1111-111111111111';

-- EMP0006 actually works Night Shift -- override the blanket General Shift
-- assignment above so recompute_attendance_day() (and every other
-- shift_assignments-based lookup, e.g. get_missing_attendance()) resolves
-- the shift this employee's overnight demo data below is generated against.
insert into public.shift_assignments (employee_id, shift_id, effective_from)
values ('11111111-1111-1111-1111-700000000006', '11111111-1111-1111-1111-500000000003', current_date - 90);

-- Opening leave balances for the current year, per employee per leave type.
-- Yearly/none-accrual types (PL, EL, LOP, ML, PTL, SPL) get one annual row.
-- Monthly-accrual types (CL, SL) get 12 monthly rows instead — matches the
-- reference app's Balance screen exactly, which shows a full year of
-- individual monthly opening/used/balance rows for Casual Leave/Sick Leave
-- when expanded, not one flat annual row (see 0042_monthly_leave_balance_periods.sql).
insert into public.leave_balances (employee_id, leave_type_id, period_start, period_end, opening, credited, used, balance)
select
  e.id,
  lt.id,
  make_date(extract(year from now())::int, 1, 1),
  make_date(extract(year from now())::int, 12, 31),
  case lt.code when 'PL' then 18 when 'EL' then 12 else 0 end,
  0, 0,
  case lt.code when 'PL' then 18 when 'EL' then 12 else 0 end
from public.employees e
cross join public.leave_types lt
where e.organization_id = '11111111-1111-1111-1111-111111111111'
  and lt.organization_id = '11111111-1111-1111-1111-111111111111'
  and lt.accrual_frequency <> 'monthly';

insert into public.leave_balances (employee_id, leave_type_id, period_start, period_end, opening, credited, used, balance)
select
  e.id,
  lt.id,
  make_date(extract(year from now())::int, months.m, 1),
  (make_date(extract(year from now())::int, months.m, 1) + interval '1 month - 1 day')::date,
  1, 0, 0, 1
from public.employees e
cross join public.leave_types lt
cross join generate_series(1, 12) as months(m)
where e.organization_id = '11111111-1111-1111-1111-111111111111'
  and lt.organization_id = '11111111-1111-1111-1111-111111111111'
  and lt.accrual_frequency = 'monthly';

-- Default single-step (reporting manager) approval workflows for the three
-- request types the Attendance module raises. HR/admin can always act too
-- via is_hr_or_admin() in act_on_approval(), independent of workflow steps.
insert into public.approval_workflows (id, organization_id, request_type, name, is_active) values
  ('11111111-1111-1111-1111-800000000001', '11111111-1111-1111-1111-111111111111', 'leave_request', 'Leave Approval', true),
  ('11111111-1111-1111-1111-800000000002', '11111111-1111-1111-1111-111111111111', 'permission_request', 'Permission Approval', true),
  ('11111111-1111-1111-1111-800000000003', '11111111-1111-1111-1111-111111111111', 'attendance_regularization', 'Regularization Approval', true);

insert into public.approval_steps (workflow_id, step_order, approver_type, is_final) values
  ('11111111-1111-1111-1111-800000000001', 1, 'reporting_manager', true),
  ('11111111-1111-1111-1111-800000000002', 1, 'reporting_manager', true),
  ('11111111-1111-1111-1111-800000000003', 1, 'reporting_manager', true);

-- Default active email template per template_key (0047), so the Email
-- Templates admin screen has real, previewable/test-sendable content out
-- of the box instead of an empty list.
-- E'...' escape-string syntax is required for \n to actually become a
-- newline -- a plain '...' string treats backslash literally (confirmed
-- live: the Email Templates preview rendered a literal "\n\n" instead of a
-- line break with plain-quoted strings).
insert into public.email_templates (organization_id, template_key, name, subject, body, is_active) values
  ('11111111-1111-1111-1111-111111111111', 'approval_request', 'Approval Request (default)',
   'Approval needed: {{request_type}} from {{employee_name}}',
   E'Hi {{manager_name}},\n\n{{employee_name}} ({{employee_id}}) has requested {{request_type}} from {{from_date}} to {{to_date}} ({{duration}}).\n\nReason: {{reason}}\n\nApplication ID: {{application_id}}\nReview: {{approval_url}}',
   true),
  ('11111111-1111-1111-1111-111111111111', 'approval_approved', 'Approval Approved (default)',
   'Your {{request_type}} request has been approved',
   E'Hi {{employee_name}},\n\nYour {{request_type}} request ({{application_id}}) from {{from_date}} to {{to_date}} ({{duration}}) has been approved by {{manager_name}}.\n\nRemarks: {{remarks}}',
   true),
  ('11111111-1111-1111-1111-111111111111', 'approval_rejected', 'Approval Rejected (default)',
   'Your {{request_type}} request has been rejected',
   E'Hi {{employee_name}},\n\nYour {{request_type}} request ({{application_id}}) from {{from_date}} to {{to_date}} ({{duration}}) has been rejected by {{manager_name}}.\n\nRemarks: {{remarks}}',
   true),
  ('11111111-1111-1111-1111-111111111111', 'missing_punch', 'Missing Punch (default)',
   'Missing attendance punch for {{employee_name}} on {{from_date}}',
   E'Hi {{manager_name}},\n\n{{employee_name}} ({{employee_id}}) has a missing punch on {{from_date}}. Status: {{status}}.',
   true),
  ('11111111-1111-1111-1111-111111111111', 'early_going', 'Early Going (default)',
   'Early going recorded for {{employee_name}} on {{from_date}}',
   E'Hi {{manager_name}},\n\n{{employee_name}} ({{employee_id}}) left early on {{from_date}}. Remarks: {{remarks}}',
   true),
  ('11111111-1111-1111-1111-111111111111', 'wfh_weekly_alert', 'WFH Weekly Alert (default)',
   'WFH threshold exceeded for {{employee_name}}',
   E'Hi {{manager_name}},\n\n{{employee_name}} ({{employee_id}}) has taken WFH for {{duration}} this week ({{from_date}} to {{to_date}}), above the configured threshold.',
   true),
  ('11111111-1111-1111-1111-111111111111', 'comp_off_expiry', 'Comp-Off Expiry (default)',
   'Your Comp-Off credit is expiring soon',
   E'Hi {{employee_name}},\n\nYour Comp-Off earned on {{from_date}} will expire on {{to_date}} if unused. Remarks: {{remarks}}',
   true),
  ('11111111-1111-1111-1111-111111111111', 'attendance_closure_reminder', 'Attendance Closure Reminder (default)',
   'Attendance closure approaching for {{from_date}} to {{to_date}}',
   E'Hi {{employee_name}},\n\nThe attendance period {{from_date}} to {{to_date}} closes soon. Please resolve any pending attendance issues before then.',
   true),
  ('11111111-1111-1111-1111-111111111111', 'reconciliation_alert', 'Reconciliation Alert (default)',
   'Attendance reconciliation mismatch for {{employee_name}} on {{from_date}}',
   E'Hi {{manager_name}},\n\nA reconciliation mismatch was found for {{employee_name}} ({{employee_id}}) on {{from_date}}. Status: {{status}}. Remarks: {{remarks}}',
   true),
  ('11111111-1111-1111-1111-111111111111', 'system_notification', 'System Notification (default)',
   '{{request_type}}',
   E'Hi {{employee_name}},\n\n{{remarks}}',
   true);

-- Attendance history: last ~60 days for every seeded employee. Weekoffs and
-- holidays are marked from the rows inserted above; everything else is
-- randomized punches around each employee's actual assigned shift (General
-- Shift for most; Night Shift 22:00-07:00 for EMP0006, giving a real example
-- of the "10 PM -> 6 AM is 8 hours, not negative" overnight rule), fed
-- through attendance_punches + recompute_attendance_day() -- the same
-- multi-session engine every other punch source uses -- instead of writing
-- attendance's metric columns directly. A majority of days get a lunch-break
-- split into two sessions rather than a single in/out pair, so the demo data
-- itself exercises the "sum of sessions, not first-in to final-out" rule
-- (src/lib/attendanceCalc.ts's computeSessionsFromPunches mirrors this).
do $$
declare
  emp record;
  d date;
  is_weekoff boolean;
  holiday_name text;
  roll numeric;
  emp_shift_id uuid;
  shift_start time;
  shift_end time;
  shift_start_minutes int;
  shift_end_minutes int; -- normalized so it's always > shift_start_minutes, even overnight
  first_in_minutes int;
  last_out_minutes int;
  lunch_out_minutes int;
  lunch_in_minutes int;
  has_lunch_break boolean;
  today constant date := current_date;
  start_date date := current_date - 60;
  org_id constant uuid := '11111111-1111-1111-1111-111111111111';
begin
  for emp in select id from public.employees where organization_id = org_id loop
    select sa.shift_id, s.start_time, s.end_time into emp_shift_id, shift_start, shift_end
      from public.shift_assignments sa
      join public.shifts s on s.id = sa.shift_id
      where sa.employee_id = emp.id and sa.effective_from <= today
      order by sa.effective_from desc limit 1;

    continue when emp_shift_id is null; -- no shift assigned -- nothing to seed

    shift_start_minutes := extract(hour from shift_start)::int * 60 + extract(minute from shift_start)::int;
    shift_end_minutes := extract(hour from shift_end)::int * 60 + extract(minute from shift_end)::int;
    if shift_end_minutes <= shift_start_minutes then
      shift_end_minutes := shift_end_minutes + 1440; -- overnight shift
    end if;

    d := start_date;
    while d <= today loop
      is_weekoff := extract(dow from d) in (0, 6);
      select name into holiday_name from public.holidays where organization_id = org_id and holiday_date = d;

      if is_weekoff then
        insert into public.attendance (organization_id, employee_id, attendance_date, shift_id, day_status, validation_status)
        values (org_id, emp.id, d, emp_shift_id, 'weekoff', 'completed')
        on conflict (employee_id, attendance_date) do nothing;
      elsif holiday_name is not null then
        insert into public.attendance (organization_id, employee_id, attendance_date, shift_id, day_status, validation_status, remarks)
        values (org_id, emp.id, d, emp_shift_id, 'holiday', 'completed', holiday_name)
        on conflict (employee_id, attendance_date) do nothing;
      else
        delete from public.attendance_punches where employee_id = emp.id and punch_date = d;

        roll := random();
        if roll >= 0.04 then
          first_in_minutes := round(shift_start_minutes - 10 + random() * 95)::int; -- up to slightly early, or up to ~85 min late
          last_out_minutes := round(shift_end_minutes - 30 + random() * 160)::int; -- around shift end, sometimes well past it
          has_lunch_break := random() < 0.6 and (last_out_minutes - first_in_minutes) > 180;

          if has_lunch_break then
            lunch_out_minutes := round((first_in_minutes + last_out_minutes) / 2.0 - 30)::int;
            lunch_in_minutes := lunch_out_minutes + 15 + round(random() * 45)::int; -- 15-60 min break

            insert into public.attendance_punches (organization_id, employee_id, punch_date, punch_time, punch_type, device, location, source)
            values
              (org_id, emp.id, d, d + (first_in_minutes || ' minutes')::interval, 'in',
               case when random() < 0.5 then 'Biometric-Gate1' else 'Biometric-Gate2' end, 'Chennai Office',
               case when random() < 0.85 then 'biometric' else 'mobile' end),
              (org_id, emp.id, d, d + (lunch_out_minutes || ' minutes')::interval, 'out',
               case when random() < 0.5 then 'Biometric-Gate1' else 'Biometric-Gate2' end, 'Chennai Office',
               case when random() < 0.85 then 'biometric' else 'mobile' end),
              (org_id, emp.id, d, d + (lunch_in_minutes || ' minutes')::interval, 'in',
               case when random() < 0.5 then 'Biometric-Gate1' else 'Biometric-Gate2' end, 'Chennai Office',
               case when random() < 0.85 then 'biometric' else 'mobile' end),
              (org_id, emp.id, d, d + (last_out_minutes || ' minutes')::interval, 'out',
               case when random() < 0.5 then 'Biometric-Gate1' else 'Biometric-Gate2' end, 'Chennai Office',
               case when random() < 0.85 then 'biometric' else 'mobile' end);
          else
            insert into public.attendance_punches (organization_id, employee_id, punch_date, punch_time, punch_type, device, location, source)
            values
              (org_id, emp.id, d, d + (first_in_minutes || ' minutes')::interval, 'in',
               case when random() < 0.5 then 'Biometric-Gate1' else 'Biometric-Gate2' end, 'Chennai Office',
               case when random() < 0.85 then 'biometric' else 'mobile' end),
              (org_id, emp.id, d, d + (last_out_minutes || ' minutes')::interval, 'out',
               case when random() < 0.5 then 'Biometric-Gate1' else 'Biometric-Gate2' end, 'Chennai Office',
               case when random() < 0.85 then 'biometric' else 'mobile' end);
          end if;
        end if;
        -- roll < 0.04: no punches inserted at all -- recompute_attendance_day
        -- below correctly derives day_status = 'absent' from zero punches.

        perform public.recompute_attendance_day(emp.id, d);
      end if;

      d := d + 1;
    end loop;
  end loop;
end $$;

-- Sample request history for EMP0001, so Event Request / Balance screens
-- have something to show on a fresh install.
insert into public.leave_requests (
  organization_id, employee_id, leave_type_id, reporting_manager_id, entry_by,
  from_date, to_date, duration_days, reason, status, approval_remarks, applied_on
)
select
  '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-700000000001',
  (select id from public.leave_types where organization_id = '11111111-1111-1111-1111-111111111111' and code = v.code),
  '11111111-1111-1111-1111-700000000002', '11111111-1111-1111-1111-700000000001',
  v.from_date::date, v.to_date::date, v.duration_days, v.reason, v.status, v.approval_remarks, v.applied_on::timestamptz
from (values
  ('SL', '2026-07-09', '2026-07-10', 2, 'Going to native for mother''s treatment', 'approved', null, '2026-07-06T11:53:00Z'),
  ('CL', '2026-06-11', '2026-06-12', 2, 'Going to native', 'approved', null, '2026-06-10T10:51:00Z'),
  ('SL', '2026-04-24', '2026-04-24', 1, 'Going to native', 'approved', null, '2026-04-22T16:09:00Z'),
  ('CL', '2026-03-30', '2026-03-31', 2, 'Grandmother death in native', 'approved', null, '2026-04-01T12:07:00Z'),
  ('PL', '2026-03-12', '2026-03-13', 2, 'Parents health issue', 'approved', null, '2026-03-12T15:39:00Z'),
  ('CL', '2026-08-20', '2026-08-20', 1, 'Personal work', 'pending', null, '2026-08-13T09:15:00Z'),
  ('SL', '2026-08-05', '2026-08-05', 1, 'Fever', 'rejected', 'Please regularize as WFH instead', '2026-08-04T08:30:00Z')
) as v(code, from_date, to_date, duration_days, reason, status, approval_remarks, applied_on);

-- The leave_balances rows above were inserted with a full opening balance
-- and used = 0 before any leave_requests existed; sync used/balance now
-- that the approved requests above exist, so a fresh install's Balance
-- screen isn't inconsistent with its own request history from day one.
-- (act_on_approval(), as of 0031, keeps this in sync for anything approved
-- through the app after seeding.) Grouped by each request's own from_date
-- against the matching period row (not just "today"'s period) — CL/SL now
-- have 12 monthly rows each, so a request from any month must land in that
-- month's row, not have every month's usage collapsed into whichever
-- period happens to contain the seed's run date.
update public.leave_balances lb
set used = lb.used + approved.total_days,
    balance = lb.balance - approved.total_days
from (
  select employee_id, leave_type_id, from_date, sum(duration_days) as total_days
  from public.leave_requests
  where status = 'approved'
  group by employee_id, leave_type_id, from_date
) as approved
where lb.employee_id = approved.employee_id
  and lb.leave_type_id = approved.leave_type_id
  and lb.period_start <= approved.from_date and lb.period_end >= approved.from_date;

insert into public.permission_requests (
  organization_id, employee_id, reporting_manager_id, entry_by,
  permission_date, from_time, to_time, duration_minutes, reason, status, approval_remarks, applied_on
)
select
  '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-700000000001',
  '11111111-1111-1111-1111-700000000002', '11111111-1111-1111-1111-700000000001',
  v.permission_date::date, v.from_time::time, v.to_time::time, v.duration_minutes, v.reason, v.status, v.approval_remarks, v.applied_on::timestamptz
from (values
  ('2026-06-10', '09:30', '11:00', 90, 'Going to native', 'approved', null, '2026-06-10T18:56:00Z'),
  ('2026-05-22', '09:30', '11:00', 90, 'Went to Bank', 'approved', null, '2026-05-22T18:49:00Z'),
  ('2026-05-09', '09:30', '11:00', 90, 'Going to native', 'rejected', 'Wrong date mentioned', '2026-05-09T20:28:00Z'),
  ('2026-05-08', '09:30', '11:00', 90, 'Going to native', 'approved', null, '2026-05-12T15:45:00Z'),
  ('2026-08-10', '10:00', '11:30', 90, 'Went to hospital', 'pending', null, '2026-08-09T09:03:00Z')
) as v(permission_date, from_time, to_time, duration_minutes, reason, status, approval_remarks, applied_on);

insert into public.attendance_regularizations (
  organization_id, employee_id, approver_id, attendance_date, regularization_type, reason, status, approval_remarks, applied_on
)
select
  '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-700000000001',
  case when v.status = 'pending' then null else '11111111-1111-1111-1111-700000000002'::uuid end,
  v.attendance_date::date, v.regularization_type, v.reason, v.status, v.approval_remarks, v.applied_on::timestamptz
from (values
  ('2026-03-11', 'missed_punch', 'Checkout time was not updated', 'approved', null, '2026-03-27T15:04:00Z'),
  ('2026-02-23', 'work_from_home', 'Work From Home', 'approved', null, '2026-02-27T12:38:00Z'),
  ('2026-01-14', 'work_from_home', 'Work from Home', 'approved', null, '2026-01-17T08:38:00Z'),
  ('2026-01-08', 'present_correction', 'Presented on that day', 'approved', null, '2025-12-31T17:18:00Z'),
  ('2026-07-25', 'missed_punch', 'Missed out punch', 'rejected', 'Need to check with security log', '2026-07-26T15:12:00Z'),
  ('2026-08-11', 'missed_punch', 'Forgot to punch in the morning', 'pending', null, '2026-08-12T09:20:00Z')
) as v(attendance_date, regularization_type, reason, status, approval_remarks, applied_on);

-- Reflect the approved leave above in EMP0001's balances.
update public.leave_balances b
set used = t.used_days, balance = b.opening - t.used_days
from (
  select lt.id as leave_type_id, sum(lr.duration_days) as used_days
  from public.leave_requests lr
  join public.leave_types lt on lt.id = lr.leave_type_id
  where lr.employee_id = '11111111-1111-1111-1111-700000000001' and lr.status = 'approved'
  group by lt.id
) t
where b.employee_id = '11111111-1111-1111-1111-700000000001' and b.leave_type_id = t.leave_type_id;

-- ============================================================
-- EIP module: document catalog, statutory/bank details, payslip
-- history, and EMP0001's academic/employment/family/asset records.
-- Note: employee_documents and policy_documents are intentionally NOT
-- seeded here — their file_path would point at nothing in Storage, and a
-- "Download" that 404s is worse than an honest empty state. Upload a real
-- file through the app (Documents Upload tab / Policies page) instead.
-- ============================================================

insert into public.documents (organization_id, code, name, is_required) values
  ('11111111-1111-1111-1111-111111111111', 'ID_PROOF', 'ID Proof', true),
  ('11111111-1111-1111-1111-111111111111', 'ADDRESS_PROOF', 'Address Proof', true),
  ('11111111-1111-1111-1111-111111111111', 'EDUCATION', 'Education', false),
  ('11111111-1111-1111-1111-111111111111', 'EXPERIENCE', 'Experience', false),
  ('11111111-1111-1111-1111-111111111111', 'PAN', 'PAN', true),
  ('11111111-1111-1111-1111-111111111111', 'BANK', 'Bank', true),
  ('11111111-1111-1111-1111-111111111111', 'OTHER', 'Other', false);

-- Statutory + bank details for every seeded employee (fictitious values —
-- masked at read time by get_my_statutory_details()/get_my_bank_details()).
with numbered_employees as (
  select e.id, e.first_name, e.last_name, row_number() over (order by e.employee_code) as rn
  from public.employees e
  where e.organization_id = '11111111-1111-1111-1111-111111111111'
)
insert into public.statutory_details (employee_id, pan_number, aadhaar_number, uan_number, pf_number, esi_number, tax_regime)
select
  id,
  'ABCPX' || lpad(rn::text, 4, '0') || 'F',
  lpad((200000000000 + rn * 111111)::text, 12, '0'),
  '100100' || lpad(rn::text, 4, '0'),
  'PF' || lpad(rn::text, 6, '0'),
  case when rn % 3 = 0 then 'ESI' || lpad(rn::text, 6, '0') else null end,
  case when rn % 2 = 0 then 'new' else 'old' end
from numbered_employees;

with numbered_employees as (
  select e.id, e.first_name, e.last_name, row_number() over (order by e.employee_code) as rn
  from public.employees e
  where e.organization_id = '11111111-1111-1111-1111-111111111111'
)
insert into public.bank_details (employee_id, bank_name, account_number, ifsc_code, branch, account_holder_name)
select
  id,
  (array['State Bank of India', 'HDFC Bank', 'ICICI Bank', 'Axis Bank', 'Kotak Mahindra Bank'])[1 + (rn % 5)],
  lpad((100000000000 + rn * 987654)::text, 14, '0'),
  (array['SBIN0001234', 'HDFC0000456', 'ICIC0000789', 'UTIB0001122', 'KKBK0003344'])[1 + (rn % 5)],
  'Main Branch',
  trim(first_name || ' ' || coalesce(last_name, ''))
from numbered_employees;

-- Six months of payslip history for every employee, scaled off grade rank.
do $$
declare
  emp record;
  m int;
  target_date date;
  monthly_gross numeric;
  basic numeric;
  hra numeric;
  allowances numeric;
  pf numeric;
  esi numeric;
  pt constant numeric := 200;
  tds numeric;
  gross numeric;
  total_ded numeric;
  net numeric;
  org_id constant uuid := '11111111-1111-1111-1111-111111111111';
begin
  for emp in
    select e.id, coalesce(g.rank, 2) as grade_rank
    from public.employees e
    left join public.grades g on g.id = e.grade_id
    where e.organization_id = org_id
  loop
    monthly_gross := 30000 + emp.grade_rank * 15000;
    basic := round(monthly_gross * 0.5, 2);
    hra := round(monthly_gross * 0.2, 2);
    allowances := round(monthly_gross * 0.3, 2);
    pf := round(basic * 0.12, 2);
    esi := 0;
    tds := round(monthly_gross * 0.05, 2);
    gross := basic + hra + allowances;
    total_ded := pf + esi + pt + tds;
    net := gross - total_ded;

    for m in 0..5 loop
      target_date := date_trunc('month', current_date) - (m || ' months')::interval;
      insert into public.payslips (
        employee_id, pay_period_month, pay_period_year,
        basic_pay, hra, other_allowances, gross_earnings,
        pf_employee_contribution, esi_employee_contribution, professional_tax, tds,
        total_deductions, net_pay
      ) values (
        emp.id, extract(month from target_date)::int, extract(year from target_date)::int,
        basic, hra, allowances, gross,
        pf, esi, pt, tds,
        total_ded, net
      )
      on conflict (employee_id, pay_period_year, pay_period_month) do nothing;
    end loop;
  end loop;
end $$;

-- Richer profile data for EMP0001 (the primary demo account) so every
-- profile tab has something real to show.
insert into public.family_members (employee_id, name, relationship, date_of_birth, gender, occupation, is_dependent, contact_number) values
  ('11111111-1111-1111-1111-700000000001', 'Kavya Rao', 'Spouse', '1993-04-12', 'female', 'Teacher', true, '9900011111'),
  ('11111111-1111-1111-1111-700000000001', 'Aditya Rao', 'Son', '2020-09-03', 'male', null, true, null);

insert into public.education_records (employee_id, qualification, specialization, institution, university, year_of_passing, score_type, score) values
  ('11111111-1111-1111-1111-700000000001', 'B.Tech', 'Computer Science', 'Anna University', 'Anna University', 2018, 'cgpa', 8.4),
  ('11111111-1111-1111-1111-700000000001', 'Higher Secondary', null, 'Chennai Public School', 'State Board', 2014, 'percentage', 91.2);

insert into public.previous_employment (employee_id, company_name, designation, start_date, end_date, total_experience_years, reason_for_leaving) values
  ('11111111-1111-1111-1111-700000000001', 'Infosys Ltd', 'Software Engineer', '2018-07-01', '2021-05-20', 2.9, 'Career growth');

insert into public.employee_assets (employee_id, asset_code, asset_type, asset_name, serial_number, issued_date, status) values
  ('11111111-1111-1111-1111-700000000001', 'AST-1001', 'Laptop', 'Dell Latitude 5420', 'DL5420-88213', '2021-05-26', 'assigned'),
  ('11111111-1111-1111-1111-700000000001', 'AST-1002', 'Access Card', 'Office ID Card', 'ID-70001', '2021-05-26', 'assigned');

insert into public.previous_employer_declarations (employee_id, financial_year, employer_name, income_earned, tds_deducted, pf_contribution, status) values
  ('11111111-1111-1111-1111-700000000001', '2021-22', 'Infosys Ltd', 450000, 12000, 21600, 'submitted');

-- ============================================================
-- Exit module: HR-configurable interview questionnaire (9 sections) and
-- two sample resignations — one withdrawn (EMP0001, so the primary demo
-- login shows real history without permanently looking "resigned"), one
-- HR-approved and mid-clearance (EMP0010, so the manager/HR-facing screens
-- have a real in-progress pipeline to review).
-- ============================================================

insert into public.exit_interview_questions (organization_id, category, question_text, response_type, display_order) values
  ('11111111-1111-1111-1111-111111111111', 'job_satisfaction', 'Overall, how satisfied were you with your job?', 'rating', 1),
  ('11111111-1111-1111-1111-111111111111', 'job_satisfaction', 'Did your role match what was described during hiring?', 'yes_no', 2),
  ('11111111-1111-1111-1111-111111111111', 'management', 'How would you rate your relationship with your manager?', 'rating', 1),
  ('11111111-1111-1111-1111-111111111111', 'management', 'What could your manager have done better?', 'text', 2),
  ('11111111-1111-1111-1111-111111111111', 'work_environment', 'How would you rate the overall work environment?', 'rating', 1),
  ('11111111-1111-1111-1111-111111111111', 'work_environment', 'Did you feel safe and comfortable at work?', 'yes_no', 2),
  ('11111111-1111-1111-1111-111111111111', 'compensation', 'How satisfied were you with your salary and benefits?', 'rating', 1),
  ('11111111-1111-1111-1111-111111111111', 'compensation', 'Was your compensation competitive with the market?', 'yes_no', 2),
  ('11111111-1111-1111-1111-111111111111', 'career_growth', 'How would you rate the career growth opportunities here?', 'rating', 1),
  ('11111111-1111-1111-1111-111111111111', 'career_growth', 'What career growth could have kept you here?', 'text', 2),
  ('11111111-1111-1111-1111-111111111111', 'learning', 'How would you rate the learning and development opportunities?', 'rating', 1),
  ('11111111-1111-1111-1111-111111111111', 'learning', 'Did you receive adequate training for your role?', 'yes_no', 2),
  ('11111111-1111-1111-1111-111111111111', 'company_culture', 'How would you rate the company culture?', 'rating', 1),
  ('11111111-1111-1111-1111-111111111111', 'company_culture', 'Would you recommend this company as a place to work?', 'yes_no', 2),
  ('11111111-1111-1111-1111-111111111111', 'reason_for_leaving', 'What is the primary reason for your resignation?', 'text', 1),
  ('11111111-1111-1111-1111-111111111111', 'reason_for_leaving', 'Was this move triggered by a specific event?', 'yes_no', 2),
  ('11111111-1111-1111-1111-111111111111', 'suggestions', 'What suggestions do you have for improving the organization?', 'text', 1),
  ('11111111-1111-1111-1111-111111111111', 'suggestions', 'Any other comments you''d like to share?', 'text', 2);

-- EMP0001: submitted, then withdrawn before the manager acted.
insert into public.exit_requests (
  id, organization_id, employee_id, resignation_date, proposed_last_working_date, notice_period_days,
  expected_last_working_date, reason, detailed_comments, status, manager_id
) values (
  '11111111-1111-1111-1111-900000000001', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-700000000001',
  '2026-06-01', '2026-07-01', 30, '2026-07-01', 'Exploring an external opportunity',
  'Reconsidered after discussing growth options with my manager.', 'withdrawn', '11111111-1111-1111-1111-700000000002'
);

-- EMP0010: HR-approved and now mid-clearance (manager/HR/admin cleared; IT and Finance still pending).
insert into public.exit_requests (
  id, organization_id, employee_id, resignation_date, proposed_last_working_date, notice_period_days,
  expected_last_working_date, reason, detailed_comments, status,
  manager_id, manager_approved_at, manager_remarks,
  hr_approver_id, hr_approved_at, hr_remarks
) values (
  '11111111-1111-1111-1111-900000000002', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-700000000010',
  '2026-07-01', '2026-08-15', 45, '2026-08-15', 'Better career opportunity',
  'Accepted an offer closer to family. Happy to assist with a smooth handover.', 'hr_approved',
  '11111111-1111-1111-1111-700000000004', '2026-07-03T10:15:00Z', 'Approved — please complete handover documentation.',
  '11111111-1111-1111-1111-700000000004', '2026-07-05T09:00:00Z', 'Approved by HR. Coordinating clearance with all departments.'
);

insert into public.exit_clearances (exit_request_id, department, status, cleared_by, cleared_at, remarks) values
  ('11111111-1111-1111-1111-900000000002', 'manager', 'cleared', '11111111-1111-1111-1111-700000000004', '2026-07-06T11:00:00Z', 'Handover plan received.'),
  ('11111111-1111-1111-1111-900000000002', 'hr', 'cleared', '11111111-1111-1111-1111-700000000004', '2026-07-06T12:00:00Z', 'Exit formalities briefed.'),
  ('11111111-1111-1111-1111-900000000002', 'admin', 'cleared', '11111111-1111-1111-1111-700000000004', '2026-07-07T09:30:00Z', 'ID card and access cards to be returned on last day.'),
  ('11111111-1111-1111-1111-900000000002', 'it', 'pending', null, null, null),
  ('11111111-1111-1111-1111-900000000002', 'finance', 'pending', null, null, null);

insert into public.exit_interviews (exit_request_id, employee_id, status) values
  ('11111111-1111-1111-1111-900000000002', '11111111-1111-1111-1111-700000000010', 'pending');

-- Real Supabase Auth login credentials for every seeded employee -- without
-- this, the seed data above has no way to actually log into the app.
-- `postgres` has INSERT on auth.users/auth.identities on every Supabase
-- project (confirmed live, this is the standard documented technique for
-- seeding auth users directly via SQL, not something project-specific).
-- Password is the same for every seeded account: Demo@12345
-- Username on the login screen is the employee_code (EMP0001, ...) --
-- resolve_login_email() (0023) maps that to official_email.
-- Role codes are looked up dynamically (not hardcoded UUIDs), since
-- roles.id is gen_random_uuid() and differs per project.
do $$
declare
  emp record;
  new_user_id uuid;
  role_code text;
  role_id uuid;
  org_id constant uuid := '11111111-1111-1111-1111-111111111111';
  password constant text := 'Demo@12345';
  extra_roles jsonb := jsonb_build_object(
    'EMP0002', jsonb_build_array('manager'),
    'EMP0003', jsonb_build_array('hr_admin'),
    'EMP0004', jsonb_build_array('manager', 'super_admin')
  );
begin
  for emp in select id, employee_code, official_email from public.employees where user_id is null order by employee_code loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change,
      email_change_token_current, reauthentication_token
    ) values (
      '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
      emp.official_email, crypt(password, gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(),
      '', '', '', '', '', ''
    )
    returning id into new_user_id;

    insert into auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (
      gen_random_uuid(), new_user_id::text, new_user_id,
      jsonb_build_object('sub', new_user_id::text, 'email', emp.official_email),
      'email', now(), now(), now()
    );

    update public.employees set user_id = new_user_id where id = emp.id;

    insert into public.user_roles (id, user_id, role_id, organization_id)
      select gen_random_uuid(), new_user_id, r.id, org_id from public.roles r where r.code = 'employee';

    for role_code in select jsonb_array_elements_text(coalesce(extra_roles->emp.employee_code, '[]'::jsonb)) loop
      select id into role_id from public.roles where code = role_code;
      if role_id is not null then
        insert into public.user_roles (id, user_id, role_id, organization_id)
          values (gen_random_uuid(), new_user_id, role_id, org_id);
      end if;
    end loop;
  end loop;
end;
$$;

commit;
