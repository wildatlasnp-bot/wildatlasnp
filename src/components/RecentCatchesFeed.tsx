import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getParkConfig } from "@/lib/parks";

const DM_SANS = "'DM Sans', sans-serif";
const CORMORANT = "'Cormorant Garamond', serif";

const PARK_COLOR_MAP: Record<string, string> = {
  yosemite: "#4A7C59",
  grand_canyon: "#C9A96E",
  zion: "#E8763A",
  glacier: "#5B8FA8",
  grand_teton: "#6B7FA3",
  rocky_mountain: "#7B6FAA",
  rainier: "#5A8C6E",
  arches: "#D4724A",
};

function getParkColor(parkId: string): string {
  return PARK_COLOR_MAP[parkId] ?? "#4A7C59";
}

interface RecentFind {
  id: string;
  permit_name: string;
  park_id: string;
  found_at: string;
}

function timeAgo(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHr = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDays === 1) return "yesterday";
  return `${diffDays}d ago`;
}

const RecentCatchesFeed = () => {
  const [finds, setFinds] = useState<RecentFind[]>([]);

  useEffect(() => {
    supabase
      .from("recent_finds")
      .select("id, permit_name, park_id, found_at")
      .order("found_at", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (!data || data.length === 0) return;
        const seen = new Set<string>();
        const deduped = data.filter((f) => {
          if (seen.has(f.permit_name)) return false;
          seen.add(f.permit_name);
          return true;
        }).slice(0, 3);
        if (deduped.length > 0) setFinds(deduped);
      });
  }, []);

  if (finds.length === 0) return (
    <div style={{ textAlign: 'center', padding: '24px 16px', color: '#6B7280', fontSize: '14px' }}>
      No recent catches yet — your first alert is coming.
    </div>
  );

  return (
    <div style={{ padding: "0 20px", marginBottom: 4, borderTop: "1px solid rgba(26,47,30,0.06)" }}>
      {/* Section label */}
      <p
        style={{
          fontFamily: DM_SANS,
          fontSize: 10,
          fontWeight: 500,
          textTransform: "uppercase" as const,
          letterSpacing: "0.12em",
          color: "rgba(26,47,30,0.45)",
          margin: "0 0 12px",
          paddingTop: 24,
          marginTop: 0,
          borderTop: '1px solid rgba(26,47,30,0.10)',
        }}
      >
        Recent catches
      </p>

      {/* Feed rows */}
      <div>
        {finds.map((find, i) => {
          const parkName = getParkConfig(find.park_id).shortName;
          const parkColor = getParkColor(find.park_id);
          return (
            <div key={find.id}>
              {i > 0 && (
                <div style={{ height: 0.5, backgroundColor: "rgba(26,47,30,0.08)" }} />
              )}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "14px 0",
                  borderLeft: `2px solid ${parkColor}`,
                  paddingLeft: 8,
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    backgroundColor: parkColor,
                    flexShrink: 0,
                  }}
                />
                <div style={{ flex: 1, minWidth: 0, marginLeft: 10 }}>
                  <span
                    style={{
                      fontFamily: DM_SANS,
                      fontSize: 14,
                      fontWeight: 500,
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
                      fontSize: 12,
                      fontWeight: 400,
                      color: "rgba(26,47,30,0.50)",
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
                    fontSize: 11,
                    fontWeight: 400,
                    color: "rgba(26,47,30,0.40)",
                    flexShrink: 0,
                  }}
                >
                  {timeAgo(find.found_at)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RecentCatchesFeed;
