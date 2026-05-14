-- Simplify process status to 4 values, add step lifecycle timestamps

-- 1) Migrate any existing legacy statuses to new vocabulary
UPDATE public.processes
SET status = 'em_andamento'
WHERE status IN ('aguardando_cliente','aguardando_orgao','em_exigencia');

-- 2) Update validation function for process status
CREATE OR REPLACE FUNCTION public.validate_process_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status NOT IN ('nao_iniciado','em_andamento','concluido','cancelado') THEN
    RAISE EXCEPTION 'invalid process status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$function$;

-- 3) Add lifecycle timestamps to process_steps (idempotent)
ALTER TABLE public.process_steps
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS dismissed_at timestamptz;
