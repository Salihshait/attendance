import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import type { DashboardCardConfig } from '@/config/dashboardCards';

export function ModuleCard({
  card,
  open,
  onToggle,
}: {
  card: DashboardCardConfig;
  open: boolean;
  onToggle: () => void;
}) {
  const Icon = card.icon;
  return (
    <div className="w-44">
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          'flex w-44 flex-col items-center gap-2 rounded-md py-6 text-white shadow-sm transition-colors',
          open ? card.colorBgDark : card.colorBg,
          !open && 'hover:opacity-90',
        )}
      >
        <Icon className="h-7 w-7" />
        <span className="px-2 text-center text-xs font-semibold">{card.label}</span>
      </button>

      {open && (
        <div className="mt-1.5 rounded-md border border-slate-200 bg-white p-2 shadow-sm">
          <ul className="space-y-1">
            {card.items.map((item) => (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className="block rounded px-2 py-1 text-xs text-primary-500 hover:bg-primary-50 hover:underline"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
