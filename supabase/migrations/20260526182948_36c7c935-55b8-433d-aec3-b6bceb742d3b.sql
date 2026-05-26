ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS shared_modules text[] NOT NULL DEFAULT '{}';