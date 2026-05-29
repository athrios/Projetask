
-- =========================================================
-- 1) Public form views: stop leaking workspace_id / user_id
-- =========================================================

-- Recreate forms_public WITHOUT user_id / workspace_id, and as
-- security_invoker=off so anon does not need direct SELECT on base table.
DROP VIEW IF EXISTS public.forms_public;
CREATE VIEW public.forms_public
WITH (security_invoker=off) AS
SELECT
  id,
  title,
  description,
  is_published,
  public_slug,
  logo_path,
  logo_alignment,
  submitter_name_label
FROM public.forms
WHERE is_published = true;

-- Recreate form_fields_public as security_invoker=off so anon does
-- not need direct SELECT on base form_fields / forms.
DROP VIEW IF EXISTS public.form_fields_public;
CREATE VIEW public.form_fields_public
WITH (security_invoker=off) AS
SELECT
  ff.id,
  ff.form_id,
  ff.label,
  ff.field_type,
  ff.required,
  ff.options,
  ff."position",
  ff.description,
  ff.add_button_label,
  ff.conditional_logic
FROM public.form_fields ff
JOIN public.forms f ON f.id = ff.form_id
WHERE f.is_published = true;

GRANT SELECT ON public.forms_public TO anon, authenticated;
GRANT SELECT ON public.form_fields_public TO anon, authenticated;

-- Drop anon SELECT policies on base tables (no longer needed; access
-- goes through the security-definer views above).
DROP POLICY IF EXISTS "anon reads published forms only" ON public.forms;
DROP POLICY IF EXISTS "anon reads fields of published forms only" ON public.form_fields;

-- =========================================================
-- 2) Secure RPC for anonymous form response submission
--    (avoids exposing owner_id / workspace_id to the client)
-- =========================================================

CREATE OR REPLACE FUNCTION public.submit_public_form_response(
  p_form_id uuid,
  p_submitter_name text,
  p_data jsonb,
  p_cnpj_snapshot jsonb DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_form public.forms%ROWTYPE;
  v_id uuid;
BEGIN
  SELECT * INTO v_form FROM public.forms WHERE id = p_form_id;
  IF NOT FOUND OR v_form.is_published IS NOT TRUE THEN
    RAISE EXCEPTION 'form not available';
  END IF;

  IF coalesce(length(trim(p_submitter_name)), 0) = 0 THEN
    RAISE EXCEPTION 'submitter name required';
  END IF;

  INSERT INTO public.form_responses (
    form_id, owner_id, workspace_id, submitter_name, data, status, cnpj_lookup_snapshot
  ) VALUES (
    v_form.id, v_form.user_id, v_form.workspace_id,
    left(trim(p_submitter_name), 200),
    coalesce(p_data, '{}'::jsonb),
    'recebida',
    p_cnpj_snapshot
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_public_form_response(uuid, text, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_public_form_response(uuid, text, jsonb, jsonb) TO anon, authenticated;

-- =========================================================
-- 3) Tighten realtime policies: require workspace membership,
--    remove permissive %uid% LIKE match.
-- =========================================================

DROP POLICY IF EXISTS "ws scoped realtime read" ON realtime.messages;
DROP POLICY IF EXISTS "ws scoped realtime send" ON realtime.messages;

CREATE POLICY "ws scoped realtime read"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.user_id = auth.uid()
      AND realtime.topic() LIKE ('%' || wm.workspace_id::text || '%')
  )
);

CREATE POLICY "ws scoped realtime send"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.user_id = auth.uid()
      AND realtime.topic() LIKE ('%' || wm.workspace_id::text || '%')
  )
);
