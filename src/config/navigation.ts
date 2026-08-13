import {
  Home,
  CalendarDays,
  Clock,
  Users,
  LogOut,
  Building2,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';
import type { AppRole } from './app.config';

export interface NavLeaf {
  label: string;
  path: string;
}

export interface NavColumn {
  heading: string;
  items: NavLeaf[];
}

export type ModuleColor = 'attendance' | 'eip' | 'exit' | 'manager' | 'admin';

export interface NavModule {
  key: string;
  label: string;
  icon: LucideIcon;
  /** Direct link — no flyout menu, e.g. Home / Calendar shortcut */
  path?: string;
  /** Flyout mega-menu columns */
  columns?: NavColumn[];
  color?: ModuleColor;
  /** Roles allowed to see this sidebar entry. Omit = all roles. */
  roles?: AppRole[];
}

/** Holiday List policy years are generated dynamically, never hardcoded. */
function holidayPolicyYears(): NavLeaf[] {
  const currentYear = new Date().getFullYear();
  const years = [currentYear - 4, currentYear - 3, currentYear - 1, currentYear];
  return years.map((y) => ({ label: `Holiday List - ${y}`, path: `/eip/policies/${y}` }));
}

export const sidebarModules: NavModule[] = [
  {
    key: 'home',
    label: 'Home',
    icon: Home,
    path: '/dashboard',
  },
  {
    key: 'attendance-calendar',
    label: 'Attendance Calendar',
    icon: CalendarDays,
    path: '/attendance/calendar',
  },
  {
    key: 'attendance',
    label: 'Attendance',
    icon: Clock,
    color: 'attendance',
    columns: [
      {
        heading: 'My Request',
        items: [{ label: 'Event Request', path: '/attendance/event-request' }],
      },
      {
        heading: 'My Report',
        items: [
          { label: 'In / Out Records', path: '/attendance/in-out-records' },
          { label: 'Raw In / Out Records', path: '/attendance/raw-in-out-records' },
          { label: 'Balance', path: '/attendance/balance' },
          { label: 'Holiday List', path: '/attendance/holiday-list' },
        ],
      },
    ],
  },
  {
    key: 'eip',
    label: 'EIP',
    icon: Users,
    color: 'eip',
    columns: [
      { heading: 'EIP', items: [{ label: 'My Profile', path: '/eip/profile' }] },
      {
        heading: 'Pay Details',
        items: [
          { label: 'Payslip & Taxsheet', path: '/eip/payslips' },
          { label: 'PF Details', path: '/eip/pf' },
          { label: 'Form 16', path: '/eip/form16' },
        ],
      },
      {
        heading: 'TDS',
        items: [
          { label: 'Tax Calculator', path: '/eip/tax-calculator' },
          { label: 'Previous Employer Declaration', path: '/eip/previous-employer' },
          { label: 'Tax Declaration', path: '/eip/tax-declaration' },
        ],
      },
      { heading: 'Policies', items: holidayPolicyYears() },
    ],
  },
  {
    key: 'exit',
    label: 'Exit',
    icon: LogOut,
    color: 'exit',
    columns: [
      { heading: 'Exit', items: [{ label: 'Home', path: '/exit' }] },
      {
        heading: 'Transaction',
        items: [
          { label: 'Resignation Entry', path: '/exit/resignation' },
          { label: 'Exit Interview', path: '/exit/interview' },
        ],
      },
    ],
  },
  {
    key: 'manager',
    label: 'Manager Self Service',
    icon: Building2,
    color: 'manager',
    roles: ['manager', 'hr_admin', 'super_admin'],
    columns: [
      {
        heading: 'Manager',
        items: [
          { label: 'Dashboard', path: '/manager/dashboard' },
          { label: 'Pending Approvals', path: '/manager/approvals' },
          { label: 'Team Attendance', path: '/manager/team-attendance' },
        ],
      },
    ],
  },
  {
    key: 'admin',
    label: 'Administration',
    icon: ShieldCheck,
    color: 'admin',
    roles: ['hr_admin', 'super_admin'],
    columns: [
      {
        heading: 'Organization',
        items: [
          { label: 'Employees', path: '/admin/employees' },
          { label: 'Departments', path: '/admin/departments' },
          { label: 'Designations', path: '/admin/designations' },
          { label: 'Locations', path: '/admin/locations' },
        ],
      },
      {
        heading: 'Configuration',
        items: [
          { label: 'Shifts', path: '/admin/shifts' },
          { label: 'Leave Types', path: '/admin/leave-types' },
          { label: 'Holidays', path: '/admin/holidays' },
          { label: 'Approval Workflows', path: '/admin/workflows' },
        ],
      },
      {
        heading: 'Insights',
        items: [
          { label: 'Reports', path: '/admin/reports' },
          { label: 'Audit Logs', path: '/admin/audit-logs' },
        ],
      },
    ],
  },
];

/** Flat lookup of every routable leaf, used to derive breadcrumbs from the current path. */
export function findNavLabel(path: string): { moduleLabel?: string; leafLabel?: string } {
  for (const mod of sidebarModules) {
    if (mod.path === path) return { moduleLabel: mod.label };
    for (const col of mod.columns ?? []) {
      for (const item of col.items) {
        if (item.path === path) return { moduleLabel: mod.label, leafLabel: item.label };
      }
    }
  }
  return {};
}

export function activeModuleForPath(path: string): NavModule | undefined {
  if (path.startsWith('/dashboard')) return sidebarModules.find((m) => m.key === 'home');
  return sidebarModules.find((mod) => {
    if (mod.path && path.startsWith(mod.path)) return true;
    return (mod.columns ?? []).some((col) => col.items.some((i) => path.startsWith(i.path)));
  });
}
