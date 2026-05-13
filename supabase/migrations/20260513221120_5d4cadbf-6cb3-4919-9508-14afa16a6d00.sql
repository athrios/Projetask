-- TASKS: recurrence + source tracking
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS is_recurring boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recurrence_type text,
  ADD COLUMN IF NOT EXISTS recurrence_interval integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS recurrence_end_date date,
  ADD COLUMN IF NOT EXISTS parent_recurring_task_id uuid,
  ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS source_id uuid;

-- Validation trigger for recurrence + source
CREATE OR REPLACE FUNCTION public.validate_task_recurrence()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.recurrence_type IS NOT NULL AND NEW.recurrence_type NOT IN ('daily','weekly','monthly') THEN
    RAISE EXCEPTION 'invalid recurrence_type: %', NEW.recurrence_type;
  END IF;
  IF NEW.source_type NOT IN ('manual','request','process') THEN
    RAISE EXCEPTION 'invalid source_type: %', NEW.source_type;
  END IF;
  IF NEW.recurrence_interval < 1 THEN
    RAISE EXCEPTION 'recurrence_interval must be >= 1';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_task_recurrence_trigger ON public.tasks;
CREATE TRIGGER validate_task_recurrence_trigger
  BEFORE INSERT OR UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.validate_task_recurrence();

-- PROCESS TEMPLATE STEPS: due offset
ALTER TABLE public.process_template_steps
  ADD COLUMN IF NOT EXISTS due_offset_days integer NOT NULL DEFAULT 0;

-- PROCESS STEPS: due_date
ALTER TABLE public.process_steps
  ADD COLUMN IF NOT EXISTS due_date date;

-- ACTIVITY LOGS
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  action text NOT NULL,
  description text NOT NULL DEFAULT '',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own logs select" ON public.activity_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "own logs insert" ON public.activity_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS activity_logs_user_created_idx
  ON public.activity_logs (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS activity_logs_entity_idx
  ON public.activity_logs (entity_type, entity_id);
