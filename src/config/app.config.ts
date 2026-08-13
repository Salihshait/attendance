/**
 * Central application configuration.
 * Change branding, tagline, and demo organization name here only.
 */
export const appConfig = {
  appName: 'Wallet HR',
  tagline: 'Simplified HCM Platform',
  poweredByLabel: 'Powered By',
  footerText: 'Wallet HR Platform (Pvt) Ltd',
  copyrightRange: '2020-2026',
  defaultOrgName: 'Demo Organization Pvt Ltd',
  defaultModuleOption: 'Demo Company',
} as const;

export const roleLabels = {
  employee: 'Employee',
  manager: 'Manager',
  hr_admin: 'HR Administrator',
  super_admin: 'Super Administrator',
} as const;

export type AppRole = keyof typeof roleLabels;
