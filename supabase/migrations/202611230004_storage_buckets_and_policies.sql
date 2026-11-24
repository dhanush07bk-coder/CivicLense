-- ============================================================================
-- Civilense Phase 2 Migration 0004: Supabase Storage Buckets & Access Policies
-- ============================================================================
-- Buckets:
--   1. civic-issue-images    (public read of submitted issue photos, 2 MB limit, JPEG/PNG/WebP)
--   2. initiative-images     (public read of initiative banners, coordinator upload, 2 MB limit)
--   3. intervention-evidence (PRIVATE bucket: unapproved/pending evidence restricted to
--                             coordinators & uploader; approved evidence resolved via signed URL)
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  (
    'civic-issue-images',
    'civic-issue-images',
    true,
    2097152,
    ARRAY['image/jpeg', 'image/png', 'image/webp']
  ),
  (
    'initiative-images',
    'initiative-images',
    true,
    2097152,
    ARRAY['image/jpeg', 'image/png', 'image/webp']
  ),
  (
    'intervention-evidence',
    'intervention-evidence',
    false,
    2097152,
    ARRAY['image/jpeg', 'image/png', 'image/webp']
  )
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 1. civic-issue-images policies
DROP POLICY IF EXISTS "Public read civic-issue-images" ON storage.objects;
CREATE POLICY "Public read civic-issue-images"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'civic-issue-images');

DROP POLICY IF EXISTS "Upload civic-issue-images with valid path and image extension" ON storage.objects;
CREATE POLICY "Upload civic-issue-images with valid path and image extension"
  ON storage.objects FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    bucket_id = 'civic-issue-images'
    AND name ~ '^reports/[0-9]{4}/[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp)$'
  );

DROP POLICY IF EXISTS "Coordinator or owner delete civic-issue-images" ON storage.objects;
CREATE POLICY "Coordinator or owner delete civic-issue-images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'civic-issue-images'
    AND (public.is_coordinator() OR owner = auth.uid())
  );

-- 2. initiative-images policies (Coordinator managed)
DROP POLICY IF EXISTS "Public read initiative-images" ON storage.objects;
CREATE POLICY "Public read initiative-images"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'initiative-images');

DROP POLICY IF EXISTS "Coordinators upload initiative-images" ON storage.objects;
CREATE POLICY "Coordinators upload initiative-images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'initiative-images'
    AND public.is_coordinator()
    AND name ~ '^initiatives/[0-9]{4}/[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp)$'
  );

DROP POLICY IF EXISTS "Coordinators update or delete initiative-images" ON storage.objects;
CREATE POLICY "Coordinators update or delete initiative-images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'initiative-images'
    AND public.is_coordinator()
  );

-- 3. intervention-evidence policies (Private bucket — non-public access)
DROP POLICY IF EXISTS "Authorized read intervention-evidence" ON storage.objects;
CREATE POLICY "Authorized read intervention-evidence"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (
    bucket_id = 'intervention-evidence'
    AND (
      public.is_coordinator()
      OR (auth.uid() IS NOT NULL AND owner = auth.uid())
      OR EXISTS (
        SELECT 1
        FROM public.intervention_evidence ie
        WHERE ie.image_path = name
          AND ie.verification_status = 'Approved'
      )
    )
  );

DROP POLICY IF EXISTS "Coordinators upload intervention-evidence" ON storage.objects;
CREATE POLICY "Coordinators upload intervention-evidence"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'intervention-evidence'
    AND public.is_coordinator()
    AND name ~ '^evidence/[0-9]{4}/[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp)$'
  );

DROP POLICY IF EXISTS "Coordinators delete intervention-evidence" ON storage.objects;
CREATE POLICY "Coordinators delete intervention-evidence"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'intervention-evidence'
    AND public.is_coordinator()
  );
