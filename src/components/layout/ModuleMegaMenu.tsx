import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import type { NavModule } from '@/config/navigation';
import { useAuth } from '@/auth/useAuth';
import type { AppRole } from '@/config/app.config';
import { cn } from '@/lib/utils';

const DEFAULT_ROLES: AppRole[] = ['employee'];

export function ModuleMegaMenu({
  module,
  onClose,
  onNavigate,
  anchorRect,
  placement = 'right',
}: {
  module: NavModule;
  onClose: () => void;
  onNavigate: () => void;
  anchorRect: DOMRect;
  placement?: 'right' | 'bottom';
}) {
  const [query, setQuery] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);
  const { authSession } = useAuth();
  const location = useLocation();
  const roles = authSession?.employee.roles ?? DEFAULT_ROLES;

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [onClose]);

  const columns = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (module.columns ?? [])
      .map((col) => ({
        ...col,
        items: col.items.filter((i) => (!i.roles || i.roles.some((r) => roles.includes(r))) && (!q || i.label.toLowerCase().includes(q))),
      }))
      .filter((col) => col.items.length > 0);
  }, [module.columns, query, roles]);

  const style: React.CSSProperties =
    placement === 'right'
      ? { position: 'fixed', top: anchorRect.top, left: anchorRect.right + 4, maxWidth: 'calc(100vw - 24px)' }
      : {
          position: 'fixed',
          top: anchorRect.bottom + 4,
          right: window.innerWidth - anchorRect.right,
          maxWidth: 'calc(100vw - 24px)',
        };

  return createPortal(
    <div
      ref={panelRef}
      style={style}
      className="z-50 w-max max-h-[calc(100vh-72px)] overflow-y-auto scrollbar-thin rounded-lg border border-slate-200 bg-white p-4 shadow-xl"
      role="menu"
    >
      <div className="mb-3 flex items-center gap-2 border-b border-slate-100 pb-3">
        <div className="flex flex-1 items-center gap-2 rounded-md border border-slate-300 px-2.5 py-1.5 focus-within:border-primary-500">
          <Search className="h-4 w-4 shrink-0 text-slate-400" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            className="w-full min-w-[8rem] text-sm outline-none placeholder:text-slate-400"
          />
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close menu"
          className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {columns.length === 0 ? (
        <p className="px-1 py-2 text-sm text-slate-400">No matches</p>
      ) : (
        <div
          className="grid items-start gap-x-8 gap-y-1"
          style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(150px, max-content))` }}
        >
          {columns.map((col) => (
            <div key={col.heading}>
              <p className="mb-1.5 whitespace-nowrap border-b border-slate-100 pb-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                {col.heading}
              </p>
              <ul className="space-y-0.5">
                {col.items.map((item) => {
                  const isActive = location.pathname.startsWith(item.path);
                  return (
                    <li key={item.path}>
                      <Link
                        to={item.path}
                        onClick={onNavigate}
                        role="menuitem"
                        className={cn(
                          'block whitespace-nowrap rounded px-2 py-1.5 text-sm text-slate-600 hover:bg-primary-50 hover:text-primary-600',
                          isActive && 'bg-primary-50 font-semibold text-primary-600',
                        )}
                      >
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>,
    document.body,
  );
}
