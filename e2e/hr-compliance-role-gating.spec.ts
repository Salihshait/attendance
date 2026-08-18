import { test, expect } from '@playwright/test';
import { hrCredentials, employeeCredentials } from './fixtures/credentials';
import { login } from './support/login';

// "These modules must be accessible only to authorized HR/Admin users" --
// the one thing about this feature set that's genuinely worth an E2E check
// rather than a unit test: real role-based routing, through a real login,
// in a real browser. See playwright.config.ts's header comment for what's
// required to actually run this (applied migrations + real credentials);
// unset credentials skip cleanly rather than failing.

const COMPLIANCE_ROUTES: { path: string; heading: string | RegExp }[] = [
  { path: '/admin/biometric-readers', heading: 'Biometric Reader Configuration' },
  { path: '/admin/email-configuration', heading: 'Email Configuration' },
  { path: '/admin/reconciliation', heading: 'Attendance Reconciliation' },
  { path: '/admin/email-templates', heading: 'Email Templates' },
  { path: '/admin/email-delivery-logs', heading: 'Email Delivery Logs' },
  { path: '/admin/audit-logs', heading: 'Audit Logs' },
];

test.describe('HR Administration & Compliance — role gating', () => {
  for (const route of COMPLIANCE_ROUTES) {
    test(`HR/Admin can open ${route.path}`, async ({ page }) => {
      const creds = hrCredentials();
      test.skip(!creds, 'E2E_HR_USERNAME/E2E_HR_PASSWORD not set');

      await login(page, creds!);
      await page.goto(route.path);
      await expect(page.getByRole('heading', { name: route.heading })).toBeVisible();
      await expect(page.getByText('You do not have permission to view this page.')).not.toBeVisible();
    });

    test(`a plain employee is blocked from ${route.path}`, async ({ page }) => {
      const creds = employeeCredentials();
      test.skip(!creds, 'E2E_EMPLOYEE_USERNAME/E2E_EMPLOYEE_PASSWORD not set');

      await login(page, creds!);
      await page.goto(route.path);
      await expect(page.getByText('You do not have permission to view this page.')).toBeVisible();
    });
  }

  test('an unauthenticated visitor is redirected to /login', async ({ page }) => {
    await page.goto('/admin/reconciliation');
    await expect(page).toHaveURL(/\/login/);
  });
});
