
DROP POLICY IF EXISTS "form-uploads public insert" ON storage.objects;

CREATE POLICY "form-uploads public insert"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'form-uploads'
  AND EXISTS (
    SELECT 1 FROM public.forms f
    WHERE f.id::text = (storage.foldername(objects.name))[1]
      AND f.is_published = true
  )
);

-- Update owner-side policies to still grant the form owner access using forms.user_id lookup.
DROP POLICY IF EXISTS "form-uploads owner read" ON storage.objects;
DROP POLICY IF EXISTS "form-uploads owner delete" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own form uploads" ON storage.objects;

CREATE POLICY "form-uploads owner read"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'form-uploads'
  AND EXISTS (
    SELECT 1 FROM public.forms f
    WHERE f.id::text = (storage.foldername(objects.name))[1]
      AND f.user_id = auth.uid()
  )
);

CREATE POLICY "form-uploads owner delete"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'form-uploads'
  AND EXISTS (
    SELECT 1 FROM public.forms f
    WHERE f.id::text = (storage.foldername(objects.name))[1]
      AND f.user_id = auth.uid()
  )
);

CREATE POLICY "form-uploads owner update"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'form-uploads'
  AND EXISTS (
    SELECT 1 FROM public.forms f
    WHERE f.id::text = (storage.foldername(objects.name))[1]
      AND f.user_id = auth.uid()
  )
)
WITH CHECK (
  bucket_id = 'form-uploads'
  AND EXISTS (
    SELECT 1 FROM public.forms f
    WHERE f.id::text = (storage.foldername(objects.name))[1]
      AND f.user_id = auth.uid()
  )
);
