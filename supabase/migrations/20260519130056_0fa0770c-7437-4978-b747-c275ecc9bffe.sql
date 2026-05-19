-- Security hardening: public form views + invite acceptance policy

-- 1. Public views that expose only safe columns
CREATE OR REPLACE VIEW public.forms_public WITH (security_invoker=on) AS
  SELECT id, user_id, workspace_id, title, description, is_published, public_slug
  FROM public.forms
  WHERE is_published = true;

CREATE OR REPLACE VIEW public.form_fields_public WITH (security_invoker=on) AS
  SELECT ff.id, ff.form_id, ff.label, ff.field_type, ff.required, ff.options, ff.position
  FROM public.form_fields ff
  JOIN public.forms f ON f.id = ff.form_id
  WHERE f.is_published = true;

GRANT SELECT ON public.forms_public TO anon, authenticated;
GRANT SELECT ON public.form_fields_public TO anon, authenticated;

-- 2. Drop the broad public SELECT policies on base tables.
-- Views above use security_invoker; we need anon to be able to read the underlying rows
-- ONLY through the published filter. Re-create tighter policies scoped to anon + published.
DROP POLICY IF EXISTS "public published forms read" ON public.forms;
DROP POLICY IF EXISTS "public published fields read" ON public.form_fields;

CREATE POLICY "anon reads published forms only"
ON public.forms
FOR SELECT
TO anon
USING (is_published = true);

CREATE POLICY "anon reads fields of published forms only"
ON public.form_fields
FOR SELECT
TO anon
USING (EXISTS (SELECT 1 FROM public.forms f WHERE f.id = form_fields.form_id AND f.is_published = true));

-- 3. Invite acceptance: invitee can mark accepted_at
CREATE POLICY "invitee accepts"
ON public.workspace_invitations
FOR UPDATE
TO authenticated
USING (lower(email) = lower(auth.jwt() ->> 'email'))
WITH CHECK (lower(email) = lower(auth.jwt() ->> 'email'));
