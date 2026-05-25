
CREATE TABLE IF NOT EXISTS public.cnpj_lookup_cache (
  cnpj text PRIMARY KEY,
  provider text NOT NULL,
  data jsonb NOT NULL,
  raw jsonb NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cnpj_lookup_cache_fetched_at
  ON public.cnpj_lookup_cache (fetched_at);

ALTER TABLE public.cnpj_lookup_cache ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.cnpj_lookup_cache IS
  'Cache de consultas de CNPJ. Acesso apenas via edge function usando service role. Sem políticas RLS para usuários autenticados/anônimos por design.';
