-- Private bucket for personal documents, keyed by folder-per-employee
-- (`<employee_id>/<filename>`), enforced by the RLS policies below.
insert into storage.buckets (id, name, public)
values ('employee-documents', 'employee-documents', false)
on conflict (id) do nothing;

create policy "employee_documents_read" on storage.objects for select
  using (
    bucket_id = 'employee-documents'
    and ((storage.foldername(name))[1] = public.current_employee_id()::text or public.is_hr_or_admin())
  );
create policy "employee_documents_write" on storage.objects for insert
  with check (
    bucket_id = 'employee-documents'
    and ((storage.foldername(name))[1] = public.current_employee_id()::text or public.is_hr_or_admin())
  );
create policy "employee_documents_delete" on storage.objects for delete
  using (
    bucket_id = 'employee-documents'
    and ((storage.foldername(name))[1] = public.current_employee_id()::text or public.is_hr_or_admin())
  );

-- Public bucket for profile photos — low sensitivity, and avatars need to be
-- easily displayable across the org (team lists, approval cards) without
-- signed URLs.
insert into storage.buckets (id, name, public)
values ('employee-photos', 'employee-photos', true)
on conflict (id) do nothing;

create policy "employee_photos_write" on storage.objects for insert
  with check (
    bucket_id = 'employee-photos'
    and ((storage.foldername(name))[1] = public.current_employee_id()::text or public.is_hr_or_admin())
  );
create policy "employee_photos_update" on storage.objects for update
  using (
    bucket_id = 'employee-photos'
    and ((storage.foldername(name))[1] = public.current_employee_id()::text or public.is_hr_or_admin())
  );
