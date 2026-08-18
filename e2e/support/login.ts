import type { Page } from '@playwright/test';
import type { Credentials } from '../fixtures/credentials';

/** Fills and submits the real login form (src/pages/auth/LoginPage.tsx) and waits for the post-login redirect. */
export async function login(page: Page, credentials: Credentials): Promise<void> {
  await page.goto('/login');
  await page.getByPlaceholder('Username').fill(credentials.username);
  await page.getByPlaceholder('Password').fill(credentials.password);
  await page.getByRole('button', { name: /login/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 15_000 });
}
