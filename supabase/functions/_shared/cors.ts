/**
 * Shared CORS helper for all edge functions.
 * Only accepts requests from explicitly allowlisted origins.
 * Fail-closed: unknown origins do not have their value reflected back.
 */

const ALLOWED_ORIGINS = new Set([
  "https://wildatlas.app",
  "https://wildatlasnp.lovable.app",
  "https://wildatlas.lovable.app",
  "http://localhost:5173",
  "http://localhost:3000",
]);

const ALLOWED_ORIGIN_PATTERNS = [
  /^https:\/\/[a-z0-9-]+\.lovableproject\.com$/,
  /^https:\/\/[a-z0-9-]+\.lovable\.app$/,
  /^https:\/\/id-preview--[a-z0-9-]+\.lovable\.app$/,
];

function isOriginAllowed(origin: string): boolean {
  if (ALLOWED_ORIGINS.has(origin)) return true;
  return ALLOWED_ORIGIN_PATTERNS.some((p) => p.test(origin));
}

export const CORS_HEADERS = "authorization, x-client-info, apikey, content-type, x-lovable-signature, x-lovable-timestamp, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version";

export const corsHeaders = (req: Request): Record<string, string> => {
  const origin = req.headers.get("origin") ?? "";
  const allowed = isOriginAllowed(origin);
  return {
    "Access-Control-Allow-Origin": allowed ? origin : (ALLOWED_ORIGINS.values().next().value as string),
    "Access-Control-Allow-Headers": CORS_HEADERS,
    "Vary": "Origin",
  };
};

/** Static CORS headers for internal/cron functions (no dynamic origin needed) */
export const staticCorsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGINS.values().next().value as string,
  "Access-Control-Allow-Headers": CORS_HEADERS,
};
