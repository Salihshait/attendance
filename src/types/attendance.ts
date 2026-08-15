export type DayStatus =
  | 'present'
  | 'half_day'
  | 'absent'
  | 'weekoff'
  | 'holiday'
  | 'leave'
  | 'on_duty'
  | 'permission';

export interface AttendanceDay {
  id: string;
  employeeId: string;
  attendanceDate: string;
  shiftName: string | null;
  checkIn: string | null;
  checkOut: string | null;
  effectiveMinutes: number;
  lateMinutes: number;
  earlyGoingMinutes: number;
  excessStayMinutes: number;
  shortfallMinutes: number;
  dayStatus: DayStatus;
  validationStatus: 'pending' | 'completed';
  remarks: string | null;
}

export type RequestStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface LeaveRequestRow {
  id: string;
  leaveTypeName: string;
  fromDate: string;
  toDate: string;
  durationDays: number;
  entryByName: string | null;
  appliedOn: string;
  reason: string;
  approvalRemarks: string | null;
  status: RequestStatus;
}

export interface PermissionRequestRow {
  id: string;
  permissionDate: string;
  fromTime: string;
  toTime: string;
  durationMinutes: number;
  entryByName: string | null;
  appliedOn: string;
  reason: string;
  approvalRemarks: string | null;
  status: RequestStatus;
}

export interface RegularizationRow {
  id: string;
  attendanceDate: string;
  regularizationType: string;
  entryByName: string | null;
  appliedOn: string;
  reason: string;
  approvalRemarks: string | null;
  status: RequestStatus;
}

export interface LeaveBalanceRow {
  leaveTypeId: string;
  leaveTypeName: string;
  opening: number;
  credited: number;
  used: number;
  balance: number;
}

export interface HolidayRow {
  id: string;
  holidayDate: string;
  name: string;
  holidayType: string;
  locationName: string | null;
  description: string | null;
}

export type PunchType = 'in' | 'out';
export type PunchSource = 'biometric' | 'mobile' | 'web' | 'manual';

export interface RawPunchRow {
  id: string;
  employeeName: string;
  employeeCode: string;
  punchDate: string;
  punchTime: string;
  punchType: PunchType;
  device: string | null;
  location: string | null;
  source: PunchSource;
}

export type ApprovalRequestType =
  | 'leave_request'
  | 'permission_request'
  | 'attendance_regularization'
  | 'onduty_request'
  | 'other_request';

export interface PendingApprovalRow {
  requestType: ApprovalRequestType;
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  dateLabel: string;
  detailLabel: string;
  reason: string;
  appliedOn: string;
}
