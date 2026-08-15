export interface StatutoryDetails {
  panNumber: string | null;
  aadhaarNumber: string | null;
  uanNumber: string | null;
  pfNumber: string | null;
  esiNumber: string | null;
  taxRegime: 'old' | 'new' | null;
}

export interface BankDetails {
  bankName: string | null;
  accountNumber: string | null;
  ifscCode: string | null;
  branch: string | null;
  accountHolderName: string | null;
  isPendingChange: boolean;
}

export type BankChangeStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface BankChangeRequest {
  id: string;
  requestedBankName: string;
  requestedAccountNumber: string;
  requestedIfscCode: string;
  requestedBranch: string | null;
  requestedAccountHolderName: string;
  status: BankChangeStatus;
  approvalRemarks: string | null;
  createdAt: string;
}

export type AssetStatus = 'assigned' | 'returned' | 'lost' | 'damaged';

export interface AssetRow {
  id: string;
  assetCode: string;
  assetType: string;
  assetName: string;
  serialNumber: string | null;
  issuedDate: string;
  returnDate: string | null;
  status: AssetStatus;
}

export interface EducationRecord {
  id: string;
  qualification: string;
  specialization: string | null;
  institution: string | null;
  university: string | null;
  yearOfPassing: number | null;
  scoreType: 'percentage' | 'cgpa' | null;
  score: number | null;
  certificateDocumentId: string | null;
}

export interface PreviousEmploymentRecord {
  id: string;
  companyName: string;
  designation: string | null;
  startDate: string | null;
  endDate: string | null;
  totalExperienceYears: number | null;
  reasonForLeaving: string | null;
}

export interface FamilyMemberRow {
  id: string;
  name: string;
  relationship: string;
  dateOfBirth: string | null;
  gender: 'male' | 'female' | 'other' | null;
  occupation: string | null;
  isDependent: boolean;
  contactNumber: string | null;
}

export type DocumentVerificationStatus = 'pending' | 'verified' | 'rejected';

export interface DocumentTypeOption {
  id: string;
  code: string;
  name: string;
  isRequired: boolean;
}

export interface EmployeeDocumentRow {
  id: string;
  documentTypeId: string;
  documentTypeName: string;
  filePath: string;
  fileName: string;
  uploadedAt: string;
  verificationStatus: DocumentVerificationStatus;
  verificationRemarks: string | null;
}

export interface PayslipRow {
  id: string;
  payPeriodMonth: number;
  payPeriodYear: number;
  basicPay: number;
  hra: number;
  otherAllowances: number;
  grossEarnings: number;
  pfEmployeeContribution: number;
  esiEmployeeContribution: number;
  professionalTax: number;
  tds: number;
  totalDeductions: number;
  netPay: number;
}

export interface PolicyDocumentRow {
  id: string;
  policyYear: number;
  title: string;
  category: string;
  filePath: string;
  fileName: string;
  uploadedAt: string;
}

export type DeclarationStatus = 'draft' | 'submitted' | 'verified';

export interface PreviousEmployerDeclarationRow {
  id: string;
  financialYear: string;
  employerName: string;
  incomeEarned: number;
  tdsDeducted: number;
  pfContribution: number;
  status: DeclarationStatus;
}

export type TaxDeclarationStatus = 'draft' | 'submitted' | 'verified' | 'locked';

export interface TaxDeclarationRow {
  id: string | null;
  financialYear: string;
  regime: 'old' | 'new';
  declaredInvestments: number;
  hraExemption: number;
  status: TaxDeclarationStatus;
  submittedAt: string | null;
}
