import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getParkConfig } from "@/lib/parks";

const DM_SANS = "'DM Sans', sans-serif";

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
    // Supabase JS doesn't support DISTINCT ON, so we fetch a larger window
    // ordered by found_at DESC, deduplicate by permit_name client-side
    // (keeping the most recent row per permit), then take the top 3.
    // Equivalent to:
    //   SELECT permit_name, park_id, found_at
    //   FROM (SELECT DISTINCT ON (permit_name) permit_name, park_id, found_at
    //         FROM recent_finds ORDER BY permit_name, found_at DESC) sub
    //   ORDER BY found_at DESC LIMIT 3
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
    <div style={{ padding: "0 20px", marginBottom: 4 }}>
      {/* Section label */}
       <p
         style={{
            fontFamily: DM_SANS,
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: "0.1em",
            color: "#6B7280",
            textTransform: "uppercase",
            margin: "0 0 14px",
            paddingTop: 16,
            marginTop: 40,
            borderTop: '1px solid #D4CFC9',
          }}
        >
        Recent Catches
      </p>

      {/* Feed rows */}
      <div>
        {finds.map((find, i) => {
          const parkName = getParkConfig(find.park_id).shortName;
          return (
            <div key={find.id}>
              {i > 0 && (
                <div style={{ height: 1, backgroundColor: "#E8E3DD" }} />
              )}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "14px 0",
                }}
              >
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    backgroundColor: "#2F6F4E",
                    flexShrink: 0,
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                   <span
                     style={{
                       fontFamily: DM_SANS,
                       fontSize: 15,
                        fontWeight: 500,
                       color: "#374151",
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
                        color: "#9CA3AF",
                        marginTop: 3,
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
                     color: "#9CA3AF",
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
