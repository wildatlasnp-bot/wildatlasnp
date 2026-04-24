import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PARKS } from "@/lib/parks";

/**
 * useLiveAlertPreview
 * ----------------------------------------------------------------------------
 * Backs the LandingPage `<LiveAlertPreview />` with real `park_alerts` data.
 *
 * Returns the most recent live alert for each severity bucket:
 *   - `closure` ← latest row where category = 'Park Closure'
 *   - `info`    ← latest row where category = 'Information'
 *
 * Severity chrome (colors, badges, accent ink) stays driven by the visual
 * presets in LandingPage.tsx — only the editorial fields (headline, body,
 * location, posted timestamp, status) are sourced from the backend.
 *
 * Public RLS on `park_alerts` allows unauthenticated reads, so this hook is
 * safe to run on the marketing page before sign-in.
 */

export type LiveAlertSeverity = "closure" | "info";

export interface LiveAlertRecord {
  /** Real park alert id (uuid). Useful for analytics/keys. */
  id: string;
  /** "Yosemite · Tioga Pass" style location label. */
  location: string;
  /** Editorial headline split into a bold lead + an italic tail. */
  headline: string;
  /** Body paragraph (trimmed for the marketing surface). */
  body: string;
  /** Already-formatted "Posted HH:MM" string in the visitor's locale. */
  posted: string;
  /** Status copy ("Ongoing" / "Informational" — derived from category). */
  status: string;
  /** ISO timestamp the alert was last refreshed by the NPS sync. */
  lastUpdatedISO: string;
}

interface AlertRow {
  id: string;
  park_id: string;
  category: string;
  title: string;
  description: string | null;
  last_updated: string;
}

const BODY_MAX_CHARS = 220;

function formatPostedLabel(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "Posted —";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `Posted ${hh}:${mm}`;
}

function formatLocation(parkId: string): string {
  return PARKS[parkId]?.name ?? parkId.replace(/_/g, " ");
}

function trimBody(input: string | null): string {
  if (!input) return "";
  const cleaned = input.replace(/\s+/g, " ").trim();
  if (cleaned.length <= BODY_MAX_CHARS) return cleaned;
  // Trim on a word boundary, then append an ellipsis (no trailing whitespace).
  const slice = cleaned.slice(0, BODY_MAX_CHARS);
  const lastSpace = slice.lastIndexOf(" ");
  return `${(lastSpace > 80 ? slice.slice(0, lastSpace) : slice).replace(/[.,;:\s]+$/, "")}…`;
}

function toRecord(row: AlertRow, severity: LiveAlertSeverity): LiveAlertRecord {
  return {
    id: row.id,
    location: formatLocation(row.park_id),
    headline: row.title.trim(),
    body: trimBody(row.description),
    posted: formatPostedLabel(row.last_updated),
    status: severity === "closure" ? "Ongoing" : "Informational",
    lastUpdatedISO: row.last_updated,
  };
}

export interface LiveAlertPreviewState {
  closure: LiveAlertRecord | null;
  info: LiveAlertRecord | null;
  loading: boolean;
  error: string | null;
}

export function useLiveAlertPreview(): LiveAlertPreviewState {
  const [state, setState] = useState<LiveAlertPreviewState>({
    closure: null,
    info: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [closureRes, infoRes] = await Promise.all([
          supabase
            .from("park_alerts")
            .select("id, park_id, category, title, description, last_updated")
            .eq("category", "Park Closure")
            .order("last_updated", { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from("park_alerts")
            .select("id, park_id, category, title, description, last_updated")
            .eq("category", "Information")
            .order("last_updated", { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);

        if (cancelled) return;

        const errMsg = closureRes.error?.message || infoRes.error?.message || null;

        setState({
          closure: closureRes.data ? toRecord(closureRes.data as AlertRow, "closure") : null,
          info: infoRes.data ? toRecord(infoRes.data as AlertRow, "info") : null,
          loading: false,
          error: errMsg,
        });
      } catch (e) {
        if (cancelled) return;
        setState((s) => ({
          ...s,
          loading: false,
          error: e instanceof Error ? e.message : "Failed to load alerts",
        }));
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
