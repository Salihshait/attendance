import { defineConfig, devices } from '@playwright/test';

// E2E config for the HR Administration / Compliance modules (Biometric
// Reader Configuration, Email Configuration, Audit Logs, Attendance
// Reconciliation) and role-gating around them.
//
// NOT executed against a live backend from any Claude session: this app's
// .env.local points at a real, live Supabase project (isDemoMode=false),
// and the schema these specs exercise (supabase/migrations/0044-0048)
// has not been applied there. Running these requires:
//   1. Applying 0044-0048 (paste into the Supabase SQL editor, same manual
//      process as every prior migration in this project).
//   2. `npm run dev` running locally (or set E2E_BASE_URL to point
//      elsewhere).
//   3. Real credentials for an hr_admin/super_admin account and a plain
//      employee account, set via E2E_HR_USERNAME/E2E_HR_PASSWORD and
//      E2E_EMPLOYEE_USERNAME/E2E_EMPLOYEE_PASSWORD env vars.
// A spec run without those credentials set is skipped, not failed --
// see e2e/fixtures/credentials.ts.

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'npm run dev',
        url: 'http://localhost:5173',
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
      },
});
