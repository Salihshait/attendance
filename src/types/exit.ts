export type ExitRequestStatus =
  | 'draft'
  | 'submitted'
  | 'manager_approved'
  | 'hr_approved'
  | 'rejected'
  | 'withdrawn'
  | 'completed';

export interface ExitRequestRow {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  resignationDate: string;
  proposedLastWorkingDate: string;
  noticePeriodDays: number;
  expectedLastWorkingDate: string;
  reason: string;
  detailedComments: string | null;
  attachmentUrl: string | null;
  status: ExitRequestStatus;
  managerId: string | null;
  managerName: string | null;
  managerRemarks: string | null;
  hrRemarks: string | null;
  createdAt: string;
}

export type ExitDepartment = 'manager' | 'hr' | 'it' | 'finance' | 'admin';
export type ClearanceStatus = 'pending' | 'cleared' | 'rejected';

export interface ExitClearanceRow {
  id: string;
  exitRequestId: string;
  department: ExitDepartment;
  status: ClearanceStatus;
  remarks: string | null;
  clearedByName: string | null;
  clearedAt: string | null;
}

export interface ExitSettlementRow {
  id: string;
  exitRequestId: string;
  lastWorkingDate: string;
  leaveEncashment: number;
  noticePay: number;
  pendingSalary: number;
  deductions: number;
  bonus: number;
  otherAdjustments: number;
  finalSettlementAmount: number;
  status: 'draft' | 'released';
  releasedAt: string | null;
}

export type ExitInterviewResponseType = 'rating' | 'text' | 'yes_no';

export type ExitInterviewCategory =
  | 'job_satisfaction'
  | 'management'
  | 'work_environment'
  | 'compensation'
  | 'career_growth'
  | 'learning'
  | 'company_culture'
  | 'reason_for_leaving'
  | 'suggestions';

export interface ExitInterviewQuestionRow {
  id: string;
  category: ExitInterviewCategory;
  questionText: string;
  responseType: ExitInterviewResponseType;
  displayOrder: number;
  isActive: boolean;
}

export interface ExitInterviewResponseRow {
  questionId: string;
  ratingValue: number | null;
  textValue: string | null;
  yesNoValue: boolean | null;
}

export interface MyExitInterview {
  id: string;
  exitRequestId: string;
  status: 'pending' | 'completed';
  conductedAt: string | null;
  responses: ExitInterviewResponseRow[];
}

export interface HrContact {
  displayName: string;
  email: string;
}
