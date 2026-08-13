import { useEffect, useRef, useState } from 'react';
import { Bell } from 'lucide-react';

interface DemoNotification {
  id: string;
  title: string;
  time: string;
  unread: boolean;
}

const demoNotifications: DemoNotification[] = [
  { id: '1', title: 'Your leave request for 12/08 was approved', time: '2h ago', unread: true },
  { id: '2', title: 'Attendance regularization pending manager review', time: '1d ago', unread: true },
  { id: '3', title: 'Holiday list for next year has been published', time: '3d ago', unread: false },
];

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const unreadCount = demoNotifications.filter((n) => n.unread).length;

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Notifications"
        className="relative rounded p-1.5 hover:bg-white/10"
      >
        <Bell className="h-4 w-4 text-white" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-status-rejected px-1 text-[10px] font-semibold text-white">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-40 mt-1 w-72 rounded-md border border-slate-200 bg-white py-1 text-slate-700 shadow-lg">
          <p className="border-b border-slate-100 px-3 py-2 text-xs font-semibold">Notifications</p>
          <ul className="max-h-80 overflow-y-auto">
            {demoNotifications.map((n) => (
              <li key={n.id} className="border-b border-slate-50 px-3 py-2 last:border-0 hover:bg-slate-50">
                <p className="flex items-start gap-1.5 text-xs">
                  {n.unread && <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary-500" />}
                  <span className={n.unread ? 'font-medium text-slate-800' : 'text-slate-500'}>{n.title}</span>
                </p>
                <p className="ml-3 mt-0.5 text-[10px] text-slate-400">{n.time}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
