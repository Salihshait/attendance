import { describe, expect, it } from 'vitest';
import {
  DEFAULT_RETRY_POLICY,
  decideQueueOutcome,
  decideRetry,
  extractTemplateVariables,
  findUnknownVariables,
  lookupManager,
  renderTemplate,
  resolveRecipients,
  type EmployeeDirectoryEntry,
} from './emailEngine';

describe('renderTemplate — email template rendering / variable replacement', () => {
  it('replaces every supplied variable in both subject and body', () => {
    const result = renderTemplate(
      {
        subject: 'Leave request from {{employee_name}} ({{employee_id}})',
        body: 'Dear {{manager_name}}, {{employee_name}} has requested {{request_type}} from {{from_date}} to {{to_date}} ({{duration}}). Reason: {{reason}}.',
      },
      {
        employee_name: 'Bharath S',
        employee_id: 'EMP0001',
        manager_name: 'Arjun Rao',
        request_type: 'Leave',
        from_date: '2026-08-20',
        to_date: '2026-08-22',
        duration: '3 days',
        reason: 'Family function',
      },
    );
    expect(result.subject).toBe('Leave request from Bharath S (EMP0001)');
    expect(result.body).toBe(
      'Dear Arjun Rao, Bharath S has requested Leave from 2026-08-20 to 2026-08-22 (3 days). Reason: Family function.',
    );
  });

  it('collapses an unsupplied variable to an empty string rather than leaking the raw placeholder', () => {
    const result = renderTemplate({ subject: 'Status: {{status}}', body: 'Remarks: {{remarks}}' }, { status: 'Approved' });
    expect(result.subject).toBe('Status: Approved');
    expect(result.body).toBe('Remarks: ');
  });

  it('collapses a genuinely unknown variable the same way', () => {
    const result = renderTemplate({ subject: 'Hello {{not_a_real_variable}}', body: 'x' }, {});
    expect(result.subject).toBe('Hello ');
  });

  it('tolerates whitespace inside the braces', () => {
    const result = renderTemplate({ subject: '{{ employee_name }}', body: 'x' }, { employee_name: 'Bharath S' });
    expect(result.subject).toBe('Bharath S');
  });

  it('renders all 12 spec-named variables correctly', () => {
    const body =
      '{{employee_name}} {{employee_id}} {{manager_name}} {{request_type}} {{from_date}} {{to_date}} ' +
      '{{duration}} {{reason}} {{remarks}} {{status}} {{application_id}} {{approval_url}}';
    const variables: Record<string, string> = {
      employee_name: 'A',
      employee_id: 'B',
      manager_name: 'C',
      request_type: 'D',
      from_date: 'E',
      to_date: 'F',
      duration: 'G',
      reason: 'H',
      remarks: 'I',
      status: 'J',
      application_id: 'K',
      approval_url: 'L',
    };
    const result = renderTemplate({ subject: '', body }, variables);
    expect(result.body).toBe('A B C D E F G H I J K L');
  });
});

describe('extractTemplateVariables / findUnknownVariables', () => {
  it('extracts every distinct variable referenced, without duplicates', () => {
    const vars = extractTemplateVariables('{{employee_name}} and {{employee_name}} again, plus {{status}}');
    expect(vars.sort()).toEqual(['employee_name', 'status']);
  });

  it('flags a variable outside the supported list', () => {
    expect(findUnknownVariables('{{employee_name}} {{secret_internal_field}}')).toEqual(['secret_internal_field']);
  });

  it('reports no unknown variables for a template using only supported ones', () => {
    expect(findUnknownVariables('{{employee_name}} ({{employee_id}}) — {{status}}')).toEqual([]);
  });
});

describe('resolveRecipients — recipient resolution', () => {
  it('always sends to the primary recipient', () => {
    expect(resolveRecipients({ primaryEmail: 'employee@example.com' })).toEqual({ to: 'employee@example.com', cc: [] });
  });

  it('cc\'s the manager only when ccManager is true and a manager email exists', () => {
    expect(
      resolveRecipients({ primaryEmail: 'employee@example.com', managerEmail: 'manager@example.com', ccManager: true }),
    ).toEqual({ to: 'employee@example.com', cc: ['manager@example.com'] });

    expect(
      resolveRecipients({ primaryEmail: 'employee@example.com', managerEmail: 'manager@example.com', ccManager: false }),
    ).toEqual({ to: 'employee@example.com', cc: [] });
  });

  it('cc\'s HR addresses only when ccHr is true', () => {
    const result = resolveRecipients({
      primaryEmail: 'employee@example.com',
      hrEmails: ['hr1@example.com', 'hr2@example.com'],
      ccHr: true,
    });
    expect(result.cc.sort()).toEqual(['hr1@example.com', 'hr2@example.com']);
  });

  it('deduplicates cc and never re-includes the primary recipient in cc', () => {
    const result = resolveRecipients({
      primaryEmail: 'shared@example.com',
      managerEmail: 'shared@example.com', // e.g. self-managed edge case
      hrEmails: ['shared@example.com', 'hr@example.com'],
      ccManager: true,
      ccHr: true,
    });
    expect(result.to).toBe('shared@example.com');
    expect(result.cc).toEqual(['hr@example.com']);
  });
});

describe('lookupManager — manager lookup', () => {
  const directory = new Map<string, EmployeeDirectoryEntry>([
    ['emp-1', { id: 'emp-1', email: 'employee@example.com', name: 'Bharath S', reportingManagerId: 'mgr-1' }],
    ['mgr-1', { id: 'mgr-1', email: 'manager@example.com', name: 'Arjun Rao', reportingManagerId: 'hr-1' }],
    ['no-manager-1', { id: 'no-manager-1', email: 'lone@example.com', name: 'Lone Employee', reportingManagerId: null }],
  ]);

  it('resolves the direct reporting manager', () => {
    expect(lookupManager('emp-1', directory)).toEqual({
      managerId: 'mgr-1',
      managerName: 'Arjun Rao',
      managerEmail: 'manager@example.com',
    });
  });

  it('does not walk further up the chain -- only the direct manager', () => {
    // mgr-1's own manager (hr-1) is not in the directory here; lookupManager
    // for emp-1 must still resolve mgr-1 directly, not hr-1.
    const result = lookupManager('emp-1', directory);
    expect(result.managerId).toBe('mgr-1');
  });

  it('returns nulls when the employee has no reporting manager', () => {
    expect(lookupManager('no-manager-1', directory)).toEqual({ managerId: null, managerName: null, managerEmail: null });
  });

  it('returns nulls when the employee is not found in the directory at all', () => {
    expect(lookupManager('unknown-employee', directory)).toEqual({ managerId: null, managerName: null, managerEmail: null });
  });

  it('returns the manager id with null name/email when the manager itself is missing from the directory', () => {
    const partialDirectory = new Map<string, EmployeeDirectoryEntry>([
      ['emp-2', { id: 'emp-2', email: 'e2@example.com', name: 'E2', reportingManagerId: 'missing-manager' }],
    ]);
    expect(lookupManager('emp-2', partialDirectory)).toEqual({
      managerId: 'missing-manager',
      managerName: null,
      managerEmail: null,
    });
  });
});

describe('decideQueueOutcome — disabled / missing template', () => {
  it('queues normally for an active, found template', () => {
    expect(decideQueueOutcome({ found: true, isActive: true })).toEqual({
      shouldSend: true,
      status: 'pending',
      errorMessage: null,
    });
  });

  it('fails with a clear error for a disabled template rather than silently dropping it', () => {
    const result = decideQueueOutcome({ found: true, isActive: false });
    expect(result.shouldSend).toBe(false);
    expect(result.status).toBe('failed');
    expect(result.errorMessage).toMatch(/disabled/i);
  });

  it('fails with a clear error when no template exists for the key at all', () => {
    const result = decideQueueOutcome({ found: false, isActive: false });
    expect(result.shouldSend).toBe(false);
    expect(result.status).toBe('failed');
    expect(result.errorMessage).toMatch(/no template/i);
  });
});

describe('decideRetry — failed email / retry', () => {
  it('schedules a retry with the first backoff step after the first failure', () => {
    const now = new Date('2026-08-18T10:00:00Z');
    const result = decideRetry(1, DEFAULT_RETRY_POLICY, now);
    expect(result.status).toBe('retrying');
    expect(result.nextRetryAt).toEqual(new Date('2026-08-18T10:05:00Z')); // +5 min
  });

  it('uses a longer backoff for the second failure', () => {
    const now = new Date('2026-08-18T10:00:00Z');
    const result = decideRetry(2, DEFAULT_RETRY_POLICY, now);
    expect(result.status).toBe('retrying');
    expect(result.nextRetryAt).toEqual(new Date('2026-08-18T10:15:00Z')); // +15 min
  });

  it('marks the email permanently failed once attempts reach the configured maximum', () => {
    const result = decideRetry(3, DEFAULT_RETRY_POLICY);
    expect(result.status).toBe('failed');
    expect(result.nextRetryAt).toBeNull();
  });

  it('never schedules a retry past the configured maximum, even if called again', () => {
    const result = decideRetry(5, DEFAULT_RETRY_POLICY);
    expect(result.status).toBe('failed');
    expect(result.nextRetryAt).toBeNull();
  });

  it('respects a custom retry policy', () => {
    const policy = { maxAttempts: 1, backoffMinutes: [2] };
    expect(decideRetry(1, policy).status).toBe('failed'); // maxAttempts=1, so attempt 1 already exhausts it
  });
});

describe('integration — approval email, expiry email, weekly WFH email rendering', () => {
  it('renders a realistic Approval Request email', () => {
    const result = renderTemplate(
      {
        subject: 'Approval needed: {{request_type}} from {{employee_name}}',
        body:
          '{{manager_name}}, {{employee_name}} ({{employee_id}}) has requested {{request_type}} ' +
          'from {{from_date}} to {{to_date}} ({{duration}}). Reason: {{reason}}. ' +
          'Review at {{approval_url}} (Application ID: {{application_id}}).',
      },
      {
        manager_name: 'Arjun Rao',
        employee_name: 'Bharath S',
        employee_id: 'EMP0001',
        request_type: 'Work From Home',
        from_date: '2026-08-20',
        to_date: '2026-08-20',
        duration: '1 day',
        reason: 'Internet installation at home',
        approval_url: 'https://app.example.com/approvals/abc123',
        application_id: 'WFH-000123',
      },
    );
    expect(result.subject).toBe('Approval needed: Work From Home from Bharath S');
    expect(result.body).toContain('Arjun Rao, Bharath S (EMP0001) has requested Work From Home');
    expect(result.body).toContain('Application ID: WFH-000123');
  });

  it('renders a realistic Comp-Off Expiry email', () => {
    const result = renderTemplate(
      {
        subject: 'Your Comp-Off credit is expiring soon',
        body: '{{employee_name}}, your Comp-Off earned on {{from_date}} will expire on {{to_date}} if unused. Remarks: {{remarks}}.',
      },
      {
        employee_name: 'Bharath S',
        from_date: '2026-07-19',
        to_date: '2026-08-18',
        remarks: '1 day remaining, expires in 1 day',
      },
    );
    expect(result.subject).toBe('Your Comp-Off credit is expiring soon');
    expect(result.body).toBe('Bharath S, your Comp-Off earned on 2026-07-19 will expire on 2026-08-18 if unused. Remarks: 1 day remaining, expires in 1 day.');
  });

  it('renders a realistic WFH Weekly Alert email', () => {
    const result = renderTemplate(
      {
        subject: 'WFH threshold exceeded for {{employee_name}}',
        body: '{{manager_name}}, {{employee_name}} ({{employee_id}}) has taken WFH {{duration}} this week ({{from_date}} to {{to_date}}), above the configured threshold.',
      },
      {
        manager_name: 'Arjun Rao',
        employee_name: 'Bharath S',
        employee_id: 'EMP0001',
        duration: '5 days',
        from_date: '2026-08-17',
        to_date: '2026-08-23',
      },
    );
    expect(result.body).toBe(
      'Arjun Rao, Bharath S (EMP0001) has taken WFH 5 days this week (2026-08-17 to 2026-08-23), above the configured threshold.',
    );
  });
});
