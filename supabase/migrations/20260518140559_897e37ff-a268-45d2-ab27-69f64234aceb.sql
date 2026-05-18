
-- Make workspace_id nullable so existing inserts (without it) still compile
ALTER TABLE public.tasks ALTER COLUMN workspace_id DROP NOT NULL;
ALTER TABLE public.subtasks ALTER COLUMN workspace_id DROP NOT NULL;
ALTER TABLE public.schedule_items ALTER COLUMN workspace_id DROP NOT NULL;
ALTER TABLE public.processes ALTER COLUMN workspace_id DROP NOT NULL;
ALTER TABLE public.process_steps ALTER COLUMN workspace_id DROP NOT NULL;
ALTER TABLE public.process_templates ALTER COLUMN workspace_id DROP NOT NULL;
ALTER TABLE public.process_template_steps ALTER COLUMN workspace_id DROP NOT NULL;
ALTER TABLE public.forms ALTER COLUMN workspace_id DROP NOT NULL;
ALTER TABLE public.form_fields ALTER COLUMN workspace_id DROP NOT NULL;
ALTER TABLE public.form_responses ALTER COLUMN workspace_id DROP NOT NULL;
ALTER TABLE public.activity_logs ALTER COLUMN workspace_id DROP NOT NULL;

-- Helper: pick user's primary owned workspace
CREATE OR REPLACE FUNCTION public.default_workspace_for(_uid uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.workspaces WHERE owner_id = _uid AND archived_at IS NULL
  ORDER BY created_at ASC LIMIT 1
$$;

-- Generic auto-fill trigger function (works for all tables with workspace_id + user_id or owner_id)
CREATE OR REPLACE FUNCTION public.autofill_workspace_id()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid; v_ws uuid;
BEGIN
  IF NEW.workspace_id IS NOT NULL THEN RETURN NEW; END IF;
  -- Determine user id from row
  BEGIN v_uid := NEW.user_id; EXCEPTION WHEN OTHERS THEN v_uid := NULL; END;
  IF v_uid IS NULL THEN
    BEGIN v_uid := NEW.owner_id; EXCEPTION WHEN OTHERS THEN v_uid := NULL; END;
  END IF;
  IF v_uid IS NULL THEN v_uid := auth.uid(); END IF;
  IF v_uid IS NULL THEN RETURN NEW; END IF;

  v_ws := public.default_workspace_for(v_uid);
  IF v_ws IS NULL THEN
    INSERT INTO public.workspaces (owner_id, name, color)
    VALUES (v_uid, 'Meu ambiente', 'blue') RETURNING id INTO v_ws;
  END IF;
  NEW.workspace_id := v_ws;
  RETURN NEW;
END;
$$;

-- Attach trigger to each data table
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY['tasks','subtasks','schedule_items','processes','process_steps','process_templates','process_template_steps','forms','form_fields','activity_logs']) LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_autofill_ws ON public.%I', t);
    EXECUTE format('CREATE TRIGGER trg_autofill_ws BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.autofill_workspace_id()', t);
  END LOOP;
END $$;

-- form_responses: workspace_id derived from form
CREATE OR REPLACE FUNCTION public.autofill_response_workspace_id()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.workspace_id IS NULL THEN
    SELECT workspace_id INTO NEW.workspace_id FROM public.forms WHERE id = NEW.form_id;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_autofill_response_ws ON public.form_responses;
CREATE TRIGGER trg_autofill_response_ws BEFORE INSERT ON public.form_responses
FOR EACH ROW EXECUTE FUNCTION public.autofill_response_workspace_id();

-- Lock down SECURITY DEFINER helpers from anon (they only need to be callable in RLS context for authenticated users)
REVOKE EXECUTE ON FUNCTION public.is_workspace_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_workspace_owner(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_workspace_permission(uuid, uuid, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.default_workspace_for(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_workspace_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_workspace_owner(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_workspace_permission(uuid, uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.default_workspace_for(uuid) TO authenticated;
