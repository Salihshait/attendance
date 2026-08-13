import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './useAuth';
import type { AppRole } from '@/config/app.config';

export function ProtectedRoute() {
  const { authSession, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="flex h-screen items-center justify-center text-sm text-slate-500">Loading…</div>;
  }
  if (!authSession) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return <Outlet />;
}

export function RequireRole({ roles, children }: { roles: AppRole[]; children: React.ReactNode }) {
  const { authSession } = useAuth();
  const hasAccess = authSession?.employee.roles.some((r) => roles.includes(r)) ?? false;
  if (!hasAccess) {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        You do not have permission to view this page.
      </div>
    );
  }
  return <>{children}</>;
}
