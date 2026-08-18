// Centralized HR Email Notification Engine (pure, framework-free -- same
// convention as attendanceCalc.ts: this is the tested TS mirror of the
// server-side source of truth, supabase/migrations' queue_templated_email()
// RPC and the send-email edge function). No module (Leave/WFH/Permission/
// Comp-Off/On-Duty/Flexi Holiday/Attendance) should render, resolve
// recipients for, or send an email on its own -- every caller goes through
// this one service (or its SQL/edge-function mirrors).

export const EMAIL_TEMPLATE_VARIABLES = [
  'employee_name',
  'employee_id',
  'manager_name',
  'request_type',
  'from_date',
  'to_date',
  'duration',
  'reason',
  'remarks',
  'status',
  'application_id',
  'approval_url',
] as const;

export type EmailTemplateVariable = (typeof EMAIL_TEMPLATE_VARIABLES)[number];

export const EMAIL_TEMPLATE_KEYS = [
  'approval_request',
  'approval_approved',
  'approval_rejected',
  'missing_punch',
  'early_going',
  'wfh_weekly_alert',
  'comp_off_expiry',
  'attendance_closure_reminder',
  'reconciliation_alert',
  'system_notification',
] as const;

export type EmailTemplateKey = (typeof EMAIL_TEMPLATE_KEYS)[number];

export interface EmailTemplateContent {
  subject: string;
  body: string;
}

const VARIABLE_PATTERN = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

/**
 * Replaces every {{variable}} occurrence with the supplied value. A
 * variable with no supplied value (unsupplied, or genuinely unknown)
 * collapses to an empty string rather than leaking the raw `{{...}}`
 * placeholder into a sent email.
 */
export function renderTemplate(template: EmailTemplateContent, variables: Partial<Record<string, string>>): EmailTemplateContent {
  const replace = (text: string) => text.replace(VARIABLE_PATTERN, (_match, key: string) => variables[key] ?? '');
  return { subject: replace(template.subject), body: replace(template.body) };
}

/** Every distinct {{variable}} referenced in a template's subject+body, e.g. for the admin preview UI to show which fields a template actually uses. */
export function extractTemplateVariables(text: string): string[] {
  return Array.from(new Set(Array.from(text.matchAll(VARIABLE_PATTERN), (m) => m[1])));
}

/** Variables referenced in a template that aren't in the supported list -- surfaced by the admin UI as a validation warning, not a hard error (an unknown variable still renders, just always empty). */
export function findUnknownVariables(text: string): string[] {
  const known = new Set<string>(EMAIL_TEMPLATE_VARIABLES);
  return extractTemplateVariables(text).filter((v) => !known.has(v));
}

// ---------------------------------------------------------------------
// Recipient / manager resolution
// ---------------------------------------------------------------------

export interface RecipientResolutionInput {
  primaryEmail: string;
  managerEmail?: string | null;
  hrEmails?: string[];
  ccManager?: boolean;
  ccHr?: boolean;
}

export interface ResolvedRecipients {
  to: string;
  cc: string[];
}

/** Pure recipient-list assembly. `to` is always the primary recipient; `cc` is deduplicated and never re-includes the primary recipient. */
export function resolveRecipients(input: RecipientResolutionInput): ResolvedRecipients {
  const cc = new Set<string>();
  if (input.ccManager && input.managerEmail) cc.add(input.managerEmail);
  if (input.ccHr) {
    for (const email of input.hrEmails ?? []) cc.add(email);
  }
  cc.delete(input.primaryEmail);
  return { to: input.primaryEmail, cc: Array.from(cc) };
}

export interface EmployeeDirectoryEntry {
  id: string;
  email: string;
  name: string;
  reportingManagerId: string | null;
}

export interface ManagerLookupResult {
  managerId: string | null;
  managerName: string | null;
  managerEmail: string | null;
}

/**
 * Direct reporting manager only -- not the transitive is_manager_of() chain
 * (matches useTeamQueries.ts's useTeamMembers() "direct reports only"
 * convention for anything manager-facing that isn't itself an RLS check).
 */
export function lookupManager(employeeId: string, directory: Map<string, EmployeeDirectoryEntry>): ManagerLookupResult {
  const employee = directory.get(employeeId);
  if (!employee?.reportingManagerId) return { managerId: null, managerName: null, managerEmail: null };

  const manager = directory.get(employee.reportingManagerId);
  if (!manager) return { managerId: employee.reportingManagerId, managerName: null, managerEmail: null };

  return { managerId: manager.id, managerName: manager.name, managerEmail: manager.email };
}

// ---------------------------------------------------------------------
// Template lookup / queueing decision
// ---------------------------------------------------------------------

export interface TemplateLookupResult {
  found: boolean;
  isActive: boolean;
}

export type QueueStatus = 'pending' | 'failed';

export interface QueueDecision {
  shouldSend: boolean;
  status: QueueStatus;
  errorMessage: string | null;
}

/**
 * Mirrors queue_templated_email()'s guard: a missing or disabled template
 * is logged as a failed delivery with a clear error, not silently dropped
 * -- every attempted send is auditable, whether or not it actually went
 * out.
 */
export function decideQueueOutcome(template: TemplateLookupResult): QueueDecision {
  if (!template.found) {
    return { shouldSend: false, status: 'failed', errorMessage: 'No template configured for this template_key' };
  }
  if (!template.isActive) {
    return { shouldSend: false, status: 'failed', errorMessage: 'Template is disabled' };
  }
  return { shouldSend: true, status: 'pending', errorMessage: null };
}

// ---------------------------------------------------------------------
// Retry policy
// ---------------------------------------------------------------------

export interface RetryPolicy {
  maxAttempts: number;
  /** Backoff in minutes before each successive retry; the last entry repeats if attemptCount exceeds the array length. */
  backoffMinutes: number[];
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = { maxAttempts: 3, backoffMinutes: [5, 15, 60] };

export interface RetryDecision {
  status: 'retrying' | 'failed';
  nextRetryAt: Date | null;
}

/**
 * Decides what happens after a send attempt fails: schedule a retry with
 * backoff, or give up permanently once maxAttempts is reached.
 * `attemptCount` is the count *after* this failed attempt (i.e. already
 * incremented) -- a temporary failure is retried, a permanent one (out of
 * attempts) is marked failed for good.
 */
export function decideRetry(attemptCount: number, policy: RetryPolicy = DEFAULT_RETRY_POLICY, now: Date = new Date()): RetryDecision {
  if (attemptCount >= policy.maxAttempts) {
    return { status: 'failed', nextRetryAt: null };
  }
  const delayMinutes = policy.backoffMinutes[Math.min(attemptCount - 1, policy.backoffMinutes.length - 1)];
  return { status: 'retrying', nextRetryAt: new Date(now.getTime() + delayMinutes * 60_000) };
}
