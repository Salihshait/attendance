import type { AttendanceDay, RequestStatus } from './attendance';

export interface TeamMemberRow {
  id: string;
  employeeCode: string;
  employeeName: string;
  departmentName: string | null;
  designationName: string | null;
  employmentStatus: string;
}

export interface TeamAttendanceRow extends AttendanceDay {
  employeeName: string;
  employeeCode: string;
}

export interface TeamLeaveRequestRow {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  leaveTypeName: string;
  fromDate: string;
  toDate: string;
  durationDays: number;
  reason: string;
  appliedOn: string;
  approvalRemarks: string | null;
  status: RequestStatus;
}

export interface TeamPermissionRow {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  permissionDate: string;
  fromTime: string;
  toTime: string;
  durationMinutes: number;
  status: RequestStatus;
}

export interface TeamStats {
  teamSize: number;
  present: number;
  absent: number;
  onLeave: number;
  late: number;
  earlyGoing: number;
}
