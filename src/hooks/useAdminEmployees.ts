import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { ORG_ID } from '@/lib/orgContext';
import { formatDateISO } from '@/lib/utils';
import type { AdminEmployeeRow, EmployeeOption } from '@/types/admin';

type NameJoin = { name: string } | null;

const EMPLOYEE_LIST_SELECT =
  'id, employee_code, first_name, middle_name, last_name, gender, date_of_birth, father_name, ' +
  'date_of_joining, date_of_leaving, official_email, official_mobile, paygroup, cost_centre, ' +
  'place_of_tax_deduction, job_responsibility, employment_type, employment_status, user_id, ' +
  'department_id, designation_id, location_id, grade_id, reporting_manager_id, ' +
  'department:departments(name), designation:designations(name), location:locations(name), grade:grades(name)';

function mapEmployeeRow(r: any, managerNameById: Map<string, string>): AdminEmployeeRow {
  return {
    id: r.id,
    employeeCode: r.employee_code,
    firstName: r.first_name,
    middleName: r.middle_name,
    lastName: r.last_name,
    employeeName: [r.first_name, r.middle_name, r.last_name].filter(Boolean).join(' '),
    gender: r.gender,
    dateOfBirth: r.date_of_birth,
    fatherName: r.father_name,
    dateOfJoining: r.date_of_joining,
    dateOfLeaving: r.date_of_leaving,
    officialEmail: r.official_email,
    officialMobile: r.official_mobile,
    paygroup: r.paygroup,
    costCentre: r.cost_centre,
    placeOfTaxDeduction: r.place_of_tax_deduction,
    jobResponsibility: r.job_responsibility,
    employmentType: r.employment_type,
    employmentStatus: r.employment_status,
    departmentId: r.department_id,
    departmentName: (r.department as NameJoin)?.name ?? null,
    designationId: r.designation_id,
    designationName: (r.designation as NameJoin)?.name ?? null,
    locationId: r.location_id,
    locationName: (r.location as NameJoin)?.name ?? null,
    gradeId: r.grade_id,
    gradeName: (r.grade as NameJoin)?.name ?? null,
    reportingManagerId: r.reporting_manager_id,
    reportingManagerName: r.reporting_manager_id ? (managerNameById.get(r.reporting_manager_id) ?? '-') : null,
    userId: r.user_id,
    hasLogin: r.user_id !== null,
  };
}

/**
 * Org-wide employee list. Manager display name is resolved from the
 * fetched rows themselves (a Map), not a second query or a self-FK embed —
 * AuthProvider.tsx's loadEmployeeProfile deliberately avoids embedding
 * reporting_manager_id via PostgREST because self-referencing FK embeds are
 * direction-ambiguous; since this query already has the whole org in hand,
 * building the name map locally is both cheaper and unambiguous.
 */
export function useAdminEmployeeList() {
  return useQuery({
    queryKey: ['admin-employees'],
    queryFn: async (): Promise<AdminEmployeeRow[]> => {
      const { data, error } = await supabase
        .from('employees')
        .select(EMPLOYEE_LIST_SELECT)
        .eq('organization_id', ORG_ID)
        .order('first_name');
      if (error) throw error;
      // supabase-js's select-string type inference falls back to a
      // GenericStringError placeholder for a select this long/embedded
      // without a generated Database type (this project has none) — cast
      // to the known raw shape rather than fight it, same looseness the
      // rest of the codebase already applies to embedded-join fields.
      const rows = (data ?? []) as any[];
      const managerNameById = new Map<string, string>();
      for (const r of rows) {
        managerNameById.set(r.id, [r.first_name, r.middle_name, r.last_name].filter(Boolean).join(' '));
      }
      return rows.map((r) => mapEmployeeRow(r, managerNameById));
    },
  });
}

/** Lightweight id/code/name list, reused by the Employee/Department-head/Approval-step forms. */
export function useEmployeesForSelect() {
  return useQuery({
    queryKey: ['admin-employees-select'],
    queryFn: async (): Promise<EmployeeOption[]> => {
      const { data, error } = await supabase
        .from('employees')
        .select('id, employee_code, first_name, middle_name, last_name')
        .eq('organization_id', ORG_ID)
        .order('first_name');
      if (error) throw error;
      return (data ?? []).map((r) => ({
        id: r.id,
        employeeCode: r.employee_code,
        name: [r.first_name, r.middle_name, r.last_name].filter(Boolean).join(' '),
      }));
    },
  });
}

export interface EmployeeInput {
  employeeCode: string;
  firstName: string;
  middleName: string | null;
  lastName: string | null;
  gender: 'male' | 'female' | 'other' | null;
  dateOfBirth: string | null;
  fatherName: string | null;
  dateOfJoining: string;
  officialEmail: string;
  officialMobile: string | null;
  paygroup: string | null;
  costCentre: string | null;
  placeOfTaxDeduction: string | null;
  jobResponsibility: string | null;
  employmentType: 'full_time' | 'part_time' | 'contract' | 'intern';
  departmentId: string | null;
  designationId: string | null;
  locationId: string | null;
  gradeId: string | null;
  reportingManagerId: string | null;
}

function toEmployeeRow(input: EmployeeInput) {
  return {
    employee_code: input.employeeCode,
    first_name: input.firstName,
    middle_name: input.middleName,
    last_name: input.lastName,
    gender: input.gender,
    date_of_birth: input.dateOfBirth,
    father_name: input.fatherName,
    date_of_joining: input.dateOfJoining,
    official_email: input.officialEmail,
    official_mobile: input.officialMobile,
    paygroup: input.paygroup,
    cost_centre: input.costCentre,
    place_of_tax_deduction: input.placeOfTaxDeduction,
    job_responsibility: input.jobResponsibility,
    employment_type: input.employmentType,
    department_id: input.departmentId,
    designation_id: input.designationId,
    location_id: input.locationId,
    grade_id: input.gradeId,
    reporting_manager_id: input.reportingManagerId,
  };
}

export function useCreateEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: EmployeeInput) => {
      // user_id stays NULL — creating a real login requires the Supabase
      // service-role admin API, which this client-side flow can't call.
      // Linking a login account is a documented manual follow-up step.
      const { error } = await supabase.from('employees').insert({ ...toEmployeeRow(input), organization_id: ORG_ID });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-employees'] });
      queryClient.invalidateQueries({ queryKey: ['admin-employees-select'] });
    },
  });
}

export function useUpdateEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: EmployeeInput }) => {
      const { error } = await supabase.from('employees').update(toEmployeeRow(input)).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-employees'] });
      queryClient.invalidateQueries({ queryKey: ['admin-employees-select'] });
    },
  });
}

export function useDeactivateEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, dateOfLeaving }: { id: string; dateOfLeaving: string | null }) => {
      const { error } = await supabase
        .from('employees')
        .update({ employment_status: 'inactive', date_of_leaving: dateOfLeaving ?? formatDateISO(new Date()) })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-employees'] }),
  });
}
