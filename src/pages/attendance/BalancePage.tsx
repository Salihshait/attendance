import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { PageHeader } from '@/components/layout/PageHeader';
import { AccordionSection, SummaryChip } from '@/components/ui/Accordion';
import { useAuth } from '@/auth/useAuth';
import { useLeaveBalances, useMyPermissionBalance, usePermissionRequests } from '@/hooks/useRequestQueries';
import { formatHoursMinutes, formatDDMMYYYY } from '@/lib/dateFormat';
import type { LeaveBalanceRow } from '@/types/attendance';

function BalanceTable({ rows }: { rows: { label: string; opening: string | number; used: string | number; balance: string | number }[] }) {
  return (
    <table className="w-full border-collapse text-xs">
      <thead>
        <tr>
          <th className="border border-table-border bg-table-header px-3 py-1.5 text-left font-semibold text-slate-600" />
          <th className="border border-table-border bg-table-header px-3 py-1.5 text-left font-semibold text-slate-600">Opening</th>
          <th className="border border-table-border bg-table-header px-3 py-1.5 text-left font-semibold text-slate-600">Used</th>
          <th className="border border-table-border bg-table-header px-3 py-1.5 text-left font-semibold text-slate-600">Balance</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.label}>
            <td className="border border-table-border px-3 py-1.5 text-slate-600">{row.label}</td>
            <td className="border border-table-border px-3 py-1.5">{row.opening}</td>
            <td className="border border-table-border px-3 py-1.5">{row.used}</td>
            <td className="border border-table-border px-3 py-1.5 font-medium">{row.balance}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// Monthly-accrual leave types (CL/SL) now carry 12 leave_balances rows a
// year instead of one flat annual row (0042_monthly_leave_balance_periods.sql)
// — matches the reference app's Balance screen, which shows a full year of
// individual monthly opening/used/balance rows when expanded. Yearly/none
// accrual types (PL, EL, ...) still have exactly one row, so this renders
// identically to before for them.
function groupByLeaveType(rows: LeaveBalanceRow[]): { leaveTypeId: string; leaveTypeName: string; periods: LeaveBalanceRow[] }[] {
  const byType = new Map<string, { leaveTypeId: string; leaveTypeName: string; periods: LeaveBalanceRow[] }>();
  for (const row of rows) {
    const existing = byType.get(row.leaveTypeId);
    if (existing) {
      existing.periods.push(row);
    } else {
      byType.set(row.leaveTypeId, { leaveTypeId: row.leaveTypeId, leaveTypeName: row.leaveTypeName, periods: [row] });
    }
  }
  return Array.from(byType.values());
}

function sum(periods: LeaveBalanceRow[], key: 'opening' | 'used' | 'balance'): number {
  return periods.reduce((total, p) => total + p[key], 0);
}

export default function BalancePage() {
  const { authSession } = useAuth();
  const employeeId = authSession?.employee.id;
  const { data: leaveBalances } = useLeaveBalances(employeeId);
  const { data: permissionRequests } = usePermissionRequests(employeeId, authSession?.employee.displayName ?? '');
  const { data: permissionBalance } = useMyPermissionBalance(employeeId);

  // Permission balance is tracked monthly (permission_balances.period_start/
  // period_end); the request count alongside it is scoped to the same
  // current-month window so every figure in this row shares one time frame,
  // rather than mixing a monthly balance with a year-to-date count.
  const now = new Date();
  const permissionThisMonth = (permissionRequests ?? []).filter((p) => {
    const d = new Date(p.permissionDate);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  });

  const permissionOpeningLabel = permissionBalance ? formatHoursMinutes(permissionBalance.openingMinutes) : '00:00';
  const permissionUsedLabel = permissionBalance ? formatHoursMinutes(permissionBalance.usedMinutes) : '00:00';
  const permissionBalanceLabel = permissionBalance ? formatHoursMinutes(permissionBalance.balanceMinutes) : '-';

  const leaveGroups = groupByLeaveType(leaveBalances ?? []);

  return (
    <div>
      <Breadcrumb items={[{ label: 'Attendance' }, { label: 'My Report' }, { label: 'Balance' }]} />

      <div className="overflow-hidden rounded border border-slate-200 bg-white">
        <PageHeader
          title="Balance"
          actions={
            <div className="flex items-center gap-1.5 text-[11px]">
              <SummaryChip value="Opening" tone="opening" />
              <SummaryChip value="Used" tone="used" />
              <SummaryChip value="Balance" tone="balance" />
            </div>
          }
        />

        <div>
          <AccordionSection
            title="Permission"
            summary={
              <>
                <SummaryChip value={permissionOpeningLabel} tone="opening" />
                <SummaryChip value={permissionUsedLabel} tone="used" />
                <SummaryChip value={permissionBalanceLabel} tone="balance" />
              </>
            }
          >
            <BalanceTable
              rows={[
                {
                  label: 'Permission (this month)',
                  opening: permissionOpeningLabel,
                  used: `${permissionUsedLabel} (${permissionThisMonth.length})`,
                  balance: permissionBalanceLabel,
                },
              ]}
            />
          </AccordionSection>

          {leaveGroups.map((group) => {
            const openingTotal = sum(group.periods, 'opening');
            const usedTotal = sum(group.periods, 'used');
            const balanceTotal = sum(group.periods, 'balance');
            const hasMultiplePeriods = group.periods.length > 1;

            return (
              <AccordionSection
                key={group.leaveTypeId}
                title={group.leaveTypeName}
                defaultOpen={hasMultiplePeriods}
                summary={
                  <>
                    <SummaryChip value={openingTotal} tone="opening" />
                    <SummaryChip value={usedTotal} tone="used" />
                    <SummaryChip value={balanceTotal} tone="balance" />
                  </>
                }
              >
                <BalanceTable
                  rows={group.periods.map((p) => ({
                    label: hasMultiplePeriods ? `${formatDDMMYYYY(p.periodStart)} - ${formatDDMMYYYY(p.periodEnd)}` : group.leaveTypeName,
                    opening: p.opening,
                    used: p.used,
                    balance: p.balance,
                  }))}
                />
              </AccordionSection>
            );
          })}
        </div>
      </div>
    </div>
  );
}
