
-- 1. Add due_time to tasks
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS due_time time;

-- 2. task_reminders table
CREATE TABLE IF NOT EXISTS public.task_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  offset_value integer NOT NULL DEFAULT 0,
  offset_unit text NOT NULL DEFAULT 'minutes',
  reminder_at timestamptz NOT NULL,
  notify_in_app boolean NOT NULL DEFAULT true,
  notify_email boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending',
  email_sent_at timestamptz,
  in_app_created_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_task_reminders_due ON public.task_reminders(status, reminder_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_task_reminders_task ON public.task_reminders(task_id);

ALTER TABLE public.task_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ws reminders select" ON public.task_reminders
  FOR SELECT USING (public.has_workspace_permission(workspace_id, auth.uid(), 'tarefas', 'view'));
CREATE POLICY "ws reminders insert" ON public.task_reminders
  FOR INSERT WITH CHECK (user_id = auth.uid() AND public.has_workspace_permission(workspace_id, auth.uid(), 'tarefas', 'edit'));
CREATE POLICY "ws reminders update" ON public.task_reminders
  FOR UPDATE USING (public.has_workspace_permission(workspace_id, auth.uid(), 'tarefas', 'edit'));
CREATE POLICY "ws reminders delete" ON public.task_reminders
  FOR DELETE USING (public.has_workspace_permission(workspace_id, auth.uid(), 'tarefas', 'edit'));

CREATE OR REPLACE FUNCTION public.validate_reminder()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.offset_unit NOT IN ('minutes','hours','days') THEN
    RAISE EXCEPTION 'invalid offset_unit: %', NEW.offset_unit;
  END IF;
  IF NEW.status NOT IN ('pending','sent','cancelled') THEN
    RAISE EXCEPTION 'invalid reminder status: %', NEW.status;
  END IF;
  IF NEW.offset_value < 0 THEN
    RAISE EXCEPTION 'offset_value must be >= 0';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_validate_reminder ON public.task_reminders;
CREATE TRIGGER trg_validate_reminder BEFORE INSERT OR UPDATE ON public.task_reminders
  FOR EACH ROW EXECUTE FUNCTION public.validate_reminder();

DROP TRIGGER IF EXISTS trg_reminders_updated_at ON public.task_reminders;
CREATE TRIGGER trg_reminders_updated_at BEFORE UPDATE ON public.task_reminders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  user_id uuid NOT NULL,
  task_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL DEFAULT '',
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id, created_at DESC) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_user_ws ON public.notifications(user_id, workspace_id, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own notifications select" ON public.notifications
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "own notifications update" ON public.notifications
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own notifications delete" ON public.notifications
  FOR DELETE USING (user_id = auth.uid());
CREATE POLICY "service role inserts notifications" ON public.notifications
  FOR INSERT WITH CHECK (auth.role() = 'service_role' OR user_id = auth.uid());

-- 4. Cancel reminders when task is completed/cancelled
CREATE OR REPLACE FUNCTION public.cancel_reminders_on_task_finish()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IN ('feita','cancelado') AND OLD.status IS DISTINCT FROM NEW.status THEN
    UPDATE public.task_reminders SET status = 'cancelled'
      WHERE task_id = NEW.id AND status = 'pending';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_cancel_reminders ON public.tasks;
CREATE TRIGGER trg_cancel_reminders AFTER UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.cancel_reminders_on_task_finish();

-- 5. Cron job to process reminders every minute
DO $$
DECLARE
  v_key_id uuid;
  v_url text := 'https://zhkkncubaqhghiljztaa.supabase.co/functions/v1/process-task-reminders';
BEGIN
  -- find existing vault secret
  SELECT id INTO v_key_id FROM vault.secrets WHERE name = 'email_queue_service_role_key' LIMIT 1;
  IF v_key_id IS NULL THEN
    RAISE NOTICE 'vault secret email_queue_service_role_key not found; cron job not scheduled';
    RETURN;
  END IF;

  -- unschedule existing job if any
  PERFORM cron.unschedule('process-task-reminders')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-task-reminders');

  PERFORM cron.schedule(
    'process-task-reminders',
    '* * * * *',
    format($cmd$
      SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key' LIMIT 1)
        ),
        body := '{}'::jsonb
      );
    $cmd$, v_url)
  );
END $$;
