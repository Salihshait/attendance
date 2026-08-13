import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { LogIn, User, Lock } from 'lucide-react';
import { appConfig } from '@/config/app.config';
import { useAuth } from '@/auth/useAuth';
import { LoginIllustration } from '@/components/auth/LoginIllustration';
import { demoAccounts } from '@/data/demoUsers';

const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional(),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const { authSession, signIn, error, isDemoMode } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema) });

  if (authSession) {
    const from = (location.state as { from?: Location })?.from?.pathname ?? '/dashboard';
    return <Navigate to={from} replace />;
  }

  async function onSubmit(values: LoginFormValues) {
    setSubmitting(true);
    await signIn(values.username, values.password);
    setSubmitting(false);
    navigate('/dashboard');
  }

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <div className="hidden flex-1 items-center justify-center bg-navy lg:flex">
        <LoginIllustration />
      </div>

      <div className="flex flex-1 flex-col justify-between bg-white px-6 py-8 sm:px-16">
        <div />
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-6 flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded bg-primary-500 text-sm font-bold text-white">
              WH
            </span>
            <span className="text-2xl font-semibold text-slate-800">{appConfig.appName}</span>
          </div>
          <p className="mb-6 text-xs text-slate-500">{appConfig.tagline}</p>

          <div className="rounded-md border border-slate-200 bg-white p-6 shadow-md">
            <h1 className="mb-4 text-center text-base font-semibold text-slate-700">Login</h1>

            <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-3">
              <select
                disabled
                className="w-full rounded border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-500"
                defaultValue={appConfig.defaultModuleOption}
              >
                <option>{appConfig.defaultModuleOption}</option>
              </select>

              <div>
                <div className="flex items-center rounded border border-slate-300 px-3 focus-within:border-primary-500">
                  <input
                    {...register('username')}
                    placeholder="Username"
                    autoComplete="username"
                    className="w-full py-2 text-xs outline-none"
                  />
                  <User className="h-4 w-4 text-slate-400" />
                </div>
                {errors.username && <p className="mt-1 text-[11px] text-status-rejected">{errors.username.message}</p>}
              </div>

              <div>
                <div className="flex items-center rounded border border-slate-300 px-3 focus-within:border-primary-500">
                  <input
                    {...register('password')}
                    type="password"
                    placeholder="Password"
                    autoComplete="current-password"
                    className="w-full py-2 text-xs outline-none"
                  />
                  <Lock className="h-4 w-4 text-slate-400" />
                </div>
                {errors.password && <p className="mt-1 text-[11px] text-status-rejected">{errors.password.message}</p>}
              </div>

              <label className="flex items-center gap-2 text-xs text-slate-600">
                <input type="checkbox" {...register('rememberMe')} className="h-3.5 w-3.5" />
                Remember Me
              </label>

              {error && <p className="rounded bg-status-rejected/10 px-3 py-2 text-xs text-status-rejected">{error}</p>}

              <button
                type="submit"
                disabled={submitting}
                className="flex w-full items-center justify-center gap-2 rounded bg-primary-500 py-2.5 text-sm font-semibold text-white hover:bg-primary-600 disabled:opacity-60"
              >
                <LogIn className="h-4 w-4" />
                {submitting ? 'Signing in…' : 'Login'}
              </button>

              <p className="text-center">
                <a href="#" className="text-xs text-primary-500 hover:underline">
                  I forgot my password
                </a>
              </p>
            </form>
          </div>

          {isDemoMode && (
            <div className="mt-4 rounded border border-primary-100 bg-primary-50 p-3 text-[11px] text-slate-600">
              <p className="mb-1 font-semibold text-slate-700">Demo mode — no Supabase project connected yet.</p>
              <p>Sign in with any of these seeded demo accounts (password: demo123):</p>
              <ul className="mt-1 space-y-0.5">
                {demoAccounts.map((a) => (
                  <li key={a.username}>
                    <span className="font-mono">{a.username}</span> — {a.profile.designationName}
                    {a.profile.roles.length > 1 ? ` (${a.profile.roles.join(', ')})` : ''}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="mx-auto mt-8 flex w-full max-w-sm items-center justify-between text-[11px] text-slate-400">
          <div>
            <p>{appConfig.poweredByLabel}</p>
            <p className="font-semibold text-slate-500">{appConfig.appName}</p>
          </div>
          <div className="flex gap-2">
            <span className="rounded border border-slate-200 px-2 py-1">Google Play</span>
            <span className="rounded border border-slate-200 px-2 py-1">App Store</span>
          </div>
        </div>
      </div>
    </div>
  );
}
