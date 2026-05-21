-- Restrict workspace-member policies to authenticated; anon uses dedicated public policies on the views
DROP POLICY IF EXISTS "ws forms select" ON public.forms;
CREATE POLICY "ws forms select" ON public.forms
  FOR SELECT TO authenticated
  USING (has_workspace_permission(workspace_id, auth.uid(), 'formularios'::text, 'view'::text));

DROP POLICY IF EXISTS "ws fields select" ON public.form_fields;
CREATE POLICY "ws fields select" ON public.form_fields
  FOR SELECT TO authenticated
  USING (has_workspace_permission(workspace_id, auth.uid(), 'formularios'::text, 'view'::text));

-- Move "Registro" form to DP workspace
UPDATE public.forms
SET workspace_id = '12ff439f-d99c-4ad7-a720-e01a5f69c669'
WHERE id = 'b8f679b2-47ca-4c60-979b-51bc411a1356';

UPDATE public.form_fields
SET workspace_id = '12ff439f-d99c-4ad7-a720-e01a5f69c669'
WHERE form_id = 'b8f679b2-47ca-4c60-979b-51bc411a1356';

UPDATE public.form_responses
SET workspace_id = '12ff439f-d99c-4ad7-a720-e01a5f69c669'
WHERE form_id = 'b8f679b2-47ca-4c60-979b-51bc411a1356';