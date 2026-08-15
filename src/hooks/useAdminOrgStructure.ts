import { createReferenceCrudHooks } from './useAdminReferenceData';
import type { AdminDepartmentRow, AdminDesignationRow, AdminGradeRow, AdminLocationRow } from '@/types/admin';

type NameJoin = { name: string } | null;
type PersonJoin = { first_name: string; last_name: string | null } | null;

function personName(p: PersonJoin): string | null {
  return p ? [p.first_name, p.last_name].filter(Boolean).join(' ') : null;
}

// --- Departments ---

export interface DepartmentInput {
  name: string;
  code: string | null;
  headEmployeeId: string | null;
}

const departmentHooks = createReferenceCrudHooks<AdminDepartmentRow, DepartmentInput>({
  table: 'departments',
  selectColumns: 'id, name, code, is_active, head_employee_id, head:employees!departments_head_employee_id_fkey(first_name, last_name)',
  queryKey: 'admin-departments',
  orderBy: { column: 'name' },
  mapRow: (r) => ({
    id: r.id,
    name: r.name,
    code: r.code,
    headEmployeeId: r.head_employee_id,
    headEmployeeName: personName(r.head as unknown as PersonJoin),
    isActive: r.is_active,
  }),
  toRow: (input) => ({ name: input.name, code: input.code, head_employee_id: input.headEmployeeId }),
});

export const useDepartments = departmentHooks.useList;
export const useCreateDepartment = departmentHooks.useCreate;
export const useUpdateDepartment = departmentHooks.useUpdate;
export const useToggleDepartmentActive = departmentHooks.useToggleActive;

// --- Designations ---

export interface DesignationInput {
  name: string;
  code: string | null;
  departmentId: string | null;
  gradeId: string | null;
}

const designationHooks = createReferenceCrudHooks<AdminDesignationRow, DesignationInput>({
  table: 'designations',
  selectColumns: 'id, name, code, is_active, department_id, grade_id, department:departments(name), grade:grades(name)',
  queryKey: 'admin-designations',
  orderBy: { column: 'name' },
  mapRow: (r) => ({
    id: r.id,
    name: r.name,
    code: r.code,
    departmentId: r.department_id,
    departmentName: (r.department as unknown as NameJoin)?.name ?? null,
    gradeId: r.grade_id,
    gradeName: (r.grade as unknown as NameJoin)?.name ?? null,
    isActive: r.is_active,
  }),
  toRow: (input) => ({ name: input.name, code: input.code, department_id: input.departmentId, grade_id: input.gradeId }),
});

export const useDesignations = designationHooks.useList;
export const useCreateDesignation = designationHooks.useCreate;
export const useUpdateDesignation = designationHooks.useUpdate;
export const useToggleDesignationActive = designationHooks.useToggleActive;

// --- Locations ---

export interface LocationInput {
  name: string;
  city: string | null;
  state: string | null;
  country: string | null;
  timeZone: string | null;
}

const locationHooks = createReferenceCrudHooks<AdminLocationRow, LocationInput>({
  table: 'locations',
  selectColumns: 'id, name, city, state, country, time_zone, is_active',
  queryKey: 'admin-locations',
  orderBy: { column: 'name' },
  mapRow: (r) => ({
    id: r.id,
    name: r.name,
    city: r.city,
    state: r.state,
    country: r.country,
    timeZone: r.time_zone,
    isActive: r.is_active,
  }),
  toRow: (input) => ({ name: input.name, city: input.city, state: input.state, country: input.country, time_zone: input.timeZone }),
});

export const useLocations = locationHooks.useList;
export const useCreateLocation = locationHooks.useCreate;
export const useUpdateLocation = locationHooks.useUpdate;
export const useToggleLocationActive = locationHooks.useToggleActive;

// --- Grades ---

export interface GradeInput {
  name: string;
  rank: number | null;
}

const gradeHooks = createReferenceCrudHooks<AdminGradeRow, GradeInput>({
  table: 'grades',
  selectColumns: 'id, name, rank, is_active',
  queryKey: 'admin-grades',
  orderBy: { column: 'rank' },
  mapRow: (r) => ({ id: r.id, name: r.name, rank: r.rank, isActive: r.is_active }),
  toRow: (input) => ({ name: input.name, rank: input.rank }),
});

export const useGrades = gradeHooks.useList;
export const useCreateGrade = gradeHooks.useCreate;
export const useUpdateGrade = gradeHooks.useUpdate;
export const useToggleGradeActive = gradeHooks.useToggleActive;
