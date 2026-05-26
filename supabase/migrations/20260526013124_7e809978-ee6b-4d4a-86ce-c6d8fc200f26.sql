
-- Clients table
CREATE TABLE public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  user_id uuid NOT NULL,
  client_type text NOT NULL DEFAULT 'pessoa_fisica',
  document text NOT NULL DEFAULT '',
  name text NOT NULL,
  trade_name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  address jsonb NOT NULL DEFAULT '{}'::jsonb,
  cnpj_lookup_snapshot jsonb,
  notes text NOT NULL DEFAULT '',
  custom_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_clients_workspace ON public.clients(workspace_id);
CREATE INDEX idx_clients_workspace_name ON public.clients(workspace_id, name);
CREATE INDEX idx_clients_workspace_document ON public.clients(workspace_id, document);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ws clients select" ON public.clients FOR SELECT
  USING (has_workspace_permission(workspace_id, auth.uid(), 'clientes', 'view'));
CREATE POLICY "ws clients insert" ON public.clients FOR INSERT
  WITH CHECK (user_id = auth.uid() AND has_workspace_permission(workspace_id, auth.uid(), 'clientes', 'create'));
CREATE POLICY "ws clients update" ON public.clients FOR UPDATE
  USING (has_workspace_permission(workspace_id, auth.uid(), 'clientes', 'edit'));
CREATE POLICY "ws clients delete" ON public.clients FOR DELETE
  USING (has_workspace_permission(workspace_id, auth.uid(), 'clientes', 'delete'));

CREATE OR REPLACE FUNCTION public.validate_client_type()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.client_type NOT IN ('pessoa_fisica','pessoa_juridica','estrangeiro') THEN
    RAISE EXCEPTION 'invalid client_type: %', NEW.client_type;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_clients_validate_type
  BEFORE INSERT OR UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.validate_client_type();

CREATE TRIGGER trg_clients_set_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_clients_autofill_ws
  BEFORE INSERT ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.autofill_workspace_id();

-- Client attachments
CREATE TABLE public.client_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL,
  user_id uuid NOT NULL,
  file_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text NOT NULL DEFAULT '',
  size_bytes bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_client_attachments_client ON public.client_attachments(client_id);
CREATE INDEX idx_client_attachments_workspace ON public.client_attachments(workspace_id);

ALTER TABLE public.client_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ws client_attachments select" ON public.client_attachments FOR SELECT
  USING (has_workspace_permission(workspace_id, auth.uid(), 'clientes', 'view'));
CREATE POLICY "ws client_attachments insert" ON public.client_attachments FOR INSERT
  WITH CHECK (user_id = auth.uid() AND has_workspace_permission(workspace_id, auth.uid(), 'clientes', 'edit'));
CREATE POLICY "ws client_attachments delete" ON public.client_attachments FOR DELETE
  USING (has_workspace_permission(workspace_id, auth.uid(), 'clientes', 'edit'));

-- Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('client-attachments', 'client-attachments', false)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "client-attachments select" ON storage.objects FOR SELECT
  USING (
    bucket_id = 'client-attachments'
    AND is_workspace_member(((storage.foldername(name))[1])::uuid, auth.uid())
  );
CREATE POLICY "client-attachments insert" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'client-attachments'
    AND auth.uid() IS NOT NULL
    AND has_workspace_permission(((storage.foldername(name))[1])::uuid, auth.uid(), 'clientes', 'edit')
  );
CREATE POLICY "client-attachments delete" ON storage.objects FOR DELETE
  USING (
    bucket_id = 'client-attachments'
    AND has_workspace_permission(((storage.foldername(name))[1])::uuid, auth.uid(), 'clientes', 'edit')
  );
