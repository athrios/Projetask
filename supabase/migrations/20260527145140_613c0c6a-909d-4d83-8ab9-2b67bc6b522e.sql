-- 1) form-logos: explicit public SELECT policy (bucket is public, logos shown on public forms)
DROP POLICY IF EXISTS "form-logos public read" ON storage.objects;
CREATE POLICY "form-logos public read"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (bucket_id = 'form-logos');

-- 2) realtime.messages: scope to workspace membership or personal user channel
-- Topic patterns used by the app:
--   schedule-tasks-{workspaceId}-{date}
--   notif-{user_id}-{workspaceId}
DROP POLICY IF EXISTS "Authenticated users can receive broadcasts" ON realtime.messages;
DROP POLICY IF EXISTS "Allow authenticated subscribe to messages" ON realtime.messages;
DROP POLICY IF EXISTS "ws scoped realtime read" ON realtime.messages;
DROP POLICY IF EXISTS "ws scoped realtime send" ON realtime.messages;

CREATE POLICY "ws scoped realtime read"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() LIKE '%' || auth.uid()::text || '%'
  OR EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.user_id = auth.uid()
      AND realtime.topic() LIKE '%' || wm.workspace_id::text || '%'
  )
);

CREATE POLICY "ws scoped realtime send"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  realtime.topic() LIKE '%' || auth.uid()::text || '%'
  OR EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.user_id = auth.uid()
      AND realtime.topic() LIKE '%' || wm.workspace_id::text || '%'
  )
);