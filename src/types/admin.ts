export interface AdminEmployeeRow {
  id: string;
  employeeCode: string;
  firstName: string;
  middleName: string | null;
  lastName: string | null;
  employeeName: string;
  gender: 'male' | 'female' | 'other' | null;
  dateOfBirth: string | null;
  fatherName: string | null;
  dateOfJoining: string;
  dateOfLeaving: string | null;
  officialEmail: string;
  officialMobile: string | null;
  paygroup: string | null;
  costCentre: string | null;
  placeOfTaxDeduction: string | null;
  jobResponsibility: string | null;
  employmentType: 'full_time' | 'part_time' | 'contract' | 'intern';
  employmentStatus: 'active' | 'inactive' | 'on_notice' | 'exited';
  departmentId: string | null;
  departmentName: string | null;
  designationId: string | null;
  designationName: string | null;
  locationId: string | null;
  locationName: string | null;
  gradeId: string | null;
  gradeName: string | null;
  reportingManagerId: string | null;
  reportingManagerName: string | null;
  userId: string | null;
  hasLogin: boolean;
}

export interface EmployeeOption {
  id: string;
  employeeCode: string;
  name: string;
}

export interface AdminDepartmentRow {
  id: string;
  name: string;
  code: string | null;
  headEmployeeId: string | null;
  headEmployeeName: string | null;
  isActive: boolean;
}

export interface AdminDesignationRow {
  id: string;
  name: string;
  code: string | null;
  departmentId: string | null;
  departmentName: string | null;
  gradeId: string | null;
  gradeName: string | null;
  isActive: boolean;
}

export interface AdminLocationRow {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  country: string | null;
  timeZone: string | null;
  isActive: boolean;
}

export interface AdminGradeRow {
  id: string;
  name: string;
  rank: number | null;
  isActive: boolean;
}

export interface AdminShiftRow {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  graceMinutes: number;
  halfDayHours: number;
  fullDayHours: number;
  isActive: boolean;
  weekoffDays: number[];
  overtimeEnabled: boolean;
  overtimeRateMultiplier: number;
  lateRuleEnabled: boolean;
  earlyGoingRuleEnabled: boolean;
  shortfallRuleEnabled: boolean;
}

export interface AdminLeaveTypeRow {
  id: string;
  code: string;
  name: string;
  isPaid: boolean;
  accrualFrequency: 'monthly' | 'yearly' | 'none';
  allowHalfDay: boolean;
  requiresAttachment: boolean;
  isActive: boolean;
}

export interface AdminLeavePolicyRow {
  id: string;
  leaveTypeId: string;
  leaveTypeName: string;
  gradeId: string | null;
  gradeName: string | null;
  annualEntitlement: number;
  carryForwardLimit: number;
  encashmentAllowed: boolean;
  effectiveFrom: string;
  effectiveTo: string | null;
}

export interface AdminHolidayRow {
  id: string;
  holidayDate: string;
  name: string;
  holidayType: 'public' | 'restricted' | 'optional';
  locationId: string | null;
  locationName: string | null;
  description: string | null;
}

export type ApprovalRequestTypeConfig =
  | 'leave_request'
  | 'permission_request'
  | 'onduty_request'
  | 'attendance_regularization'
  | 'exit_request'
  | 'bank_detail_change_request'
  | 'other_request';

export interface AdminApprovalWorkflowRow {
  id: string;
  requestType: ApprovalRequestTypeConfig;
  name: string;
  isActive: boolean;
  stepCount: number;
}

export type ApproverType = 'reporting_manager' | 'role' | 'specific_employee';

export interface AdminApprovalStepRow {
  id: string;
  workflowId: string;
  stepOrder: number;
  approverType: ApproverType;
  approverRole: 'manager' | 'hr_admin' | 'super_admin' | null;
  approverEmployeeId: string | null;
  approverEmployeeName: string | null;
  isFinal: boolean;
  escalateAfterHours: number | null;
}

export interface AdminDocumentTypeRow {
  id: string;
  code: string;
  name: string;
  isRequired: boolean;
  isActive: boolean;
}

export interface AdminEmployeeDocumentRow {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  documentTypeId: string;
  documentTypeName: string;
  filePath: string;
  fileName: string;
  uploadedAt: string;
  verificationStatus: 'pending' | 'verified' | 'rejected';
  verificationRemarks: string | null;
  verifiedAt: string | null;
}

export interface AdminPayslipRow {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  payPeriodMonth: number;
  payPeriodYear: number;
  basicPay: number;
  hra: number;
  otherAllowances: number;
  pfEmployeeContribution: number;
  esiEmployeeContribution: number;
  professionalTax: number;
  tds: number;
  grossEarnings: number;
  totalDeductions: number;
  netPay: number;
  generatedAt: string;
}

export interface AdminNotificationRow {
  id: string;
  title: string;
  body: string | null;
  linkPath: string | null;
  createdAt: string;
  recipientUserId: string;
  recipientName: string;
}

export interface AdminAuditLogRow {
  id: string;
  actorUserId: string | null;
  actorName: string;
  action: string;
  module: string;
  recordId: string | null;
  oldValue: unknown;
  newValue: unknown;
  ipAddress: string | null;
  createdAt: string;
}

export interface AdminSystemSettingRow {
  settingKey: string;
  settingValue: unknown;
  updatedAt: string | null;
}
