import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import type { NavModule } from '@/config/navigation';

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

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [onClose]);

  const columns = useMemo(() => {
    if (!query.trim()) return module.columns ?? [];
    const q = query.trim().toLowerCase();
    return (module.columns ?? [])
      .map((col) => ({ ...col, items: col.items.filter((i) => i.label.toLowerCase().includes(q)) }))
      .filter((col) => col.items.length > 0);
  }, [module.columns, query]);

  const style: React.CSSProperties =
    placement === 'right'
      ? { position: 'fixed', top: anchorRect.top, left: anchorRect.right + 4 }
      : { position: 'fixed', top: anchorRect.bottom + 4, right: window.innerWidth - anchorRect.right };

  return createPortal(
    <div
      ref={panelRef}
      style={style}
      className="z-50 w-[420px] rounded-md border border-slate-200 bg-white p-3 shadow-lg"
      role="menu"
    >
      <div className="mb-2 flex items-center gap-2 border-b border-slate-100 pb-2">
        <div className="flex flex-1 items-center gap-1.5 rounded border border-slate-200 px-2 py-1">
          <Search className="h-3.5 w-3.5 text-slate-400" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            className="w-full text-xs outline-none placeholder:text-slate-400"
          />
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close menu"
          className="text-slate-400 hover:text-slate-600"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex gap-6">
        {columns.length === 0 && <p className="px-1 py-2 text-xs text-slate-400">No matches</p>}
        {columns.map((col) => (
          <div key={col.heading} className="min-w-[130px]">
            <p className="mb-1.5 text-xs font-semibold text-slate-700">{col.heading}</p>
            <ul className="space-y-1.5">
              {col.items.map((item) => (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    onClick={onNavigate}
                    className="text-xs text-primary-500 hover:underline"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>,
    document.body,
  );
}
