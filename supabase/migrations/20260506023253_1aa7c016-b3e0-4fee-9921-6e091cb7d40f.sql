ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pendente';
UPDATE public.tasks SET status = CASE WHEN done THEN 'feita' ELSE 'pendente' END;
ALTER TABLE public.tasks ADD CONSTRAINT tasks_status_check CHECK (status IN ('pendente','fazendo','feita'));