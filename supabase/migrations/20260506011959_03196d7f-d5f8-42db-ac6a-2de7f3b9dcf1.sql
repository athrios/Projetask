
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  done BOOLEAN NOT NULL DEFAULT false,
  task_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own tasks select" ON public.tasks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own tasks insert" ON public.tasks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own tasks update" ON public.tasks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own tasks delete" ON public.tasks FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX tasks_user_date_idx ON public.tasks(user_id, task_date);

CREATE TABLE public.schedule_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_date DATE NOT NULL DEFAULT CURRENT_DATE,
  start_time TIME NOT NULL,
  title TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 15,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.schedule_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own sched select" ON public.schedule_items FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own sched insert" ON public.schedule_items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own sched update" ON public.schedule_items FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own sched delete" ON public.schedule_items FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX sched_user_date_idx ON public.schedule_items(user_id, task_date, position);
