DROP POLICY IF EXISTS "ws members can view" ON public.workspaces;
CREATE POLICY "owner or member can view ws"
ON public.workspaces
FOR SELECT
TO authenticated
USING (auth.uid() = owner_id OR public.is_workspace_member(id, auth.uid()));