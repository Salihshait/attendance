import type { BreadcrumbItem } from '@/components/layout/Breadcrumb';
import type { AppRole } from './app.config';

export interface BusinessRouteDef {
  path: string;
  title: string;
  breadcrumb: BreadcrumbItem[];
  roles?: AppRole[];
}

/**
 * Every route from the app's routing spec that isn't fully built yet renders
 * ComingSoonPage with this title/breadcrumb until its module is implemented
 * in a follow-up session.
 */
export const businessRoutes: BusinessRouteDef[] = [
  { path: '/attendance/calendar', title: 'Attendance Calendar', breadcrumb: [{ label: 'Attendance' }, { label: 'Calendar' }] },
  {
    path: '/attendance/event-request',
    title: 'Event Request',
    breadcrumb: [{ label: 'Attendance' }, { label: 'My Request' }, { label: 'Event Request' }],
  },
  {
    path: '/attendance/in-out-records',
    title: 'In / Out Records',
    breadcrumb: [{ label: 'Attendance' }, { label: 'My Report' }, { label: 'In / Out Records' }],
  },
  {
    path: '/attendance/raw-in-out-records',
    title: 'Raw In / Out Records',
    breadcrumb: [{ label: 'Attendance' }, { label: 'My Report' }, { label: 'Raw In / Out Records' }],
  },
  {
    path: '/attendance/balance',
    title: 'Balance',
    breadcrumb: [{ label: 'Attendance' }, { label: 'My Report' }, { label: 'Balance' }],
  },
  {
    path: '/attendance/holiday-list',
    title: 'Holiday List',
    breadcrumb: [{ label: 'Attendance' }, { label: 'My Report' }, { label: 'Holiday List' }],
  },
  { path: '/eip/profile', title: 'My Profile', breadcrumb: [{ label: 'EIP' }, { label: 'My Profile' }] },
  {
    path: '/eip/payslips',
    title: 'Payslip & Taxsheet',
    breadcrumb: [{ label: 'EIP' }, { label: 'Pay Details' }, { label: 'Payslip & Taxsheet' }],
  },
  { path: '/eip/pf', title: 'PF Details', breadcrumb: [{ label: 'EIP' }, { label: 'Pay Details' }, { label: 'PF Details' }] },
  { path: '/eip/form16', title: 'Form 16', breadcrumb: [{ label: 'EIP' }, { label: 'Pay Details' }, { label: 'Form 16' }] },
  {
    path: '/eip/tax-calculator',
    title: 'Tax Calculator',
    breadcrumb: [{ label: 'EIP' }, { label: 'TDS' }, { label: 'Tax Calculator' }],
  },
  {
    path: '/eip/previous-employer',
    title: 'Previous Employer Declaration',
    breadcrumb: [{ label: 'EIP' }, { label: 'TDS' }, { label: 'Previous Employer Declaration' }],
  },
  {
    path: '/eip/tax-declaration',
    title: 'Tax Declaration',
    breadcrumb: [{ label: 'EIP' }, { label: 'TDS' }, { label: 'Tax Declaration' }],
  },
  {
    path: '/eip/policies/:year',
    title: 'Holiday List Policy',
    breadcrumb: [{ label: 'EIP' }, { label: 'Policies' }],
  },
  { path: '/exit', title: 'Exit', breadcrumb: [{ label: 'Exit' }, { label: 'Home' }] },
  {
    path: '/exit/resignation',
    title: 'Resignation Entry',
    breadcrumb: [{ label: 'Exit' }, { label: 'Transaction' }, { label: 'Resignation Entry' }],
  },
  {
    path: '/exit/interview',
    title: 'Exit Interview',
    breadcrumb: [{ label: 'Exit' }, { label: 'Transaction' }, { label: 'Exit Interview' }],
  },
  {
    path: '/manager/dashboard',
    title: 'Manager Dashboard',
    breadcrumb: [{ label: 'Manager Self Service' }, { label: 'Dashboard' }],
    roles: ['manager', 'hr_admin', 'super_admin'],
  },
  {
    path: '/manager/approvals',
    title: 'Pending Approvals',
    breadcrumb: [{ label: 'Manager Self Service' }, { label: 'Pending Approvals' }],
    roles: ['manager', 'hr_admin', 'super_admin'],
  },
  {
    path: '/manager/team-attendance',
    title: 'Team Attendance',
    breadcrumb: [{ label: 'Manager Self Service' }, { label: 'Team Attendance' }],
    roles: ['manager', 'hr_admin', 'super_admin'],
  },
  {
    path: '/admin/employees',
    title: 'Employees',
    breadcrumb: [{ label: 'Administration' }, { label: 'Employees' }],
    roles: ['hr_admin', 'super_admin'],
  },
  {
    path: '/admin/departments',
    title: 'Departments',
    breadcrumb: [{ label: 'Administration' }, { label: 'Departments' }],
    roles: ['hr_admin', 'super_admin'],
  },
  {
    path: '/admin/designations',
    title: 'Designations',
    breadcrumb: [{ label: 'Administration' }, { label: 'Designations' }],
    roles: ['hr_admin', 'super_admin'],
  },
  {
    path: '/admin/locations',
    title: 'Locations',
    breadcrumb: [{ label: 'Administration' }, { label: 'Locations' }],
    roles: ['hr_admin', 'super_admin'],
  },
  {
    path: '/admin/shifts',
    title: 'Shifts',
    breadcrumb: [{ label: 'Administration' }, { label: 'Shifts' }],
    roles: ['hr_admin', 'super_admin'],
  },
  {
    path: '/admin/leave-types',
    title: 'Leave Types',
    breadcrumb: [{ label: 'Administration' }, { label: 'Leave Types' }],
    roles: ['hr_admin', 'super_admin'],
  },
  {
    path: '/admin/holidays',
    title: 'Holidays',
    breadcrumb: [{ label: 'Administration' }, { label: 'Holidays' }],
    roles: ['hr_admin', 'super_admin'],
  },
  {
    path: '/admin/workflows',
    title: 'Approval Workflows',
    breadcrumb: [{ label: 'Administration' }, { label: 'Approval Workflows' }],
    roles: ['hr_admin', 'super_admin'],
  },
  {
    path: '/admin/reports',
    title: 'Reports',
    breadcrumb: [{ label: 'Administration' }, { label: 'Reports' }],
    roles: ['hr_admin', 'super_admin'],
  },
  {
    path: '/admin/audit-logs',
    title: 'Audit Logs',
    breadcrumb: [{ label: 'Administration' }, { label: 'Audit Logs' }],
    roles: ['hr_admin', 'super_admin'],
  },
  {
    path: '/information/announcements',
    title: 'Announcements',
    breadcrumb: [{ label: 'Information' }, { label: 'Announcements' }],
  },
  {
    path: '/information/company',
    title: 'Company Information',
    breadcrumb: [{ label: 'Information' }, { label: 'Company Information' }],
  },
];
