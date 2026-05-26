CREATE TABLE public.client_settings (
  workspace_id uuid PRIMARY KEY,
  field_order jsonb NOT NULL DEFAULT '[]'::jsonb,
  hidden_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  extra_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.client_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ws client_settings select"
ON public.client_settings FOR SELECT
USING (has_workspace_permission(workspace_id, auth.uid(), 'clientes', 'view'));

CREATE POLICY "ws client_settings insert"
ON public.client_settings FOR INSERT
WITH CHECK (has_workspace_permission(workspace_id, auth.uid(), 'clientes', 'edit'));

CREATE POLICY "ws client_settings update"
ON public.client_settings FOR UPDATE
USING (has_workspace_permission(workspace_id, auth.uid(), 'clientes', 'edit'));

CREATE TRIGGER trg_client_settings_updated_at
BEFORE UPDATE ON public.client_settings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();