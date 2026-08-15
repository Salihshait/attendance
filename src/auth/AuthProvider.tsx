import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { findDemoAccount } from '@/data/demoUsers';
import type { AppRole } from '@/config/app.config';
import type { AuthSession, EmployeeProfile } from '@/types/domain';

export const isSupabaseConfigured = Boolean(
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY,
);

const DEMO_STORAGE_KEY = 'wallethr.demoSession';

interface AuthContextValue {
  loading: boolean;
  authSession: AuthSession | null;
  error: string | null;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  setActiveRole: (role: AppRole) => void;
  isDemoMode: boolean;
  requestPasswordReset: (email: string) => Promise<{ error: string | null }>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ error: string | null }>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function loadEmployeeProfile(supabaseUserId: string, email: string): Promise<EmployeeProfile | null> {
  const { data: employee, error: employeeError } = await supabase
    .from('employees')
    .select(
      `id, employee_code, first_name, middle_name, last_name, gender, photo_url,
       official_email, official_mobile, date_of_joining, reporting_manager_id,
       paygroup, father_name, date_of_birth, cost_centre, place_of_tax_deduction, job_responsibility,
       department:departments(name), designation:designations(name),
       location:locations(name), grade:grades(name)`,
    )
    .eq('user_id', supabaseUserId)
    .maybeSingle();

  if (employeeError || !employee) return null;

  const { data: roleRows } = await supabase
    .from('user_roles')
    .select('role:roles(code)')
    .eq('user_id', supabaseUserId);

  const roles = (roleRows ?? [])
    .map((r) => (r.role as unknown as { code: AppRole } | null)?.code)
    .filter((r): r is AppRole => Boolean(r));

  const dept = employee.department as unknown as { name: string } | null;
  const desig = employee.designation as unknown as { name: string } | null;
  const loc = employee.location as unknown as { name: string } | null;
  const grade = employee.grade as unknown as { name: string } | null;

  // Fetched separately rather than as an embedded PostgREST resource:
  // self-referencing FK embeds are direction-ambiguous and depend on RLS
  // granting access to the *joined* row too — a plain follow-up query is
  // both simpler and more reliable.
  let reportingManagerName: string | null = null;
  if (employee.reporting_manager_id) {
    const { data: manager } = await supabase
      .from('employees')
      .select('first_name, last_name')
      .eq('id', employee.reporting_manager_id)
      .maybeSingle();
    if (manager) reportingManagerName = [manager.first_name, manager.last_name].filter(Boolean).join(' ');
  }

  return {
    id: employee.id,
    userId: supabaseUserId,
    employeeCode: employee.employee_code,
    firstName: employee.first_name,
    middleName: employee.middle_name,
    lastName: employee.last_name,
    displayName: [employee.first_name, employee.last_name].filter(Boolean).join(' '),
    gender: employee.gender,
    photoUrl: employee.photo_url,
    officialEmail: employee.official_email ?? email,
    officialMobile: employee.official_mobile,
    departmentName: dept?.name ?? '-',
    designationName: desig?.name ?? '-',
    locationName: loc?.name ?? '-',
    gradeName: grade?.name ?? null,
    reportingManagerId: employee.reporting_manager_id,
    reportingManagerName,
    dateOfJoining: employee.date_of_joining,
    paygroup: employee.paygroup,
    fatherName: employee.father_name,
    dateOfBirth: employee.date_of_birth,
    costCentre: employee.cost_centre,
    placeOfTaxDeduction: employee.place_of_tax_deduction,
    jobResponsibility: employee.job_responsibility,
    roles: roles.length > 0 ? roles : ['employee'],
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [authSession, setAuthSessionState] = useState<AuthSession | null>(null);
  const [error, setError] = useState<string | null>(null);

  const buildAuthSession = useCallback(
    (employee: EmployeeProfile, email: string, userId: string): AuthSession => ({
      userId,
      email,
      employee,
      activeRole: employee.roles[employee.roles.length - 1] ?? 'employee',
    }),
    [],
  );

  useEffect(() => {
    let cancelled = false;

    async function init() {
      if (!isSupabaseConfigured) {
        const stored = localStorage.getItem(DEMO_STORAGE_KEY);
        if (stored) {
          const account = findDemoAccount(JSON.parse(stored).username, JSON.parse(stored).password);
          if (account) {
            setAuthSessionState(buildAuthSession(account.profile, account.profile.officialEmail, account.profile.userId));
          }
        }
        setLoading(false);
        return;
      }

      const { data } = await supabase.auth.getSession();
      await hydrateFromSession(data.session);
      setLoading(false);

      supabase.auth.onAuthStateChange((_event, session) => {
        void hydrateFromSession(session);
      });
    }

    async function hydrateFromSession(session: Session | null) {
      if (!session?.user) {
        if (!cancelled) setAuthSessionState(null);
        return;
      }
      const profile = await loadEmployeeProfile(session.user.id, session.user.email ?? '');
      if (!cancelled) {
        setAuthSessionState(
          profile ? buildAuthSession(profile, session.user.email ?? '', session.user.id) : null,
        );
      }
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, [buildAuthSession]);

  const signIn = useCallback(
    async (username: string, password: string) => {
      setError(null);
      if (!isSupabaseConfigured) {
        const account = findDemoAccount(username, password);
        if (!account) {
          setError('Invalid demo credentials. Try EMP0001 / demo123.');
          return;
        }
        localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify({ username, password }));
        setAuthSessionState(
          buildAuthSession(account.profile, account.profile.officialEmail, account.profile.userId),
        );
        return;
      }

      // The login field accepts an employee code (matching the reference
      // app's UX) or a plain email — Supabase Auth only ever signs in by
      // email, so resolve a non-email username via the RPC first.
      let email = username.trim();
      if (!email.includes('@')) {
        const { data: resolved } = await supabase.rpc('resolve_login_email', { _username: email });
        if (resolved) email = resolved;
      }

      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError || !data.user) {
        setError(signInError?.message ?? 'Unable to sign in.');
        return;
      }
      const profile = await loadEmployeeProfile(data.user.id, data.user.email ?? '');
      if (!profile) {
        setError('Signed in, but no employee profile is linked to this account.');
        return;
      }
      setAuthSessionState(buildAuthSession(profile, data.user.email ?? '', data.user.id));
    },
    [buildAuthSession],
  );

  const signOut = useCallback(async () => {
    if (!isSupabaseConfigured) {
      localStorage.removeItem(DEMO_STORAGE_KEY);
      setAuthSessionState(null);
      return;
    }
    await supabase.auth.signOut();
    setAuthSessionState(null);
  }, []);

  const setActiveRole = useCallback((role: AppRole) => {
    setAuthSessionState((prev) => (prev ? { ...prev, activeRole: role } : prev));
  }, []);

  const requestPasswordReset = useCallback(async (email: string) => {
    if (!isSupabaseConfigured) {
      return { error: 'Password reset is not available in demo mode.' };
    }
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { error: resetError?.message ?? null };
  }, []);

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      if (!isSupabaseConfigured) {
        return { error: 'Password change is not available in demo mode.' };
      }
      if (!authSession?.email) {
        return { error: 'No active session.' };
      }
      // Supabase's updateUser() does not verify the caller's current
      // password, so we re-authenticate with it first to make sure this
      // is really the account owner before accepting the new one.
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: authSession.email,
        password: currentPassword,
      });
      if (verifyError) {
        return { error: 'Current password is incorrect.' };
      }
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      return { error: updateError?.message ?? null };
    },
    [authSession?.email],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      loading,
      authSession,
      error,
      signIn,
      signOut,
      setActiveRole,
      isDemoMode: !isSupabaseConfigured,
      requestPasswordReset,
      changePassword,
    }),
    [loading, authSession, error, signIn, signOut, setActiveRole, requestPasswordReset, changePassword],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
