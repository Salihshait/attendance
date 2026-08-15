import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type StatCardTone = 'present' | 'absent' | 'leave' | 'late' | 'early' | 'pending' | 'neutral';

const toneClasses: Record<StatCardTone, string> = {
  present: 'bg-status-present/15 text-status-present',
  absent: 'bg-status-absent/15 text-status-absent',
  leave: 'bg-status-leave/15 text-status-leave',
  late: 'bg-status-late/15 text-status-late',
  early: 'bg-status-early/15 text-status-early',
  pending: 'bg-status-pending/15 text-status-pending',
  neutral: 'bg-primary-100 text-primary-600',
};

export function StatCard({
  label,
  value,
  icon: Icon,
  tone,
  onClick,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  tone: StatCardTone;
  onClick?: () => void;
}) {
  const content = (
    <>
      <div className={cn('flex h-9 w-9 items-center justify-center rounded-full', toneClasses[tone])}>
        <Icon className="h-4.5 w-4.5" />
      </div>
      <div>
        <div className="text-xl font-semibold text-slate-800">{value}</div>
        <div className="text-[11px] font-medium text-slate-500">{label}</div>
      </div>
    </>
  );

  const className = cn(
    'flex items-center gap-3 rounded border border-slate-200 bg-white p-3.5 text-left',
    onClick && 'cursor-pointer transition hover:border-primary-300 hover:shadow-sm',
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {content}
      </button>
    );
  }
  return <div className={className}>{content}</div>;
}
