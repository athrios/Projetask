
ALTER TABLE public.form_fields
  ADD COLUMN IF NOT EXISTS conditional_logic jsonb;

CREATE OR REPLACE VIEW public.form_fields_public AS
SELECT ff.id, ff.form_id, ff.label, ff.field_type, ff.required, ff.options,
       ff."position", ff.description, ff.add_button_label, ff.conditional_logic
FROM public.form_fields ff
JOIN public.forms f ON f.id = ff.form_id
WHERE f.is_published = true;

ALTER VIEW public.form_fields_public SET (security_invoker = true);

GRANT SELECT ON public.form_fields_public TO anon, authenticated;
