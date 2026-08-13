create table public.exit_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  resignation_date date not null,
  proposed_last_working_date date not null,
  notice_period_days integer not null,
  expected_last_working_date date not null,
  reason text not null,
  detailed_comments text,
  attachment_url text,
  status text not null default 'draft' check (
    status in ('draft', 'submitted', 'manager_approved', 'hr_approved', 'rejected', 'withdrawn', 'completed')
  ),
  manager_id uuid references public.employees(id),
  manager_approved_at timestamptz,
  manager_remarks text,
  hr_approver_id uuid references public.employees(id),
  hr_approved_at timestamptz,
  hr_remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_exit_requests_updated_at before update on public.exit_requests
  for each row execute function public.set_updated_at();
create index idx_exit_requests_employee on public.exit_requests(employee_id);

-- HR-configurable questionnaire, grouped by category (section 32).
create table public.exit_interview_questions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  category text not null check (
    category in (
      'job_satisfaction', 'management', 'work_environment', 'compensation',
      'career_growth', 'learning', 'company_culture', 'reason_for_leaving', 'suggestions'
    )
  ),
  question_text text not null,
  response_type text not null default 'rating' check (response_type in ('rating', 'text', 'yes_no')),
  display_order smallint not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid
);

create table public.exit_interviews (
  id uuid primary key default gen_random_uuid(),
  exit_request_id uuid not null references public.exit_requests(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  conducted_by uuid references public.employees(id),
  conducted_at timestamptz,
  status text not null default 'pending' check (status in ('pending', 'completed')),
  created_at timestamptz not null default now(),
  unique (exit_request_id)
);

create table public.exit_interview_responses (
  id uuid primary key default gen_random_uuid(),
  exit_interview_id uuid not null references public.exit_interviews(id) on delete cascade,
  question_id uuid not null references public.exit_interview_questions(id),
  rating_value smallint check (rating_value between 1 and 5),
  text_value text,
  yes_no_value boolean,
  created_at timestamptz not null default now(),
  unique (exit_interview_id, question_id)
);
