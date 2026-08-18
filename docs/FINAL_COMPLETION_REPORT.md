# Wallet HR — Final Completion Report

Generated at the end of a multi-session production-readiness audit. All findings below reflect
verified behavior — either live-tested against the real Supabase-backed instance with real accounts,
or, where explicitly marked, code-complete but not yet live-verified because the migration it depends
on has not been applied to the live database at report time.

---

## FEATURE STATUS

| Feature | Status | Evidence |
|---|---|---|
| **WFH (Work From Home)** | Implemented, **live-verified** | Full submission form, overlap/duplicate guard, manager approval (existing Pending Approvals already supported the type), cancel, view history, attendance sync on approval. Migration `0037` applied and confirmed live. Kept as its own workflow rather than folded into the reference app's simpler "reason under Present" pattern — a deliberate, user-confirmed decision, not an oversight. |
| **Permission Balance** | Implemented, **live-verified** | Real `permission_balances` table, monthly periods, minutes-based storage (never decimal hours — `01:30` stored as `90`, not `1.30`), Opening/Credit/Used/Balance on `BalancePage.tsx`, insufficient-balance guard client + DB side. Migration `0038` applied and confirmed live. |
| **Missing Attendance Report** | Implemented, **1 bug found and fixed, awaiting re-verification** | New `get_missing_attendance()` RPC (self/manager/HR scoped), new page with filters (date/employee/department/missing-type), export, self-only "Apply Correction" action. Migration `0039` applied but the function had a real bug (ambiguous `employee_id` column reference against its own `RETURNS TABLE` output name) that only surfaced on execution — fixed via migration `0041`, **not yet applied**. |
| **Leave Configuration CRUD** | **Live-tested, PASS** | Create, duplicate-code rejected (DB unique constraint), edit, persists after refresh, deactivate (soft). |
| **Shift Configuration CRUD** | **Live-tested, PASS** | Create, duplicate-name rejected, edit, persists after refresh. |
| **Holiday Configuration CRUD** | **Live-tested, PASS** | Create, edit, persists after refresh, **real hard delete** (confirmed safe — no other table has a foreign key to `holidays`). |
| **Payroll** | **Live-tested (authorization only), PASS** | IDOR test with a real positive control: non-owner employee reading a specific payslip by ID gets 0 rows; owner gets the real row; non-HR write attempt affects 0 rows. No payroll calculation logic was touched, per the explicit high-risk instruction. |
| **Notifications** | **Live-tested — 1 bug found, fixed, and re-verified** | Compose/send confirmed working (real insert, correct recipients, correct skip-count for recipients with no login). **Bug**: HR could never read back what they sent ("Sent History" always empty) — see Bug Status. Fixed via migration `0040`, applied and **confirmed live**: HR can now read back real earlier test sends that were previously invisible. |
| **System Settings** | **Live-tested, PASS** | Read, edit, save, persists after refresh, restored to original value. Minor gap noted below (Low severity). |
| **UI Validation against reference screenshots** | **12 of 15 screens reviewed, real findings applied** | Real screenshots were attached and compared screen-by-screen against the running app (structural/layout comparison, not automated pixel-diff). Two real fixes applied: "Entry By" now renders as `Name [CODE]` matching the reference exactly, and the Balance screen now shows a full monthly accrual history for Casual/Sick Leave (migration `0042`, **not yet applied**) instead of one flat annual row. Two divergences from the reference (WFH as its own workflow; a "Missing Attendance" nav entry) were explicitly confirmed with the user as intentional, not defects. 3 screens (Employee Self Service as a distinct screen, Manager Self Service landing, Information) were never attached and remain unreviewed. See `docs/reference-screenshots/README.md` for the full per-screen breakdown. |

---

## TEST STATUS

| Metric | Count |
|---|---|
| Automated unit test files | 15 |
| Automated unit tests (Vitest) | 112 |
| Passed | 112 |
| Failed | 0 |
| Skipped | 0 |
| New tests added this session | 20 (`ondutyValidation.test.ts` ×5, `permissionValidation.test.ts` balance cases ×7, `leaveValidation.test.ts` `findApplicableLeaveBalance` cases ×4, plus supporting edits) |
| Live/manual browser+API tests executed this session | 45+ discrete checks across auth, leave, permission, regularization, exit, WFH, employee/leave-type/shift/holiday CRUD, payroll IDOR, notifications, system settings, a 44-page-load role-gating smoke test, and a real reference-screenshot comparison |
| Live test failures found | 5 (see Bug Status — all root-caused; 4 fixed and re-verified live, 1 fixed but awaiting re-verification pending migration `0041`) |

No formal automated E2E test suite (Playwright/Cypress checked into the repo) exists — all browser-level
testing this session was done with temporarily-installed Playwright scripts, run, then fully removed
(confirmed via `git diff package.json`/`package-lock.json` each time). **This is a real gap**: there is
no repeatable, checked-in E2E suite a future change could be regression-tested against. Recommended as
follow-up work, not fabricated as already done.

---

## BUG STATUS

### Critical
1. **Live login was completely broken for every real (non-demo) account.** Migration `0029` added
   `departments.head_employee_id`, creating a second relationship path between `employees` and
   `departments`. Three unhinted embeds (`AuthProvider.tsx`, `useTeamQueries.ts`,
   `useAdminEmployees.ts`) started returning HTTP 300 from PostgREST. **Fixed and live-verified.**
2. **Employees/managers could self-approve their own leave, permission, regularization, on-duty, and
   exit requests** via a raw client update — RLS `UPDATE` policies had no `WITH CHECK`. **Fixed
   (migration `0030`) and live-verified** (raw bypass insert attempts correctly rejected).
3. **Approving a leave request never touched the `attendance` table.** An approved leave day showed as
   blank/missing, and would have caused false positives in the Missing Attendance report. **Fixed
   (migration `0037`) and live-verified.**

### High
4. **Leave balance was never deducted on approval.** `act_on_approval()` flipped `leave_requests.status`
   but never touched `leave_balances` — the Balance screen never reflected usage. **Fixed and
   live-verified** (confirmed real before/after deltas: `used` 8→9, `balance` 4→3).
5. **Attendance regularization approval never touched the `attendance` table.** The actual correction
   (check-in/out times, computed late/early/effective minutes) was never applied — only the request's
   own status changed. `attendance.is_regularized` existed since the first migration and nothing ever
   set it. **Fixed and live-verified** end-to-end via the real UI, including correct shift resolution
   and overnight-shift math.
6. **No overlap protection for leave, permission, or WFH requests**, and **no duplicate-submission
   protection for regularizations or exit requests**, at the database level — only (inconsistently)
   in the browser. A direct API call could bypass every one of these. **Fixed and live-verified** with
   real bypass-attempt tests for leave, permission, regularization, exit, and WFH.
7. **HR could never read back notifications they sent to anyone but themselves.**
   `notifications_select` RLS had no HR/admin bypass, so "Sent History" was always empty for every real
   broadcast despite the send itself succeeding. **Fixed (migration `0040`) and live-verified.**
8. **No permission-balance concept existed at all**, despite being a named requirement — `BalancePage`
   showed hardcoded placeholders regardless of actual usage. **Implemented and live-verified**
   (migration `0038`).
9. **No Missing Attendance / Missing Punch report existed.** The only "Absent" report matched an
   explicit `day_status = 'absent'` and could never surface an unrecorded day or a partial punch.
   **Implemented (migration `0039`); the RPC itself had a real bug found on live execution (ambiguous
   column reference) — fixed via migration `0041`, awaiting application and re-verification.**
10. **53 foreign-key columns had zero index coverage**, including several RLS filters/joins on directly
    on nearly every request (`exit_requests.manager_id`, `exit_interviews.employee_id`/`conducted_by`,
    `bank_detail_change_requests.employee_id`, `organization_id` missing on 13 tables). **Fixed and
    applied** (purely additive, `create index if not exists`).
11. **Balance screen didn't match the reference app's structure** for monthly-accrual leave types
    (Casual Leave, Sick Leave) — reference shows a full year of individual monthly opening/used/balance
    rows; this app showed one flat annual row. **Fixed** (migration `0042`, redistributes existing
    annual rows into 12 correctly-attributed monthly rows without losing real usage history; also fixed
    the same class of bug in `seed.sql`'s own backfill logic, which would have wrongly dumped a whole
    year's usage into one month). **Not yet applied to the live database.**

### Medium
12. Missing "Forgot Password" and "Change Password" — both were dead UI elements (a `href="#"` link and
    a menu item with an empty `onClick`). **Fixed and verified** (demo-mode-aware messaging, real
    Supabase Auth flows for the live path).
13. No employee-facing Work From Home submission form existed at all — the approval side (Pending
    Approvals) supported the type, but nothing could ever create one. **Implemented and live-verified.**
14. Hardcoded organization ID duplicated across 9 files instead of the one shared constant; duplicated
    `Field`/`inputClass` form-primitive implementation across 22 importers. **Fixed.**
15. Attendance Calendar's Work-From-Home/On-Duty usage counts were hardcoded to zero instead of querying
    real data. **Fixed and verified** (demo-mode smoke test).
16. "Entry By" rendered as a plain name instead of `Name [CODE]` on the Leave/Present/Permission request
    lists, diverging from the reference app. **Fixed and verified** (build + test pass; matches
    reference format exactly).

### Low
17. Empty System Settings values (e.g. Company Name) are silently accepted — no required-field
    validation. Not fixed (low impact, flagged only).
18. Notifications compose only supports "all departments" or a single department as scope — no
    individual-recipient or role-based recipient picker, despite being named in the original request.
    Not built in this session (scope decision, not a defect); flagged as a real gap, not silently
    dropped.
19. A handful of harmless dead-code items remain uncleaned (documented, low-risk utility functions with
    stated purpose — e.g. `maskTail` in `mask.ts`) — left in place deliberately, not overlooked.
20. Reference app's Balance screen shows separate "Count" sub-columns alongside "Days" for leave types;
    this app's monthly-history rework (Bug #11) does not replicate that column. The reference's own
    example data shows it as 0 throughout, so its real meaning couldn't be confirmed from the evidence
    available — flagged rather than guessed at.

---

## SECURITY

| Area | Status | Evidence |
|---|---|---|
| Authentication | **Pass** (after Critical Bug #1 fix) | Live-tested: valid login, invalid login (correct error), logout, post-logout redirect to `/login` for a protected route. |
| Authorization / RBAC | **Pass** | Live role-gating smoke test: 44 page loads across employee/manager/HR/super-admin accounts, all correctly gated (e.g. HR blocked from System Settings, super admin allowed). |
| IDOR (Insecure Direct Object Reference) | **Pass**, tested on: cross-employee `leave_balances`, `bank_details`, `statutory_details`, `audit_logs`, `user_roles`, and a real payslip-by-ID test with a positive control. All correctly scoped by RLS. | See Payroll section above and the earlier live RLS verification round. |
| XSS | **Not formally tested.** No manual injection payloads were run against form fields in this session. React's default JSX escaping covers the common case, but this is not a substitute for an actual XSS test pass. | Flagged as untested, not claimed as passed. |
| SQL Injection | **Not directly exploitable via the app** — all data access goes through Supabase's PostgREST/RPC layer with parameterized queries; no raw string-concatenated SQL exists in any migration or RPC. Not independently fuzzed. | Architectural, not empirically fuzz-tested. |
| CSRF | **Not formally tested.** Supabase Auth's bearer-token model (not cookie-session-based for API calls) substantially reduces classic CSRF risk, but this was not independently verified against this specific deployment's cookie/session configuration. | Flagged as untested. |

---

## PERFORMANCE

| Area | Status |
|---|---|
| API | Not load-tested. Individual request latency during live testing was subjectively normal (sub-second) but no formal benchmarking was performed. |
| Database | 53 missing FK indexes closed this session (see Bug #10) — the single highest-leverage database performance fix available given the schema's actual query patterns. No query-plan (`EXPLAIN ANALYZE`) profiling was performed beyond that. |
| UI | Production bundle is a single ~1.7MB JS chunk (Vite warns on this every build) — no code-splitting has been implemented. Not a correctness issue, but a real, unaddressed performance gap for initial load time. |

---

## FINAL STATUS

**READY FOR PRODUCTION: NO**

### Exact blockers

1. **Feature**: Missing Attendance Report, Balance screen monthly-accrual rework
   **Problem**: Migrations `0041` (fixes a real ambiguous-column bug in `get_missing_attendance()`) and
   `0042` (monthly leave-balance periods) are written and code-complete but have not been confirmed
   applied to the live database at the time of this report.
   **Severity**: High (Missing Attendance is entirely non-functional — errors on every call — until
   `0041` is applied; the Balance screen's new monthly view has no data to show until `0042` is applied)
   **Root Cause**: No DB write access is available to this session (anon key only, no service-role key,
   no CLI link) — every migration in this project has required the user to paste it into the Supabase
   SQL Editor manually.
   **Required Action**: Apply `0041` then `0042`, in order, then re-run the live verification this
   session already has a proven methodology for.

2. **Feature**: UI Pixel Validation (Phase 2 of this audit)
   **Problem**: 3 of 15 named reference screens (Employee Self Service as a distinct screen, Manager
   Self Service landing, Information) were never attached to this session and remain unreviewed.
   **Severity**: Low (12 of 15 were reviewed with real findings and fixes; this is a completeness gap,
   not an unverified-from-scratch state)
   **Root Cause**: Only 12 screenshots were provided.
   **Required Action**: Attach the remaining 3 screens (see `docs/reference-screenshots/README.md`) if
   full coverage is wanted.

3. **Feature**: Automated E2E regression suite
   **Problem**: No checked-in Playwright/Cypress suite exists — every browser-level test this session
   ran was written, executed, and then deleted.
   **Severity**: Medium (does not block current correctness, but every future change is one regression
   away from silently breaking a previously-verified flow with no automated tripwire)
   **Root Cause**: Not built in any prior session; this session prioritized live-verifying real bugs
   over building durable test infrastructure, given the scope of genuine defects found.
   **Required Action**: Promote a curated subset of this session's throwaway test scripts (login,
   leave/permission/regularization/WFH submit-approve-verify, role-gating) into a permanent
   `tests/e2e/` suite with its own CI-safe demo-mode or seeded-test-account strategy.

4. **Feature**: Security (XSS / CSRF)
   **Problem**: Neither was actively tested this session, only architecturally reasoned about.
   **Severity**: Medium-High (unknown risk, not a confirmed vulnerability)
   **Root Cause**: Out of scope for the time available in this session relative to the volume of
   functional defects found and fixed.
   **Required Action**: A dedicated security-review pass (the project's own `security-review` skill, or
   an external pentest) before production launch.

5. **Feature**: Residual test-data records
   **Problem**: A real approved leave request and a real regularized attendance day for the demo
   employee "Arjun Rao" (EMP0001) remain in the live database from earlier live-verification testing
   this session, plus a "Test Shift Audit" / "Test Leave Type EDITED" config row from Phase 3 CRUD
   testing.
   **Severity**: Low (cosmetic — legitimate, correctly-processed records, not corrupted data)
   **Root Cause**: Left in place deliberately as evidence trail during active testing rather than risk a
   destructive cleanup mid-session.
   **Required Action**: Remove or leave at the user's discretion before treating seed data as
   pristine for demos.

### What *is* solid enough to ship, once blocker #1 is cleared

Authentication, core Attendance/Leave/Permission/Regularization/Exit/WFH workflows, all tested Admin
reference-data CRUD, Payroll access-control, System Settings, and Notification compose are all
live-verified against the real database with real bugs found and fixed along the way — not just
code-reviewed. UI structure/workflow was validated against real reference screenshots for 12 of 15
named screens, with real discrepancies found and fixed. That is the genuinely production-grade portion
of this audit.
