-- Real gap found during a production-readiness audit's "duplicate records"
-- check: attendance_regularizations has no protection against an employee
-- submitting more than one active (draft/pending) regularization for the
-- same date — RegularizationForm.tsx doesn't check for an existing request
-- before submitting, and there was no DB constraint either. Once one is
-- approved/rejected/cancelled, resubmitting for that same date is still
-- allowed (the partial index only covers draft/pending), matching how a
-- real employee would legitimately reapply after a rejection.

create unique index attendance_regularizations_one_active_per_day
  on public.attendance_regularizations (employee_id, attendance_date)
  where (status in ('draft', 'pending'));
