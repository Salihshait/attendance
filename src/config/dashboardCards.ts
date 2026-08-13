import { Megaphone, ClipboardList, Info, type LucideIcon } from 'lucide-react';
import type { AppRole } from './app.config';

export interface DashboardCardItem {
  label: string;
  path: string;
}

export interface DashboardCardConfig {
  key: string;
  label: string;
  icon: LucideIcon;
  colorBg: string;
  colorBgDark: string;
  items: DashboardCardItem[];
  roles?: AppRole[];
}

const currentYear = new Date().getFullYear();

export const dashboardCards: DashboardCardConfig[] = [
  {
    key: 'ess',
    label: 'Employee Self Service',
    icon: Megaphone,
    colorBg: 'bg-card-ess',
    colorBgDark: 'bg-card-ess-dark',
    items: [
      { label: 'Attendance', path: '/attendance/calendar' },
      { label: 'My Requests', path: '/attendance/event-request' },
      { label: 'My Reports', path: '/attendance/in-out-records' },
    ],
  },
  {
    key: 'mss',
    label: 'Manager Self Service',
    icon: ClipboardList,
    colorBg: 'bg-card-mss',
    colorBgDark: 'bg-card-mss-dark',
    roles: ['manager', 'hr_admin', 'super_admin'],
    items: [
      { label: 'Team Attendance', path: '/manager/team-attendance' },
      { label: 'Pending Approvals', path: '/manager/approvals' },
      { label: 'Team Reports', path: '/manager/dashboard' },
    ],
  },
  {
    key: 'info',
    label: 'Information',
    icon: Info,
    colorBg: 'bg-card-info',
    colorBgDark: 'bg-card-info-dark',
    items: [
      { label: 'Policies', path: `/eip/policies/${currentYear}` },
      { label: 'Holidays', path: '/attendance/holiday-list' },
      { label: 'Announcements', path: '/information/announcements' },
      { label: 'Company Information', path: '/information/company' },
    ],
  },
];
