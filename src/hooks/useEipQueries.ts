import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type {
  PayslipRow,
  PolicyDocumentRow,
  PreviousEmployerDeclarationRow,
  TaxDeclarationRow,
} from '@/types/eip';

// --- Pay Details: Payslips + PF + Form 16 all read from the same table ---

export function usePayslips(employeeId: string | undefined, year?: number) {
  return useQuery({
    queryKey: ['payslips', employeeId, year],
    enabled: Boolean(employeeId),
    queryFn: async (): Promise<PayslipRow[]> => {
      let query = supabase
        .from('payslips')
        .select(
          'id, pay_period_month, pay_period_year, basic_pay, hra, other_allowances, gross_earnings, pf_employee_contribution, esi_employee_contribution, professional_tax, tds, total_deductions, net_pay',
        )
        .eq('employee_id', employeeId);
      if (year) query = query.eq('pay_period_year', year);
      const { data, error } = await query.order('pay_period_year', { ascending: false }).order('pay_period_month', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r) => ({
        id: r.id,
        payPeriodMonth: r.pay_period_month,
        payPeriodYear: r.pay_period_year,
        basicPay: Number(r.basic_pay),
        hra: Number(r.hra),
        otherAllowances: Number(r.other_allowances),
        grossEarnings: Number(r.gross_earnings),
        pfEmployeeContribution: Number(r.pf_employee_contribution),
        esiEmployeeContribution: Number(r.esi_employee_contribution),
        professionalTax: Number(r.professional_tax),
        tds: Number(r.tds),
        totalDeductions: Number(r.total_deductions),
        netPay: Number(r.net_pay),
      }));
    },
  });
}

// --- TDS: Previous Employer Declaration ---

export function usePreviousEmployerDeclarations(employeeId: string | undefined) {
  return useQuery({
    queryKey: ['previous-employer-declarations', employeeId],
    enabled: Boolean(employeeId),
    queryFn: async (): Promise<PreviousEmployerDeclarationRow[]> => {
      const { data, error } = await supabase
        .from('previous_employer_declarations')
        .select('id, financial_year, employer_name, income_earned, tds_deducted, pf_contribution, status')
        .eq('employee_id', employeeId)
        .order('financial_year', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r) => ({
        id: r.id,
        financialYear: r.financial_year,
        employerName: r.employer_name,
        incomeEarned: Number(r.income_earned),
        tdsDeducted: Number(r.tds_deducted),
        pfContribution: Number(r.pf_contribution),
        status: r.status,
      }));
    },
  });
}

interface NewPreviousEmployerDeclarationInput {
  employeeId: string;
  financialYear: string;
  employerName: string;
  incomeEarned: number;
  tdsDeducted: number;
  pfContribution: number;
}

export function useCreatePreviousEmployerDeclaration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: NewPreviousEmployerDeclarationInput) => {
      const { error } = await supabase.from('previous_employer_declarations').insert({
        employee_id: input.employeeId,
        financial_year: input.financialYear,
        employer_name: input.employerName,
        income_earned: input.incomeEarned,
        tds_deducted: input.tdsDeducted,
        pf_contribution: input.pfContribution,
        status: 'submitted',
      });
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['previous-employer-declarations', variables.employeeId] });
    },
  });
}

// --- TDS: Tax Declaration (investment declarations, regime, HRA exemption) ---

export function useTaxDeclaration(employeeId: string | undefined, financialYear: string) {
  return useQuery({
    queryKey: ['tax-declaration', employeeId, financialYear],
    enabled: Boolean(employeeId && financialYear),
    queryFn: async (): Promise<TaxDeclarationRow> => {
      const { data, error } = await supabase
        .from('tax_declarations')
        .select('id, financial_year, regime, declared_investments, hra_exemption, status, submitted_at')
        .eq('employee_id', employeeId)
        .eq('financial_year', financialYear)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        return { id: null, financialYear, regime: 'new', declaredInvestments: 0, hraExemption: 0, status: 'draft', submittedAt: null };
      }
      return {
        id: data.id,
        financialYear: data.financial_year,
        regime: data.regime,
        declaredInvestments: Number(data.declared_investments),
        hraExemption: Number(data.hra_exemption),
        status: data.status,
        submittedAt: data.submitted_at,
      };
    },
  });
}

interface UpsertTaxDeclarationInput {
  employeeId: string;
  financialYear: string;
  regime: 'old' | 'new';
  declaredInvestments: number;
  hraExemption: number;
  submit: boolean;
}

export function useUpsertTaxDeclaration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpsertTaxDeclarationInput) => {
      const { error } = await supabase.from('tax_declarations').upsert(
        {
          employee_id: input.employeeId,
          financial_year: input.financialYear,
          regime: input.regime,
          declared_investments: input.declaredInvestments,
          hra_exemption: input.hraExemption,
          status: input.submit ? 'submitted' : 'draft',
          submitted_at: input.submit ? new Date().toISOString() : null,
        },
        { onConflict: 'employee_id,financial_year' },
      );
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tax-declaration', variables.employeeId, variables.financialYear] });
    },
  });
}

// --- Policies: org-wide documents grouped by year, HR-uploaded ---

export function usePolicyDocuments(organizationId: string | undefined) {
  return useQuery({
    queryKey: ['policy-documents', organizationId],
    enabled: Boolean(organizationId),
    queryFn: async (): Promise<PolicyDocumentRow[]> => {
      const { data, error } = await supabase
        .from('policy_documents')
        .select('id, policy_year, title, category, file_path, file_name, uploaded_at')
        .eq('organization_id', organizationId)
        .order('policy_year', { ascending: false })
        .order('uploaded_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r) => ({
        id: r.id,
        policyYear: r.policy_year,
        title: r.title,
        category: r.category,
        filePath: r.file_path,
        fileName: r.file_name,
        uploadedAt: r.uploaded_at,
      }));
    },
  });
}

interface UploadPolicyDocumentInput {
  organizationId: string;
  uploadedBy: string;
  policyYear: number;
  title: string;
  category: string;
  file: File;
}

export function useUploadPolicyDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UploadPolicyDocumentInput) => {
      const path = `${input.organizationId}/${input.policyYear}-${Date.now()}-${input.file.name}`;
      const { error: uploadError } = await supabase.storage.from('policy-documents').upload(path, input.file);
      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase.from('policy_documents').insert({
        organization_id: input.organizationId,
        policy_year: input.policyYear,
        title: input.title,
        category: input.category,
        file_path: path,
        file_name: input.file.name,
        uploaded_by: input.uploadedBy,
      });
      if (insertError) throw insertError;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['policy-documents', variables.organizationId] });
    },
  });
}

export function usePolicyDownloadUrl() {
  return useMutation({
    mutationFn: async ({ filePath }: { filePath: string }) => {
      const { data, error } = await supabase.storage.from('policy-documents').createSignedUrl(filePath, 60);
      if (error) throw error;
      return data.signedUrl;
    },
  });
}
