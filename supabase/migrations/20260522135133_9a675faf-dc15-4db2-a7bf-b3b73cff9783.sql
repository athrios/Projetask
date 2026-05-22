
-- 1) New columns on forms
ALTER TABLE public.forms
  ADD COLUMN IF NOT EXISTS auto_create_process boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS linked_process_template_id uuid NULL;

-- 2) Unique partial index to prevent duplicate process per response
CREATE UNIQUE INDEX IF NOT EXISTS form_responses_one_process_per_response
  ON public.form_responses(converted_process_id)
  WHERE converted_process_id IS NOT NULL;

-- 3) Helper: unaccent-lite lowercase
CREATE OR REPLACE FUNCTION public._norm_label(t text)
RETURNS text
LANGUAGE sql IMMUTABLE
AS $$
  SELECT lower(translate(coalesce(t,''),
    'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇáàâãäéèêëíìîïóòôõöúùûüç',
    'AAAAAEEEEIIIIOOOOOUUUUCaaaaaeeeeiiiiooooouuuuc'));
$$;

-- 4) Trigger function
CREATE OR REPLACE FUNCTION public.handle_form_response_autoprocess()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_form        public.forms%ROWTYPE;
  v_tpl         public.process_templates%ROWTYPE;
  v_proc_id     uuid;
  v_proc_name   text;
  v_found_name  text;
  v_key         text;
  v_val         text;
  v_base_iso    date := current_date;
  v_table_data  jsonb;
BEGIN
  IF NEW.converted_process_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_form FROM public.forms WHERE id = NEW.form_id;
  IF NOT FOUND OR v_form.auto_create_process IS NOT TRUE OR v_form.linked_process_template_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_tpl
    FROM public.process_templates
   WHERE id = v_form.linked_process_template_id
     AND workspace_id = v_form.workspace_id;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- Try to extract a readable name from response data
  IF NEW.data IS NOT NULL AND jsonb_typeof(NEW.data) = 'object' THEN
    FOR v_key, v_val IN
      SELECT k, CASE jsonb_typeof(v)
                 WHEN 'string' THEN v #>> '{}'
                 WHEN 'number' THEN v::text
                 ELSE NULL END
        FROM jsonb_each(NEW.data) AS e(k, v)
    LOOP
      IF v_val IS NULL OR length(trim(v_val)) = 0 THEN CONTINUE; END IF;
      IF public._norm_label(v_key) ~ '(empresa|razao social|cliente|nome|email|e-mail)' THEN
        v_found_name := trim(v_val);
        EXIT;
      END IF;
    END LOOP;
  END IF;

  IF v_found_name IS NULL AND NEW.submitter_name IS NOT NULL AND length(trim(NEW.submitter_name)) > 0 THEN
    v_found_name := trim(NEW.submitter_name);
  END IF;

  IF v_found_name IS NOT NULL THEN
    v_proc_name := v_tpl.name || ' - ' || v_found_name;
  ELSE
    v_proc_name := v_tpl.name || ' - Resposta de formulário - ' || to_char(now(), 'DD-MM-YY');
  END IF;

  v_table_data := CASE
    WHEN v_tpl.template_type = 'table' THEN coalesce(v_tpl.table_schema, '{"rows":[],"columns":[]}'::jsonb)
    ELSE '{"rows":[],"columns":[]}'::jsonb
  END;

  INSERT INTO public.processes (
    user_id, workspace_id, name, template_id, status, template_type, table_data
  ) VALUES (
    v_form.user_id, v_form.workspace_id, v_proc_name, v_tpl.id, 'nao_iniciado', v_tpl.template_type, v_table_data
  ) RETURNING id INTO v_proc_id;

  IF v_tpl.template_type <> 'table' THEN
    INSERT INTO public.process_steps (process_id, user_id, workspace_id, position, title, status, due_date)
    SELECT v_proc_id,
           v_form.user_id,
           v_form.workspace_id,
           s.position,
           s.title,
           'pendente',
           CASE WHEN coalesce(s.due_offset_days,0) > 0
                THEN v_base_iso + s.due_offset_days
                ELSE NULL END
      FROM public.process_template_steps s
     WHERE s.template_id = v_tpl.id
       AND s.workspace_id = v_form.workspace_id
     ORDER BY s.position;
  END IF;

  UPDATE public.form_responses
     SET converted_process_id = v_proc_id,
         status = 'convertida_processo',
         updated_at = now()
   WHERE id = NEW.id;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- never block the response insert
  RAISE WARNING 'handle_form_response_autoprocess failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_form_response_autoprocess ON public.form_responses;
CREATE TRIGGER trg_form_response_autoprocess
AFTER INSERT ON public.form_responses
FOR EACH ROW
EXECUTE FUNCTION public.handle_form_response_autoprocess();
