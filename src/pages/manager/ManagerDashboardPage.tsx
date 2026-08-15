import { useNavigate } from 'react-router-dom';
import { Users, UserCheck, UserX, CalendarOff, Clock, LogOut, BellDot } from 'lucide-react';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatCard } from '@/components/manager/StatCard';
import { useAuth } from '@/auth/useAuth';
import { useTeamMembers, useTeamStats } from '@/hooks/useTeamQueries';
import { usePendingApprovals } from '@/hooks/useApprovalQueries';

export default function ManagerDashboardPage() {
  const navigate = useNavigate();
  const { authSession } = useAuth();
  const managerId = authSession?.employee.id;

  const { data: team, isLoading: teamLoading } = useTeamMembers(managerId);
  const teamIds = (team ?? []).map((m) => m.id);
  const { data: stats, isLoading: statsLoading } = useTeamStats(teamIds, new Date());
  const { data: pending, isLoading: pendingLoading } = usePendingApprovals();

  const loading = teamLoading || statsLoading || pendingLoading;
  const teamSize = team?.length ?? 0;

  return (
    <div>
      <Breadcrumb items={[{ label: 'Manager Self Service' }, { label: 'Dashboard' }]} />

      <div className="overflow-hidden rounded border border-slate-200 bg-white">
        <PageHeader title="Manager Dashboard" />

        <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4 lg:grid-cols-7">
          <StatCard label="Team Size" value={teamSize} icon={Users} tone="neutral" />
          <StatCard label="Present Today" value={loading ? 0 : stats?.present ?? 0} icon={UserCheck} tone="present" />
          <StatCard label="Absent Today" value={loading ? 0 : stats?.absent ?? 0} icon={UserX} tone="absent" />
          <StatCard label="On Leave" value={loading ? 0 : stats?.onLeave ?? 0} icon={CalendarOff} tone="leave" />
          <StatCard label="Late" value={loading ? 0 : stats?.late ?? 0} icon={Clock} tone="late" />
          <StatCard label="Early Going" value={loading ? 0 : stats?.earlyGoing ?? 0} icon={LogOut} tone="early" />
          <StatCard
            label="Pending Approvals"
            value={pending?.length ?? 0}
            icon={BellDot}
            tone="pending"
            onClick={() => navigate('/manager/approvals')}
          />
        </div>

        {teamSize === 0 && !teamLoading && (
          <p className="px-4 pb-4 text-xs text-slate-400">No direct reports found for your account yet.</p>
        )}
      </div>
    </div>
  );
}
