
-- Add api_type column to distinguish between different Recreation.gov API endpoint formats
ALTER TABLE public.park_permits ADD COLUMN api_type text NOT NULL DEFAULT 'standard';
-- standard = /api/permits/{id}/availability/month
-- permitinyo = /api/permitinyo/{id}/availability
