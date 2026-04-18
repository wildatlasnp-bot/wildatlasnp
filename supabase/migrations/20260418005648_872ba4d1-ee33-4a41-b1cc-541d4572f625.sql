-- Drop the overly broad SELECT policy that allowed anonymous clients to call
-- the Storage list API and enumerate every file in email-assets.
-- Direct fetches via /storage/v1/object/public/email-assets/<key> still work
-- because the bucket itself is marked public — those don't require a policy
-- on storage.objects.
DROP POLICY IF EXISTS "Public read access on email-assets" ON storage.objects;