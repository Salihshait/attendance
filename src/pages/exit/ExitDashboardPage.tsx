import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Mail, User } from 'lucide-react';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatusBadge, type StatusKind } from '@/components/ui/StatusBadge';
import { ClearanceTimeline } from '@/components/exit/ClearanceTimeline';
import { useAuth } from '@/auth/useAuth';
import { useExitClearances, useExitSettlement, useHrContact, useMyExitRequests } from '@/hooks/useExitQueries';
import { exitStatusBucket } from '@/lib/exitCalc';
import { formatCurrency } from '@/lib/utils';
import { formatDDMMYYYY } from '@/lib/dateFormat';
import type { ExitRequestStatus } from '@/types/exit';

const ACTIVE_STATUSES: ExitRequestStatus[] = ['submitted', 'manager_approved', 'hr_approved'];

const statusLabels: Record<ExitRequestStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  manager_approved: 'Manager Approved',
  hr_approved: 'HR Approved',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
  completed: 'Completed',
};
const statusTone: Record<ExitRequestStatus, StatusKind> = {
  draft: 'draft',
  submitted: 'pending',
  manager_approved: 'pending',
  hr_approved: 'approved',
  rejected: 'rejected',
  withdrawn: 'cancelled',
  completed: 'approved',
};

function SummaryCell({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded border border-slate-200 p-3">
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className="text-sm font-semibold text-slate-700">{value}</p>
    </div>
  );
}

export default function ExitDashboardPage() {
  const { authSession } = useAuth();
  const employeeId = authSession?.employee.id;
  const { data: requests, isLoading } = useMyExitRequests(employeeId);
  const { data: hrContact } = useHrContact(employeeId);

  const current = useMemo(() => {
    if (!requests || requests.length === 0) return null;
    return requests.find((r) => ACTIVE_STATUSES.includes(r.status)) ?? requests[0];
  }, [requests]);

  const showClearance = current?.status === 'hr_approved' || current?.status === 'completed';
  const { data: clearances, isLoading: clearancesLoading } = useExitClearances(showClearance ? current?.id : undefined);
  const { data: settlement } = useExitSettlement(current?.id);

  return (
    <div>
      <Breadcrumb items={[{ label: 'Exit' }, { label: 'Home' }]} />

      <div className="mb-4 overflow-hidden rounded border border-slate-200 bg-white">
        <PageHeader title="Exit Dashboard" />

        {isLoading ? (
          <p className="px-3 py-8 text-center text-xs text-slate-400">Loading…</p>
        ) : !current ? (
          <div className="flex flex-col items-center gap-3 py-12 text-sm text-slate-500">
            <p>You have not submitted a resignation.</p>
            <Link to="/exit/resignation" className="rounded bg-primary-500 px-4 py-2 text-xs font-semibold text-white hover:bg-primary-600">
              Submit Resignation
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 p-4 text-xs sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCell label="Resignation Status" value={<StatusBadge status={statusTone[current.status]} label={statusLabels[current.status]} />} />
            <SummaryCell label="Resignation Date" value={formatDDMMYYYY(current.resignationDate)} />
            <SummaryCell label="Notice Period" value={`${current.noticePeriodDays} days`} />
            <SummaryCell label="Expected Last Working Date" value={formatDDMMYYYY(current.expectedLastWorkingDate)} />
            <SummaryCell label="Manager" value={current.managerName ?? '-'} />
            <SummaryCell
              label="HR Contact"
              value={
                hrContact ? (
                  <span className="flex flex-col gap-0.5 text-xs font-normal text-slate-600">
                    <span className="flex items-center gap-1 font-semibold text-slate-700">
                      <User className="h-3 w-3" /> {hrContact.displayName}
                    </span>
                    <span className="flex items-center gap-1">
                      <Mail className="h-3 w-3" /> {hrContact.email}
                    </span>
                  </span>
                ) : (
                  '-'
                )
              }
            />
            <SummaryCell label="Exit Status" value={exitStatusBucket(current.status)} />
          </div>
        )}
      </div>

      {current && showClearance && (
        <div className="mb-4 overflow-hidden rounded border border-slate-200 bg-white">
          <PageHeader title="Exit Clearance" />
          <div className="p-4">
            <ClearanceTimeline clearances={clearances ?? []} isLoading={clearancesLoading} />
          </div>
        </div>
      )}

      {current && (
        <div className="overflow-hidden rounded border border-slate-200 bg-white">
          <PageHeader title="Final Settlement" />
          <div className="p-4 text-xs">
            {!settlement || settlement.status !== 'released' ? (
              <p className="text-slate-400">Final settlement will be available here once HR releases it.</p>
            ) : (
              <div className="space-y-1.5">
                <SettlementLine label="Last Working Date" value={formatDDMMYYYY(settlement.lastWorkingDate)} />
                <SettlementLine label="Pending Salary" value={formatCurrency(settlement.pendingSalary)} />
                <SettlementLine label="Leave Encashment" value={formatCurrency(settlement.leaveEncashment)} />
                <SettlementLine label="Bonus" value={formatCurrency(settlement.bonus)} />
                <SettlementLine label="Other Adjustments" value={formatCurrency(settlement.otherAdjustments)} />
                <SettlementLine label="Notice Pay (recovery)" value={`- ${formatCurrency(settlement.noticePay)}`} />
                <SettlementLine label="Deductions" value={`- ${formatCurrency(settlement.deductions)}`} />
                <div className="mt-2 flex justify-between rounded bg-primary-50 px-3 py-2 font-bold text-primary-600">
                  <span>Final Settlement</span>
                  <span>{formatCurrency(settlement.finalSettlementAmount)}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SettlementLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-slate-100 pb-1 text-slate-600">
      <span>{label}</span>
      <span className="font-medium text-slate-700">{value}</span>
    </div>
  );
}
