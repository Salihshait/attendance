import { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Pencil, UserX } from 'lucide-react';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable } from '@/components/ui/DataTable';
import { FilterBar, FilterField, FilterSelect } from '@/components/ui/FilterBar';
import { Modal } from '@/components/ui/Modal';
import { StatusBadge, type StatusKind } from '@/components/ui/StatusBadge';
import { Field, FormActions, inputClass } from '@/components/admin/FormField';
import { useAdminEmployeeList, useCreateEmployee, useUpdateEmployee, useDeactivateEmployee, useEmployeesForSelect } from '@/hooks/useAdminEmployees';
import { useDepartments, useDesignations, useLocations, useGrades } from '@/hooks/useAdminOrgStructure';
import { formatDDMMYYYY } from '@/lib/dateFormat';
import type { EmployeeInput } from '@/hooks/useAdminEmployees';
import type { AdminEmployeeRow } from '@/types/admin';

const statusLabels: Record<AdminEmployeeRow['employmentStatus'], string> = {
  active: 'Active',
  inactive: 'Inactive',
  on_notice: 'On Notice',
  exited: 'Exited',
};
const statusTone: Record<AdminEmployeeRow['employmentStatus'], StatusKind> = {
  active: 'active',
  inactive: 'inactive',
  on_notice: 'pending',
  exited: 'cancelled',
};
const statusOptions = [{ value: 'all', label: 'All' }, ...Object.entries(statusLabels).map(([value, label]) => ({ value, label }))];

const schema = z.object({
  employeeCode: z.string().min(1, 'Required'),
  firstName: z.string().min(1, 'Required'),
  middleName: z.string().optional(),
  lastName: z.string().optional(),
  officialEmail: z.string().email('Enter a valid email'),
  officialMobile: z.string().optional(),
  gender: z.enum(['male', 'female', 'other', '']).optional(),
  dateOfBirth: z.string().optional(),
  fatherName: z.string().optional(),
  dateOfJoining: z.string().min(1, 'Required'),
  employmentType: z.enum(['full_time', 'part_time', 'contract', 'intern']),
  departmentId: z.string().optional(),
  designationId: z.string().optional(),
  locationId: z.string().optional(),
  gradeId: z.string().optional(),
  reportingManagerId: z.string().optional(),
  paygroup: z.string().optional(),
  costCentre: z.string().optional(),
  placeOfTaxDeduction: z.string().optional(),
  jobResponsibility: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

export default function EmployeesPage() {
  const { data, isLoading } = useAdminEmployeeList();
  const { data: departments } = useDepartments();
  const { data: locations } = useLocations();
  const createEmployee = useCreateEmployee();
  const updateEmployee = useUpdateEmployee();
  const deactivateEmployee = useDeactivateEmployee();

  const [statusFilter, setStatusFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');
  const [editing, setEditing] = useState<{ mode: 'create' | 'edit'; row: AdminEmployeeRow | null } | null>(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState<AdminEmployeeRow | null>(null);

  const departmentOptions = useMemo(
    () => [{ value: 'all', label: 'All' }, ...(departments ?? []).map((d) => ({ value: d.id, label: d.name }))],
    [departments],
  );
  const locationOptions = useMemo(
    () => [{ value: 'all', label: 'All' }, ...(locations ?? []).map((l) => ({ value: l.id, label: l.name }))],
    [locations],
  );

  const rows = useMemo(
    () =>
      (data ?? []).filter((r) => {
        if (statusFilter !== 'all' && r.employmentStatus !== statusFilter) return false;
        if (departmentFilter !== 'all' && r.departmentId !== departmentFilter) return false;
        if (locationFilter !== 'all' && r.locationId !== locationFilter) return false;
        return true;
      }),
    [data, statusFilter, departmentFilter, locationFilter],
  );

  const columns: ColumnDef<AdminEmployeeRow, any>[] = [
    { header: 'Employee ID', accessorKey: 'employeeCode' },
    { header: 'Name', accessorKey: 'employeeName' },
    { header: 'Email', accessorKey: 'officialEmail' },
    { header: 'Mobile', accessorFn: (r) => r.officialMobile ?? '-', id: 'mobile' },
    { header: 'Department', accessorFn: (r) => r.departmentName ?? '-', id: 'department' },
    { header: 'Designation', accessorFn: (r) => r.designationName ?? '-', id: 'designation' },
    { header: 'Manager', accessorFn: (r) => r.reportingManagerName ?? '-', id: 'manager' },
    { header: 'Location', accessorFn: (r) => r.locationName ?? '-', id: 'location' },
    { header: 'Grade', accessorFn: (r) => r.gradeName ?? '-', id: 'grade' },
    { header: 'Joining Date', accessorFn: (r) => formatDDMMYYYY(r.dateOfJoining), id: 'doj' },
    { header: 'Employment Type', accessorFn: (r) => r.employmentType.replace('_', ' '), id: 'employmentType' },
    {
      header: 'Status',
      id: 'status',
      cell: ({ row }) => <StatusBadge status={statusTone[row.original.employmentStatus]} label={statusLabels[row.original.employmentStatus]} />,
    },
    {
      header: 'Actions',
      id: 'actions',
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setEditing({ mode: 'edit', row: row.original })}
            className="rounded bg-primary-500 p-1 text-white hover:bg-primary-600"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          {row.original.employmentStatus === 'active' && (
            <button type="button" onClick={() => setConfirmDeactivate(row.original)} className="rounded bg-status-rejected p-1 text-white hover:opacity-90">
              <UserX className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <Breadcrumb items={[{ label: 'Administration' }, { label: 'Employees' }]} />

      <div className="overflow-hidden rounded border border-slate-200 bg-white">
        <PageHeader
          title="Employees"
          actions={
            <button
              type="button"
              onClick={() => setEditing({ mode: 'create', row: null })}
              className="rounded bg-white/15 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/25"
            >
              + Add New
            </button>
          }
        />

        <FilterBar>
          <FilterField label="Status">
            <FilterSelect value={statusFilter} onChange={setStatusFilter} options={statusOptions} />
          </FilterField>
          <FilterField label="Department">
            <FilterSelect value={departmentFilter} onChange={setDepartmentFilter} options={departmentOptions} />
          </FilterField>
          <FilterField label="Location">
            <FilterSelect value={locationFilter} onChange={setLocationFilter} options={locationOptions} />
          </FilterField>
        </FilterBar>

        <p className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-[11px] text-slate-500">
          New employees have no login account until one is manually linked — this is expected and not a bug.
        </p>

        <DataTable columns={columns} data={rows} searchPlaceholder="Search by name, code, or email" emptyMessage={isLoading ? 'Loading…' : 'No employees found.'} />
      </div>

      {editing && (
        <Modal title={editing.mode === 'create' ? 'Add Employee' : 'Edit Employee'} onClose={() => setEditing(null)} widthClass="max-w-2xl">
          <EmployeeForm
            initial={editing.row}
            onDone={() => setEditing(null)}
            onSubmit={async (values) => {
              if (editing.mode === 'create') await createEmployee.mutateAsync(values);
              else await updateEmployee.mutateAsync({ id: editing.row!.id, input: values });
            }}
            isPending={createEmployee.isPending || updateEmployee.isPending}
            submitError={(createEmployee.error as Error)?.message ?? (updateEmployee.error as Error)?.message}
          />
        </Modal>
      )}

      {confirmDeactivate && (
        <Modal title="Deactivate Employee" onClose={() => setConfirmDeactivate(null)}>
          <div className="space-y-3 text-xs">
            <p className="text-slate-600">
              Deactivate <span className="font-semibold">{confirmDeactivate.employeeName}</span> ({confirmDeactivate.employeeCode})? Their
              employment status will be set to Inactive.
            </p>
            {deactivateEmployee.isError && <p className="text-status-rejected">{(deactivateEmployee.error as Error).message}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmDeactivate(null)} className="rounded border border-slate-300 px-3.5 py-1.5 text-slate-600">
                Cancel
              </button>
              <button
                type="button"
                disabled={deactivateEmployee.isPending}
                onClick={async () => {
                  await deactivateEmployee.mutateAsync({ id: confirmDeactivate.id, dateOfLeaving: confirmDeactivate.dateOfLeaving });
                  setConfirmDeactivate(null);
                }}
                className="rounded bg-status-rejected px-3.5 py-1.5 font-semibold text-white hover:opacity-90 disabled:opacity-60"
              >
                {deactivateEmployee.isPending ? 'Deactivating…' : 'Deactivate'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function EmployeeForm({
  initial,
  onDone,
  onSubmit,
  isPending,
  submitError,
}: {
  initial: AdminEmployeeRow | null;
  onDone: () => void;
  onSubmit: (values: EmployeeInput) => Promise<void>;
  isPending: boolean;
  submitError?: string;
}) {
  const { data: departments } = useDepartments();
  const { data: designations } = useDesignations();
  const { data: locations } = useLocations();
  const { data: grades } = useGrades();
  const { data: managers } = useEmployeesForSelect();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      employeeCode: initial?.employeeCode ?? '',
      firstName: initial?.firstName ?? '',
      middleName: initial?.middleName ?? '',
      lastName: initial?.lastName ?? '',
      officialEmail: initial?.officialEmail ?? '',
      officialMobile: initial?.officialMobile ?? '',
      gender: initial?.gender ?? '',
      dateOfBirth: initial?.dateOfBirth ?? '',
      fatherName: initial?.fatherName ?? '',
      dateOfJoining: initial?.dateOfJoining ?? '',
      employmentType: initial?.employmentType ?? 'full_time',
      departmentId: initial?.departmentId ?? '',
      designationId: initial?.designationId ?? '',
      locationId: initial?.locationId ?? '',
      gradeId: initial?.gradeId ?? '',
      reportingManagerId: initial?.reportingManagerId ?? '',
      paygroup: initial?.paygroup ?? '',
      costCentre: initial?.costCentre ?? '',
      placeOfTaxDeduction: initial?.placeOfTaxDeduction ?? '',
      jobResponsibility: initial?.jobResponsibility ?? '',
    },
  });

  async function submit(values: FormValues) {
    setError(null);
    try {
      await onSubmit({
        employeeCode: values.employeeCode,
        firstName: values.firstName,
        middleName: values.middleName || null,
        lastName: values.lastName || null,
        gender: values.gender || null,
        dateOfBirth: values.dateOfBirth || null,
        fatherName: values.fatherName || null,
        dateOfJoining: values.dateOfJoining,
        officialEmail: values.officialEmail,
        officialMobile: values.officialMobile || null,
        paygroup: values.paygroup || null,
        costCentre: values.costCentre || null,
        placeOfTaxDeduction: values.placeOfTaxDeduction || null,
        jobResponsibility: values.jobResponsibility || null,
        employmentType: values.employmentType,
        departmentId: values.departmentId || null,
        designationId: values.designationId || null,
        locationId: values.locationId || null,
        gradeId: values.gradeId || null,
        reportingManagerId: values.reportingManagerId || null,
      });
      onDone();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="max-h-[70vh] space-y-4 overflow-y-auto pr-1 text-xs">
      <div>
        <p className="mb-2 font-semibold text-slate-500">Identity</p>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Employee ID" error={errors.employeeCode?.message}>
            <input {...register('employeeCode')} className={inputClass} />
          </Field>
          <Field label="First Name" error={errors.firstName?.message}>
            <input {...register('firstName')} className={inputClass} />
          </Field>
          <Field label="Middle Name">
            <input {...register('middleName')} className={inputClass} />
          </Field>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-3">
          <Field label="Last Name">
            <input {...register('lastName')} className={inputClass} />
          </Field>
          <Field label="Gender">
            <select {...register('gender')} className={inputClass}>
              <option value="">Select</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </Field>
          <Field label="Date of Birth">
            <input type="date" {...register('dateOfBirth')} className={inputClass} />
          </Field>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-3">
          <Field label="Father's Name">
            <input {...register('fatherName')} className={inputClass} />
          </Field>
        </div>
      </div>

      <div>
        <p className="mb-2 font-semibold text-slate-500">Contact</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Email" error={errors.officialEmail?.message}>
            <input type="email" {...register('officialEmail')} className={inputClass} />
          </Field>
          <Field label="Mobile">
            <input {...register('officialMobile')} className={inputClass} />
          </Field>
        </div>
      </div>

      <div>
        <p className="mb-2 font-semibold text-slate-500">Employment</p>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Joining Date" error={errors.dateOfJoining?.message}>
            <input type="date" {...register('dateOfJoining')} className={inputClass} />
          </Field>
          <Field label="Employment Type">
            <select {...register('employmentType')} className={inputClass}>
              <option value="full_time">Full Time</option>
              <option value="part_time">Part Time</option>
              <option value="contract">Contract</option>
              <option value="intern">Intern</option>
            </select>
          </Field>
          <Field label="Manager">
            <select {...register('reportingManagerId')} className={inputClass}>
              <option value="">None</option>
              {(managers ?? [])
                .filter((m) => m.id !== initial?.id)
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.employeeCode})
                  </option>
                ))}
            </select>
          </Field>
        </div>
        <div className="mt-3 grid grid-cols-4 gap-3">
          <Field label="Department">
            <select {...register('departmentId')} className={inputClass}>
              <option value="">None</option>
              {(departments ?? []).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Designation">
            <select {...register('designationId')} className={inputClass}>
              <option value="">None</option>
              {(designations ?? []).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Location">
            <select {...register('locationId')} className={inputClass}>
              <option value="">None</option>
              {(locations ?? []).map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Grade">
            <select {...register('gradeId')} className={inputClass}>
              <option value="">None</option>
              {(grades ?? []).map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </div>

      <div>
        <p className="mb-2 font-semibold text-slate-500">Other</p>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Paygroup">
            <input {...register('paygroup')} className={inputClass} />
          </Field>
          <Field label="Cost Centre">
            <input {...register('costCentre')} className={inputClass} />
          </Field>
          <Field label="Place of Tax Deduction">
            <input {...register('placeOfTaxDeduction')} className={inputClass} />
          </Field>
        </div>
        <div className="mt-3">
          <Field label="Job Responsibility">
            <textarea {...register('jobResponsibility')} rows={2} className={inputClass} />
          </Field>
        </div>
      </div>

      <FormActions onCancel={onDone} isSubmitting={isPending} error={error ?? submitError} />
    </form>
  );
}
