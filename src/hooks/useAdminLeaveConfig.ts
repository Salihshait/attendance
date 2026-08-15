import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { ORG_ID } from '@/lib/orgContext';
import { createReferenceCrudHooks } from './useAdminReferenceData';
import type { AdminLeavePolicyRow, AdminLeaveTypeRow } from '@/types/admin';

type NameJoin = { name: string } | null;

// --- Leave Types ---

export interface LeaveTypeInput {
  code: string;
  name: string;
  isPaid: boolean;
  accrualFrequency: 'monthly' | 'yearly' | 'none';
  allowHalfDay: boolean;
  requiresAttachment: boolean;
}

const leaveTypeHooks = createReferenceCrudHooks<AdminLeaveTypeRow, LeaveTypeInput>({
  table: 'leave_types',
  selectColumns: 'id, code, name, is_paid, accrual_frequency, allow_half_day, requires_attachment, is_active',
  queryKey: 'admin-leave-types',
  orderBy: { column: 'name' },
  mapRow: (r) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    isPaid: r.is_paid,
    accrualFrequency: r.accrual_frequency,
    allowHalfDay: r.allow_half_day,
    requiresAttachment: r.requires_attachment,
    isActive: r.is_active,
  }),
  toRow: (input) => ({
    code: input.code,
    name: input.name,
    is_paid: input.isPaid,
    accrual_frequency: input.accrualFrequency,
    allow_half_day: input.allowHalfDay,
    requires_attachment: input.requiresAttachment,
  }),
});

export const useLeaveTypesAdmin = leaveTypeHooks.useList;
export const useCreateLeaveType = leaveTypeHooks.useCreate;
export const useUpdateLeaveType = leaveTypeHooks.useUpdate;
export const useToggleLeaveTypeActive = leaveTypeHooks.useToggleActive;

// --- Leave Policies ---

export function useLeavePolicies() {
  return useQuery({
    queryKey: ['admin-leave-policies'],
    queryFn: async (): Promise<AdminLeavePolicyRow[]> => {
      const { data, error } = await supabase
        .from('leave_policies')
        .select('id, leave_type_id, grade_id, annual_entitlement, carry_forward_limit, encashment_allowed, effective_from, effective_to, leave_type:leave_types(name), grade:grades(name)')
        .eq('organization_id', ORG_ID)
        .order('effective_from', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r) => ({
        id: r.id,
        leaveTypeId: r.leave_type_id,
        leaveTypeName: (r.leave_type as unknown as NameJoin)?.name ?? '-',
        gradeId: r.grade_id,
        gradeName: (r.grade as unknown as NameJoin)?.name ?? null,
        annualEntitlement: Number(r.annual_entitlement),
        carryForwardLimit: Number(r.carry_forward_limit),
        encashmentAllowed: r.encashment_allowed,
        effectiveFrom: r.effective_from,
        effectiveTo: r.effective_to,
      }));
    },
  });
}

export interface LeavePolicyInput {
  leaveTypeId: string;
  gradeId: string | null;
  annualEntitlement: number;
  carryForwardLimit: number;
  encashmentAllowed: boolean;
  effectiveFrom: string;
  effectiveTo: string | null;
}

function toLeavePolicyRow(input: LeavePolicyInput) {
  return {
    leave_type_id: input.leaveTypeId,
    grade_id: input.gradeId,
    annual_entitlement: input.annualEntitlement,
    carry_forward_limit: input.carryForwardLimit,
    encashment_allowed: input.encashmentAllowed,
    effective_from: input.effectiveFrom,
    effective_to: input.effectiveTo,
  };
}

export function useCreateLeavePolicy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: LeavePolicyInput) => {
      const { error } = await supabase.from('leave_policies').insert({ ...toLeavePolicyRow(input), organization_id: ORG_ID });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-leave-policies'] }),
  });
}

export function useUpdateLeavePolicy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: LeavePolicyInput }) => {
      const { error } = await supabase.from('leave_policies').update(toLeavePolicyRow(input)).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-leave-policies'] }),
  });
}
