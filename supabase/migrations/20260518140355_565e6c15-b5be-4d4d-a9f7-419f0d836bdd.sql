
-- 1. CORE TABLES
CREATE TABLE public.workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  name text NOT NULL,
  color text NOT NULL DEFAULT 'gray',
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.workspace_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id)
);
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_workspace_members_user ON public.workspace_members(user_id);
CREATE INDEX idx_workspace_members_ws ON public.workspace_members(workspace_id);

CREATE TABLE public.workspace_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  module text NOT NULL,
  can_view boolean NOT NULL DEFAULT false,
  can_create boolean NOT NULL DEFAULT false,
  can_edit boolean NOT NULL DEFAULT false,
  can_delete boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id, module)
);
ALTER TABLE public.workspace_permissions ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_ws_perm_lookup ON public.workspace_permissions(workspace_id, user_id, module);

CREATE TABLE public.workspace_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  email text NOT NULL,
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  invited_by uuid NOT NULL,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, email)
);
ALTER TABLE public.workspace_invitations ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_ws_invite_email ON public.workspace_invitations(lower(email));

-- 2. HELPERS
CREATE OR REPLACE FUNCTION public.is_workspace_member(_ws uuid, _uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.workspace_members WHERE workspace_id = _ws AND user_id = _uid)
$$;

CREATE OR REPLACE FUNCTION public.is_workspace_owner(_ws uuid, _uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.workspaces WHERE id = _ws AND owner_id = _uid)
$$;

CREATE OR REPLACE FUNCTION public.has_workspace_permission(_ws uuid, _uid uuid, _module text, _action text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_owner boolean;
  v_row public.workspace_permissions%ROWTYPE;
BEGIN
  SELECT EXISTS (SELECT 1 FROM public.workspaces WHERE id = _ws AND owner_id = _uid) INTO v_owner;
  IF v_owner THEN RETURN true; END IF;
  SELECT * INTO v_row FROM public.workspace_permissions
    WHERE workspace_id = _ws AND user_id = _uid AND module = _module LIMIT 1;
  IF NOT FOUND THEN RETURN false; END IF;
  RETURN CASE _action
    WHEN 'view' THEN v_row.can_view
    WHEN 'create' THEN v_row.can_create
    WHEN 'edit' THEN v_row.can_edit
    WHEN 'delete' THEN v_row.can_delete
    ELSE false END;
END;
$$;

CREATE OR REPLACE FUNCTION public.add_workspace_owner_as_member()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'owner') ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_workspace_owner_member AFTER INSERT ON public.workspaces
FOR EACH ROW EXECUTE FUNCTION public.add_workspace_owner_as_member();
CREATE TRIGGER trg_workspaces_updated_at BEFORE UPDATE ON public.workspaces
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_ws_perm_updated_at BEFORE UPDATE ON public.workspace_permissions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. RLS WORKSPACE TABLES
CREATE POLICY "ws members can view" ON public.workspaces FOR SELECT
  USING (public.is_workspace_member(id, auth.uid()));
CREATE POLICY "any auth can create own ws" ON public.workspaces FOR INSERT
  WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "owner can update ws" ON public.workspaces FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "owner can delete ws" ON public.workspaces FOR DELETE USING (auth.uid() = owner_id);

CREATE POLICY "members visible to ws members" ON public.workspace_members FOR SELECT
  USING (public.is_workspace_member(workspace_id, auth.uid()));
CREATE POLICY "owner manages members insert" ON public.workspace_members FOR INSERT
  WITH CHECK (public.is_workspace_owner(workspace_id, auth.uid()));
CREATE POLICY "owner manages members delete" ON public.workspace_members FOR DELETE
  USING (public.is_workspace_owner(workspace_id, auth.uid()) AND role <> 'owner');
CREATE POLICY "owner manages members update" ON public.workspace_members FOR UPDATE
  USING (public.is_workspace_owner(workspace_id, auth.uid()));

CREATE POLICY "perms visible to ws members" ON public.workspace_permissions FOR SELECT
  USING (public.is_workspace_member(workspace_id, auth.uid()));
CREATE POLICY "owner manages perms insert" ON public.workspace_permissions FOR INSERT
  WITH CHECK (public.is_workspace_owner(workspace_id, auth.uid()));
CREATE POLICY "owner manages perms update" ON public.workspace_permissions FOR UPDATE
  USING (public.is_workspace_owner(workspace_id, auth.uid()));
CREATE POLICY "owner manages perms delete" ON public.workspace_permissions FOR DELETE
  USING (public.is_workspace_owner(workspace_id, auth.uid()));

CREATE POLICY "owner views invites" ON public.workspace_invitations FOR SELECT
  USING (public.is_workspace_owner(workspace_id, auth.uid()));
CREATE POLICY "owner creates invites" ON public.workspace_invitations FOR INSERT
  WITH CHECK (public.is_workspace_owner(workspace_id, auth.uid()));
CREATE POLICY "owner deletes invites" ON public.workspace_invitations FOR DELETE
  USING (public.is_workspace_owner(workspace_id, auth.uid()));

-- 4. ADD workspace_id
ALTER TABLE public.tasks ADD COLUMN workspace_id uuid;
ALTER TABLE public.subtasks ADD COLUMN workspace_id uuid;
ALTER TABLE public.schedule_items ADD COLUMN workspace_id uuid;
ALTER TABLE public.processes ADD COLUMN workspace_id uuid;
ALTER TABLE public.process_steps ADD COLUMN workspace_id uuid;
ALTER TABLE public.process_templates ADD COLUMN workspace_id uuid;
ALTER TABLE public.process_template_steps ADD COLUMN workspace_id uuid;
ALTER TABLE public.forms ADD COLUMN workspace_id uuid;
ALTER TABLE public.form_fields ADD COLUMN workspace_id uuid;
ALTER TABLE public.form_responses ADD COLUMN workspace_id uuid;
ALTER TABLE public.activity_logs ADD COLUMN workspace_id uuid;

-- 5. BACKFILL default workspace per user
DO $$
DECLARE v_user uuid; v_ws uuid;
BEGIN
  FOR v_user IN
    SELECT DISTINCT uid FROM (
      SELECT user_id AS uid FROM public.tasks
      UNION SELECT user_id FROM public.subtasks
      UNION SELECT user_id FROM public.schedule_items
      UNION SELECT user_id FROM public.processes
      UNION SELECT user_id FROM public.process_steps
      UNION SELECT user_id FROM public.process_templates
      UNION SELECT user_id FROM public.process_template_steps
      UNION SELECT user_id FROM public.forms
      UNION SELECT user_id FROM public.form_fields
      UNION SELECT owner_id FROM public.form_responses
      UNION SELECT user_id FROM public.activity_logs
    ) u WHERE uid IS NOT NULL
  LOOP
    INSERT INTO public.workspaces (owner_id, name, color)
    VALUES (v_user, 'Meu ambiente', 'blue') RETURNING id INTO v_ws;
    UPDATE public.tasks SET workspace_id = v_ws WHERE user_id = v_user AND workspace_id IS NULL;
    UPDATE public.subtasks SET workspace_id = v_ws WHERE user_id = v_user AND workspace_id IS NULL;
    UPDATE public.schedule_items SET workspace_id = v_ws WHERE user_id = v_user AND workspace_id IS NULL;
    UPDATE public.processes SET workspace_id = v_ws WHERE user_id = v_user AND workspace_id IS NULL;
    UPDATE public.process_steps SET workspace_id = v_ws WHERE user_id = v_user AND workspace_id IS NULL;
    UPDATE public.process_templates SET workspace_id = v_ws WHERE user_id = v_user AND workspace_id IS NULL;
    UPDATE public.process_template_steps SET workspace_id = v_ws WHERE user_id = v_user AND workspace_id IS NULL;
    UPDATE public.forms SET workspace_id = v_ws WHERE user_id = v_user AND workspace_id IS NULL;
    UPDATE public.form_fields SET workspace_id = v_ws WHERE user_id = v_user AND workspace_id IS NULL;
    UPDATE public.form_responses SET workspace_id = v_ws WHERE owner_id = v_user AND workspace_id IS NULL;
    UPDATE public.activity_logs SET workspace_id = v_ws WHERE user_id = v_user AND workspace_id IS NULL;
  END LOOP;
END $$;

-- 6. Make NOT NULL + index
ALTER TABLE public.tasks ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.subtasks ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.schedule_items ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.processes ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.process_steps ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.process_templates ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.process_template_steps ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.forms ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.form_fields ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.form_responses ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.activity_logs ALTER COLUMN workspace_id SET NOT NULL;

CREATE INDEX idx_tasks_ws ON public.tasks(workspace_id);
CREATE INDEX idx_subtasks_ws ON public.subtasks(workspace_id);
CREATE INDEX idx_sched_ws ON public.schedule_items(workspace_id);
CREATE INDEX idx_processes_ws ON public.processes(workspace_id);
CREATE INDEX idx_proc_steps_ws ON public.process_steps(workspace_id);
CREATE INDEX idx_proc_tmpl_ws ON public.process_templates(workspace_id);
CREATE INDEX idx_proc_tmpl_steps_ws ON public.process_template_steps(workspace_id);
CREATE INDEX idx_forms_ws ON public.forms(workspace_id);
CREATE INDEX idx_form_fields_ws ON public.form_fields(workspace_id);
CREATE INDEX idx_form_resp_ws ON public.form_responses(workspace_id);
CREATE INDEX idx_activity_logs_ws ON public.activity_logs(workspace_id);

-- 7. REPLACE RLS POLICIES on existing tables
-- tasks
DROP POLICY IF EXISTS "own tasks select" ON public.tasks;
DROP POLICY IF EXISTS "own tasks insert" ON public.tasks;
DROP POLICY IF EXISTS "own tasks update" ON public.tasks;
DROP POLICY IF EXISTS "own tasks delete" ON public.tasks;
CREATE POLICY "ws tasks select" ON public.tasks FOR SELECT
  USING (public.has_workspace_permission(workspace_id, auth.uid(), 'tarefas', 'view'));
CREATE POLICY "ws tasks insert" ON public.tasks FOR INSERT
  WITH CHECK (user_id = auth.uid() AND public.has_workspace_permission(workspace_id, auth.uid(), 'tarefas', 'create'));
CREATE POLICY "ws tasks update" ON public.tasks FOR UPDATE
  USING (public.has_workspace_permission(workspace_id, auth.uid(), 'tarefas', 'edit'));
CREATE POLICY "ws tasks delete" ON public.tasks FOR DELETE
  USING (public.has_workspace_permission(workspace_id, auth.uid(), 'tarefas', 'delete'));

-- subtasks (share tarefas module)
DROP POLICY IF EXISTS "own subtasks select" ON public.subtasks;
DROP POLICY IF EXISTS "own subtasks insert" ON public.subtasks;
DROP POLICY IF EXISTS "own subtasks update" ON public.subtasks;
DROP POLICY IF EXISTS "own subtasks delete" ON public.subtasks;
CREATE POLICY "ws subtasks select" ON public.subtasks FOR SELECT
  USING (public.has_workspace_permission(workspace_id, auth.uid(), 'tarefas', 'view'));
CREATE POLICY "ws subtasks insert" ON public.subtasks FOR INSERT
  WITH CHECK (user_id = auth.uid() AND public.has_workspace_permission(workspace_id, auth.uid(), 'tarefas', 'create'));
CREATE POLICY "ws subtasks update" ON public.subtasks FOR UPDATE
  USING (public.has_workspace_permission(workspace_id, auth.uid(), 'tarefas', 'edit'));
CREATE POLICY "ws subtasks delete" ON public.subtasks FOR DELETE
  USING (public.has_workspace_permission(workspace_id, auth.uid(), 'tarefas', 'delete'));

-- schedule_items
DROP POLICY IF EXISTS "own sched select" ON public.schedule_items;
DROP POLICY IF EXISTS "own sched insert" ON public.schedule_items;
DROP POLICY IF EXISTS "own sched update" ON public.schedule_items;
DROP POLICY IF EXISTS "own sched delete" ON public.schedule_items;
CREATE POLICY "ws sched select" ON public.schedule_items FOR SELECT
  USING (public.has_workspace_permission(workspace_id, auth.uid(), 'cronograma', 'view'));
CREATE POLICY "ws sched insert" ON public.schedule_items FOR INSERT
  WITH CHECK (user_id = auth.uid() AND public.has_workspace_permission(workspace_id, auth.uid(), 'cronograma', 'create'));
CREATE POLICY "ws sched update" ON public.schedule_items FOR UPDATE
  USING (public.has_workspace_permission(workspace_id, auth.uid(), 'cronograma', 'edit'));
CREATE POLICY "ws sched delete" ON public.schedule_items FOR DELETE
  USING (public.has_workspace_permission(workspace_id, auth.uid(), 'cronograma', 'delete'));

-- processes
DROP POLICY IF EXISTS "own processes select" ON public.processes;
DROP POLICY IF EXISTS "own processes insert" ON public.processes;
DROP POLICY IF EXISTS "own processes update" ON public.processes;
DROP POLICY IF EXISTS "own processes delete" ON public.processes;
CREATE POLICY "ws processes select" ON public.processes FOR SELECT
  USING (public.has_workspace_permission(workspace_id, auth.uid(), 'processos', 'view'));
CREATE POLICY "ws processes insert" ON public.processes FOR INSERT
  WITH CHECK (user_id = auth.uid() AND public.has_workspace_permission(workspace_id, auth.uid(), 'processos', 'create'));
CREATE POLICY "ws processes update" ON public.processes FOR UPDATE
  USING (public.has_workspace_permission(workspace_id, auth.uid(), 'processos', 'edit'));
CREATE POLICY "ws processes delete" ON public.processes FOR DELETE
  USING (public.has_workspace_permission(workspace_id, auth.uid(), 'processos', 'delete'));

-- process_steps
DROP POLICY IF EXISTS "own proc steps select" ON public.process_steps;
DROP POLICY IF EXISTS "own proc steps insert" ON public.process_steps;
DROP POLICY IF EXISTS "own proc steps update" ON public.process_steps;
DROP POLICY IF EXISTS "own proc steps delete" ON public.process_steps;
CREATE POLICY "ws proc steps select" ON public.process_steps FOR SELECT
  USING (public.has_workspace_permission(workspace_id, auth.uid(), 'processos', 'view'));
CREATE POLICY "ws proc steps insert" ON public.process_steps FOR INSERT
  WITH CHECK (user_id = auth.uid() AND public.has_workspace_permission(workspace_id, auth.uid(), 'processos', 'create'));
CREATE POLICY "ws proc steps update" ON public.process_steps FOR UPDATE
  USING (public.has_workspace_permission(workspace_id, auth.uid(), 'processos', 'edit'));
CREATE POLICY "ws proc steps delete" ON public.process_steps FOR DELETE
  USING (public.has_workspace_permission(workspace_id, auth.uid(), 'processos', 'delete'));

-- process_templates
DROP POLICY IF EXISTS "own templates select" ON public.process_templates;
DROP POLICY IF EXISTS "own templates insert" ON public.process_templates;
DROP POLICY IF EXISTS "own templates update" ON public.process_templates;
DROP POLICY IF EXISTS "own templates delete" ON public.process_templates;
CREATE POLICY "ws templates select" ON public.process_templates FOR SELECT
  USING (public.has_workspace_permission(workspace_id, auth.uid(), 'processos', 'view'));
CREATE POLICY "ws templates insert" ON public.process_templates FOR INSERT
  WITH CHECK (user_id = auth.uid() AND public.has_workspace_permission(workspace_id, auth.uid(), 'processos', 'create'));
CREATE POLICY "ws templates update" ON public.process_templates FOR UPDATE
  USING (public.has_workspace_permission(workspace_id, auth.uid(), 'processos', 'edit'));
CREATE POLICY "ws templates delete" ON public.process_templates FOR DELETE
  USING (public.has_workspace_permission(workspace_id, auth.uid(), 'processos', 'delete'));

-- process_template_steps
DROP POLICY IF EXISTS "own tmpl steps select" ON public.process_template_steps;
DROP POLICY IF EXISTS "own tmpl steps insert" ON public.process_template_steps;
DROP POLICY IF EXISTS "own tmpl steps update" ON public.process_template_steps;
DROP POLICY IF EXISTS "own tmpl steps delete" ON public.process_template_steps;
CREATE POLICY "ws tmpl steps select" ON public.process_template_steps FOR SELECT
  USING (public.has_workspace_permission(workspace_id, auth.uid(), 'processos', 'view'));
CREATE POLICY "ws tmpl steps insert" ON public.process_template_steps FOR INSERT
  WITH CHECK (user_id = auth.uid() AND public.has_workspace_permission(workspace_id, auth.uid(), 'processos', 'create'));
CREATE POLICY "ws tmpl steps update" ON public.process_template_steps FOR UPDATE
  USING (public.has_workspace_permission(workspace_id, auth.uid(), 'processos', 'edit'));
CREATE POLICY "ws tmpl steps delete" ON public.process_template_steps FOR DELETE
  USING (public.has_workspace_permission(workspace_id, auth.uid(), 'processos', 'delete'));

-- forms (keep public read of published)
DROP POLICY IF EXISTS "own forms all" ON public.forms;
CREATE POLICY "ws forms select" ON public.forms FOR SELECT
  USING (public.has_workspace_permission(workspace_id, auth.uid(), 'formularios', 'view'));
CREATE POLICY "ws forms insert" ON public.forms FOR INSERT
  WITH CHECK (user_id = auth.uid() AND public.has_workspace_permission(workspace_id, auth.uid(), 'formularios', 'create'));
CREATE POLICY "ws forms update" ON public.forms FOR UPDATE
  USING (public.has_workspace_permission(workspace_id, auth.uid(), 'formularios', 'edit'));
CREATE POLICY "ws forms delete" ON public.forms FOR DELETE
  USING (public.has_workspace_permission(workspace_id, auth.uid(), 'formularios', 'delete'));

-- form_fields
DROP POLICY IF EXISTS "own fields all" ON public.form_fields;
CREATE POLICY "ws fields select" ON public.form_fields FOR SELECT
  USING (public.has_workspace_permission(workspace_id, auth.uid(), 'formularios', 'view'));
CREATE POLICY "ws fields insert" ON public.form_fields FOR INSERT
  WITH CHECK (user_id = auth.uid() AND public.has_workspace_permission(workspace_id, auth.uid(), 'formularios', 'create'));
CREATE POLICY "ws fields update" ON public.form_fields FOR UPDATE
  USING (public.has_workspace_permission(workspace_id, auth.uid(), 'formularios', 'edit'));
CREATE POLICY "ws fields delete" ON public.form_fields FOR DELETE
  USING (public.has_workspace_permission(workspace_id, auth.uid(), 'formularios', 'delete'));

-- form_responses
DROP POLICY IF EXISTS "owner responses select" ON public.form_responses;
DROP POLICY IF EXISTS "owner responses update" ON public.form_responses;
DROP POLICY IF EXISTS "owner responses delete" ON public.form_responses;
CREATE POLICY "ws responses select" ON public.form_responses FOR SELECT
  USING (public.has_workspace_permission(workspace_id, auth.uid(), 'solicitacoes', 'view'));
CREATE POLICY "ws responses update" ON public.form_responses FOR UPDATE
  USING (public.has_workspace_permission(workspace_id, auth.uid(), 'solicitacoes', 'edit'));
CREATE POLICY "ws responses delete" ON public.form_responses FOR DELETE
  USING (public.has_workspace_permission(workspace_id, auth.uid(), 'solicitacoes', 'delete'));
-- public submit policy: also enforces workspace_id matches form
DROP POLICY IF EXISTS "public submit response" ON public.form_responses;
CREATE POLICY "public submit response" ON public.form_responses FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.forms f
    WHERE f.id = form_responses.form_id
      AND f.is_published = true
      AND f.user_id = form_responses.owner_id
      AND f.workspace_id = form_responses.workspace_id
  ));

-- activity_logs
DROP POLICY IF EXISTS "own logs select" ON public.activity_logs;
DROP POLICY IF EXISTS "own logs insert" ON public.activity_logs;
CREATE POLICY "ws logs select" ON public.activity_logs FOR SELECT
  USING (public.is_workspace_member(workspace_id, auth.uid()));
CREATE POLICY "ws logs insert" ON public.activity_logs FOR INSERT
  WITH CHECK (user_id = auth.uid() AND public.is_workspace_member(workspace_id, auth.uid()));
