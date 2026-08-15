# Wallet HR

A production-track Employee Self-Service / HRMS web app, visually modeled on
an existing enterprise HR product (blue header, icon sidebar with flyout
mega-menus, dense tables, colored status badges). Branding is fully
configurable — see [`src/config/app.config.ts`](src/config/app.config.ts) —
and no proprietary logos or real personal data are used anywhere; all demo
data is fictitious.

**Status:** foundation + the full Attendance, EIP, and Exit modules. Done so
far: project scaffold, full database schema + RLS, authentication (with a
demo mode that needs no backend, and employee-code login against a real
backend), the common app shell (login, header, sidebar, dashboard), and —
fully wired to real data — the complete **Attendance** module (Calendar with
the right-hand Monthly Details summary panel, Event Request covering
Leave/Present/Permission with balance/overlap/holiday/weekoff validation,
In/Out Records, Raw In/Out Records, Balance, Holiday List) plus a Manager
Self Service **Pending Approvals** screen, the complete **EIP** module (My
Profile's 9 specified tabs, Pay Details, TDS, and Policies — see
[EIP module](#eip-module)), and the complete **Exit** module (Dashboard,
Resignation Entry with withdraw, a manager→HR approval workflow, department
Exit Clearance, a configurable Exit Interview, and an HR-only Final
Settlement — see [Exit module](#exit-module)). The remaining modules
(Manager dashboard/team attendance, Admin) are routed and reachable from
navigation, but render a "coming soon" placeholder until built in a
follow-up session — see [Roadmap](#roadmap).

## Stack

React + TypeScript + Vite + Tailwind CSS v4 + React Router + TanStack Query
+ React Hook Form + Zod + Recharts + Supabase (Postgres, Auth, Storage, RLS).

## Getting started

```bash
npm install
npm run dev
```

Run `npm test` for the unit test suite (Vitest) covering the attendance
calculation and validation rules in [`src/lib/`](src/lib/) — see
[Testing](#testing).

That's it — the app runs immediately in **demo mode** with no Supabase
project required. Sign in on the login page with any seeded demo account
(password `demo123`):

| Username | Role(s) |
|---|---|
| `EMP0001` | Employee |
| `EMP0002` | Employee, Manager |
| `EMP0003` | Employee, HR Administrator |
| `EMP0004` | Employee, Manager, HR Administrator, Super Administrator |

Demo mode is implemented in [`src/auth/AuthProvider.tsx`](src/auth/AuthProvider.tsx)
and [`src/data/demoUsers.ts`](src/data/demoUsers.ts) — it never makes a
network call, so it's safe to use on cold clones and in CI previews.

### Connecting a real Supabase project

1. Create a project at [supabase.com](https://supabase.com).
2. Run `supabase/full_setup.generated.sql` against it in one shot — paste
   its contents into the SQL Editor and run (it's every migration plus the
   seed data, concatenated in order; see the comment at its top). Prefer
   the CLI instead? `supabase db push` applies `supabase/migrations/*.sql`
   in filename order, then run `supabase/seed/seed.sql` separately.
3. That seeds the organization, departments, designations, locations,
   grades, shifts, leave types, holidays, 10 employees, ~2 months of
   attendance history, 6 months of payslip history per employee,
   statutory/bank details for every employee, sample leave/permission/
   regularization/EIP profile data for EMP0001, a 9-section exit interview
   questionnaire, and two sample resignations (EMP0001 withdrawn, EMP0010
   HR-approved and mid-clearance) — but leaves every `employees.user_id`
   unset. To let
   a real person sign in as one of them: create a Supabase Auth user
   (`supabase.auth.admin.createUser({ email, password, email_confirm: true })`
   from a trusted server context, using the service_role key — the Admin
   API is the reliable path since project-level email-confirmation and
   rate-limit settings otherwise block a plain client-side `signUp`), then
   run the `update`/`insert` statements at the top of `supabase/seed/seed.sql`
   to link it to an employee and grant roles.
4. The two storage buckets' policies already exist in the migrations
   (`employee-documents` private, `employee-photos` public) — nothing
   further to do there.
5. Copy `.env.example` to `.env.local` and fill in your project URL and anon
   ("publishable") key (Project Settings → API).
6. `npm run dev` — the app now talks to your real project instead of demo
   mode. The login page's "Username" field accepts either an employee code
   (e.g. `EMP0001`, resolved server-side via the `resolve_login_email` RPC
   in `0023_login_lookup_rpc.sql`) or a plain email.

## Project structure

```
src/
  app/                 (reserved for router config as it grows)
  auth/                AuthProvider, useAuth, ProtectedRoute/RequireRole
  components/
    layout/            AppLayout, TopHeader, Sidebar, ModuleMegaMenu, Breadcrumb, PageHeader
    ui/                 Shared primitives (DataTable, FilterBar, Accordion, Modal, StatusBadge, ModuleCard, ...)
    auth/               LoginIllustration
    attendance/         LeaveRequestForm, PermissionRequestForm, RegularizationForm, AttendanceDayCell, MonthlyDetailsPanel
    eip/                InfoRow + one component per My Profile tab (Statutory/Bank/Assets/Academic/Documents/PreviousEmployment/Family)
    exit/               ClearanceTimeline, SettlementEditor (shared between the employee dashboard and Manage Resignations)
  config/               app.config, navigation (NavLeaf.roles gates individual links, not just whole modules),
                         moduleColors, dashboardCards, businessRoutes
  data/                 demoUsers (demo-mode only, never real personal data)
  hooks/                TanStack Query hooks — useAttendanceQueries, useRequestQueries, useApprovalQueries,
                         useProfileQueries (My Profile tabs), useEipQueries (Pay Details/TDS/Policies),
                         useExitQueries, useExitInterviewQueries
  lib/                  supabase client, cn()/formatting/date/currency utilities, attendanceCalc,
                         leaveValidation, requestStatus, mask, taxCalc, exitCalc, settlementCalc
                         (pure, unit-tested rule modules)
  pages/                Route components, one folder per module (attendance/, eip/, exit/, manager/, ...)
  types/                Hand-authored domain types (regenerate database.types.ts via
                         `supabase gen types typescript` once your schema is live)
supabase/
  migrations/                Ordered schema + RLS SQL, 0001 -> 0030
  seed/seed.sql               Demo organization/employee/attendance/request/payroll/exit data
  full_setup.generated.sql    migrations + seed concatenated, for a one-paste setup
```

**Dependency note:** `@tanstack/react-table` is pinned to `8.21.3`. The
`9.x` line published to npm is a from-scratch API rewrite (different hook
names, a "TableFeatures" composition model) — don't bump the major version
without rewriting `DataTable.tsx` to match.

## Roles & access control

Four roles — `employee`, `manager`, `hr_admin`, `super_admin` — defined in
[`src/config/app.config.ts`](src/config/app.config.ts) and mirrored in the
`roles` table. An employee can hold more than one (e.g. a manager is also an
employee). Sidebar sections, dashboard cards, and routes all filter by the
signed-in user's roles; see `RequireRole` in
[`src/auth/ProtectedRoute.tsx`](src/auth/ProtectedRoute.tsx) and the `roles`
field on entries in [`src/config/navigation.ts`](src/config/navigation.ts).
`roles` exists at both the module level (hides "Manager Self Service" and
"Administration" entirely) and the individual-leaf level (`NavLeaf.roles`,
added for Exit's "Manage Resignations" — everyone needs to see the Exit
module to resign, but only a manager/HR/admin should see that one link);
`Sidebar.tsx` and `ModuleMegaMenu.tsx` both filter on it.

**Note:** RLS is row-level, not column-level. A few policies in
`0019`/`0020` intentionally note where a future view or RPC should project
down to a narrower column set (e.g. hiding a report's compensation-adjacent
fields from their manager) — the row-level self/manager/HR/admin boundary is
in place now, field-level trimming is a follow-up.

## Database & RLS

Every table from the spec's minimum table list exists, with `created_at`/
`updated_at`/`created_by`/`updated_by` — the latter two are auto-populated by
a DB trigger (`0030_data_governance_hardening.sql`), not app code. See
**[`supabase/DATABASE.md`](supabase/DATABASE.md)** for the full table
inventory, every naming deviation from the spec's literal table names and
why, the RLS model, audit-trail coverage (which tables are auto-audited vs.
RPC-audited vs. not audited and why), the masking approach, and the
soft-delete stance — this README section only summarizes the highlights.

A generic, configurable multi-step **approval engine**
(`approval_workflows` → `approval_steps` → `approval_instances` →
`approval_actions`) drives leave/permission/on-duty/regularization/exit
approvals rather than hardcoding a single approval level anywhere. A default
single-step (reporting manager) workflow is seeded for leave/permission/
regularization requests. Flipping a request to approved/rejected goes
through the `act_on_approval(request_type, request_id, action, remarks)`
SECURITY DEFINER RPC in `0025_approval_action_rpc.sql` — it authorizes the
caller (manager-of-owner or HR/admin), updates the request row, advances the
approval engine, and inserts a `notifications` row for the employee, all
atomically. Manager Self Service → Pending Approvals is the UI for it.

RLS helper functions (`current_employee_id()`, `is_manager_of()`,
`is_hr_or_admin()`, `request_owner_employee_id()`, ...) live in
`0017_rls_helper_functions.sql` and are reused across every policy file.

## EIP module

**My Profile**'s left-tab layout covers all 9 spec'd tabs with real data:
Company Details, Statutory Details, Bank Details, Assets, Academic
Qualification, Documents Upload, Previous Employment, Personal Details,
Family Details. Three tabs the spec listed by name only, with no fields
given (**Others**, **New Fields**, **Employee Review**), are left as a
"planned for a follow-up" placeholder rather than guessed at.

- **Masking is server-side, not cosmetic.** `get_my_statutory_details()`
  and `get_my_bank_details()` (`0026_eip_extras.sql`, SECURITY DEFINER) mask
  PAN/Aadhaar/account number with SQL `overlay()` *before* the row leaves
  Postgres — the full value never reaches the browser for a routine profile
  view, unlike a client-side-only mask that a network inspector would
  defeat. Each call also inserts a `'view'` `audit_logs` row (that action
  value was added to the table's check constraint in this migration).
  True column-level encryption (pgcrypto is already enabled) is a
  documented next step, intentionally not implemented now — without a
  KMS-backed secret to encrypt under, a hardcoded application key would be
  security theater rather than real protection.
- **Bank detail changes require approval.** The employee submits a
  `bank_detail_change_requests` row (`bank_details.is_pending_change` stays
  false and the canonical row is untouched until HR acts); there's no
  approve/reject UI yet since that belongs in the HR/Super Admin console
  (Roadmap), which this session doesn't build.
- **Documents Upload** and **Policies** use real Supabase Storage
  (`employee-documents`, and a new `policy-documents` bucket keyed by
  `<organization_id>/<filename>`, HR/admin write-only). Deliberately **not**
  seeded with fake rows — a document row pointing at a file that was never
  uploaded would make "Download" 404. Both screens start empty and become
  populated the moment a real upload happens through the UI.
- **Policies** groups by year purely from whatever `policy_year` values
  exist in the data — no hardcoded year list anywhere, including the
  sidebar (previously a hand-computed set of offsets; simplified to a
  single "Policies" link since the page itself is now the dynamic source).
- **Tax Calculator** (old vs. new regime, `src/lib/taxCalc.ts`) uses
  simplified, illustrative FY 2024-25 slabs — clearly labeled as an
  estimate, not tax advice, since real slabs/cess/surcharge change every
  Union Budget.
- **Payslip breakdown**: `payslips` originally only had gross/deductions/net
  summary columns; this session added `basic_pay`/`hra`/`other_allowances`/
  `pf_employee_contribution`/`esi_employee_contribution`/`professional_tax`/
  `tds` so the Payslip, PF Details, and Form 16 screens could show the
  itemized breakdown the spec asks for. "Download PDF" is the browser's
  native print-to-PDF (`window.print()` on a printable view) rather than a
  new PDF-generation dependency — the same approach already used for the
  Attendance module's Print button.

## Exit module

Resignation submission stays a plain client insert (consistent with how
leave/permission/regularization requests already work), but every status
transition after that — manager approve/reject, HR approve/reject, employee
withdraw — goes through `act_on_exit_request()`
(`0027_exit_extras.sql`, SECURITY DEFINER), the same pattern as
`act_on_approval()` for Attendance. On HR approval it also provisions the
five `exit_clearances` rows (Manager/HR/IT/Finance/Admin) and the
`exit_interviews` row — clearance and the interview only make sense once HR
has signed off. `act_on_exit_clearance()` marks one department cleared/
rejected (HR/admin can act on any department; a manager can only act on the
'manager' row, and only for their own report) and auto-flips the resignation
to `completed` once every department reads `cleared`.

- **RLS gaps found and closed while building this, not just new tables.**
  `exit_requests_update`'s original policy let an employee or manager
  update *any* column on a row they could see — including `status` — so a
  plain client call could self-approve straight to `hr_approved`. Added a
  `WITH CHECK` restricting direct updates to only the "nothing happened yet"
  states, so `act_on_exit_request()` is the only real path to every other
  status. Separately, `exit_interviews_write`/`exit_interview_responses_write`
  only granted write access to `is_hr_or_admin()` or `conducted_by = self`
  — but the spec's interview is self-administered by the employee, who is
  neither of those, so as originally written **an employee could never
  submit their own exit interview**. Extended both policies to also allow
  the interview's own `employee_id`.
- **HR Contact** (Exit Dashboard) can't be resolved with a plain query — the
  `user_roles` RLS policy is self-or-HR only, so a regular employee has no
  way to look up who holds the `hr_admin` role. `get_hr_contact()` is a
  narrow SECURITY DEFINER RPC that exposes only a name + email for that
  purpose.
- **Exit Clearance and Final Settlement have no nav entries of their own**
  — the spec's menu lists only Home / Resignation Entry / Exit Interview.
  Clearance and Settlement are surfaced as sections of the Exit Dashboard
  (read-only for the employee) and inside **Manage Resignations**
  (`/exit/manage`, a new manager/HR/admin-only screen linked from the Exit
  nav column) where the action buttons actually live. This keeps the
  spec'd 3-item menu intact while still shipping sections 6 and 7.
- **Final Settlement total is a generated column**
  (`exit_settlements.final_settlement_amount`), computed by Postgres from
  the same formula as `src/lib/settlementCalc.ts`'s `calculateFinalSettlement()`
  — the two are commented as needing to stay in sync if the formula changes,
  since the DB is the source of truth but the form needs a live preview
  before saving.

## Testing

`npm test` runs the Vitest suite. Coverage is deliberately concentrated in
`src/lib/` — the pure, framework-free rule modules — rather than mocking
Supabase, since the calculation and validation rules are exactly what the
spec calls out for testing:

- **`attendanceCalc.test.ts`** — effective hours / late / early going /
  excess stay / shortfall for normal, late, early-going, and overtime
  attendance; missing-punch → absent; the overnight-shift rule (22:00 ->
  06:00 must read as 8 hours, never negative); and `determineDayStatus`
  across holiday/weekoff/leave/permission/regularized-present days.
- **`leaveValidation.test.ts`** — insufficient balance, overlapping leave,
  holiday-only and weekoff-only ranges, and ignoring cancelled/rejected
  requests when checking for a duplicate. (This test caught a real bug:
  the original date-enumeration helper round-tripped through
  `Date#toISOString()`, which shifts the calendar date by a day in any
  positive-UTC-offset timezone — including the seeded org's own
  Asia/Kolkata. Fixed in both `leaveValidation.ts` and the shared
  `formatDateISO()` in `lib/utils.ts`, which had the same bug and backs the
  calendar grid and every date-range filter.)
- **`requestStatus.test.ts`** — the approve/reject/cancel status-transition
  rules shared by the Event Request cancel buttons and the Pending
  Approvals actions.
- **`mask.test.ts`** — `maskTail()`/`formatMaskedAadhaar()` (PAN/Aadhaar/
  account number display formatting; the masking a client actually receives
  is done server-side, see [EIP module](#eip-module)).
- **`taxCalc.test.ts`** — old vs. new regime slab tax, standard deduction,
  and the 87A rebate threshold for the Tax Calculator.
- **`exitCalc.test.ts`** — Expected Last Working Date (resignation date +
  notice period, including month/year and leap-year rollover), the
  fully-cleared/progress helpers behind the Exit Clearance timeline, and the
  "Resignation Status" vs. coarser "Exit Status" bucketing shown on the
  dashboard.
- **`settlementCalc.test.ts`** — the Final Settlement total formula,
  including the case where notice-pay recovery exceeds earnings (a
  negative settlement).

## Roadmap

Built: the full **Attendance** module (Calendar + Monthly Details panel,
Event Request with validation, In/Out Records, Raw In/Out Records, Balance,
Holiday List, Leave/Permission/Regularization forms with file-attachment
upload), the approval engine RPC + Manager Self Service → Pending Approvals;
the full **EIP** module (My Profile's 9 spec'd tabs, Pay Details, TDS,
Policies — see [EIP module](#eip-module)); and the full **Exit** module
(Dashboard, Resignation Entry, the manager→HR approval workflow, Exit
Clearance, a configurable Exit Interview, and HR-only Final Settlement —
see [Exit module](#exit-module)).

Planned as follow-up sessions, in spec order: Manager dashboard + Team
Attendance → HR/Super Admin console (which is also where bank-change-request
approval and document/policy verification UIs belong) → cross-cutting
reports. Each placeholder page's route, breadcrumb, and RLS-backed table
already exist, so those sessions are UI + query work, not re-architecture.
