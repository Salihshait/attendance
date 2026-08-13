create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  notification_type text not null check (
    notification_type in (
      'leave_approved', 'leave_rejected', 'permission_approved', 'permission_rejected',
      'regularization_approved', 'regularization_rejected', 'new_approval',
      'resignation_update', 'document_verification', 'system_announcement'
    )
  ),
  title text not null,
  body text,
  link_path text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
create index idx_notifications_recipient on public.notifications(recipient_user_id, is_read, created_at desc);

-- Append-only audit trail. Never updated or deleted by application code.
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_user_id uuid references auth.users(id),
  action text not null check (
    action in ('login', 'logout', 'create', 'update', 'delete', 'approval', 'rejection', 'document_upload')
  ),
  module text not null,
  record_id uuid,
  old_value jsonb,
  new_value jsonb,
  ip_address inet,
  created_at timestamptz not null default now()
);
create index idx_audit_logs_org_created on public.audit_logs(organization_id, created_at desc);
create index idx_audit_logs_actor on public.audit_logs(actor_user_id);

create table public.system_settings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  setting_key text not null,
  setting_value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  unique (organization_id, setting_key)
);
create trigger trg_system_settings_updated_at before update on public.system_settings
  for each row execute function public.set_updated_at();
