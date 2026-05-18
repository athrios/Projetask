DROP POLICY IF EXISTS "any auth can create own ws" ON public.workspaces;
CREATE POLICY "any auth can create own ws"
ON public.workspaces
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = owner_id);