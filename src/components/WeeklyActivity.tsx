import { useEffect, useState } from "react";
import { Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const WeeklyActivity = ({ parkId }: { parkId: string }) => {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    const fetch = async () => {
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
      const { count: c } = await supabase
        .from("recent_finds")
        .select("id", { count: "exact", head: true })
        .eq("park_id", parkId)
        .gte("found_at", weekAgo);
      setCount(c ?? 0);
    };
    fetch();
  }, [parkId]);

  if (count === null) return null;

  return (
    <div className="px-5 mb-3">
      <div className="flex items-center gap-3 rounded-lg border border-border bg-card/50 px-4 py-3">
        <Activity size={16} className="text-primary shrink-0" />
        <div>
          <div className="font-body font-bold text-lg leading-none text-foreground">{count}</div>
          <div className="font-body text-[9px] text-muted-foreground uppercase tracking-widest mt-1">Openings detected this week</div>
        </div>
      </div>
    </div>
  );
};

export default WeeklyActivity;
