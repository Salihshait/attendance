import type { EmailTemplateKey } from '@/lib/emailEngine';
export type { EmailTemplateKey };

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
  /** Used when breakDeductionMode = 'standard': deducted flat once any qualifying break occurs, regardless of the gap's actual measured length. */
  standardBreakMinutes: number;
  /** A gap shorter than this isn't a formal break -- bridged into effective time instead. */
  minBreakMinutes: number;
  /** A gap longer than this doesn't change the math but is flagged (attendance.has_excess_break) for review. */
  maxBreakMinutes: number;
  /** Paid break time still counts toward satisfying required hours (payable_minutes); unpaid does not. */
  breakPaid: boolean;
  breakDeductionMode: 'actual' | 'standard';
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
  actorRole: string | null;
  employeeId: string | null;
  employeeName: string | null;
  action: string;
  module: string;
  recordId: string | null;
  oldValue: unknown;
  newValue: unknown;
  ipAddress: string | null;
  result: 'success' | 'failure';
  createdAt: string;
}

export interface AdminSystemSettingRow {
  settingKey: string;
  settingValue: unknown;
  updatedAt: string | null;
}

export interface AdminEmailTemplateRow {
  id: string;
  templateKey: EmailTemplateKey;
  name: string;
  subject: string;
  body: string;
  isActive: boolean;
  updatedAt: string;
}

export type EmailDeliveryStatus = 'pending' | 'sent' | 'failed' | 'retrying';

export interface AdminEmailDeliveryLogRow {
  id: string;
  templateKey: string;
  recipientEmail: string;
  cc: string[];
  bcc: string[];
  subject: string | null;
  status: EmailDeliveryStatus;
  errorMessage: string | null;
  referenceId: string | null;
  attemptCount: number;
  sentAt: string | null;
  createdAt: string;
}

export type BiometricReaderType = 'biometric' | 'rfid' | 'face_recognition' | 'hybrid';
export type BiometricSyncStatus = 'success' | 'failed' | 'never';

export interface AdminBiometricReaderRow {
  id: string;
  name: string;
  deviceId: string;
  readerType: BiometricReaderType;
  ipAddress: string;
  port: number;
  location: string | null;
  isActive: boolean;
  syncIntervalMinutes: number;
  lastSyncAt: string | null;
  lastSyncStatus: BiometricSyncStatus;
  lastErrorMessage: string | null;
}

export type BiometricSyncEventType =
  | 'created'
  | 'updated'
  | 'enabled'
  | 'disabled'
  | 'test_connection'
  | 'sync_started'
  | 'sync_completed'
  | 'sync_failed';
export type BiometricSyncEventStatus = 'success' | 'failed' | 'in_progress';

export interface AdminBiometricSyncLogRow {
  id: string;
  readerId: string;
  readerName: string;
  eventType: BiometricSyncEventType;
  status: BiometricSyncEventStatus;
  recordsSynced: number | null;
  errorMessage: string | null;
  createdAt: string;
}

export interface AdminEmailConfiguration {
  host: string | null;
  port: number | null;
  encryption: 'none' | 'tls' | 'ssl';
  username: string | null;
  hasPassword: boolean;
  fromName: string | null;
  fromEmail: string | null;
  replyTo: string | null;
  isActive: boolean;
  updatedAt: string | null;
}

export type ReconciliationMismatchType =
  | 'biometric_present_but_leave'
  | 'wfh_with_biometric_present'
  | 'unexplained_absence'
  | 'onduty_marked_absent'
  | 'missing_in'
  | 'missing_out'
  | 'duplicate_punch'
  | 'invalid_punch_sequence';

export type ReconciliationResolutionStatus = 'open' | 'resolved' | 'accepted' | 'overridden';

export interface AdminReconciliationFindingRow {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  findingDate: string;
  mismatchType: ReconciliationMismatchType;
  biometricStatus: string | null;
  hrStatus: string | null;
  expectedStatus: string | null;
  resolutionStatus: ReconciliationResolutionStatus;
  resolvedByName: string | null;
  resolvedAt: string | null;
  remarks: string | null;
  createdAt: string;
}
