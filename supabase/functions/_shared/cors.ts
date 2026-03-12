/**
 * Shared CORS helper for all edge functions.
 * Only accepts requests from explicitly allowlisted origins.
 * Fail-closed: unknown origins do not have their value reflected back.
 */

const ALLOWED_ORIGINS = new Set([
  "https://wildatlas.app",           // production
  "https://wildatlasnp.lovable.app", // Lovable preview
  "http://localhost:5173",           // local dev
]);

const isAllowedOrigin = (origin: string): boolean => {
  return ALLOWED_ORIGINS.has(origin);
};

const DEFAULT_ORIGIN = "https://wildatlasnp.lovable.app";

export const CORS_HEADERS = "authorization, x-client-info, apikey, content-type, x-lovable-signature, x-lovable-timestamp, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version";

export const corsHeaders = (req: Request) => {
  const origin = req.headers.get("origin") ?? "";
  return {
    "Access-Control-Allow-Origin": isAllowedOrigin(origin) ? origin : DEFAULT_ORIGIN,
    "Access-Control-Allow-Headers": CORS_HEADERS,
  };
};

/** Static CORS headers for internal/cron functions (no dynamic origin needed) */
export const staticCorsHeaders = {
  "Access-Control-Allow-Origin": DEFAULT_ORIGIN,
  "Access-Control-Allow-Headers": CORS_HEADERS,
};
