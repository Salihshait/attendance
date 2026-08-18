import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { ORG_ID } from '@/lib/orgContext';
import type { AdminShiftRow } from '@/types/admin';

const SHIFT_SELECT =
  'id, name, start_time, end_time, grace_minutes, half_day_hours, full_day_hours, is_active, ' +
  'weekoff_days, overtime_enabled, overtime_rate_multiplier, late_rule_enabled, early_going_rule_enabled, shortfall_rule_enabled, ' +
  'standard_break_minutes, min_break_minutes, max_break_minutes, break_paid, break_deduction_mode';

function mapShiftRow(r: any): AdminShiftRow {
  return {
    id: r.id,
    name: r.name,
    startTime: r.start_time,
    endTime: r.end_time,
    graceMinutes: r.grace_minutes,
    halfDayHours: Number(r.half_day_hours),
    fullDayHours: Number(r.full_day_hours),
    isActive: r.is_active,
    weekoffDays: r.weekoff_days ?? [],
    overtimeEnabled: r.overtime_enabled,
    overtimeRateMultiplier: Number(r.overtime_rate_multiplier),
    lateRuleEnabled: r.late_rule_enabled,
    earlyGoingRuleEnabled: r.early_going_rule_enabled,
    shortfallRuleEnabled: r.shortfall_rule_enabled,
    standardBreakMinutes: r.standard_break_minutes,
    minBreakMinutes: r.min_break_minutes,
    maxBreakMinutes: r.max_break_minutes,
    breakPaid: r.break_paid,
    breakDeductionMode: r.break_deduction_mode,
  };
}

/** Shared by ShiftsPage (base fields) and AttendanceRulesPage (rule columns) — one table, two focused UIs. */
export function useShifts() {
  return useQuery({
    queryKey: ['admin-shifts'],
    queryFn: async (): Promise<AdminShiftRow[]> => {
      const { data, error } = await supabase.from('shifts').select(SHIFT_SELECT).eq('organization_id', ORG_ID).order('name');
      if (error) throw error;
      return (data ?? []).map(mapShiftRow);
    },
  });
}

export interface ShiftInput {
  name: string;
  startTime: string;
  endTime: string;
  graceMinutes: number;
  halfDayHours: number;
  fullDayHours: number;
}

function toShiftRow(input: ShiftInput) {
  return {
    name: input.name,
    start_time: input.startTime,
    end_time: input.endTime,
    grace_minutes: input.graceMinutes,
    half_day_hours: input.halfDayHours,
    full_day_hours: input.fullDayHours,
  };
}

export function useCreateShift() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: ShiftInput) => {
      const { error } = await supabase.from('shifts').insert({ ...toShiftRow(input), organization_id: ORG_ID });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-shifts'] }),
  });
}

export function useUpdateShift() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: ShiftInput }) => {
      const { error } = await supabase.from('shifts').update(toShiftRow(input)).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-shifts'] }),
  });
}

export function useToggleShiftActive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase.from('shifts').update({ is_active: isActive }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-shifts'] }),
  });
}

export interface ShiftRulesInput {
  weekoffDays: number[];
  overtimeEnabled: boolean;
  overtimeRateMultiplier: number;
  lateRuleEnabled: boolean;
  earlyGoingRuleEnabled: boolean;
  shortfallRuleEnabled: boolean;
  /** Actually read by recompute_attendance_day() (0045) -- not informational-only, unlike the toggles above. */
  standardBreakMinutes: number;
  minBreakMinutes: number;
  maxBreakMinutes: number;
  breakPaid: boolean;
  breakDeductionMode: 'actual' | 'standard';
}

/** Rule columns only — same query-key invalidation as base-field edits so Shifts and Attendance Rules stay in sync. */
export function useUpdateShiftRules() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: ShiftRulesInput }) => {
      const { error } = await supabase
        .from('shifts')
        .update({
          weekoff_days: input.weekoffDays,
          overtime_enabled: input.overtimeEnabled,
          overtime_rate_multiplier: input.overtimeRateMultiplier,
          late_rule_enabled: input.lateRuleEnabled,
          early_going_rule_enabled: input.earlyGoingRuleEnabled,
          shortfall_rule_enabled: input.shortfallRuleEnabled,
          standard_break_minutes: input.standardBreakMinutes,
          min_break_minutes: input.minBreakMinutes,
          max_break_minutes: input.maxBreakMinutes,
          break_paid: input.breakPaid,
          break_deduction_mode: input.breakDeductionMode,
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-shifts'] }),
  });
}
