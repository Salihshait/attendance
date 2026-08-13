import { Link } from 'react-router-dom';
import { Home, ChevronRight } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  path?: string;
}

export function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 px-4 py-2 text-xs text-slate-500">
      <Link to="/dashboard" className="flex items-center gap-1 text-primary-500 hover:underline">
        <Home className="h-3.5 w-3.5" />
        Home
      </Link>
      {items.map((item, idx) => (
        <span key={item.label + idx} className="flex items-center gap-1.5">
          <ChevronRight className="h-3 w-3 text-slate-400" />
          {item.path ? (
            <Link to={item.path} className="text-primary-500 hover:underline">
              {item.label}
            </Link>
          ) : (
            <span className="text-slate-600">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
