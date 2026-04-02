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
    supabase
      .from("recent_finds")
      .select("id, permit_name, park_id, found_at")
      .order("found_at", { ascending: false })
      .limit(3)
      .then(({ data }) => {
        if (data && data.length > 0) setFinds(data);
      });
  }, []);

  if (finds.length === 0) return null;

  return (
    <div style={{ padding: "0 20px", marginBottom: 4 }}>
      {/* Section label */}
      <p
        style={{
          fontFamily: DM_SANS,
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: "0.1em",
          color: "#888",
          textTransform: "uppercase",
          margin: "0 0 10px",
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
                <div style={{ height: "0.5px", background: "#E5E5E5" }} />
              )}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 0",
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
                      fontSize: 14,
                      fontWeight: 500,
                      color: "#1C1812",
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
                      color: "#888",
                    }}
                  >
                    {parkName}
                  </span>
                </div>
                <span
                  style={{
                    fontFamily: DM_SANS,
                    fontSize: 12,
                    color: "#888",
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
