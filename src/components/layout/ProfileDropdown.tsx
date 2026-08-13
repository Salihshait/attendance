import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, Settings, KeyRound, UserCircle, Undo2, LogOut } from 'lucide-react';
import { useAuth } from '@/auth/useAuth';
import { initialsFromName } from '@/lib/utils';

export function ProfileDropdown() {
  const { authSession, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  if (!authSession) return null;
  const { employee } = authSession;

  async function handleLogout() {
    await signOut();
    navigate('/login');
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded px-1.5 py-1 hover:bg-white/10"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-xs font-semibold">
          {initialsFromName(employee.displayName)}
        </span>
        <span className="text-left text-xs leading-tight">
          <span className="block text-[10px] text-white/70">Welcome,</span>
          <span className="block font-medium">{employee.displayName}</span>
        </span>
        <ChevronDown className="h-3.5 w-3.5" />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-40 mt-1 w-52 rounded-md border border-slate-200 bg-white py-1 text-slate-700 shadow-lg">
          <MenuItem icon={Settings} label="Card Settings" onClick={() => setOpen(false)} />
          <MenuItem icon={KeyRound} label="Change Password" onClick={() => setOpen(false)} />
          <MenuItem icon={UserCircle} label="User Account" onClick={() => setOpen(false)} />
          <div className="my-1 border-t border-slate-100" />
          <MenuItem icon={Undo2} label="Back to old version" onClick={() => setOpen(false)} />
          <div className="my-1 border-t border-slate-100" />
          <MenuItem icon={LogOut} label="Logout" onClick={handleLogout} />
        </div>
      )}
    </div>
  );
}

function MenuItem({
  icon: Icon,
  label,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-slate-50"
    >
      <Icon className="h-3.5 w-3.5 text-slate-500" />
      {label}
    </button>
  );
}
