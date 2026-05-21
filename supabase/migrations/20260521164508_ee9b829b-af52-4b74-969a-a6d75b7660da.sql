-- 1. Relax validation trigger: allow any non-empty status text
CREATE OR REPLACE FUNCTION public.validate_process_step_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status IS NULL OR length(trim(NEW.status)) = 0 THEN
    RAISE EXCEPTION 'invalid step status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$function$;

-- 2. Custom statuses table (per workspace)
CREATE TABLE public.process_step_custom_statuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  user_id uuid NOT NULL,
  label text NOT NULL,
  color text NOT NULL DEFAULT 'gray',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, label)
);

ALTER TABLE public.process_step_custom_statuses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ws custom step status select"
  ON public.process_step_custom_statuses FOR SELECT
  USING (has_workspace_permission(workspace_id, auth.uid(), 'processos', 'view'));

CREATE POLICY "ws custom step status insert"
  ON public.process_step_custom_statuses FOR INSERT
  WITH CHECK (user_id = auth.uid() AND has_workspace_permission(workspace_id, auth.uid(), 'processos', 'create'));

CREATE POLICY "ws custom step status update"
  ON public.process_step_custom_statuses FOR UPDATE
  USING (has_workspace_permission(workspace_id, auth.uid(), 'processos', 'edit'));

CREATE POLICY "ws custom step status delete"
  ON public.process_step_custom_statuses FOR DELETE
  USING (has_workspace_permission(workspace_id, auth.uid(), 'processos', 'delete'));