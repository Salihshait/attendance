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
  /** First IN to Last OUT, regardless of gaps -- see also breakMinutes. */
  grossMinutes: number;
  /** The break actually deducted, per the shift's configured break policy -- not simply "every gap." */
  breakMinutes: number;
  effectiveMinutes: number;
  /** effectiveMinutes, plus breakMinutes back if the shift's break policy is paid. Used for shortfall/excess-stay, not shown as "Effective Hours" itself. */
  payableMinutes: number;
  /** A break gap exceeded the shift's configured maximum break duration. */
  hasExcessBreak: boolean;
  lateMinutes: number;
  earlyGoingMinutes: number;
  excessStayMinutes: number;
  shortfallMinutes: number;
  /** An OUT punch exists for this day but no IN punch was ever recorded. */
  missingIn: boolean;
  /** The last IN punch was never closed by a matching OUT. */
  missingOut: boolean;
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
  periodStart: string;
  periodEnd: string;
  opening: number;
  credited: number;
  used: number;
  balance: number;
}

export interface MissingAttendanceRow {
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  departmentName: string | null;
  locationName: string | null;
  attendanceDate: string;
  shiftName: string | null;
  shiftStartTime: string | null;
  shiftEndTime: string | null;
  missingIn: boolean;
  missingOut: boolean;
  dayStatus: string;
  regularizationStatus: string | null;
}

export interface PermissionBalanceRow {
  periodStart: string;
  periodEnd: string;
  openingMinutes: number;
  creditedMinutes: number;
  usedMinutes: number;
  balanceMinutes: number;
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

export interface MonthlyAttendanceSummaryRow {
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  departmentName: string | null;
  locationName: string | null;
  managerName: string | null;
  workingDays: number;
  presentDays: number;
  absentDays: number;
  leaveDays: number;
  wfhDays: number;
  onDutyDays: number;
  permissionCount: number;
  permissionMinutes: number;
  lateDays: number;
  earlyGoingDays: number;
  missingPunchDays: number;
  effectiveMinutes: number;
  requiredMinutes: number;
  shortfallMinutes: number;
  excessStayMinutes: number;
  /** Comp-Off does not exist as a feature in this schema yet -- always 0, not fabricated. */
  compOffEarned: number;
  compOffUsed: number;
}
