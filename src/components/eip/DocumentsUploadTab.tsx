import { useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { useAuth } from '@/auth/useAuth';
import { useDocumentTypes, useEmployeeDocuments, useUploadEmployeeDocument, useDocumentDownloadUrl } from '@/hooks/useProfileQueries';
import { Modal } from '@/components/ui/Modal';
import { Field, inputClass } from '@/components/attendance/LeaveRequestForm';
import { StatusBadge, type StatusKind } from '@/components/ui/StatusBadge';
import { ORG_ID } from '@/lib/orgContext';

const verificationTone: Record<string, StatusKind> = {
  pending: 'pending',
  verified: 'approved',
  rejected: 'rejected',
};

export function DocumentsUploadTab() {
  const { authSession } = useAuth();
  const employeeId = authSession?.employee.id;
  const { data: docTypes } = useDocumentTypes(authSession?.employee ? ORG_ID : undefined);
  const { data: documents, isLoading } = useEmployeeDocuments(employeeId);
  const uploadDocument = useUploadEmployeeDocument();
  const downloadUrl = useDocumentDownloadUrl();

  const [showForm, setShowForm] = useState(false);
  const [documentTypeId, setDocumentTypeId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleUpload() {
    if (!employeeId || !documentTypeId || !file) {
      setFormError('Select a document type and choose a file.');
      return;
    }
    setFormError(null);
    await uploadDocument.mutateAsync({ employeeId, documentTypeId, file });
    setDocumentTypeId('');
    setFile(null);
    setShowForm(false);
  }

  async function handleDownload(filePath: string) {
    const url = await downloadUrl.mutateAsync({ filePath });
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  return (
    <div>
      <div className="flex items-center justify-end border-b border-table-border bg-slate-50 px-3 py-2">
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 rounded bg-primary-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-600"
        >
          <Upload className="h-3.5 w-3.5" /> Upload Document
        </button>
      </div>

      {isLoading && <p className="px-3 py-8 text-center text-xs text-slate-400">Loading…</p>}
      {!isLoading && (documents ?? []).length === 0 && <p className="px-3 py-8 text-center text-xs text-slate-400">No documents uploaded yet.</p>}

      {!isLoading && (documents ?? []).length > 0 && (
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              {['Type', 'File Name', 'Uploaded On', 'Status', ''].map((h) => (
                <th key={h} className="border border-table-border bg-table-header px-3 py-1.5 text-left font-semibold text-slate-600">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(documents ?? []).map((d) => (
              <tr key={d.id}>
                <td className="border border-table-border px-3 py-1.5">{d.documentTypeName}</td>
                <td className="border border-table-border px-3 py-1.5">{d.fileName}</td>
                <td className="border border-table-border px-3 py-1.5">{new Date(d.uploadedAt).toLocaleDateString()}</td>
                <td className="border border-table-border px-3 py-1.5">
                  <StatusBadge status={verificationTone[d.verificationStatus]} label={d.verificationStatus} />
                </td>
                <td className="border border-table-border px-3 py-1.5 text-center">
                  <button
                    type="button"
                    aria-label="Download"
                    onClick={() => handleDownload(d.filePath)}
                    className="rounded bg-card-info p-1 text-white hover:bg-card-info-dark"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showForm && (
        <Modal title="Upload Document" onClose={() => setShowForm(false)}>
          <div className="space-y-3 text-xs">
            <Field label="Document Type">
              <select value={documentTypeId} onChange={(e) => setDocumentTypeId(e.target.value)} className={inputClass}>
                <option value="">Select</option>
                {(docTypes ?? []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="File">
              <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className={inputClass} />
            </Field>

            {formError && <p className="rounded bg-status-rejected/10 px-3 py-2 text-status-rejected">{formError}</p>}
            {uploadDocument.isError && (
              <p className="rounded bg-status-rejected/10 px-3 py-2 text-status-rejected">{(uploadDocument.error as Error).message}</p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setShowForm(false)} className="rounded border border-slate-300 px-3.5 py-1.5 text-slate-600">
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUpload}
                disabled={uploadDocument.isPending}
                className="rounded bg-primary-500 px-3.5 py-1.5 font-semibold text-white hover:bg-primary-600 disabled:opacity-60"
              >
                {uploadDocument.isPending ? 'Uploading…' : 'Upload'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
