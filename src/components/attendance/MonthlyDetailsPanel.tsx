import type { ReactNode } from 'react';
import type { LeaveBalanceRow } from '@/types/attendance';

function MiniTable({ headers, children }: { headers: string[]; children: ReactNode }) {
  return (
    <table className="w-full border-collapse text-[11px]">
      <thead>
        <tr>
          {headers.map((h) => (
            <th key={h} className="border border-table-border bg-table-header px-2 py-1 text-left font-semibold text-slate-600">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold text-slate-600">{title}</p>
      {children}
    </div>
  );
}

export interface MonthlyDetailsData {
  shortfall: { excessStay: string; shortfall: string; difference: string };
  leaveBalances: LeaveBalanceRow[];
  onduty: { label: string; opening: number; credit: number; used: number; balance: number }[];
  permission: { opening: string; credit: string; used: string; balance: string };
  present: { opening: number; credit: number; used: number; balance: number };
  late: { count: number; hours: string };
  earlyGoing: { count: number; hours: string };
}

export function MonthlyDetailsPanel({ data }: { data: MonthlyDetailsData }) {
  return (
    <div className="space-y-4">
      <Section title="Short fall">
        <MiniTable headers={['ExcessStay', 'Shortfall', 'Difference']}>
          <tr>
            <td className="border border-table-border px-2 py-1">{data.shortfall.excessStay}</td>
            <td className="border border-table-border px-2 py-1">{data.shortfall.shortfall}</td>
            <td className="border border-table-border px-2 py-1 font-medium text-status-approved">{data.shortfall.difference}</td>
          </tr>
        </MiniTable>
      </Section>

      <Section title="Leave">
        <MiniTable headers={['Leave', 'Opening', 'Credit', 'Used', 'Balance']}>
          {data.leaveBalances.map((lb) => (
            <tr key={lb.leaveTypeId}>
              <td className="border border-table-border px-2 py-1">{lb.leaveTypeName}</td>
              <td className="border border-table-border px-2 py-1">{lb.opening}</td>
              <td className="border border-table-border px-2 py-1">{lb.credited}</td>
              <td className="border border-table-border px-2 py-1">{lb.used}</td>
              <td className="border border-table-border px-2 py-1 font-medium">{lb.balance}</td>
            </tr>
          ))}
        </MiniTable>
      </Section>

      <Section title="Onduty">
        <MiniTable headers={['Onduty', 'Opening', 'Credit', 'Used', 'Balance']}>
          {data.onduty.map((row) => (
            <tr key={row.label}>
              <td className="border border-table-border px-2 py-1">{row.label}</td>
              <td className="border border-table-border px-2 py-1">{row.opening}</td>
              <td className="border border-table-border px-2 py-1">{row.credit}</td>
              <td className="border border-table-border px-2 py-1">{row.used}</td>
              <td className="border border-table-border px-2 py-1 font-medium">{row.balance}</td>
            </tr>
          ))}
        </MiniTable>
      </Section>

      <Section title="Permission">
        <MiniTable headers={['Permission', 'Opening', 'Credit', 'Used', 'Balance']}>
          <tr>
            <td className="border border-table-border px-2 py-1">Permission</td>
            <td className="border border-table-border px-2 py-1">{data.permission.opening}</td>
            <td className="border border-table-border px-2 py-1">{data.permission.credit}</td>
            <td className="border border-table-border px-2 py-1">{data.permission.used}</td>
            <td className="border border-table-border px-2 py-1 font-medium">{data.permission.balance}</td>
          </tr>
        </MiniTable>
      </Section>

      <Section title="Present">
        <MiniTable headers={['Present', 'Opening', 'Credit', 'Used', 'Balance']}>
          <tr>
            <td className="border border-table-border px-2 py-1">Present</td>
            <td className="border border-table-border px-2 py-1">{data.present.opening}</td>
            <td className="border border-table-border px-2 py-1">{data.present.credit}</td>
            <td className="border border-table-border px-2 py-1">{data.present.used}</td>
            <td className="border border-table-border px-2 py-1 font-medium">{data.present.balance}</td>
          </tr>
        </MiniTable>
      </Section>

      <Section title="Late">
        <MiniTable headers={['Count', 'Hours']}>
          <tr>
            <td className="border border-table-border px-2 py-1">{data.late.count}</td>
            <td className="border border-table-border px-2 py-1">{data.late.hours}</td>
          </tr>
        </MiniTable>
      </Section>

      <Section title="Early Going">
        <MiniTable headers={['Count', 'Hours']}>
          <tr>
            <td className="border border-table-border px-2 py-1">{data.earlyGoing.count}</td>
            <td className="border border-table-border px-2 py-1">{data.earlyGoing.hours}</td>
          </tr>
        </MiniTable>
      </Section>
    </div>
  );
}
