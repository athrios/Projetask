
-- 1. Enforce NOT NULL on workspace_id columns (no NULL rows exist; autofill triggers ensure values)
ALTER TABLE public.tasks ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.subtasks ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.schedule_items ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.processes ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.process_steps ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.process_templates ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.process_template_steps ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.forms ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.form_fields ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.form_responses ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.activity_logs ALTER COLUMN workspace_id SET NOT NULL;

-- 2. Allow invitees to read and accept their own invitations by email (closes invitation read gap)
CREATE POLICY "invitee views own invitation"
ON public.workspace_invitations
FOR SELECT
TO authenticated
USING (lower(email) = lower((auth.jwt() ->> 'email'::text)));

-- 3. Add UPDATE policy to storage objects for form-uploads bucket (owner only)
CREATE POLICY "Users can update their own form uploads"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'form-uploads' AND auth.uid()::text = (storage.foldername(name))[1])
WITH CHECK (bucket_id = 'form-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);

-- 4. Revoke EXECUTE on SECURITY DEFINER helper functions that should only be called by service role / triggers
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM anon, authenticated, public;
