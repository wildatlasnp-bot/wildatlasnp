/**
 * Shared CORS helper for all edge functions.
 * Only accepts requests from explicitly allowlisted origins.
 * Fail-closed: unknown origins do not have their value reflected back.
 */

const isProd = Deno.env.get("ENVIRONMENT") === "production";

const ALLOWED_ORIGINS = new Set([
  "https://wildatlas.app",           // production
  "https://wildatlasnp.lovable.app", // Lovable preview
  "https://wildatlas.lovable.app",   // Lovable preview
  ...(isProd ? [] : ["http://localhost:5173"]),  // local dev (non-production only)
]);

/** Also allow *.lovableproject.com preview origins */
const isAllowedDynamic = (origin: string): boolean =>
  /^https:\/\/[a-z0-9-]+\.lovableproject\.com$/.test(origin);

const isAllowedOrigin = (origin: string): boolean => ALLOWED_ORIGINS.has(origin) || isAllowedDynamic(origin);

const DEFAULT_ORIGIN = "https://wildatlas.app";

export const CORS_HEADERS = "authorization, x-client-info, apikey, content-type, x-lovable-signature, x-lovable-timestamp, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version";

export const corsHeaders = (req: Request) => {
  const origin = req.headers.get("origin") ?? "";
  return {
    "Access-Control-Allow-Origin": isAllowedOrigin(origin) ? origin : DEFAULT_ORIGIN,
    "Access-Control-Allow-Headers": CORS_HEADERS,
    "Vary": "Origin",
  };
};

/** Static CORS headers for internal/cron functions (no dynamic origin needed) */
export const staticCorsHeaders = {
  "Access-Control-Allow-Origin": DEFAULT_ORIGIN,
  "Access-Control-Allow-Headers": CORS_HEADERS,
};
