import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Building2, ChevronDown, Menu } from 'lucide-react';
import { appConfig } from '@/config/app.config';
import { activeModuleForPath } from '@/config/navigation';
import { moduleColorMap } from '@/config/moduleColors';
import { ModuleMegaMenu } from './ModuleMegaMenu';
import { ProfileDropdown } from './ProfileDropdown';
import { NotificationBell } from './NotificationBell';
import { cn } from '@/lib/utils';

export function TopHeader({ onToggleMobileSidebar }: { onToggleMobileSidebar: () => void }) {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuRect, setMenuRect] = useState<DOMRect | null>(null);
  const activeModule = activeModuleForPath(location.pathname);
  const colors = activeModule?.color ? moduleColorMap[activeModule.color] : null;

  return (
    <header className="fixed inset-x-0 top-0 z-40 flex h-12 items-center justify-between bg-header px-3 text-white shadow-sm">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onToggleMobileSidebar}
          className="rounded p-1 hover:bg-white/10 lg:hidden"
          aria-label="Toggle navigation"
        >
          <Menu className="h-5 w-5" />
        </button>
        <Link to="/dashboard" className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          <span className="text-sm font-semibold tracking-wide">{appConfig.defaultOrgName}</span>
        </Link>
      </div>

      <div className="flex items-center gap-2">
        {activeModule && activeModule.columns && (
          <div className="relative">
            <button
              type="button"
              onClick={(e) => {
                setMenuOpen((o) => !o);
                setMenuRect(e.currentTarget.getBoundingClientRect());
              }}
              className={cn(
                'flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-semibold',
                colors ? colors.bg : 'bg-white/15',
              )}
            >
              <activeModule.icon className="h-3.5 w-3.5" />
              {activeModule.label}
              <ChevronDown className="h-3 w-3" />
            </button>
            {menuOpen && menuRect && (
              <ModuleMegaMenu
                module={activeModule}
                anchorRect={menuRect}
                placement="bottom"
                onClose={() => setMenuOpen(false)}
                onNavigate={() => setMenuOpen(false)}
              />
            )}
          </div>
        )}
        <NotificationBell />
        <ProfileDropdown />
      </div>
    </header>
  );
}
