import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { FileText, Upload } from 'lucide-react';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { PageHeader } from '@/components/layout/PageHeader';
import { FilterBar, FilterField, FilterSelect } from '@/components/ui/FilterBar';
import { StatusBadge, type StatusKind } from '@/components/ui/StatusBadge';
import { Field, inputClass } from '@/components/attendance/LeaveRequestForm';
import { useAuth } from '@/auth/useAuth';
import { usePayslips, useTaxDeclaration, useUpsertTaxDeclaration } from '@/hooks/useEipQueries';
import { useDocumentTypes, useEmployeeDocuments, useUploadEmployeeDocument } from '@/hooks/useProfileQueries';
import { formatCurrency } from '@/lib/utils';
import { ORG_ID } from '@/lib/orgContext';

function currentFinancialYear(): string {
  const now = new Date();
  const startYear = now.getMonth() + 1 >= 4 ? now.getFullYear() : now.getFullYear() - 1;
  return `${startYear}-${String(startYear + 1).slice(-2)}`;
}

function financialYearOptions(): { value: string; label: string }[] {
  const current = currentFinancialYear();
  const currentStart = Number(current.split('-')[0]);
  return [0, 1].map((offset) => {
    const startYear = currentStart - offset;
    const label = `${startYear}-${String(startYear + 1).slice(-2)}`;
    return { value: label, label };
  });
}

const schema = z.object({
  regime: z.enum(['old', 'new']),
  declaredInvestments: z.coerce.number().min(0),
  hraExemption: z.coerce.number().min(0),
});
type FormValues = z.infer<typeof schema>;

const statusTone: Record<string, StatusKind> = { draft: 'draft', submitted: 'pending', verified: 'approved', locked: 'cancelled' };

export default function TaxDeclarationPage() {
  const { authSession, isDemoMode } = useAuth();
  const employeeId = authSession?.employee.id;
  const [financialYear, setFinancialYear] = useState(currentFinancialYear());

  const { data: declaration, isLoading } = useTaxDeclaration(employeeId, financialYear);
  const upsert = useUpsertTaxDeclaration();
  const { data: payslips } = usePayslips(employeeId);
  const { data: docTypes } = useDocumentTypes(authSession?.employee ? ORG_ID : undefined);
  const { data: documents } = useEmployeeDocuments(employeeId);
  const uploadDocument = useUploadEmployeeDocument();

  const [documentTypeId, setDocumentTypeId] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const estimatedAnnualIncome = useMemo(() => {
    const latest = (payslips ?? [])[0];
    if (!latest) return 0;
    return (latest.basicPay + latest.hra + latest.otherAllowances) * 12;
  }, [payslips]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: declaration
      ? { regime: declaration.regime, declaredInvestments: declaration.declaredInvestments, hraExemption: declaration.hraExemption }
      : undefined,
  });

  const isLocked = declaration?.status === 'locked';

  async function onSave(values: FormValues, submit: boolean) {
    if (!employeeId) return;
    await upsert.mutateAsync({ employeeId, financialYear, submit, ...values });
  }

  async function handleUpload() {
    if (!employeeId || !documentTypeId || !file) return;
    await uploadDocument.mutateAsync({ employeeId, documentTypeId, file });
    setFile(null);
  }

  return (
    <div>
      <Breadcrumb items={[{ label: 'EIP' }, { label: 'TDS' }, { label: 'Tax Declaration' }]} />

      <div className="overflow-hidden rounded border border-slate-200 bg-white">
        <PageHeader title="Tax Declaration" />

        <FilterBar
          actions={declaration?.status && <StatusBadge status={statusTone[declaration.status]} label={declaration.status} />}
        >
          <FilterField label="Financial Year">
            <FilterSelect value={financialYear} onChange={setFinancialYear} options={financialYearOptions()} />
          </FilterField>
        </FilterBar>

        {isLoading ? (
          <p className="px-3 py-8 text-center text-xs text-slate-400">Loading…</p>
        ) : (
          <form onSubmit={handleSubmit((v) => onSave(v, false))} className="space-y-4 p-4 text-xs">
            <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2">
              <span className="font-medium text-slate-500">Estimated Annual Income (from payroll): </span>
              <span className="font-semibold text-slate-700">{formatCurrency(estimatedAnnualIncome)}</span>
            </div>

            <Field label="Tax Regime">
              <select {...register('regime')} disabled={isLocked} className={inputClass}>
                <option value="new">New Regime</option>
                <option value="old">Old Regime</option>
              </select>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Investment Declarations (80C, 80D, etc.)" error={errors.declaredInvestments?.message}>
                <input type="number" disabled={isLocked} {...register('declaredInvestments')} className={inputClass} />
              </Field>
              <Field label="HRA Exemption Claimed" error={errors.hraExemption?.message}>
                <input type="number" disabled={isLocked} {...register('hraExemption')} className={inputClass} />
              </Field>
            </div>

            {upsert.isError && (
              <p className="rounded bg-status-rejected/10 px-3 py-2 text-status-rejected">{(upsert.error as Error).message}</p>
            )}

            {!isLocked && (
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="submit"
                  disabled={upsert.isPending}
                  className="rounded border border-primary-300 px-3.5 py-1.5 font-semibold text-primary-600 hover:bg-primary-50 disabled:opacity-60"
                >
                  Save as Draft
                </button>
                <button
                  type="button"
                  onClick={handleSubmit((v) => onSave(v, true))}
                  disabled={upsert.isPending}
                  className="rounded bg-primary-500 px-3.5 py-1.5 font-semibold text-white hover:bg-primary-600 disabled:opacity-60"
                >
                  {upsert.isPending ? 'Submitting…' : 'Submit Declaration'}
                </button>
              </div>
            )}
          </form>
        )}

        <div className="border-t border-slate-100 p-4 text-xs">
          <p className="mb-2 flex items-center gap-1.5 font-semibold text-slate-600">
            <FileText className="h-3.5 w-3.5" /> Supporting Documents
          </p>

          <div className="mb-3 flex flex-wrap items-end gap-2">
            <label className="block">
              <span className="mb-1 block text-[11px] font-medium text-slate-500">Document Type</span>
              <select value={documentTypeId} onChange={(e) => setDocumentTypeId(e.target.value)} className={inputClass}>
                <option value="">Select</option>
                {(docTypes ?? []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} disabled={isDemoMode} className={inputClass} />
            <button
              type="button"
              onClick={handleUpload}
              disabled={uploadDocument.isPending || !documentTypeId || !file}
              className="flex items-center gap-1.5 rounded bg-primary-500 px-3 py-1.5 font-semibold text-white hover:bg-primary-600 disabled:opacity-50"
            >
              <Upload className="h-3.5 w-3.5" /> Upload
            </button>
          </div>

          {(documents ?? []).length === 0 ? (
            <p className="text-slate-400">No supporting documents uploaded yet.</p>
          ) : (
            <ul className="list-disc space-y-1 pl-5 text-slate-600">
              {(documents ?? []).map((d) => (
                <li key={d.id}>
                  {d.fileName} <span className="text-slate-400">({d.documentTypeName})</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
