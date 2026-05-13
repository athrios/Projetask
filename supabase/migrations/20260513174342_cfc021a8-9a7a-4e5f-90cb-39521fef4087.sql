
-- 1. Update validation triggers to accept new statuses/priorities
CREATE OR REPLACE FUNCTION public.validate_task_priority()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.priority NOT IN ('baixa','media','alta','urgente') THEN
    RAISE EXCEPTION 'invalid priority: %', NEW.priority;
  END IF;
  IF NEW.status NOT IN ('pendente','fazendo','aguardando','feita','cancelado') THEN
    RAISE EXCEPTION 'invalid status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_schedule_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status NOT IN ('pendente','fazendo','aguardando','feita','cancelado','pulado') THEN
    RAISE EXCEPTION 'invalid schedule status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

-- Generic updated_at helper (idempotent)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- 2. PROCESSES
CREATE TABLE public.process_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.process_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own templates select" ON public.process_templates FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own templates insert" ON public.process_templates FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own templates update" ON public.process_templates FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own templates delete" ON public.process_templates FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE public.process_template_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.process_templates(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  position integer NOT NULL DEFAULT 0,
  title text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.process_template_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own tmpl steps select" ON public.process_template_steps FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own tmpl steps insert" ON public.process_template_steps FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own tmpl steps update" ON public.process_template_steps FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own tmpl steps delete" ON public.process_template_steps FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE public.processes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  template_id uuid REFERENCES public.process_templates(id) ON DELETE SET NULL,
  name text NOT NULL,
  client_name text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'nao_iniciado',
  due_date date,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.processes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own processes select" ON public.processes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own processes insert" ON public.processes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own processes update" ON public.processes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own processes delete" ON public.processes FOR DELETE USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.validate_process_status()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status NOT IN ('nao_iniciado','em_andamento','aguardando_cliente','aguardando_orgao','em_exigencia','concluido','cancelado') THEN
    RAISE EXCEPTION 'invalid process status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_validate_process_status BEFORE INSERT OR UPDATE ON public.processes
  FOR EACH ROW EXECUTE FUNCTION public.validate_process_status();
CREATE TRIGGER trg_processes_updated BEFORE UPDATE ON public.processes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.process_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  process_id uuid NOT NULL REFERENCES public.processes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  position integer NOT NULL DEFAULT 0,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'pendente',
  notes text NOT NULL DEFAULT '',
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.process_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own proc steps select" ON public.process_steps FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own proc steps insert" ON public.process_steps FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own proc steps update" ON public.process_steps FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own proc steps delete" ON public.process_steps FOR DELETE USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.validate_process_step_status()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status NOT IN ('pendente','fazendo','feita','pulado') THEN
    RAISE EXCEPTION 'invalid step status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_validate_process_step_status BEFORE INSERT OR UPDATE ON public.process_steps
  FOR EACH ROW EXECUTE FUNCTION public.validate_process_step_status();

-- 3. FORMS
CREATE TABLE public.forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  public_slug text NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text, '-', ''),
  is_published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.forms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own forms all" ON public.forms FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "public published forms read" ON public.forms FOR SELECT USING (is_published = true);
CREATE TRIGGER trg_forms_updated BEFORE UPDATE ON public.forms
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.form_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid NOT NULL REFERENCES public.forms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  position integer NOT NULL DEFAULT 0,
  label text NOT NULL,
  field_type text NOT NULL DEFAULT 'short_text',
  required boolean NOT NULL DEFAULT false,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.form_fields ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own fields all" ON public.form_fields FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "public published fields read" ON public.form_fields FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.forms f WHERE f.id = form_id AND f.is_published = true));

CREATE OR REPLACE FUNCTION public.validate_form_field_type()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.field_type NOT IN ('short_text','long_text','select','multi_select','date') THEN
    RAISE EXCEPTION 'invalid field type: %', NEW.field_type;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_validate_field_type BEFORE INSERT OR UPDATE ON public.form_fields
  FOR EACH ROW EXECUTE FUNCTION public.validate_form_field_type();

-- 4. RESPONSES (REQUESTS)
CREATE TABLE public.form_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid NOT NULL REFERENCES public.forms(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  submitter_name text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'recebida',
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  converted_task_id uuid,
  converted_process_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.form_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner responses select" ON public.form_responses FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "owner responses update" ON public.form_responses FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "owner responses delete" ON public.form_responses FOR DELETE USING (auth.uid() = owner_id);
CREATE POLICY "public submit response" ON public.form_responses FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.forms f WHERE f.id = form_id AND f.is_published = true AND f.user_id = owner_id));

CREATE OR REPLACE FUNCTION public.validate_response_status()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status NOT IN ('recebida','em_analise','convertida_tarefa','convertida_processo','concluida','arquivada') THEN
    RAISE EXCEPTION 'invalid response status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_validate_response_status BEFORE INSERT OR UPDATE ON public.form_responses
  FOR EACH ROW EXECUTE FUNCTION public.validate_response_status();
CREATE TRIGGER trg_responses_updated BEFORE UPDATE ON public.form_responses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_processes_user ON public.processes(user_id);
CREATE INDEX idx_process_steps_process ON public.process_steps(process_id);
CREATE INDEX idx_form_fields_form ON public.form_fields(form_id);
CREATE INDEX idx_form_responses_form ON public.form_responses(form_id);
CREATE INDEX idx_form_responses_owner ON public.form_responses(owner_id);
