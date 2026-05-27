ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS source_key text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_source_key
  ON public.notifications (source_key)
  WHERE source_key IS NOT NULL;

CREATE OR REPLACE FUNCTION public.notify_on_form_response()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_form_title text;
  v_submitter  text;
BEGIN
  SELECT title INTO v_form_title FROM public.forms WHERE id = NEW.form_id;
  v_submitter := COALESCE(NULLIF(trim(NEW.submitter_name), ''), 'Anônimo');

  INSERT INTO public.notifications (workspace_id, user_id, title, message)
  VALUES (
    NEW.workspace_id,
    NEW.owner_id,
    'Nova resposta recebida',
    v_submitter
      || ' respondeu o formulário "'
      || COALESCE(v_form_title, 'sem título')
      || '"'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_form_response ON public.form_responses;
CREATE TRIGGER trg_notify_form_response
  AFTER INSERT ON public.form_responses
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_form_response();