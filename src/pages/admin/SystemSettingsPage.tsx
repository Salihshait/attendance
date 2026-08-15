import { useEffect, useState } from 'react';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { PageHeader } from '@/components/layout/PageHeader';
import { Field, FormActions, inputClass } from '@/components/admin/FormField';
import { useSystemSettings, useUpsertSystemSetting, SYSTEM_SETTINGS_DEFAULTS, type SystemSettingsValues } from '@/hooks/useAdminSystemSettings';

export default function SystemSettingsPage() {
  const { data, isLoading } = useSystemSettings();
  const upsertSetting = useUpsertSystemSetting();
  const [values, setValues] = useState<SystemSettingsValues>(SYSTEM_SETTINGS_DEFAULTS);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (data) setValues(data);
  }, [data]);

  async function saveAll() {
    setError(null);
    setSaved(false);
    try {
      await Promise.all([
        upsertSetting.mutateAsync({ key: 'companyName', value: values.companyName }),
        upsertSetting.mutateAsync({ key: 'defaultTimezone', value: values.defaultTimezone }),
        upsertSetting.mutateAsync({ key: 'weekendDays', value: values.weekendDays }),
        upsertSetting.mutateAsync({ key: 'leaveYearStartMonth', value: values.leaveYearStartMonth }),
        upsertSetting.mutateAsync({ key: 'sessionTimeoutMinutes', value: values.sessionTimeoutMinutes }),
      ]);
      setSaved(true);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  function toggleWeekendDay(day: number) {
    setValues((prev) => ({
      ...prev,
      weekendDays: prev.weekendDays.includes(day) ? prev.weekendDays.filter((d) => d !== day) : [...prev.weekendDays, day].sort(),
    }));
  }

  return (
    <div>
      <Breadcrumb items={[{ label: 'Administration' }, { label: 'System Settings' }]} />

      <div className="overflow-hidden rounded border border-slate-200 bg-white">
        <PageHeader title="System Settings" />

        <div className="border-b border-amber-100 bg-amber-50 px-4 py-2 text-[11px] text-amber-800">
          This key set is a starting point invented for this module — no prior convention existed for system_settings before now.
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void saveAll();
          }}
          className="space-y-4 p-4 text-xs"
        >
          {isLoading && <p className="text-slate-400">Loading…</p>}

          <Field label="Company Name">
            <input value={values.companyName} onChange={(e) => setValues((p) => ({ ...p, companyName: e.target.value }))} className={inputClass} />
          </Field>

          <Field label="Default Time Zone">
            <input
              value={values.defaultTimezone}
              onChange={(e) => setValues((p) => ({ ...p, defaultTimezone: e.target.value }))}
              className={inputClass}
              placeholder="e.g. Asia/Kolkata"
            />
          </Field>

          <div>
            <span className="mb-1.5 block text-[11px] font-medium text-slate-500">Weekend Days</span>
            <div className="flex flex-wrap gap-1.5">
              {DAY_LABELS.map((label, idx) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => toggleWeekendDay(idx)}
                  className={
                    values.weekendDays.includes(idx)
                      ? 'rounded border border-status-weekoff bg-status-weekoff/15 px-2.5 py-1 font-semibold text-status-weekoff'
                      : 'rounded border border-slate-300 px-2.5 py-1 text-slate-500 hover:bg-slate-50'
                  }
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Leave Year Start Month">
              <select
                value={values.leaveYearStartMonth}
                onChange={(e) => setValues((p) => ({ ...p, leaveYearStartMonth: Number(e.target.value) }))}
                className={inputClass}
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>
                    {new Date(2000, m - 1, 1).toLocaleDateString('en-US', { month: 'long' })}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Session Timeout (minutes)">
              <input
                type="number"
                value={values.sessionTimeoutMinutes}
                onChange={(e) => setValues((p) => ({ ...p, sessionTimeoutMinutes: Number(e.target.value) }))}
                className={inputClass}
              />
            </Field>
          </div>

          {saved && <p className="rounded bg-status-approved/10 px-3 py-2 text-status-approved">Settings saved.</p>}
          <FormActions
            onCancel={() => data && setValues(data)}
            isSubmitting={upsertSetting.isPending}
            error={error}
            submitLabel="Save Settings"
            submittingLabel="Saving…"
          />
        </form>
      </div>
    </div>
  );
}
