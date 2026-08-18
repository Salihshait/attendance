// Real credentials are never hardcoded or committed -- read from env vars
// the person running the suite provides. A spec that needs credentials
// which aren't set calls skipIfMissing() to skip (not fail) cleanly, so
// `npx playwright test` is safe to run without any setup and simply
// reports what it couldn't check, rather than a wall of false failures.

export interface Credentials {
  username: string;
  password: string;
}

export function hrCredentials(): Credentials | null {
  const username = process.env.E2E_HR_USERNAME;
  const password = process.env.E2E_HR_PASSWORD;
  return username && password ? { username, password } : null;
}

export function employeeCredentials(): Credentials | null {
  const username = process.env.E2E_EMPLOYEE_USERNAME;
  const password = process.env.E2E_EMPLOYEE_PASSWORD;
  return username && password ? { username, password } : null;
}
