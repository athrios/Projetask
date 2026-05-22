
ALTER TABLE public.forms
  ADD COLUMN IF NOT EXISTS submitter_name_label text NOT NULL DEFAULT 'Seu nome';

ALTER TABLE public.form_fields
  ADD COLUMN IF NOT EXISTS add_button_label text;

CREATE OR REPLACE VIEW public.forms_public AS
SELECT id, user_id, workspace_id, title, description, is_published, public_slug,
       logo_path, logo_alignment, submitter_name_label
FROM public.forms
WHERE is_published = true;

CREATE OR REPLACE VIEW public.form_fields_public AS
SELECT ff.id, ff.form_id, ff.label, ff.field_type, ff.required, ff.options,
       ff."position", ff.description, ff.add_button_label
FROM public.form_fields ff
JOIN public.forms f ON f.id = ff.form_id
WHERE f.is_published = true;
