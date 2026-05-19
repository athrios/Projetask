ALTER TABLE public.process_templates
  ADD COLUMN IF NOT EXISTS template_type text NOT NULL DEFAULT 'tasks',
  ADD COLUMN IF NOT EXISTS table_schema jsonb NOT NULL DEFAULT '{"columns":[],"rows":[]}'::jsonb;

ALTER TABLE public.processes
  ADD COLUMN IF NOT EXISTS template_type text NOT NULL DEFAULT 'tasks',
  ADD COLUMN IF NOT EXISTS table_data jsonb NOT NULL DEFAULT '{"columns":[],"rows":[]}'::jsonb;

CREATE OR REPLACE FUNCTION public.validate_template_type()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.template_type NOT IN ('tasks','table') THEN
    RAISE EXCEPTION 'invalid template_type: %', NEW.template_type;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS process_templates_validate_type ON public.process_templates;
CREATE TRIGGER process_templates_validate_type
  BEFORE INSERT OR UPDATE ON public.process_templates
  FOR EACH ROW EXECUTE FUNCTION public.validate_template_type();

DROP TRIGGER IF EXISTS processes_validate_type ON public.processes;
CREATE TRIGGER processes_validate_type
  BEFORE INSERT OR UPDATE ON public.processes
  FOR EACH ROW EXECUTE FUNCTION public.validate_template_type();