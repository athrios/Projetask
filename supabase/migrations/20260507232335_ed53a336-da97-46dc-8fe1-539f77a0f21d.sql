ALTER TABLE public.schedule_items ADD COLUMN task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_schedule_items_task_id ON public.schedule_items(task_id);