import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft } from 'lucide-react';
import { appConfig } from '@/config/app.config';
import { useAuth } from '@/auth/useAuth';

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
});

type FormValues = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const { requestPasswordReset, isDemoMode } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    setError(null);
    const { error: resetError } = await requestPasswordReset(values.email);
    setSubmitting(false);
    if (resetError) {
      setError(resetError);
      return;
    }
    setSent(true);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-8">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded bg-primary-500 text-sm font-bold text-white">
            WH
          </span>
          <span className="text-2xl font-semibold text-slate-800">{appConfig.appName}</span>
        </div>

        <div className="rounded-md border border-slate-200 bg-white p-6 shadow-md">
          <h1 className="mb-1 text-base font-semibold text-slate-700">Forgot Password</h1>
          <p className="mb-4 text-xs text-slate-500">
            Enter your official email address and we&apos;ll send you a link to reset your password.
          </p>

          {isDemoMode && (
            <p className="mb-4 rounded border border-primary-100 bg-primary-50 p-2.5 text-[11px] text-slate-600">
              Demo mode has no real email delivery — password reset is unavailable here.
            </p>
          )}

          {sent ? (
            <p className="rounded bg-status-approved/10 px-3 py-2 text-xs text-status-approved">
              If an account exists for that email, a reset link has been sent. Check your inbox.
            </p>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-3">
              <div>
                <div className="flex items-center rounded border border-slate-300 px-3 focus-within:border-primary-500">
                  <input
                    {...register('email')}
                    type="email"
                    placeholder="Official email"
                    autoComplete="email"
                    className="w-full py-2 text-xs outline-none"
                  />
                  <Mail className="h-4 w-4 text-slate-400" />
                </div>
                {errors.email && <p className="mt-1 text-[11px] text-status-rejected">{errors.email.message}</p>}
              </div>

              {error && <p className="rounded bg-status-rejected/10 px-3 py-2 text-xs text-status-rejected">{error}</p>}

              <button
                type="submit"
                disabled={submitting || isDemoMode}
                className="flex w-full items-center justify-center gap-2 rounded bg-primary-500 py-2.5 text-sm font-semibold text-white hover:bg-primary-600 disabled:opacity-60"
              >
                {submitting ? 'Sending…' : 'Send reset link'}
              </button>
            </form>
          )}

          <Link to="/login" className="mt-4 flex items-center justify-center gap-1 text-xs text-primary-500 hover:underline">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to login
          </Link>
        </div>
      </div>
    </div>
  );
}
