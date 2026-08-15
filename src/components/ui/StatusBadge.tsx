import { cn } from '@/lib/utils';

export type StatusKind =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'cancelled'
  | 'draft'
  | 'present'
  | 'half_day'
  | 'absent'
  | 'weekoff'
  | 'holiday'
  | 'leave'
  | 'on_duty'
  | 'permission'
  | 'active'
  | 'inactive';

const statusStyles: Record<StatusKind, string> = {
  pending: 'bg-status-pending/15 text-status-pending border-status-pending/30',
  approved: 'bg-status-approved/15 text-status-approved border-status-approved/30',
  rejected: 'bg-status-rejected/15 text-status-rejected border-status-rejected/30',
  cancelled: 'bg-status-cancelled/15 text-status-cancelled border-status-cancelled/30',
  draft: 'bg-status-draft/15 text-status-draft border-status-draft/30',
  present: 'bg-status-present/15 text-status-present border-status-present/30',
  half_day: 'bg-status-present/15 text-status-present border-status-present/30',
  absent: 'bg-status-absent/15 text-status-absent border-status-absent/30',
  weekoff: 'bg-status-weekoff/15 text-status-weekoff border-status-weekoff/30',
  holiday: 'bg-status-holiday/15 text-status-holiday border-status-holiday/30',
  leave: 'bg-status-leave/15 text-status-leave border-status-leave/30',
  on_duty: 'bg-status-regularized/15 text-status-regularized border-status-regularized/30',
  permission: 'bg-status-leave/15 text-status-leave border-status-leave/30',
  active: 'bg-status-active/15 text-status-active border-status-active/30',
  inactive: 'bg-status-inactive/15 text-status-inactive border-status-inactive/30',
};

const solidStyles: Record<StatusKind, string> = {
  pending: 'bg-status-pending text-white',
  approved: 'bg-status-approved text-white',
  rejected: 'bg-status-rejected text-white',
  cancelled: 'bg-status-cancelled text-white',
  draft: 'bg-status-draft text-white',
  present: 'bg-status-present text-white',
  half_day: 'bg-status-present text-white',
  absent: 'bg-status-absent text-white',
  weekoff: 'bg-status-weekoff text-white',
  holiday: 'bg-status-holiday text-white',
  leave: 'bg-status-leave text-white',
  on_duty: 'bg-status-regularized text-white',
  permission: 'bg-status-leave text-white',
  active: 'bg-status-active text-white',
  inactive: 'bg-status-inactive text-white',
};

export function StatusBadge({
  status,
  label,
  variant = 'soft',
}: {
  status: StatusKind;
  label: string;
  variant?: 'soft' | 'solid';
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded px-2 py-0.5 text-[11px] font-semibold border',
        variant === 'soft' ? statusStyles[status] : cn(solidStyles[status], 'border-transparent'),
      )}
    >
      {label}
    </span>
  );
}
