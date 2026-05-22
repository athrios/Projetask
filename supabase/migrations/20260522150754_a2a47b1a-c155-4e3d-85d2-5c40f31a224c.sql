
-- 1. form_fields.description
ALTER TABLE public.form_fields
  ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '';

-- 2. forms: logo
ALTER TABLE public.forms
  ADD COLUMN IF NOT EXISTS logo_path text NULL,
  ADD COLUMN IF NOT EXISTS logo_alignment text NOT NULL DEFAULT 'center';

CREATE OR REPLACE FUNCTION public.validate_form_logo_alignment()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.logo_alignment NOT IN ('left','center','right') THEN
    RAISE EXCEPTION 'invalid logo_alignment: %', NEW.logo_alignment;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_form_logo_alignment ON public.forms;
CREATE TRIGGER trg_validate_form_logo_alignment
  BEFORE INSERT OR UPDATE ON public.forms
  FOR EACH ROW EXECUTE FUNCTION public.validate_form_logo_alignment();

-- 3. Refresh public views
CREATE OR REPLACE VIEW public.forms_public AS
  SELECT id, user_id, workspace_id, title, description, is_published, public_slug,
         logo_path, logo_alignment
    FROM public.forms
   WHERE is_published = true;

CREATE OR REPLACE VIEW public.form_fields_public AS
  SELECT ff.id, ff.form_id, ff.label, ff.field_type, ff.required, ff.options, ff."position",
         ff.description
    FROM public.form_fields ff
    JOIN public.forms f ON f.id = ff.form_id
   WHERE f.is_published = true;

-- 4. Storage bucket for logos (public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('form-logos', 'form-logos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Policies for form-logos
DROP POLICY IF EXISTS "form-logos public read" ON storage.objects;
CREATE POLICY "form-logos public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'form-logos');

DROP POLICY IF EXISTS "form-logos owner insert" ON storage.objects;
CREATE POLICY "form-logos owner insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'form-logos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "form-logos owner update" ON storage.objects;
CREATE POLICY "form-logos owner update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'form-logos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "form-logos owner delete" ON storage.objects;
CREATE POLICY "form-logos owner delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'form-logos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
