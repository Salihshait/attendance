import { ShieldCheck } from 'lucide-react';
import { useAuth } from '@/auth/useAuth';
import { useStatutoryDetails } from '@/hooks/useProfileQueries';
import { formatMaskedAadhaar } from '@/lib/mask';
import { InfoRow } from './InfoRow';

export function StatutoryDetailsTab() {
  const { authSession } = useAuth();
  const { data, isLoading } = useStatutoryDetails(authSession?.employee.id);

  return (
    <div>
      <div className="flex items-center gap-1.5 border-b border-table-border bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
        <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
        PAN and Aadhaar are masked — only the last 4 characters are shown. The full value never leaves the server.
      </div>
      {isLoading && <p className="px-3 py-8 text-center text-xs text-slate-400">Loading…</p>}
      {!isLoading && (
        <div>
          <InfoRow label="PAN" value={data?.panNumber} />
          <InfoRow label="Aadhaar" value={formatMaskedAadhaar(data?.aadhaarNumber)} />
          <InfoRow label="UAN" value={data?.uanNumber} />
          <InfoRow label="PF Number" value={data?.pfNumber} />
          <InfoRow label="ESI Number" value={data?.esiNumber} />
          <InfoRow label="Tax Regime" value={data?.taxRegime === 'old' ? 'Old Regime' : data?.taxRegime === 'new' ? 'New Regime' : null} />
        </div>
      )}
    </div>
  );
}
