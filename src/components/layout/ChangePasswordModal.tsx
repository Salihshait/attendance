import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Modal } from '@/components/ui/Modal';
import { useAuth } from '@/auth/useAuth';

const schema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type FormValues = z.infer<typeof schema>;

export function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const { changePassword, isDemoMode } = useAuth();
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
    const { error: changeError } = await changePassword(values.currentPassword, values.newPassword);
    setSubmitting(false);
    if (changeError) {
      setError(changeError);
      return;
    }
    setDone(true);
  }

  return (
    <Modal title="Change Password" onClose={onClose}>
      {isDemoMode ? (
        <p className="rounded border border-primary-100 bg-primary-50 p-2.5 text-[11px] text-slate-600">
          Demo mode has no real authentication — password change is unavailable here.
        </p>
      ) : done ? (
        <p className="rounded bg-status-approved/10 px-3 py-2 text-xs text-status-approved">
          Password updated successfully.
        </p>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-3">
          <div>
            <label className="mb-1 block text-[11px] font-medium text-slate-600">Current Password</label>
            <input
              {...register('currentPassword')}
              type="password"
              autoComplete="current-password"
              className="w-full rounded border border-slate-300 px-3 py-2 text-xs outline-none focus:border-primary-500"
            />
            {errors.currentPassword && (
              <p className="mt-1 text-[11px] text-status-rejected">{errors.currentPassword.message}</p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-medium text-slate-600">New Password</label>
            <input
              {...register('newPassword')}
              type="password"
              autoComplete="new-password"
              className="w-full rounded border border-slate-300 px-3 py-2 text-xs outline-none focus:border-primary-500"
            />
            {errors.newPassword && <p className="mt-1 text-[11px] text-status-rejected">{errors.newPassword.message}</p>}
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-medium text-slate-600">Confirm New Password</label>
            <input
              {...register('confirmPassword')}
              type="password"
              autoComplete="new-password"
              className="w-full rounded border border-slate-300 px-3 py-2 text-xs outline-none focus:border-primary-500"
            />
            {errors.confirmPassword && (
              <p className="mt-1 text-[11px] text-status-rejected">{errors.confirmPassword.message}</p>
            )}
          </div>

          {error && <p className="rounded bg-status-rejected/10 px-3 py-2 text-xs text-status-rejected">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded bg-primary-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-600 disabled:opacity-60"
            >
              {submitting ? 'Updating…' : 'Update Password'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
