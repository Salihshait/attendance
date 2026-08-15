import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type {
  AssetRow,
  BankChangeRequest,
  BankDetails,
  DocumentTypeOption,
  EducationRecord,
  EmployeeDocumentRow,
  FamilyMemberRow,
  PreviousEmploymentRecord,
  StatutoryDetails,
} from '@/types/eip';

export interface PersonalDetails {
  maritalStatus: string | null;
  nationality: string | null;
  bloodGroup: string | null;
  personalEmail: string | null;
  personalMobile: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  pinCode: string | null;
  emergencyContactName: string | null;
  emergencyContactNumber: string | null;
}

export function usePersonalDetails(employeeId: string | undefined) {
  return useQuery({
    queryKey: ['personal-details', employeeId],
    enabled: Boolean(employeeId),
    queryFn: async (): Promise<PersonalDetails | null> => {
      const { data, error } = await supabase
        .from('employee_profiles')
        .select('*')
        .eq('employee_id', employeeId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        maritalStatus: data.marital_status,
        nationality: data.nationality,
        bloodGroup: data.blood_group,
        personalEmail: data.personal_email,
        personalMobile: data.personal_mobile,
        addressLine1: data.address_line1,
        addressLine2: data.address_line2,
        city: data.city,
        state: data.state,
        country: data.country,
        pinCode: data.pin_code,
        emergencyContactName: data.emergency_contact_name,
        emergencyContactNumber: data.emergency_contact_number,
      };
    },
  });
}

// --- Statutory + Bank details: read through masking RPCs (0026_eip_extras.sql)
// so the full PAN/Aadhaar/account number never reaches the browser. ---

export function useStatutoryDetails(employeeId: string | undefined) {
  return useQuery({
    queryKey: ['statutory-details', employeeId],
    enabled: Boolean(employeeId),
    queryFn: async (): Promise<StatutoryDetails | null> => {
      const { data, error } = await supabase.rpc('get_my_statutory_details');
      if (error) throw error;
      const row = data?.[0];
      if (!row) return null;
      return {
        panNumber: row.pan_number,
        aadhaarNumber: row.aadhaar_number,
        uanNumber: row.uan_number,
        pfNumber: row.pf_number,
        esiNumber: row.esi_number,
        taxRegime: row.tax_regime,
      };
    },
  });
}

export function useBankDetails(employeeId: string | undefined) {
  return useQuery({
    queryKey: ['bank-details', employeeId],
    enabled: Boolean(employeeId),
    queryFn: async (): Promise<BankDetails | null> => {
      const { data, error } = await supabase.rpc('get_my_bank_details');
      if (error) throw error;
      const row = data?.[0];
      if (!row) return null;
      return {
        bankName: row.bank_name,
        accountNumber: row.account_number,
        ifscCode: row.ifsc_code,
        branch: row.branch,
        accountHolderName: row.account_holder_name,
        isPendingChange: row.is_pending_change,
      };
    },
  });
}

export function useBankChangeRequests(employeeId: string | undefined) {
  return useQuery({
    queryKey: ['bank-change-requests', employeeId],
    enabled: Boolean(employeeId),
    queryFn: async (): Promise<BankChangeRequest[]> => {
      const { data, error } = await supabase
        .from('bank_detail_change_requests')
        .select('id, requested_bank_name, requested_account_number, requested_ifsc_code, requested_branch, requested_account_holder_name, status, approval_remarks, created_at')
        .eq('employee_id', employeeId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r) => ({
        id: r.id,
        requestedBankName: r.requested_bank_name,
        requestedAccountNumber: r.requested_account_number,
        requestedIfscCode: r.requested_ifsc_code,
        requestedBranch: r.requested_branch,
        requestedAccountHolderName: r.requested_account_holder_name,
        status: r.status,
        approvalRemarks: r.approval_remarks,
        createdAt: r.created_at,
      }));
    },
  });
}

interface NewBankChangeRequestInput {
  employeeId: string;
  bankName: string;
  accountNumber: string;
  ifscCode: string;
  branch?: string;
  accountHolderName: string;
}

export function useCreateBankChangeRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: NewBankChangeRequestInput) => {
      const { error } = await supabase.from('bank_detail_change_requests').insert({
        employee_id: input.employeeId,
        requested_bank_name: input.bankName,
        requested_account_number: input.accountNumber,
        requested_ifsc_code: input.ifscCode,
        requested_branch: input.branch ?? null,
        requested_account_holder_name: input.accountHolderName,
        status: 'pending',
      });
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['bank-change-requests', variables.employeeId] });
      queryClient.invalidateQueries({ queryKey: ['bank-details', variables.employeeId] });
    },
  });
}

// --- Assets (HR-assigned, read-only for the employee) ---

export function useAssets(employeeId: string | undefined) {
  return useQuery({
    queryKey: ['assets', employeeId],
    enabled: Boolean(employeeId),
    queryFn: async (): Promise<AssetRow[]> => {
      const { data, error } = await supabase
        .from('employee_assets')
        .select('id, asset_code, asset_type, asset_name, serial_number, issued_date, return_date, status')
        .eq('employee_id', employeeId)
        .order('issued_date', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r) => ({
        id: r.id,
        assetCode: r.asset_code,
        assetType: r.asset_type,
        assetName: r.asset_name,
        serialNumber: r.serial_number,
        issuedDate: r.issued_date,
        returnDate: r.return_date,
        status: r.status,
      }));
    },
  });
}

// --- Academic Qualification (multi-record, self-service CRUD) ---

export function useEducationRecords(employeeId: string | undefined) {
  return useQuery({
    queryKey: ['education-records', employeeId],
    enabled: Boolean(employeeId),
    queryFn: async (): Promise<EducationRecord[]> => {
      const { data, error } = await supabase
        .from('education_records')
        .select('id, qualification, specialization, institution, university, year_of_passing, score_type, score, certificate_document_id')
        .eq('employee_id', employeeId)
        .order('year_of_passing', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r) => ({
        id: r.id,
        qualification: r.qualification,
        specialization: r.specialization,
        institution: r.institution,
        university: r.university,
        yearOfPassing: r.year_of_passing,
        scoreType: r.score_type,
        score: r.score,
        certificateDocumentId: r.certificate_document_id,
      }));
    },
  });
}

interface NewEducationRecordInput {
  employeeId: string;
  qualification: string;
  specialization?: string;
  institution?: string;
  university?: string;
  yearOfPassing?: number;
  scoreType?: 'percentage' | 'cgpa';
  score?: number;
}

export function useCreateEducationRecord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: NewEducationRecordInput) => {
      const { error } = await supabase.from('education_records').insert({
        employee_id: input.employeeId,
        qualification: input.qualification,
        specialization: input.specialization ?? null,
        institution: input.institution ?? null,
        university: input.university ?? null,
        year_of_passing: input.yearOfPassing ?? null,
        score_type: input.scoreType ?? null,
        score: input.score ?? null,
      });
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['education-records', variables.employeeId] });
    },
  });
}

export function useDeleteEducationRecord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; employeeId: string }) => {
      const { error } = await supabase.from('education_records').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['education-records', variables.employeeId] });
    },
  });
}

// --- Previous Employment (multi-record, self-service CRUD) ---

export function usePreviousEmploymentRecords(employeeId: string | undefined) {
  return useQuery({
    queryKey: ['previous-employment', employeeId],
    enabled: Boolean(employeeId),
    queryFn: async (): Promise<PreviousEmploymentRecord[]> => {
      const { data, error } = await supabase
        .from('previous_employment')
        .select('id, company_name, designation, start_date, end_date, total_experience_years, reason_for_leaving')
        .eq('employee_id', employeeId)
        .order('end_date', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r) => ({
        id: r.id,
        companyName: r.company_name,
        designation: r.designation,
        startDate: r.start_date,
        endDate: r.end_date,
        totalExperienceYears: r.total_experience_years,
        reasonForLeaving: r.reason_for_leaving,
      }));
    },
  });
}

interface NewPreviousEmploymentInput {
  employeeId: string;
  companyName: string;
  designation?: string;
  startDate?: string;
  endDate?: string;
  totalExperienceYears?: number;
  reasonForLeaving?: string;
}

export function useCreatePreviousEmployment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: NewPreviousEmploymentInput) => {
      const { error } = await supabase.from('previous_employment').insert({
        employee_id: input.employeeId,
        company_name: input.companyName,
        designation: input.designation ?? null,
        start_date: input.startDate ?? null,
        end_date: input.endDate ?? null,
        total_experience_years: input.totalExperienceYears ?? null,
        reason_for_leaving: input.reasonForLeaving ?? null,
      });
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['previous-employment', variables.employeeId] });
    },
  });
}

export function useDeletePreviousEmployment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; employeeId: string }) => {
      const { error } = await supabase.from('previous_employment').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['previous-employment', variables.employeeId] });
    },
  });
}

// --- Family Details (multi-record, self-service CRUD) ---

export function useFamilyMembers(employeeId: string | undefined) {
  return useQuery({
    queryKey: ['family-members', employeeId],
    enabled: Boolean(employeeId),
    queryFn: async (): Promise<FamilyMemberRow[]> => {
      const { data, error } = await supabase
        .from('family_members')
        .select('id, name, relationship, date_of_birth, gender, occupation, is_dependent, contact_number')
        .eq('employee_id', employeeId)
        .order('created_at');
      if (error) throw error;
      return (data ?? []).map((r) => ({
        id: r.id,
        name: r.name,
        relationship: r.relationship,
        dateOfBirth: r.date_of_birth,
        gender: r.gender,
        occupation: r.occupation,
        isDependent: r.is_dependent,
        contactNumber: r.contact_number,
      }));
    },
  });
}

interface NewFamilyMemberInput {
  employeeId: string;
  name: string;
  relationship: string;
  dateOfBirth?: string;
  gender?: 'male' | 'female' | 'other';
  occupation?: string;
  isDependent: boolean;
  contactNumber?: string;
}

export function useCreateFamilyMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: NewFamilyMemberInput) => {
      const { error } = await supabase.from('family_members').insert({
        employee_id: input.employeeId,
        name: input.name,
        relationship: input.relationship,
        date_of_birth: input.dateOfBirth ?? null,
        gender: input.gender ?? null,
        occupation: input.occupation ?? null,
        is_dependent: input.isDependent,
        contact_number: input.contactNumber ?? null,
      });
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['family-members', variables.employeeId] });
    },
  });
}

export function useDeleteFamilyMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; employeeId: string }) => {
      const { error } = await supabase.from('family_members').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['family-members', variables.employeeId] });
    },
  });
}

// --- Documents (org-configured types + per-employee uploads to Supabase Storage) ---

export function useDocumentTypes(organizationId: string | undefined) {
  return useQuery({
    queryKey: ['document-types', organizationId],
    enabled: Boolean(organizationId),
    queryFn: async (): Promise<DocumentTypeOption[]> => {
      const { data, error } = await supabase
        .from('documents')
        .select('id, code, name, is_required')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return (data ?? []).map((r) => ({ id: r.id, code: r.code, name: r.name, isRequired: r.is_required }));
    },
  });
}

export function useEmployeeDocuments(employeeId: string | undefined) {
  return useQuery({
    queryKey: ['employee-documents', employeeId],
    enabled: Boolean(employeeId),
    queryFn: async (): Promise<EmployeeDocumentRow[]> => {
      const { data, error } = await supabase
        .from('employee_documents')
        .select('id, document_type_id, file_path, file_name, uploaded_at, verification_status, verification_remarks, document_type:documents(name)')
        .eq('employee_id', employeeId)
        .order('uploaded_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r) => ({
        id: r.id,
        documentTypeId: r.document_type_id,
        documentTypeName: (r.document_type as unknown as { name: string } | null)?.name ?? '-',
        filePath: r.file_path,
        fileName: r.file_name,
        uploadedAt: r.uploaded_at,
        verificationStatus: r.verification_status,
        verificationRemarks: r.verification_remarks,
      }));
    },
  });
}

interface UploadDocumentInput {
  employeeId: string;
  documentTypeId: string;
  file: File;
}

export function useUploadEmployeeDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UploadDocumentInput) => {
      const path = `${input.employeeId}/${Date.now()}-${input.file.name}`;
      const { error: uploadError } = await supabase.storage.from('employee-documents').upload(path, input.file);
      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase.from('employee_documents').insert({
        employee_id: input.employeeId,
        document_type_id: input.documentTypeId,
        file_path: path,
        file_name: input.file.name,
      });
      if (insertError) throw insertError;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['employee-documents', variables.employeeId] });
    },
  });
}

export function useDocumentDownloadUrl() {
  return useMutation({
    mutationFn: async ({ filePath }: { filePath: string }) => {
      const { data, error } = await supabase.storage.from('employee-documents').createSignedUrl(filePath, 60);
      if (error) throw error;
      return data.signedUrl;
    },
  });
}
