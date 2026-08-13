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
   'karthik.s@demo.walletwr.local', '9800000004', '11111111-1111-1111-1111-200000000005', '11111111-1111-1111-1111-300000000007',
   '11111111-1111-1111-1111-100000000002', '11111111-1111-1111-1111-400000000005', null, 'full_time', 'active'),
  ('11111111-1111-1111-1111-700000000002', '11111111-1111-1111-1111-111111111111', 'EMP0002', 'Priya', 'Nandakumar', 'female', '2018-03-12',
   'priya.n@demo.walletwr.local', '9800000002', '11111111-1111-1111-1111-200000000001', '11111111-1111-1111-1111-300000000003',
   '11111111-1111-1111-1111-100000000001', '11111111-1111-1111-1111-400000000004', '11111111-1111-1111-1111-700000000004', 'full_time', 'active'),
  ('11111111-1111-1111-1111-700000000003', '11111111-1111-1111-1111-111111111111', 'EMP0003', 'Divya', 'Krishnan', 'female', '2019-07-01',
   'divya.k@demo.walletwr.local', '9800000003', '11111111-1111-1111-1111-200000000002', '11111111-1111-1111-1111-300000000004',
   '11111111-1111-1111-1111-100000000002', '11111111-1111-1111-1111-400000000003', '11111111-1111-1111-1111-700000000004', 'full_time', 'active'),
  ('11111111-1111-1111-1111-700000000001', '11111111-1111-1111-1111-111111111111', 'EMP0001', 'Arjun', 'Rao', 'male', '2021-05-26',
   'arjun.rao@demo.walletwr.local', '9800000001', '11111111-1111-1111-1111-200000000001', '11111111-1111-1111-1111-300000000002',
   '11111111-1111-1111-1111-100000000001', '11111111-1111-1111-1111-400000000002', '11111111-1111-1111-1111-700000000002', 'full_time', 'active'),
  ('11111111-1111-1111-1111-700000000005', '11111111-1111-1111-1111-111111111111', 'EMP0005', 'Meena', 'Iyer', 'female', '2022-02-14',
   'meena.i@demo.walletwr.local', '9800000005', '11111111-1111-1111-1111-200000000001', '11111111-1111-1111-1111-300000000001',
   '11111111-1111-1111-1111-100000000001', '11111111-1111-1111-1111-400000000001', '11111111-1111-1111-1111-700000000002', 'full_time', 'active'),
  ('11111111-1111-1111-1111-700000000006', '11111111-1111-1111-1111-111111111111', 'EMP0006', 'Rahul', 'Verma', 'male', '2020-09-01',
   'rahul.v@demo.walletwr.local', '9800000006', '11111111-1111-1111-1111-200000000001', '11111111-1111-1111-1111-300000000002',
   '11111111-1111-1111-1111-100000000001', '11111111-1111-1111-1111-400000000002', '11111111-1111-1111-1111-700000000002', 'full_time', 'active'),
  ('11111111-1111-1111-1111-700000000007', '11111111-1111-1111-1111-111111111111', 'EMP0007', 'Sneha', 'Reddy', 'female', '2021-11-08',
   'sneha.r@demo.walletwr.local', '9800000007', '11111111-1111-1111-1111-200000000003', '11111111-1111-1111-1111-300000000005',
   '11111111-1111-1111-1111-100000000003', '11111111-1111-1111-1111-400000000001', '11111111-1111-1111-1111-700000000004', 'full_time', 'active'),
  ('11111111-1111-1111-1111-700000000008', '11111111-1111-1111-1111-111111111111', 'EMP0008', 'Vikram', 'Nair', 'male', '2023-01-20',
   'vikram.n@demo.walletwr.local', '9800000008', '11111111-1111-1111-1111-200000000004', '11111111-1111-1111-1111-300000000006',
   '11111111-1111-1111-1111-100000000002', '11111111-1111-1111-1111-400000000001', '11111111-1111-1111-1111-700000000004', 'full_time', 'active'),
  ('11111111-1111-1111-1111-700000000009', '11111111-1111-1111-1111-111111111111', 'EMP0009', 'Anita', 'Das', 'female', '2022-06-06',
   'anita.d@demo.walletwr.local', '9800000009', '11111111-1111-1111-1111-200000000004', '11111111-1111-1111-1111-300000000006',
   '11111111-1111-1111-1111-100000000003', '11111111-1111-1111-1111-400000000001', '11111111-1111-1111-1111-700000000004', 'full_time', 'active'),
  ('11111111-1111-1111-1111-700000000010', '11111111-1111-1111-1111-111111111111', 'EMP0010', 'Suresh', 'Pillai', 'male', '2023-08-15',
   'suresh.p@demo.walletwr.local', '9800000010', '11111111-1111-1111-1111-200000000003', '11111111-1111-1111-1111-300000000005',
   '11111111-1111-1111-1111-100000000001', '11111111-1111-1111-1111-400000000001', '11111111-1111-1111-1111-700000000004', 'full_time', 'active');

insert into public.employee_profiles (employee_id, marital_status, nationality, personal_email, city, state, country)
select id, 'single', 'Indian', lower(employee_code) || '.personal@example.com', 'Chennai', 'Tamil Nadu', 'India'
from public.employees where organization_id = '11111111-1111-1111-1111-111111111111';

insert into public.shift_assignments (employee_id, shift_id, effective_from)
select id, '11111111-1111-1111-1111-500000000001', date_of_joining
from public.employees where organization_id = '11111111-1111-1111-1111-111111111111';

-- Opening leave balances for the current year, per employee per leave type.
insert into public.leave_balances (employee_id, leave_type_id, period_start, period_end, opening, credited, used, balance)
select
  e.id,
  lt.id,
  make_date(extract(year from now())::int, 1, 1),
  make_date(extract(year from now())::int, 12, 31),
  case lt.code when 'PL' then 18 when 'EL' then 12 when 'CL' then 12 when 'SL' then 12 else 0 end,
  0, 0,
  case lt.code when 'PL' then 18 when 'EL' then 12 when 'CL' then 12 when 'SL' then 12 else 0 end
from public.employees e
cross join public.leave_types lt
where e.organization_id = '11111111-1111-1111-1111-111111111111'
  and lt.organization_id = '11111111-1111-1111-1111-111111111111';

commit;
