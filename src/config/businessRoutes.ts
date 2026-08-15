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
