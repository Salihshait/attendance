import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { ORG_ID } from '@/lib/orgContext';
import { createReferenceCrudHooks } from './useAdminReferenceData';
import type { AdminDocumentTypeRow, AdminEmployeeDocumentRow } from '@/types/admin';

type NameJoin = { name: string } | null;
type EmployeeJoin = { first_name: string; last_name: string | null; employee_code: string; organization_id: string } | null;

// --- Document type catalog ---

export interface DocumentTypeInput {
  code: string;
  name: string;
  isRequired: boolean;
}

const documentTypeHooks = createReferenceCrudHooks<AdminDocumentTypeRow, DocumentTypeInput>({
  table: 'documents',
  selectColumns: 'id, code, name, is_required, is_active',
  queryKey: 'admin-document-types',
  orderBy: { column: 'name' },
  mapRow: (r) => ({ id: r.id, code: r.code, name: r.name, isRequired: r.is_required, isActive: r.is_active }),
  toRow: (input) => ({ code: input.code, name: input.name, is_required: input.isRequired }),
});

export const useDocumentTypes = documentTypeHooks.useList;
export const useCreateDocumentType = documentTypeHooks.useCreate;
export const useUpdateDocumentType = documentTypeHooks.useUpdate;
export const useToggleDocumentTypeActive = documentTypeHooks.useToggleActive;

// --- Employee document verification queue ---
// employee_documents has no organization_id column and its RLS is
// is_hr_or_admin()-only with no org check (a pre-existing gap, not
// introduced here) — so we defensively drop rows whose employee isn't in
// this org after fetching, rather than a `!inner` PostgREST join filter
// (postgrest-js's select-string type inference can't parse `!inner` hints
// without a generated Database type, which this project doesn't have).

export function useEmployeeDocumentsQueue(statusFilter: 'all' | 'pending' | 'verified' | 'rejected') {
  return useQuery({
    queryKey: ['admin-employee-documents', statusFilter],
    queryFn: async (): Promise<AdminEmployeeDocumentRow[]> => {
      let query = supabase
        .from('employee_documents')
        .select(
          'id, employee_id, document_type_id, file_path, file_name, uploaded_at, verification_status, verification_remarks, verified_at, ' +
            'employee:employees(organization_id, first_name, last_name, employee_code), document_type:documents(name)',
        )
        .order('uploaded_at', { ascending: false });
      if (statusFilter !== 'all') query = query.eq('verification_status', statusFilter);
      const { data, error } = await query;
      if (error) throw error;
      // supabase-js falls back to a GenericStringError placeholder for a
      // select this long/embedded without a generated Database type (this
      // project has none) — cast to the known raw shape rather than fight it.
      return ((data ?? []) as any[])
        .filter((r) => (r.employee as unknown as EmployeeJoin)?.organization_id === ORG_ID)
        .map((r) => {
          const employee = r.employee as unknown as EmployeeJoin;
          return {
            id: r.id,
            employeeId: r.employee_id,
            employeeName: employee ? [employee.first_name, employee.last_name].filter(Boolean).join(' ') : '-',
            employeeCode: employee?.employee_code ?? '-',
            documentTypeId: r.document_type_id,
            documentTypeName: (r.document_type as unknown as NameJoin)?.name ?? '-',
            filePath: r.file_path,
            fileName: r.file_name,
            uploadedAt: r.uploaded_at,
            verificationStatus: r.verification_status,
            verificationRemarks: r.verification_remarks,
            verifiedAt: r.verified_at,
          };
        });
    },
  });
}

export function useVerifyEmployeeDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      status,
      remarks,
      verifiedByEmployeeId,
    }: {
      id: string;
      status: 'verified' | 'rejected';
      remarks: string | null;
      verifiedByEmployeeId: string;
    }) => {
      const { error } = await supabase
        .from('employee_documents')
        .update({
          verification_status: status,
          verification_remarks: remarks,
          verified_by: verifiedByEmployeeId,
          verified_at: new Date().toISOString(),
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-employee-documents'] }),
  });
}
