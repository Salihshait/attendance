import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { ORG_ID } from '@/lib/orgContext';
import type { AdminApprovalStepRow, AdminApprovalWorkflowRow, ApproverType } from '@/types/admin';

type PersonJoin = { first_name: string; last_name: string | null } | null;

export function useApprovalWorkflows() {
  return useQuery({
    queryKey: ['admin-approval-workflows'],
    queryFn: async (): Promise<AdminApprovalWorkflowRow[]> => {
      const { data, error } = await supabase
        .from('approval_workflows')
        .select('id, request_type, name, is_active, approval_steps(count)')
        .eq('organization_id', ORG_ID)
        .order('name');
      if (error) throw error;
      return (data ?? []).map((r) => ({
        id: r.id,
        requestType: r.request_type,
        name: r.name,
        isActive: r.is_active,
        stepCount: (r.approval_steps as unknown as { count: number }[])?.[0]?.count ?? 0,
      }));
    },
  });
}

export interface WorkflowInput {
  requestType: AdminApprovalWorkflowRow['requestType'];
  name: string;
}

export function useCreateWorkflow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: WorkflowInput) => {
      const { data, error } = await supabase
        .from('approval_workflows')
        .insert({ request_type: input.requestType, name: input.name, organization_id: ORG_ID })
        .select('id')
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-approval-workflows'] }),
  });
}

export function useUpdateWorkflow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: WorkflowInput }) => {
      const { error } = await supabase.from('approval_workflows').update({ request_type: input.requestType, name: input.name }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-approval-workflows'] }),
  });
}

export function useToggleWorkflowActive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase.from('approval_workflows').update({ is_active: isActive }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-approval-workflows'] }),
  });
}

export function useApprovalSteps(workflowId: string | undefined) {
  return useQuery({
    queryKey: ['admin-approval-steps', workflowId],
    enabled: Boolean(workflowId),
    queryFn: async (): Promise<AdminApprovalStepRow[]> => {
      const { data, error } = await supabase
        .from('approval_steps')
        .select('id, workflow_id, step_order, approver_type, approver_role, approver_employee_id, is_final, escalate_after_hours, approver_employee:employees(first_name, last_name)')
        .eq('workflow_id', workflowId)
        .order('step_order');
      if (error) throw error;
      return (data ?? []).map((r) => ({
        id: r.id,
        workflowId: r.workflow_id,
        stepOrder: r.step_order,
        approverType: r.approver_type,
        approverRole: r.approver_role,
        approverEmployeeId: r.approver_employee_id,
        approverEmployeeName: r.approver_employee
          ? [(r.approver_employee as unknown as PersonJoin)?.first_name, (r.approver_employee as unknown as PersonJoin)?.last_name].filter(Boolean).join(' ')
          : null,
        isFinal: r.is_final,
        escalateAfterHours: r.escalate_after_hours,
      }));
    },
  });
}

export interface StepInput {
  workflowId: string;
  stepOrder: number;
  approverType: ApproverType;
  approverRole: 'manager' | 'hr_admin' | 'super_admin' | null;
  approverEmployeeId: string | null;
  isFinal: boolean;
  escalateAfterHours: number | null;
}

export function useCreateStep() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: StepInput) => {
      const { error } = await supabase.from('approval_steps').insert({
        workflow_id: input.workflowId,
        step_order: input.stepOrder,
        approver_type: input.approverType,
        approver_role: input.approverRole,
        approver_employee_id: input.approverEmployeeId,
        is_final: input.isFinal,
        escalate_after_hours: input.escalateAfterHours,
      });
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-approval-steps', variables.workflowId] });
      queryClient.invalidateQueries({ queryKey: ['admin-approval-workflows'] });
    },
  });
}

export function useUpdateStep() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: StepInput }) => {
      const { error } = await supabase
        .from('approval_steps')
        .update({
          step_order: input.stepOrder,
          approver_type: input.approverType,
          approver_role: input.approverRole,
          approver_employee_id: input.approverEmployeeId,
          is_final: input.isFinal,
          escalate_after_hours: input.escalateAfterHours,
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-approval-steps', variables.input.workflowId] });
    },
  });
}

export function useDeleteStep() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; workflowId: string }) => {
      const { error } = await supabase.from('approval_steps').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-approval-steps', variables.workflowId] });
      queryClient.invalidateQueries({ queryKey: ['admin-approval-workflows'] });
    },
  });
}
