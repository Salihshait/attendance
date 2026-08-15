import { useMemo, useState } from 'react';
import { Star, Settings2, Plus } from 'lucide-react';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { PageHeader } from '@/components/layout/PageHeader';
import { Modal } from '@/components/ui/Modal';
import { Field, inputClass } from '@/components/attendance/LeaveRequestForm';
import { cn } from '@/lib/utils';
import { useAuth } from '@/auth/useAuth';
import {
  useCreateExitInterviewQuestion,
  useExitInterviewQuestions,
  useMyExitInterview,
  useSetExitInterviewQuestionActive,
  useSubmitExitInterview,
  type ExitInterviewAnswer,
} from '@/hooks/useExitInterviewQueries';
import type { ExitInterviewCategory, ExitInterviewQuestionRow, ExitInterviewResponseType } from '@/types/exit';
import { ORG_ID } from '@/lib/orgContext';

const CATEGORY_LABELS: Record<ExitInterviewCategory, string> = {
  job_satisfaction: 'Job Satisfaction',
  management: 'Management',
  work_environment: 'Work Environment',
  compensation: 'Salary / Benefits',
  career_growth: 'Career Growth',
  learning: 'Learning',
  company_culture: 'Company Culture',
  reason_for_leaving: 'Reason for Leaving',
  suggestions: 'Suggestions',
};
const CATEGORY_ORDER = Object.keys(CATEGORY_LABELS) as ExitInterviewCategory[];

export default function ExitInterviewPage() {
  const { authSession } = useAuth();
  const employeeId = authSession?.employee.id;
  const isHr = authSession?.employee.roles.some((r) => r === 'hr_admin' || r === 'super_admin') ?? false;

  const { data: questions, isLoading: questionsLoading } = useExitInterviewQuestions(authSession?.employee ? ORG_ID : undefined);
  const { data: interview, isLoading: interviewLoading } = useMyExitInterview(employeeId);
  const submitInterview = useSubmitExitInterview();

  const [answers, setAnswers] = useState<Record<string, ExitInterviewAnswer>>({});
  const [showManageQuestions, setShowManageQuestions] = useState(false);

  const byCategory = useMemo(() => {
    const map = new Map<ExitInterviewCategory, ExitInterviewQuestionRow[]>();
    for (const q of questions ?? []) {
      const list = map.get(q.category) ?? [];
      list.push(q);
      map.set(q.category, list);
    }
    return CATEGORY_ORDER.filter((c) => map.has(c)).map((c) => [c, map.get(c)!] as const);
  }, [questions]);

  function setAnswer(questionId: string, patch: Partial<ExitInterviewAnswer>) {
    setAnswers((prev) => ({ ...prev, [questionId]: { ...prev[questionId], ...patch, questionId } }));
  }

  async function handleSubmit() {
    if (!interview || !employeeId) return;
    await submitInterview.mutateAsync({ exitInterviewId: interview.id, answers: Object.values(answers), employeeId });
  }

  const alreadyAnswered = new Map((interview?.responses ?? []).map((r) => [r.questionId, r]));

  return (
    <div>
      <Breadcrumb items={[{ label: 'Exit' }, { label: 'Transaction' }, { label: 'Exit Interview' }]} />

      <div className="overflow-hidden rounded border border-slate-200 bg-white">
        <PageHeader
          title="Exit Interview"
          actions={
            isHr && (
              <button
                type="button"
                onClick={() => setShowManageQuestions(true)}
                className="flex items-center gap-1.5 rounded bg-white/15 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/25"
              >
                <Settings2 className="h-3.5 w-3.5" /> Manage Questions
              </button>
            )
          }
        />

        {interviewLoading || questionsLoading ? (
          <p className="px-3 py-8 text-center text-xs text-slate-400">Loading…</p>
        ) : !interview ? (
          <p className="px-3 py-12 text-center text-xs text-slate-400">
            Your exit interview isn't available yet — it opens once HR approves your resignation.
          </p>
        ) : interview.status === 'completed' ? (
          <p className="px-3 py-12 text-center text-xs text-slate-500">
            Thank you — your exit interview was submitted on {interview.conductedAt ? new Date(interview.conductedAt).toLocaleString() : '-'}.
          </p>
        ) : (
          <div className="space-y-5 p-4">
            {byCategory.map(([category, categoryQuestions]) => (
              <section key={category}>
                <h2 className="mb-2 text-sm font-semibold text-primary-600">{CATEGORY_LABELS[category]}</h2>
                <div className="space-y-3">
                  {categoryQuestions.map((q) => {
                    const existing = alreadyAnswered.get(q.id);
                    const current = answers[q.id] ?? {
                      questionId: q.id,
                      ratingValue: existing?.ratingValue ?? undefined,
                      textValue: existing?.textValue ?? undefined,
                      yesNoValue: existing?.yesNoValue ?? undefined,
                    };
                    return (
                      <div key={q.id} className="rounded border border-slate-200 p-3 text-xs">
                        <p className="mb-2 font-medium text-slate-700">{q.questionText}</p>
                        {q.responseType === 'rating' && (
                          <div className="flex gap-1">
                            {[1, 2, 3, 4, 5].map((n) => (
                              <button
                                key={n}
                                type="button"
                                onClick={() => setAnswer(q.id, { ratingValue: n })}
                                aria-label={`${n} star`}
                                className="p-0.5"
                              >
                                <Star
                                  className={cn('h-5 w-5', (current.ratingValue ?? 0) >= n ? 'fill-amber-400 text-amber-400' : 'text-slate-300')}
                                />
                              </button>
                            ))}
                          </div>
                        )}
                        {q.responseType === 'yes_no' && (
                          <div className="flex gap-2">
                            {[
                              { label: 'Yes', value: true },
                              { label: 'No', value: false },
                            ].map((opt) => (
                              <button
                                key={opt.label}
                                type="button"
                                onClick={() => setAnswer(q.id, { yesNoValue: opt.value })}
                                className={cn(
                                  'rounded border px-3 py-1 text-xs font-medium',
                                  current.yesNoValue === opt.value
                                    ? 'border-primary-500 bg-primary-500 text-white'
                                    : 'border-slate-300 text-slate-600 hover:bg-slate-50',
                                )}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        )}
                        {q.responseType === 'text' && (
                          <textarea
                            value={current.textValue ?? ''}
                            onChange={(e) => setAnswer(q.id, { textValue: e.target.value })}
                            rows={2}
                            className={inputClass}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}

            {submitInterview.isError && (
              <p className="rounded bg-status-rejected/10 px-3 py-2 text-status-rejected">{(submitInterview.error as Error).message}</p>
            )}

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitInterview.isPending}
                className="rounded bg-primary-500 px-4 py-2 text-xs font-semibold text-white hover:bg-primary-600 disabled:opacity-60"
              >
                {submitInterview.isPending ? 'Submitting…' : 'Submit Exit Interview'}
              </button>
            </div>
          </div>
        )}
      </div>

      {showManageQuestions && (
        <ManageQuestionsModal onClose={() => setShowManageQuestions(false)} />
      )}
    </div>
  );
}

function ManageQuestionsModal({ onClose }: { onClose: () => void }) {
  const { data: questions } = useExitInterviewQuestions(ORG_ID, false);
  const createQuestion = useCreateExitInterviewQuestion();
  const setActive = useSetExitInterviewQuestionActive();

  const [category, setCategory] = useState<ExitInterviewCategory>('job_satisfaction');
  const [questionText, setQuestionText] = useState('');
  const [responseType, setResponseType] = useState<ExitInterviewResponseType>('rating');

  async function handleAdd() {
    if (!questionText.trim()) return;
    const nextOrder = (questions ?? []).filter((q) => q.category === category).length + 1;
    await createQuestion.mutateAsync({ organizationId: ORG_ID, category, questionText, responseType, displayOrder: nextOrder });
    setQuestionText('');
  }

  return (
    <Modal title="Manage Exit Interview Questions" onClose={onClose} widthClass="max-w-2xl">
      <div className="space-y-4 text-xs">
        <div className="grid grid-cols-[1fr_140px_120px_auto] items-end gap-2 rounded bg-slate-50 p-3">
          <Field label="Question">
            <input value={questionText} onChange={(e) => setQuestionText(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Category">
            <select value={category} onChange={(e) => setCategory(e.target.value as ExitInterviewCategory)} className={inputClass}>
              {CATEGORY_ORDER.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Type">
            <select value={responseType} onChange={(e) => setResponseType(e.target.value as ExitInterviewResponseType)} className={inputClass}>
              <option value="rating">Rating</option>
              <option value="text">Text</option>
              <option value="yes_no">Yes/No</option>
            </select>
          </Field>
          <button
            type="button"
            onClick={handleAdd}
            disabled={createQuestion.isPending}
            className="flex items-center gap-1 rounded bg-primary-500 px-3 py-1.5 font-semibold text-white hover:bg-primary-600 disabled:opacity-60"
          >
            <Plus className="h-3.5 w-3.5" /> Add
          </button>
        </div>

        <div className="max-h-96 space-y-3 overflow-y-auto">
          {CATEGORY_ORDER.map((c) => {
            const list = (questions ?? []).filter((q) => q.category === c);
            if (list.length === 0) return null;
            return (
              <div key={c}>
                <p className="mb-1 font-semibold text-slate-600">{CATEGORY_LABELS[c]}</p>
                <ul className="space-y-1">
                  {list.map((q) => (
                    <li key={q.id} className="flex items-center justify-between gap-2 rounded border border-slate-200 px-2.5 py-1.5">
                      <span className={cn(!q.isActive && 'text-slate-400 line-through')}>
                        {q.questionText} <span className="text-slate-400">({q.responseType})</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setActive.mutate({ id: q.id, isActive: !q.isActive, organizationId: ORG_ID })}
                        className={cn(
                          'shrink-0 rounded px-2 py-0.5 text-[11px] font-semibold',
                          q.isActive ? 'bg-status-approved/15 text-status-approved' : 'bg-slate-200 text-slate-500',
                        )}
                      >
                        {q.isActive ? 'Active' : 'Inactive'}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        <div className="flex justify-end pt-1">
          <button type="button" onClick={onClose} className="rounded border border-slate-300 px-3.5 py-1.5 text-slate-600">
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}
