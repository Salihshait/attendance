-- Matches the reference app's Balance screen exactly (confirmed against
-- real screenshots): monthly-accrual leave types (Casual Leave, Sick
-- Leave — leave_types.accrual_frequency = 'monthly') show a full year of
-- individual monthly opening/used/balance rows when expanded, not one flat
-- annual row. Yearly/none-accrual types (Privilege Leave, Earned Leave,
-- LOP, etc.) are unaffected — they keep their single annual row, matching
-- the reference's collapsed single-row summary for those types.
--
-- leave_balances already supports this (unique(employee_id, leave_type_id,
-- period_start) — the schema was never the blocker, only the seeding was).
-- This migration replaces each employee's single annual row for a
-- monthly-accrual type with 12 monthly rows, splitting the annual opening
-- evenly and re-deriving each month's `used`/`balance` from the actual
-- approved leave_requests that fall in it — not just zeroing everything out
-- and losing the real usage history 0031 already backfilled once.
--
-- act_on_approval()'s leave-balance deduction block (0031/0037/0038) needs
-- no change: it already looks up the balance row by
-- `period_start <= from_date and period_end >= from_date`, which works
-- identically whether that period is a year or a month.

do $$
declare
  _lt record;
  _emp record;
  _monthly_opening numeric(6,2);
  _m int;
  _period_start date;
  _period_end date;
  _month_used numeric(6,2);
  _yr int := extract(year from current_date)::int;
begin
  for _lt in select id from public.leave_types where accrual_frequency = 'monthly' loop
    for _emp in
      select employee_id, opening as annual_opening
      from public.leave_balances
      where leave_type_id = _lt.id
    loop
      _monthly_opening := round(_emp.annual_opening / 12, 2);

      delete from public.leave_balances where employee_id = _emp.employee_id and leave_type_id = _lt.id;

      for _m in 1..12 loop
        _period_start := make_date(_yr, _m, 1);
        _period_end := (_period_start + interval '1 month - 1 day')::date;

        select coalesce(sum(duration_days), 0) into _month_used
          from public.leave_requests
          where employee_id = _emp.employee_id
            and leave_type_id = _lt.id
            and status = 'approved'
            and from_date >= _period_start and from_date <= _period_end;

        insert into public.leave_balances (employee_id, leave_type_id, period_start, period_end, opening, credited, used, balance)
        values (_emp.employee_id, _lt.id, _period_start, _period_end, _monthly_opening, 0, _month_used, _monthly_opening - _month_used)
        on conflict (employee_id, leave_type_id, period_start) do update set
          opening = excluded.opening, used = excluded.used, balance = excluded.balance;
      end loop;
    end loop;
  end loop;
end;
$$;
