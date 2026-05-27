ALTER TABLE public.schedule_items
  ADD COLUMN IF NOT EXISTS note text NOT NULL DEFAULT '';