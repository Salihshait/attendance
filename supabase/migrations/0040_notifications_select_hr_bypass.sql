-- Real bug found while live-testing Notifications compose: notifications_select
-- (0021) only ever allowed recipient_user_id = auth.uid() — no HR/admin
-- bypass. HR can compose (notifications_insert already checks
-- is_hr_or_admin()) but could never read back what they sent to anyone
-- else, since every row's recipient is someone other than the sender.
-- Confirmed live: composing to 2 recipients returns 201 with the correct
-- payload, but useSentAnnouncements() (a plain table select, subject to
-- this same RLS) always returns zero rows for HR — "Sent History" was
-- silently empty for every real broadcast. notifications_update (marking
-- one's own notification read) is unaffected and correctly stays self-only.

drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications for select
  using (recipient_user_id = auth.uid() or public.is_hr_or_admin());
