import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { TopHeader } from './TopHeader';
import { Sidebar } from './Sidebar';
import { cn } from '@/lib/utils';

export function AppLayout() {
  const [expanded, setExpanded] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-appbg">
      <TopHeader onToggleMobileSidebar={() => setMobileOpen((o) => !o)} />
      <Sidebar expanded={expanded} onToggleExpanded={() => setExpanded((e) => !e)} mobileOpen={mobileOpen} />

      {mobileOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 top-12 z-20 bg-black/30 lg:hidden"
        />
      )}

      <main
        className={cn(
          'min-h-[calc(100vh-3rem)] pt-12 transition-all',
          expanded ? 'lg:pl-56' : 'lg:pl-11',
        )}
      >
        <div className="p-4">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
