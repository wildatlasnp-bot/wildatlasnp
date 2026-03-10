/**
 * Shared CORS helper for all edge functions.
 * Accepts requests from production, Lovable preview/editor, and localhost.
 */

const isAllowedOrigin = (origin: string): boolean => {
  if (!origin) return false;
  // Exact matches
  if (origin === "https://wildatlasnp.lovable.app") return true;
  if (origin === "http://localhost:8080") return true;
  if (origin === "http://localhost:5173") return true;
  // Pattern matches for Lovable preview/editor URLs
  if (origin.endsWith(".lovable.app")) return true;
  if (origin.endsWith(".lovable.dev")) return true;
  if (origin.endsWith(".lovableproject.com")) return true;
  return false;
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
