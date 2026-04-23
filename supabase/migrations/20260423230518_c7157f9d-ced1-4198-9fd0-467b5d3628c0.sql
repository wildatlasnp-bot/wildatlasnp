-- The 'email-assets' bucket has public = true, which serves files via the
-- public CDN URL without needing an RLS SELECT policy match. The broad SELECT
-- policy we added previously enables the list endpoint, which lets anonymous
-- clients enumerate filenames in the bucket. Remove it — direct URL access
-- still works via the public bucket flag.

DROP POLICY IF EXISTS "Public read access for email-assets" ON storage.objects;
