import { useState } from 'react';
import { dashboardCards } from '@/config/dashboardCards';
import { ModuleCard } from '@/components/ui/ModuleCard';
import { WebCheckinCard } from '@/components/attendance/WebCheckinCard';
import { useAuth } from '@/auth/useAuth';

export default function DashboardPage() {
  const { authSession } = useAuth();
  const [openKey, setOpenKey] = useState<string | null>(null);
  const roles = authSession?.employee.roles ?? ['employee'];
  const cards = dashboardCards.filter((c) => !c.roles || c.roles.some((r) => roles.includes(r)));

  return (
    <div className="flex flex-wrap items-start gap-6 pt-4">
      {cards.map((card) => (
        <ModuleCard
          key={card.key}
          card={card}
          open={openKey === card.key}
          onToggle={() => setOpenKey((k) => (k === card.key ? null : card.key))}
        />
      ))}
      <WebCheckinCard open={openKey === 'web-checkin'} onToggle={() => setOpenKey((k) => (k === 'web-checkin' ? null : 'web-checkin'))} />
    </div>
  );
}
