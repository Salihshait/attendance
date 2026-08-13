import type { EmployeeProfile } from '@/types/domain';

/**
 * Demo accounts used only when Supabase env vars are not configured
 * (see src/auth/AuthProvider.tsx). Lets `npm run dev` be click-through
 * out of the box. None of this is real personal data.
 */
export interface DemoAccount {
  username: string;
  password: string;
  profile: EmployeeProfile;
}

export const demoAccounts: DemoAccount[] = [
  {
    username: 'EMP0001',
    password: 'demo123',
    profile: {
      id: 'demo-emp-0001',
      userId: 'demo-user-0001',
      employeeCode: 'EMP0001',
      firstName: 'Arjun',
      lastName: 'Rao',
      displayName: 'Arjun Rao',
      gender: 'male',
      officialEmail: 'arjun.rao@demo.walletwr.local',
      officialMobile: '9800000001',
      departmentName: 'Software',
      designationName: 'Senior Software Engineer',
      locationName: 'Chennai',
      gradeName: 'G4',
      reportingManagerName: 'Priya Nandakumar',
      dateOfJoining: '2021-05-26',
      roles: ['employee'],
    },
  },
  {
    username: 'EMP0002',
    password: 'demo123',
    profile: {
      id: 'demo-emp-0002',
      userId: 'demo-user-0002',
      employeeCode: 'EMP0002',
      firstName: 'Priya',
      lastName: 'Nandakumar',
      displayName: 'Priya Nandakumar',
      gender: 'female',
      officialEmail: 'priya.n@demo.walletwr.local',
      officialMobile: '9800000002',
      departmentName: 'Software',
      designationName: 'Engineering Manager',
      locationName: 'Chennai',
      gradeName: 'G6',
      reportingManagerName: 'Karthik Subramanian',
      dateOfJoining: '2018-03-12',
      roles: ['employee', 'manager'],
    },
  },
  {
    username: 'EMP0003',
    password: 'demo123',
    profile: {
      id: 'demo-emp-0003',
      userId: 'demo-user-0003',
      employeeCode: 'EMP0003',
      firstName: 'Divya',
      lastName: 'Krishnan',
      displayName: 'Divya Krishnan',
      gender: 'female',
      officialEmail: 'divya.k@demo.walletwr.local',
      officialMobile: '9800000003',
      departmentName: 'Human Resources',
      designationName: 'HR Administrator',
      locationName: 'Bengaluru',
      gradeName: 'G5',
      reportingManagerName: 'Karthik Subramanian',
      dateOfJoining: '2019-07-01',
      roles: ['employee', 'hr_admin'],
    },
  },
  {
    username: 'EMP0004',
    password: 'demo123',
    profile: {
      id: 'demo-emp-0004',
      userId: 'demo-user-0004',
      employeeCode: 'EMP0004',
      firstName: 'Karthik',
      lastName: 'Subramanian',
      displayName: 'Karthik Subramanian',
      gender: 'male',
      officialEmail: 'karthik.s@demo.walletwr.local',
      officialMobile: '9800000004',
      departmentName: 'Leadership',
      designationName: 'VP Engineering',
      locationName: 'Bengaluru',
      gradeName: 'G8',
      dateOfJoining: '2015-01-15',
      roles: ['employee', 'manager', 'hr_admin', 'super_admin'],
    },
  },
];

export function findDemoAccount(username: string, password: string): DemoAccount | undefined {
  return demoAccounts.find(
    (a) => a.username.toLowerCase() === username.trim().toLowerCase() && a.password === password,
  );
}
