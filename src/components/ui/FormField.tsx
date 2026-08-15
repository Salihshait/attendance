import type { ReactNode } from 'react';

export const inputClass = 'w-full rounded border border-slate-300 px-2.5 py-1.5 text-xs outline-none focus:border-primary-500';

export function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium text-slate-500">{label}</span>
      {children}
      {error && <span className="mt-1 block text-[11px] text-status-rejected">{error}</span>}
    </label>
  );
}

export function FormActions({
  onCancel,
  isSubmitting,
  submitLabel = 'Save',
  submittingLabel = 'Saving…',
  error,
}: {
  onCancel: () => void;
  isSubmitting: boolean;
  submitLabel?: string;
  submittingLabel?: string;
  error?: string | null;
}) {
  return (
    <>
      {error && <p className="rounded bg-status-rejected/10 px-3 py-2 text-[11px] text-status-rejected">{error}</p>}
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onCancel} className="rounded border border-slate-300 px-3.5 py-1.5 text-xs text-slate-600">
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded bg-primary-500 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-primary-600 disabled:opacity-60"
        >
          {isSubmitting ? submittingLabel : submitLabel}
        </button>
      </div>
    </>
  );
}
