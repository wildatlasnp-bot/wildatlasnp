import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getParkConfig, getParkColor } from "@/lib/parks";
import { ChevronRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const DM_SANS = "'DM Sans', sans-serif";


interface RecentFind {
  id: string;
  permit_name: string;
  park_id: string;
  found_at: string;
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatHourAmPm(h: number): string {
  const ampm = h >= 12 ? "pm" : "am";
  return `${h % 12 || 12}${ampm}`;
}

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHr = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMin < 60) return `${Math.max(diffMin, 1)}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDays < 7) return `${DAY_NAMES[date.getDay()]} at ${formatHourAmPm(date.getHours())}`;
  // 7+ days
  const sameYear = date.getFullYear() === now.getFullYear();
  const label = `${MONTH_NAMES[date.getMonth()]} ${date.getDate()}`;
  return sameYear ? label : `${label}, ${date.getFullYear()}`;
}

const RecentCatchesFeed = () => {
  const { user } = useAuth();
  const [finds, setFinds] = useState<RecentFind[] | null>(null); // null = loading
  const hasRendered = useRef(false);

  useEffect(() => {
    if (!user) { setFinds([]); return; }

    // 1. Fetch user's watched permit+park pairs, then scope recent_finds
    (async () => {
      // Get scan_target_ids the user watches (past or present)
      const { data: watchers } = await supabase
        .from("user_watchers")
        .select("scan_target_id")
        .eq("user_id", user.id);

      if (!watchers || watchers.length === 0) { setFinds([]); return; }

      const targetIds = watchers.map((w) => w.scan_target_id);

      // Get park_id + permit_type for those targets
      const { data: targets } = await supabase
        .from("scan_targets")
        .select("park_id, permit_type")
        .in("id", targetIds);

      if (!targets || targets.length === 0) { setFinds([]); return; }

      // Build unique permit keys the user has watched
      const watchedKeys = new Set(targets.map((t) => `${t.park_id}::${t.permit_type}`));

      // Fetch recent finds — grab more than needed so we can client-filter
      const { data: allFinds } = await supabase
        .from("recent_finds")
        .select("id, permit_name, park_id, found_at")
        .order("found_at", { ascending: false })
        .limit(50);

      if (!allFinds) { setFinds([]); return; }

      const scoped = allFinds
        .filter((f) => watchedKeys.has(`${f.park_id}::${f.permit_name}`))
        .slice(0, 10);

      setFinds(scoped);
    })();
  }, [user]);

  // Don't render while loading or if empty
  if (finds === null || finds.length === 0) return null;

  const shouldAnimate = !hasRendered.current;
  hasRendered.current = true;

  return (
    <div
      style={{
        padding: "0 20px",
        paddingTop: 24,
        paddingBottom: 16,
        ...(shouldAnimate
          ? { animation: "recentCatchesFadeIn 200ms ease-out both" }
          : {}),
      }}
    >
      <style>{`
        @keyframes recentCatchesFadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes catchRowEnter {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes catchDotPulse {
          0%   { box-shadow: 0 0 0 rgba(201, 169, 110, 0); }
          25%  { box-shadow: 0 0 12px rgba(201, 169, 110, 0.95); }
          100% { box-shadow: 0 0 0 rgba(201, 169, 110, 0); }
        }
      `}</style>

      <p
        style={{
          fontFamily: DM_SANS,
          fontSize: 12,
          fontWeight: 500,
          textTransform: "uppercase" as const,
          letterSpacing: "0.12em",
          color: "#8A8A7A",
          margin: "0 0 16px",
        }}
      >
        Recent catches
      </p>

      <div>
        {finds.map((find, i) => {
          const parkName = getParkConfig(find.park_id).shortName;
          const parkColor = getParkColor(find.park_id);
          return (
            <div key={find.id}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  minHeight: 64,
                  padding: "16px 0",
                  borderBottom: i < finds.length - 1 ? "1px solid rgba(0,0,0,0.06)" : "none",
                  cursor: "pointer",
                }}
              >
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    backgroundColor: parkColor,
                    flexShrink: 0,
                  }}
                />
                <div style={{ flex: 1, minWidth: 0, marginLeft: 12 }}>
                  <span
                    style={{
                      fontFamily: DM_SANS,
                      fontSize: 16,
                      fontWeight: 600,
                      color: "#1A2F1E",
                      display: "block",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {find.permit_name}
                  </span>
                  <span
                    style={{
                      fontFamily: DM_SANS,
                      fontSize: 13,
                      fontWeight: 400,
                      color: "#8A8A7A",
                      marginTop: 2,
                      display: "block",
                    }}
                  >
                    {parkName}
                  </span>
                </div>
                <span
                  style={{
                    fontFamily: DM_SANS,
                    fontSize: 12,
                    fontWeight: 400,
                    color: "#A8A89A",
                    flexShrink: 0,
                    marginRight: 4,
                  }}
                >
                  {timeAgo(find.found_at)}
                </span>
                <ChevronRight size={16} strokeWidth={1.5} style={{ color: "rgba(0,0,0,0.25)", flexShrink: 0 }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RecentCatchesFeed;
