-- Real gap found during a production-readiness audit: unlike leave_requests
-- (0031), permission_requests had no overlap protection at all — neither
-- client-side nor DB-level — even though the spec explicitly calls out
-- "Overlapping permission" as a required check. Mirrors 0031's leave
-- exclusion constraint: same employee, overlapping [from_time, to_time) on
-- the same date, status still draft/pending/approved.

alter table public.permission_requests
  add constraint permission_requests_no_overlap
  exclude using gist (
    employee_id with =,
    tsrange(permission_date + from_time, permission_date + to_time, '[)') with &&
  )
  where (status in ('draft', 'pending', 'approved'));
