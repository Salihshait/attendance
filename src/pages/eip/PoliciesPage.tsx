import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Download, Upload } from 'lucide-react';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { PageHeader } from '@/components/layout/PageHeader';
import { AccordionSection } from '@/components/ui/Accordion';
import { Modal } from '@/components/ui/Modal';
import { Field, inputClass } from '@/components/attendance/LeaveRequestForm';
import { useAuth } from '@/auth/useAuth';
import { usePolicyDocuments, usePolicyDownloadUrl, useUploadPolicyDocument } from '@/hooks/useEipQueries';
import type { PolicyDocumentRow } from '@/types/eip';
import { ORG_ID } from '@/lib/orgContext';

export default function PoliciesPage() {
  const { authSession } = useAuth();
  const { year: deepLinkYear } = useParams();
  const isHr = authSession?.employee.roles.some((r) => r === 'hr_admin' || r === 'super_admin') ?? false;

  const { data, isLoading } = usePolicyDocuments(authSession?.employee ? ORG_ID : undefined);
  const downloadUrl = usePolicyDownloadUrl();
  const uploadPolicy = useUploadPolicyDocument();

  const [showForm, setShowForm] = useState(false);
  const [policyYear, setPolicyYear] = useState(String(new Date().getFullYear()));
  const [title, setTitle] = useState('Holiday List');
  const [file, setFile] = useState<File | null>(null);

  const byYear = useMemo(() => {
    const map = new Map<number, PolicyDocumentRow[]>();
    for (const doc of data ?? []) {
      const list = map.get(doc.policyYear) ?? [];
      list.push(doc);
      map.set(doc.policyYear, list);
    }
    return [...map.entries()].sort((a, b) => b[0] - a[0]);
  }, [data]);

  async function handleDownload(filePath: string) {
    const url = await downloadUrl.mutateAsync({ filePath });
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  async function handleUpload() {
    if (!authSession || !file) return;
    await uploadPolicy.mutateAsync({
      organizationId: ORG_ID,
      uploadedBy: authSession.employee.id,
      policyYear: Number(policyYear),
      title,
      category: 'general',
      file,
    });
    setFile(null);
    setShowForm(false);
  }

  return (
    <div>
      <Breadcrumb items={[{ label: 'EIP' }, { label: 'Policies' }]} />

      <div className="overflow-hidden rounded border border-slate-200 bg-white">
        <PageHeader
          title="Policies"
          actions={
            isHr && (
              <button
                type="button"
                onClick={() => setShowForm(true)}
                className="flex items-center gap-1.5 rounded bg-white/15 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/25"
              >
                <Upload className="h-3.5 w-3.5" /> Upload Policy
              </button>
            )
          }
        />

        {isLoading && <p className="px-3 py-8 text-center text-xs text-slate-400">Loading…</p>}
        {!isLoading && byYear.length === 0 && <p className="px-3 py-8 text-center text-xs text-slate-400">No policy documents uploaded yet.</p>}

        {byYear.map(([year, docs]) => (
          <AccordionSection key={year} title={String(year)} defaultOpen={String(year) === deepLinkYear || (!deepLinkYear && year === byYear[0]?.[0])}>
            <ul className="divide-y divide-slate-100">
              {docs.map((doc) => (
                <li key={doc.id} className="flex items-center justify-between py-2 text-xs">
                  <div>
                    <p className="font-medium text-slate-700">{doc.title}</p>
                    <p className="text-slate-400">{doc.fileName} · {new Date(doc.uploadedAt).toLocaleDateString()}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDownload(doc.filePath)}
                    className="flex items-center gap-1.5 rounded bg-card-info px-2.5 py-1 text-white hover:bg-card-info-dark"
                  >
                    <Download className="h-3.5 w-3.5" /> View / Download
                  </button>
                </li>
              ))}
            </ul>
          </AccordionSection>
        ))}
      </div>

      {showForm && (
        <Modal title="Upload Policy Document" onClose={() => setShowForm(false)}>
          <div className="space-y-3 text-xs">
            <Field label="Title">
              <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} placeholder="e.g. Holiday List" />
            </Field>
            <Field label="Year">
              <input type="number" value={policyYear} onChange={(e) => setPolicyYear(e.target.value)} className={inputClass} />
            </Field>
            <Field label="File">
              <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className={inputClass} />
            </Field>

            {uploadPolicy.isError && (
              <p className="rounded bg-status-rejected/10 px-3 py-2 text-status-rejected">{(uploadPolicy.error as Error).message}</p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setShowForm(false)} className="rounded border border-slate-300 px-3.5 py-1.5 text-slate-600">
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUpload}
                disabled={uploadPolicy.isPending || !file}
                className="rounded bg-primary-500 px-3.5 py-1.5 font-semibold text-white hover:bg-primary-600 disabled:opacity-60"
              >
                {uploadPolicy.isPending ? 'Uploading…' : 'Upload'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
