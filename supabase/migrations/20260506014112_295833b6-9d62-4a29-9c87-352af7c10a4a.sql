CREATE TABLE public.subtasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  done BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.subtasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own subtasks select" ON public.subtasks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own subtasks insert" ON public.subtasks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own subtasks update" ON public.subtasks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own subtasks delete" ON public.subtasks FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_subtasks_task_id ON public.subtasks(task_id);