/**
 * mochi-chat — Poko's streaming chat endpoint.
 *
 * Slim orchestrator. All non-trivial logic lives in sibling modules:
 *   - parks.ts          — park metadata + knowledge base
 *   - permit-windows.ts — pre-computed lottery/reservation window status
 *   - live-data.ts      — NPS alerts, weather, permits, scanner heartbeat
 *   - park-detection.ts — keyword-based park detection from user message
 *   - emergency.ts      — life-safety intercept (bypasses LLM + rate limit)
 *   - rate-limit.ts     — per-minute + daily caps with fail-open / fail-closed
 *   - system-prompt.ts  — long-form prompt composition
 *
 * Handler responsibilities (kept in this file):
 *   1. CORS + warm ping
 *   2. Auth check (Supabase JWT)
 *   3. Input validation (message length cap)
 *   4. Emergency intercept
 *   5. Rate limiting + record hit
 *   6. Live data fan-out
 *   7. Stream the AI gateway response
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

import { PARK_META, DEFAULT_PARK } from "./parks.ts";
import { fetchNPSAlerts, fetchWeather, fetchPermitStatus, fetchScannerHeartbeat } from "./live-data.ts";
import { detectParkFromMessage } from "./park-detection.ts";
import { isEmergency, buildEmergencyStream } from "./emergency.ts";
import { enforceRateLimit, recordRateLimitHit } from "./rate-limit.ts";
import { buildSystemPrompt } from "./system-prompt.ts";

const MAX_USER_MESSAGE_LENGTH = 2000;
const AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const AI_MODEL = "google/gemini-2.5-flash";
const AI_TIMEOUT_MS = 30_000;

const WEATHER_KEYWORDS = /\b(weather|temperature|conditions|pack|wear|cold|hot|rain|snow|wind|forecast|degrees|freezing|layering|jacket)\b/i;

serve(async (req) => {
  const cors = corsHeaders(req);

  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  // Prewarming ping — keeps V8 isolate alive, no auth required.
  const isWarmPing = req.method === "GET" && (
    req.headers.get("x-up-warm") === "1" ||
    req.headers.get("user-agent")?.includes("UptimeRobot") ||
    req.headers.get("user-agent")?.includes("BetterUptime")
  );
  if (isWarmPing) {
    return new Response(JSON.stringify({ status: "warm" }), {
      status: 200,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // ── Auth check ──
    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;
    if (authHeader?.startsWith("Bearer ")) {
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user }, error } = await userClient.auth.getUser();
      if (!error && user?.id) userId = user.id;
    }

    if (!userId) {
      return new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // ── Parse + validate body ──
    const { messages, arrivalDate: rawArrivalDate, parkId } = await req.json();
    const arrivalDate = typeof rawArrivalDate === "string"
      ? rawArrivalDate.replace(/[\r\n]+/g, "").replace(/##|--/g, "").slice(0, 20).trim()
      : null;

    const lastUserMsg = messages?.findLast?.((m: any) => m.role === "user");
    const lastUserBody: string = typeof lastUserMsg?.content === "string" ? lastUserMsg.content : "";
    if (lastUserBody.length > MAX_USER_MESSAGE_LENGTH) {
      return new Response(
        JSON.stringify({ error: `Message too long. Please keep messages under ${MAX_USER_MESSAGE_LENGTH} characters.` }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    // ── Emergency intercept (bypasses rate limit + LLM) ──
    if (isEmergency(lastUserBody)) {
      return new Response(buildEmergencyStream(parkId), {
        headers: { ...cors, "Content-Type": "text/event-stream" },
      });
    }

    // ── Rate limiting (DB-backed, cold-start safe) ──
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: proData } = await adminClient
      .from("profiles")
      .select("is_pro")
      .eq("user_id", userId)
      .single();
    const isPro = proData?.is_pro === true;

    const limited = await enforceRateLimit({ adminClient, userId, isPro, corsHeaders: cors });
    if (limited) return limited;
    await recordRateLimitHit(adminClient, userId);

    // ── Park selection ──
    const permitData = await fetchPermitStatus(userId);
    const trackedParkId = permitData.trackedParkIds[0] ?? null;
    const mentionedParkId = detectParkFromMessage(messages ?? []);
    const activeParkId = mentionedParkId ?? parkId ?? trackedParkId ?? DEFAULT_PARK;
    const hasParkSelection = !!(mentionedParkId ?? parkId ?? trackedParkId);
    const VALID_PARK_IDS = Object.keys(PARK_META);
    const safeParkId = VALID_PARK_IDS.includes(activeParkId) ? activeParkId : DEFAULT_PARK;
    const park = PARK_META[safeParkId];

    // ── Diagnostics ──
    const msgCount = Array.isArray(messages) ? messages.length : 0;
    const hasAssistantMsgs = Array.isArray(messages) && messages.some((m: any) => m.role === "assistant");
    const lastUserPreview = Array.isArray(messages)
      ? messages.filter((m: any) => m.role === "user").pop()?.content?.slice(0, 100)
      : "N/A";
    console.log(`[mochi-chat] userId=${userId.slice(0, 8)} parkId=${parkId} trackedParkId=${trackedParkId} activeParkId=${activeParkId} mentionedPark=${mentionedParkId} msgs=${msgCount} hasAssistant=${hasAssistantMsgs} lastUser_len=${lastUserPreview?.length ?? 0}`);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Only fetch weather if the user's latest message asks about it.
    const lastUserText = Array.isArray(messages)
      ? messages.filter((m: any) => m.role === "user").pop()?.content ?? ""
      : "";
    const userWantsWeather = WEATHER_KEYWORDS.test(lastUserText);

    // ── Fan-out live data fetches in parallel ──
    const [weather, alerts, scannerStatus, _scanTargetRows] = await Promise.all([
      userWantsWeather ? fetchWeather(park.lat, park.lon) : Promise.resolve(""),
      fetchNPSAlerts(activeParkId, park.name),
      fetchScannerHeartbeat(),
      adminClient.from("scan_targets").select("park_id").eq("status", "active").order("park_id")
        .then(({ data }) => [...new Set((data ?? []).map((r: any) => PARK_META[r.park_id]?.name?.replace(" National Park", "") ?? r.park_id))]),
    ]);

    // Always list all configured parks so Poko never falsely denies coverage.
    const allParkNames = Object.values(PARK_META).map((p) => p.name.replace(" National Park", ""));
    const monitoredParks = allParkNames.join(", ");
    const parking = park.parkingContext();

    console.log(`[mochi-chat] Live data fetched — weather: ${weather.slice(0, 80)} | alerts: ${alerts.slice(0, 80)} | scanner: ${scannerStatus}`);

    const systemPrompt = buildSystemPrompt(
      park,
      weather,
      alerts,
      parking,
      arrivalDate,
      permitData.watches,
      scannerStatus,
      monitoredParks,
      hasParkSelection,
    );

    // Sanitize messages to prevent prompt injection.
    const safeMessages = (messages ?? []).map((m: any) => {
      if (m.role === "user" && typeof m.content === "string") {
        return { ...m, content: `<user_message>${m.content}</user_message>` };
      }
      return m;
    });

    const response = await fetch(AI_GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [{ role: "system", content: systemPrompt }, ...safeMessages],
        stream: true,
      }),
      signal: AbortSignal.timeout(AI_TIMEOUT_MS),
    });

    console.log(`[mochi-chat] AI gateway response status=${response.status}`);

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again shortly." }), {
          status: 429,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...cors, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("mochi-chat error:", e instanceof Error ? e.message : e, e instanceof Error ? e.stack : "");
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }
});
