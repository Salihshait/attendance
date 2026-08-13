# Wallet HR

A production-track Employee Self-Service / HRMS web app, visually modeled on
an existing enterprise HR product (blue header, icon sidebar with flyout
mega-menus, dense tables, colored status badges). Branding is fully
configurable — see [`src/config/app.config.ts`](src/config/app.config.ts) —
and no proprietary logos or real personal data are used anywhere; all demo
data is fictitious.

**Status:** foundation build. Done so far: project scaffold, full database
schema + RLS, authentication (with a demo mode that needs no backend), and
the common app shell (login, header, sidebar, dashboard). The business
modules (Attendance, EIP, Exit, Manager, Admin) are routed and reachable
from navigation, but render a "coming soon" placeholder until built in a
follow-up session — see [Roadmap](#roadmap).

## Stack

React + TypeScript + Vite + Tailwind CSS v4 + React Router + TanStack Query
+ React Hook Form + Zod + Recharts + Supabase (Postgres, Auth, Storage, RLS).

## Getting started

```bash
npm install
npm run dev
```

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
2. Run every file in `supabase/migrations/` against it, **in filename
   order** — either paste each into the SQL Editor, or, with the
   [Supabase CLI](https://supabase.com/docs/guides/cli) installed and linked:
   ```bash
   supabase db push
   ```
3. Load demo data: run `supabase/seed/seed.sql` the same way (SQL Editor or
   `psql "$DATABASE_URL" -f supabase/seed/seed.sql`). It seeds the
   organization, departments, designations, locations, grades, shifts,
   leave types, holidays, and 10 employees — but leaves `employees.user_id`
   unset. To let a real person sign in as one of them, create a Supabase
   Auth user and link it (see the comment at the top of `seed.sql` for the
   exact statements).
4. Create the two storage buckets' policies already exist in the migrations
   (`employee-documents` private, `employee-photos` public) — nothing
   further to do there.
5. Copy `.env.example` to `.env.local` and fill in your project URL and anon
   key (Project Settings → API).
6. `npm run dev` — the app now talks to your real project instead of demo mode.

## Project structure

```
src/
  app/                 (reserved for router config as it grows)
  auth/                AuthProvider, useAuth, ProtectedRoute/RequireRole
  components/
    layout/            AppLayout, TopHeader, Sidebar, ModuleMegaMenu, Breadcrumb, PageHeader
    ui/                 Shared primitives (StatusBadge, ModuleCard, ...)
    auth/               LoginIllustration
  config/               app.config, navigation, moduleColors, dashboardCards, businessRoutes
  data/                 demoUsers (demo-mode only, never real personal data)
  lib/                  supabase client, cn()/formatting utilities
  pages/                Route components, one folder per module
  types/                Hand-authored domain types (regenerate database.types.ts via
                         `supabase gen types typescript` once your schema is live)
supabase/
  migrations/           Ordered schema + RLS SQL, 0001 -> 0022
  seed/seed.sql          Demo organization/employee data
```

## Roles & access control

Four roles — `employee`, `manager`, `hr_admin`, `super_admin` — defined in
[`src/config/app.config.ts`](src/config/app.config.ts) and mirrored in the
`roles` table. An employee can hold more than one (e.g. a manager is also an
employee). Sidebar sections, dashboard cards, and routes all filter by the
signed-in user's roles; see `RequireRole` in
[`src/auth/ProtectedRoute.tsx`](src/auth/ProtectedRoute.tsx) and the `roles`
field on entries in [`src/config/navigation.ts`](src/config/navigation.ts).

**Note:** RLS is row-level, not column-level. A few policies in
`0019`/`0020` intentionally note where a future view or RPC should project
down to a narrower column set (e.g. hiding a report's compensation-adjacent
fields from their manager) — the row-level self/manager/HR/admin boundary is
in place now, field-level trimming is a follow-up.

## Database & RLS

Every table from the spec's minimum table list exists, with `created_at`/
`updated_at` (+ `created_by`/`updated_by` where mutation tracking matters).
Two intentional naming deviations, both commented in the migrations:

- **`users`** → `public.profiles`, extending `auth.users` (Supabase owns the
  `users` name in the `auth` schema).
- **`managers`** isn't a separate table — management structure is
  `employees.reporting_manager_id`, a self-referencing FK, plus the
  `manager` role for RBAC. A dedicated table would just duplicate that.

A generic, configurable multi-step **approval engine**
(`approval_workflows` → `approval_steps` → `approval_instances` →
`approval_actions`) drives leave/permission/on-duty/regularization/exit
approvals rather than hardcoding a single approval level anywhere.

RLS helper functions (`current_employee_id()`, `is_manager_of()`,
`is_hr_or_admin()`, `request_owner_employee_id()`, ...) live in
`0017_rls_helper_functions.sql` and are reused across every policy file.

## Roadmap

Planned as follow-up sessions, in spec order: Attendance (calendar, event
request, in/out + raw records, balance, holiday list) → EIP (profile, pay
details, TDS, policies) → Exit (resignation, interview) → Manager Self
Service → HR/Super Admin console → cross-cutting reports. Each placeholder
page's route, breadcrumb, and RLS-backed table already exist, so those
sessions are UI + query work, not re-architecture.
