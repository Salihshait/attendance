-- Real gap found during a production-readiness audit's "duplicate records"
-- check, same class as 0034's attendance_regularizations fix: an employee
-- can only have one active resignation in flight per
-- ResignationEntryPage.tsx's client-side `activeRequest` check (blocks the
-- submit form while one exists), but nothing enforced this at the DB level
-- — a direct client insert could create a second active exit_requests row
-- for the same employee. Matches the exact active-status set the UI
-- already uses (ACTIVE_STATUSES in ResignationEntryPage.tsx).

create unique index exit_requests_one_active_per_employee
  on public.exit_requests (employee_id)
  where (status in ('submitted', 'manager_approved', 'hr_approved'));
