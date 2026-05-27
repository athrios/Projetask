### Security Fix: Add missing UPDATE policy on storage client-attachments bucket

**What:**
Create a migration that adds the missing `UPDATE` policy for the `client-attachments` storage bucket.

**Why:**
The original migration created SELECT, INSERT and DELETE policies for `client-attachments` but omitted UPDATE. Without this policy, workspace members cannot modify files they have edit permission for, and the security scanner flagged it as a gap.

**How:**
Run the provided SQL via the migration tool. The policy checks:
- `bucket_id = 'client-attachments'`
- The user has `edit` permission on the `clientes` module for the workspace extracted from the first path segment (`storage.foldername(name))[1]`)

**SQL to run:**
```sql
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
```