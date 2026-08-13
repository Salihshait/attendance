import type { AppRole } from '@/config/app.config';

export interface EmployeeProfile {
  id: string;
  userId: string;
  employeeCode: string;
  firstName: string;
  middleName?: string | null;
  lastName?: string | null;
  displayName: string;
  gender?: 'male' | 'female' | 'other' | null;
  photoUrl?: string | null;
  officialEmail: string;
  officialMobile?: string | null;
  departmentName: string;
  designationName: string;
  locationName: string;
  gradeName?: string | null;
  reportingManagerName?: string | null;
  dateOfJoining: string;
  roles: AppRole[];
}

export interface AuthSession {
  userId: string;
  email: string;
  employee: EmployeeProfile;
  activeRole: AppRole;
}
