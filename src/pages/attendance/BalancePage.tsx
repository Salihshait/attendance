import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { PageHeader } from '@/components/layout/PageHeader';
import { AccordionSection, SummaryChip } from '@/components/ui/Accordion';
import { useAuth } from '@/auth/useAuth';
import { useLeaveBalances, usePermissionRequests } from '@/hooks/useRequestQueries';
import { formatHoursMinutes } from '@/lib/dateFormat';

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

export default function BalancePage() {
  const { authSession } = useAuth();
  const employeeId = authSession?.employee.id;
  const { data: leaveBalances } = useLeaveBalances(employeeId);
  const { data: permissionRequests } = usePermissionRequests(employeeId, authSession?.employee.displayName ?? '');

  const currentYear = new Date().getFullYear();
  const permissionThisYear = (permissionRequests ?? []).filter((p) => new Date(p.permissionDate).getFullYear() === currentYear);
  const permissionMinutesUsed = permissionThisYear.reduce((sum, p) => sum + p.durationMinutes, 0);

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
            defaultOpen
            summary={
              <>
                <SummaryChip value="00:00" tone="opening" />
                <SummaryChip value={formatHoursMinutes(permissionMinutesUsed)} tone="used" />
                <SummaryChip value="-" tone="balance" />
              </>
            }
          >
            <BalanceTable
              rows={[
                {
                  label: 'Permission',
                  opening: '00:00',
                  used: `${formatHoursMinutes(permissionMinutesUsed)} (${permissionThisYear.length})`,
                  balance: '-',
                },
              ]}
            />
          </AccordionSection>

          {(leaveBalances ?? []).map((lb) => (
            <AccordionSection
              key={lb.leaveTypeId}
              title={lb.leaveTypeName}
              summary={
                <>
                  <SummaryChip value={lb.opening} tone="opening" />
                  <SummaryChip value={lb.used} tone="used" />
                  <SummaryChip value={lb.balance} tone="balance" />
                </>
              }
            >
              <BalanceTable rows={[{ label: lb.leaveTypeName, opening: lb.opening, used: lb.used, balance: lb.balance }]} />
            </AccordionSection>
          ))}
        </div>
      </div>
    </div>
  );
}
