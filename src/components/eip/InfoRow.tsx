export function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="grid grid-cols-[minmax(160px,220px)_1fr] odd:bg-primary-50/30">
      <span className="border border-table-border px-3 py-2 text-right font-medium text-primary-600">{label}</span>
      <span className="border border-table-border px-3 py-2 text-slate-700">{value || '-'}</span>
    </div>
  );
}
