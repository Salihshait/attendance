import { useEffect, useState } from 'react';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { PageHeader } from '@/components/layout/PageHeader';
import { Field, FormActions, inputClass } from '@/components/admin/FormField';
import {
  useEmailConfiguration,
  useSaveEmailConfiguration,
  useTestSmtpConnection,
  useSendTestSmtpEmail,
  type EmailConfigurationInput,
} from '@/hooks/useAdminEmailConfiguration';

const EMPTY: EmailConfigurationInput = {
  host: '',
  port: 587,
  encryption: 'tls',
  username: '',
  fromName: '',
  fromEmail: '',
  replyTo: '',
  isActive: false,
  password: '',
};

export default function EmailConfigurationPage() {
  const { data, isLoading } = useEmailConfiguration();
  const save = useSaveEmailConfiguration();
  const testConnection = useTestSmtpConnection();
  const sendTest = useSendTestSmtpEmail();

  const [values, setValues] = useState<EmailConfigurationInput>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testRecipient, setTestRecipient] = useState('');

  useEffect(() => {
    if (data) {
      setValues({
        host: data.host ?? '',
        port: data.port ?? 587,
        encryption: data.encryption,
        username: data.username ?? '',
        fromName: data.fromName ?? '',
        fromEmail: data.fromEmail ?? '',
        replyTo: data.replyTo ?? '',
        isActive: data.isActive,
        password: '',
      });
    }
  }, [data]);

  async function saveConfig() {
    setError(null);
    setSaved(false);
    try {
      await save.mutateAsync(values);
      setSaved(true);
      setValues((p) => ({ ...p, password: '' })); // blank it back out -- never keep the typed value in memory longer than needed
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function runTestConnection() {
    setTestResult(null);
    try {
      const result = await testConnection.mutateAsync();
      setTestResult(result.success ? 'Connection successful.' : `Connection failed: ${result.message ?? 'unknown error'}`);
    } catch (e) {
      setTestResult(`Connection failed: ${(e as Error).message}`);
    }
  }

  async function runSendTest() {
    setTestResult(null);
    try {
      const result = await sendTest.mutateAsync(testRecipient);
      setTestResult(result.success ? `Test email sent to ${testRecipient}.` : `Send failed: ${result.message ?? 'unknown error'}`);
    } catch (e) {
      setTestResult(`Send failed: ${(e as Error).message}`);
    }
  }

  return (
    <div>
      <Breadcrumb items={[{ label: 'Administration' }, { label: 'Email Configuration' }]} />

      <div className="overflow-hidden rounded border border-slate-200 bg-white">
        <PageHeader title="Email Configuration" />

        <div className="border-b border-amber-100 bg-amber-50 px-4 py-2 text-[11px] text-amber-800">
          The password is encrypted at rest (Supabase Vault) and can only ever be decrypted by the server-side email worker, never by
          this app — the field below only ever shows blank, even for a saved configuration. Leave it blank to keep the existing
          password.
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void saveConfig();
          }}
          className="space-y-4 p-4 text-xs"
        >
          {isLoading && <p className="text-slate-400">Loading…</p>}

          <div className="grid grid-cols-2 gap-3">
            <Field label="SMTP Host">
              <input value={values.host} onChange={(e) => setValues((p) => ({ ...p, host: e.target.value }))} className={inputClass} placeholder="smtp.example.com" />
            </Field>
            <Field label="Port">
              <input type="number" value={values.port} onChange={(e) => setValues((p) => ({ ...p, port: Number(e.target.value) }))} className={inputClass} />
            </Field>
          </div>

          <Field label="Encryption">
            <select value={values.encryption} onChange={(e) => setValues((p) => ({ ...p, encryption: e.target.value as EmailConfigurationInput['encryption'] }))} className={inputClass}>
              <option value="none">None</option>
              <option value="tls">TLS</option>
              <option value="ssl">SSL</option>
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Username">
              <input value={values.username} onChange={(e) => setValues((p) => ({ ...p, username: e.target.value }))} className={inputClass} />
            </Field>
            <Field label={`Password ${data?.hasPassword ? '(currently set)' : '(not set)'}`}>
              <input
                type="password"
                value={values.password}
                onChange={(e) => setValues((p) => ({ ...p, password: e.target.value }))}
                className={inputClass}
                placeholder={data?.hasPassword ? '•••••••• (leave blank to keep)' : 'Enter password'}
                autoComplete="new-password"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="From Name">
              <input value={values.fromName} onChange={(e) => setValues((p) => ({ ...p, fromName: e.target.value }))} className={inputClass} />
            </Field>
            <Field label="From Email">
              <input type="email" value={values.fromEmail} onChange={(e) => setValues((p) => ({ ...p, fromEmail: e.target.value }))} className={inputClass} />
            </Field>
          </div>

          <Field label="Reply-To">
            <input type="email" value={values.replyTo} onChange={(e) => setValues((p) => ({ ...p, replyTo: e.target.value }))} className={inputClass} />
          </Field>

          <label className="flex items-center gap-1.5 text-slate-600">
            <input type="checkbox" checked={values.isActive} onChange={(e) => setValues((p) => ({ ...p, isActive: e.target.checked }))} /> Enabled
          </label>

          {saved && <p className="rounded bg-status-approved/10 px-3 py-2 text-status-approved">Configuration saved.</p>}
          <FormActions
            onCancel={() => data && setValues((p) => ({ ...p, password: '' }))}
            isSubmitting={save.isPending}
            error={error}
            submitLabel="Save Configuration"
            submittingLabel="Saving…"
          />
        </form>

        <div className="space-y-3 border-t border-slate-100 p-4 text-xs">
          <p className="font-semibold text-slate-600">Test</p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={runTestConnection}
              disabled={testConnection.isPending}
              className="rounded border border-slate-300 px-3 py-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-60"
            >
              {testConnection.isPending ? 'Testing…' : 'Test Connection'}
            </button>
            <input
              type="email"
              value={testRecipient}
              onChange={(e) => setTestRecipient(e.target.value)}
              placeholder="Send test email to…"
              className="w-56 rounded border border-slate-300 px-2.5 py-1.5 outline-none focus:border-primary-500"
            />
            <button
              type="button"
              onClick={runSendTest}
              disabled={!testRecipient || sendTest.isPending}
              className="rounded bg-primary-500 px-3 py-1.5 font-semibold text-white hover:bg-primary-600 disabled:opacity-60"
            >
              {sendTest.isPending ? 'Sending…' : 'Send Test Email'}
            </button>
          </div>
          {testResult && <p className="rounded bg-slate-50 px-3 py-2 text-slate-600">{testResult}</p>}
        </div>
      </div>
    </div>
  );
}
