import { useEffect, useState } from "react";
import { Activity, Clock, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface ActivityData {
  todayCount: number;
  lastFound: string | null;
  topPermit: string | null;
}

const formatTimeAgo = (iso: string): string => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "yesterday";
  return `${days}d ago`;
};

const PermitActivity = ({ parkId }: { parkId: string }) => {
  const [data, setData] = useState<ActivityData | null>(null);

  useEffect(() => {
    const fetch = async () => {
      const now = Date.now();
      const dayAgo = new Date(now - 86400000).toISOString();
      const weekAgo = new Date(now - 7 * 86400000).toISOString();

      const [todayRes, lastRes, weekRes] = await Promise.all([
        supabase
          .from("recent_finds")
          .select("id", { count: "exact", head: true })
          .eq("park_id", parkId)
          .gte("found_at", dayAgo),
        supabase
          .from("recent_finds")
          .select("found_at")
          .eq("park_id", parkId)
          .order("found_at", { ascending: false })
          .limit(1),
        supabase
          .from("recent_finds")
          .select("permit_name")
          .eq("park_id", parkId)
          .gte("found_at", weekAgo),
      ]);

      // Find most frequent permit this week
      let topPermit: string | null = null;
      if (weekRes.data && weekRes.data.length > 0) {
        const counts: Record<string, number> = {};
        for (const r of weekRes.data) {
          counts[r.permit_name] = (counts[r.permit_name] || 0) + 1;
        }
        topPermit = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
      }

      setData({
        todayCount: todayRes.count ?? 0,
        lastFound: lastRes.data?.[0]?.found_at ?? null,
        topPermit,
      });
    };
    fetch();
  }, [parkId]);

  if (!data) return null;

  const stats = [
    {
      icon: Activity,
      value: String(data.todayCount),
      label: "Detected Today",
      cls: data.todayCount > 0 ? "text-status-found" : "text-muted-foreground",
    },
    {
      icon: Clock,
      value: data.lastFound ? formatTimeAgo(data.lastFound) : "–",
      label: "Last Opening",
      cls: data.lastFound ? "text-primary" : "text-muted-foreground",
    },
    {
      icon: TrendingUp,
      value: data.topPermit ?? "–",
      label: "Most Active",
      cls: data.topPermit ? "text-secondary" : "text-muted-foreground",
      small: true,
    },
  ];

  return (
    <div className="px-5 mb-3">
      <p className="section-header mb-2">Permit Activity</p>
      <div className="flex items-stretch gap-0 rounded-lg border border-border bg-card/50">
        {stats.map((s, i) => {
          const Icon = s.icon;
          return (
            <div
              key={s.label}
              className={`flex-1 py-3 text-center ${i < stats.length - 1 ? "border-r border-border" : ""}`}
            >
              <Icon size={13} className={`mx-auto mb-1 ${s.cls}`} />
              <div className={`font-body font-bold leading-none ${s.cls} ${s.small ? "text-[11px]" : "text-lg"}`}>
                {s.value}
              </div>
              <div className="font-body font-medium text-[8px] text-muted-foreground uppercase tracking-widest mt-1.5">
                {s.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PermitActivity;
