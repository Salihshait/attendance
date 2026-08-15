import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { ExitInterviewCategory, ExitInterviewQuestionRow, ExitInterviewResponseType, MyExitInterview } from '@/types/exit';

export function useExitInterviewQuestions(organizationId: string | undefined, activeOnly = true) {
  return useQuery({
    queryKey: ['exit-interview-questions', organizationId, activeOnly],
    enabled: Boolean(organizationId),
    queryFn: async (): Promise<ExitInterviewQuestionRow[]> => {
      let query = supabase
        .from('exit_interview_questions')
        .select('id, category, question_text, response_type, display_order, is_active')
        .eq('organization_id', organizationId);
      if (activeOnly) query = query.eq('is_active', true);
      const { data, error } = await query.order('category').order('display_order');
      if (error) throw error;
      return (data ?? []).map((r) => ({
        id: r.id,
        category: r.category,
        questionText: r.question_text,
        responseType: r.response_type,
        displayOrder: r.display_order,
        isActive: r.is_active,
      }));
    },
  });
}

interface NewQuestionInput {
  organizationId: string;
  category: ExitInterviewCategory;
  questionText: string;
  responseType: ExitInterviewResponseType;
  displayOrder: number;
}

export function useCreateExitInterviewQuestion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: NewQuestionInput) => {
      const { error } = await supabase.from('exit_interview_questions').insert({
        organization_id: input.organizationId,
        category: input.category,
        question_text: input.questionText,
        response_type: input.responseType,
        display_order: input.displayOrder,
      });
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['exit-interview-questions', variables.organizationId] });
    },
  });
}

export function useSetExitInterviewQuestionActive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean; organizationId: string }) => {
      const { error } = await supabase.from('exit_interview_questions').update({ is_active: isActive }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['exit-interview-questions', variables.organizationId] });
    },
  });
}

/** The current employee's most recent exit interview (if HR has approved a resignation and provisioned one), with any responses already saved. */
export function useMyExitInterview(employeeId: string | undefined) {
  return useQuery({
    queryKey: ['my-exit-interview', employeeId],
    enabled: Boolean(employeeId),
    queryFn: async (): Promise<MyExitInterview | null> => {
      const { data: interview, error } = await supabase
        .from('exit_interviews')
        .select('id, exit_request_id, status, conducted_at')
        .eq('employee_id', employeeId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!interview) return null;

      const { data: responses, error: responsesError } = await supabase
        .from('exit_interview_responses')
        .select('question_id, rating_value, text_value, yes_no_value')
        .eq('exit_interview_id', interview.id);
      if (responsesError) throw responsesError;

      return {
        id: interview.id,
        exitRequestId: interview.exit_request_id,
        status: interview.status,
        conductedAt: interview.conducted_at,
        responses: (responses ?? []).map((r) => ({
          questionId: r.question_id,
          ratingValue: r.rating_value,
          textValue: r.text_value,
          yesNoValue: r.yes_no_value,
        })),
      };
    },
  });
}

export interface ExitInterviewAnswer {
  questionId: string;
  ratingValue?: number;
  textValue?: string;
  yesNoValue?: boolean;
}

export function useSubmitExitInterview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ exitInterviewId, answers }: { exitInterviewId: string; answers: ExitInterviewAnswer[]; employeeId: string }) => {
      const rows = answers.map((a) => ({
        exit_interview_id: exitInterviewId,
        question_id: a.questionId,
        rating_value: a.ratingValue ?? null,
        text_value: a.textValue ?? null,
        yes_no_value: a.yesNoValue ?? null,
      }));
      const { error: upsertError } = await supabase
        .from('exit_interview_responses')
        .upsert(rows, { onConflict: 'exit_interview_id,question_id' });
      if (upsertError) throw upsertError;

      const { error: updateError } = await supabase
        .from('exit_interviews')
        .update({ status: 'completed', conducted_at: new Date().toISOString() })
        .eq('id', exitInterviewId);
      if (updateError) throw updateError;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['my-exit-interview', variables.employeeId] });
    },
  });
}
