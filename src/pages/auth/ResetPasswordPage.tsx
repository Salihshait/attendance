import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { KeyRound } from 'lucide-react';
import { appConfig } from '@/config/app.config';
import { useAuth } from '@/auth/useAuth';
import { supabase } from '@/lib/supabase';

const schema = z
  .object({
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type FormValues = z.infer<typeof schema>;

// Reached via the link Supabase emails from requestPasswordReset(). Supabase
// detects the recovery token in the URL itself and establishes a session
// before this page mounts, so all we do here is collect the new password.
export default function ResetPasswordPage() {
  const { isDemoMode } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    setError(null);
    const { error: updateError } = await supabase.auth.updateUser({ password: values.password });
    setSubmitting(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setDone(true);
    setTimeout(() => navigate('/dashboard'), 1500);
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
          <h1 className="mb-4 text-base font-semibold text-slate-700">Set a new password</h1>

          {isDemoMode ? (
            <p className="rounded border border-primary-100 bg-primary-50 p-2.5 text-[11px] text-slate-600">
              Demo mode has no real authentication — password reset is unavailable here.
            </p>
          ) : done ? (
            <p className="rounded bg-status-approved/10 px-3 py-2 text-xs text-status-approved">
              Password updated. Redirecting to your dashboard…
            </p>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-3">
              <div>
                <div className="flex items-center rounded border border-slate-300 px-3 focus-within:border-primary-500">
                  <input
                    {...register('password')}
                    type="password"
                    placeholder="New password"
                    autoComplete="new-password"
                    className="w-full py-2 text-xs outline-none"
                  />
                  <KeyRound className="h-4 w-4 text-slate-400" />
                </div>
                {errors.password && <p className="mt-1 text-[11px] text-status-rejected">{errors.password.message}</p>}
              </div>

              <div>
                <div className="flex items-center rounded border border-slate-300 px-3 focus-within:border-primary-500">
                  <input
                    {...register('confirmPassword')}
                    type="password"
                    placeholder="Confirm new password"
                    autoComplete="new-password"
                    className="w-full py-2 text-xs outline-none"
                  />
                  <KeyRound className="h-4 w-4 text-slate-400" />
                </div>
                {errors.confirmPassword && (
                  <p className="mt-1 text-[11px] text-status-rejected">{errors.confirmPassword.message}</p>
                )}
              </div>

              {error && <p className="rounded bg-status-rejected/10 px-3 py-2 text-xs text-status-rejected">{error}</p>}

              <button
                type="submit"
                disabled={submitting}
                className="flex w-full items-center justify-center gap-2 rounded bg-primary-500 py-2.5 text-sm font-semibold text-white hover:bg-primary-600 disabled:opacity-60"
              >
                {submitting ? 'Updating…' : 'Update password'}
              </button>
            </form>
          )}

          <Link to="/login" className="mt-4 block text-center text-xs text-primary-500 hover:underline">
            Back to login
          </Link>
        </div>
      </div>
    </div>
  );
}
