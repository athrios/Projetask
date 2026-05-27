DROP POLICY IF EXISTS "client-attachments update" ON storage.objects;

CREATE POLICY "client-attachments update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'client-attachments'
  AND has_workspace_permission(
        ((storage.foldername(name))[1])::uuid,
        auth.uid(),
        'clientes',
        'edit'
      )
)
WITH CHECK (
  bucket_id = 'client-attachments'
  AND has_workspace_permission(
        ((storage.foldername(name))[1])::uuid,
        auth.uid(),
        'clientes',
        'edit'
      )
);