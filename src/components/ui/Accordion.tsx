import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export function AccordionSection({
  title,
  summary,
  defaultOpen = false,
  children,
}: {
  title: string;
  summary?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-slate-100 last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50"
      >
        <span className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
          <ChevronDown className={cn('h-4 w-4 text-slate-400 transition-transform', open && 'rotate-180')} />
          {title}
        </span>
        {summary && <span className="flex items-center gap-1.5">{summary}</span>}
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

export function SummaryChip({ value, tone }: { value: string | number; tone: 'opening' | 'used' | 'balance' }) {
  const toneClass =
    tone === 'opening'
      ? 'bg-status-weekoff text-white'
      : tone === 'used'
        ? 'bg-status-pending text-white'
        : 'bg-status-leave text-white';
  return <span className={cn('rounded px-2 py-0.5 text-[11px] font-semibold', toneClass)}>{value}</span>;
}
