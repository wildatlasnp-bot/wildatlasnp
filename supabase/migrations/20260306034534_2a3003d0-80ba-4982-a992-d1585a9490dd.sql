CREATE INDEX IF NOT EXISTS idx_active_watches_user_id ON public.active_watches (user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles (user_id);
CREATE INDEX IF NOT EXISTS idx_permit_cache_cache_key ON public.permit_cache (cache_key);