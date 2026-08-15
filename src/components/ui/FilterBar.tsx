import type { ReactNode } from 'react';

export function FilterBar({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-100 bg-white px-4 py-3">
      <div className="flex flex-wrap items-end gap-3">{children}</div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-medium text-slate-500">{label}</span>
      {children}
    </label>
  );
}

const fieldClass =
  'rounded border border-slate-300 px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-primary-500 min-w-[9rem]';

export function FilterSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={fieldClass}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function FilterDate({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return <input type="date" value={value} onChange={(e) => onChange(e.target.value)} className={fieldClass} />;
}

export function FilterButton({
  children,
  onClick,
  variant = 'default',
  type = 'button',
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'default' | 'primary';
  type?: 'button' | 'submit';
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      className={
        variant === 'primary'
          ? 'rounded bg-primary-500 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-primary-600'
          : 'rounded border border-slate-300 px-3.5 py-1.5 text-xs text-slate-600 hover:bg-slate-50'
      }
    >
      {children}
    </button>
  );
}
