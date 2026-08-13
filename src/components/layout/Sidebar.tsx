import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, ChevronLeft, ChevronDown } from 'lucide-react';
import { sidebarModules, activeModuleForPath } from '@/config/navigation';
import { moduleColorMap } from '@/config/moduleColors';
import { useAuth } from '@/auth/useAuth';
import { cn } from '@/lib/utils';
import { ModuleMegaMenu } from './ModuleMegaMenu';

export function Sidebar({
  expanded,
  onToggleExpanded,
  mobileOpen,
}: {
  expanded: boolean;
  onToggleExpanded: () => void;
  mobileOpen: boolean;
}) {
  const { authSession } = useAuth();
  const location = useLocation();
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [openRect, setOpenRect] = useState<DOMRect | null>(null);

  const roles = authSession?.employee.roles ?? ['employee'];
  const modules = sidebarModules.filter((m) => !m.roles || m.roles.some((r) => roles.includes(r)));
  const activeKey = activeModuleForPath(location.pathname)?.key;

  return (
    <aside
      className={cn(
        'fixed left-0 top-12 z-30 h-[calc(100vh-3rem)] flex-col border-r border-sidebar-border bg-sidebar transition-all',
        expanded ? 'w-56' : 'w-11',
        mobileOpen ? 'flex' : 'hidden lg:flex',
      )}
    >
      <div className="flex justify-center py-2">
        <div className="grid grid-cols-2 gap-0.5" aria-hidden>
          <span className="h-2 w-2 bg-primary-500" />
          <span className="h-2 w-2 bg-module-attendance" />
          <span className="h-2 w-2 bg-module-manager" />
          <span className="h-2 w-2 bg-module-exit" />
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto scrollbar-thin">
        <ul className="flex flex-col gap-0.5 px-1.5">
          {modules.map((mod) => {
            const Icon = mod.icon;
            const isActive = activeKey === mod.key;
            const colors = mod.color ? moduleColorMap[mod.color] : null;
            const isOpen = openKey === mod.key;

            return (
              <li key={mod.key} className="relative">
                {mod.path ? (
                  <Link
                    to={mod.path}
                    title={mod.label}
                    className={cn(
                      'flex items-center gap-2 rounded px-2.5 py-2 text-sidebar-icon hover:bg-white',
                      isActive && 'bg-white text-sidebar-icon-active',
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {expanded && <span className="text-xs font-medium">{mod.label}</span>}
                  </Link>
                ) : (
                  <button
                    type="button"
                    title={mod.label}
                    onClick={(e) => {
                      setOpenKey(isOpen ? null : mod.key);
                      setOpenRect(isOpen ? null : e.currentTarget.getBoundingClientRect());
                    }}
                    className={cn(
                      'flex w-full items-center gap-2 rounded px-2.5 py-2 text-sidebar-icon hover:bg-white',
                      isActive && 'bg-white',
                      isActive && colors?.text,
                      !isActive && isOpen && 'bg-white',
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {expanded && <span className="flex-1 text-left text-xs font-medium">{mod.label}</span>}
                    {expanded && (
                      <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', isOpen && 'rotate-180')} />
                    )}
                  </button>
                )}

                {isOpen && !expanded && mod.columns && openRect && (
                  <ModuleMegaMenu
                    module={mod}
                    anchorRect={openRect}
                    onClose={() => setOpenKey(null)}
                    onNavigate={() => setOpenKey(null)}
                  />
                )}

                {isOpen && expanded && mod.columns && (
                  <div className="ml-4 mt-0.5 space-y-2 border-l border-sidebar-border pb-2 pl-3">
                    {mod.columns.map((col) => (
                      <div key={col.heading}>
                        <p className="mb-1 text-[11px] font-semibold text-slate-500">{col.heading}</p>
                        <ul className="space-y-1">
                          {col.items.map((item) => (
                            <li key={item.path}>
                              <Link
                                to={item.path}
                                className="text-xs text-slate-600 hover:text-primary-500 hover:underline"
                              >
                                {item.label}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      <button
        type="button"
        onClick={onToggleExpanded}
        aria-label={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
        className="flex items-center justify-center border-t border-sidebar-border py-2 text-sidebar-icon hover:bg-white"
      >
        {expanded ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </button>
    </aside>
  );
}
