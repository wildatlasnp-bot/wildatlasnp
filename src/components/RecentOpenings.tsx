import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Radio, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface RecentFind {
  id: string;
  permit_name: string;
  found_at: string;
  location_name: string;
}

const formatTimeAgo = (iso: string): string => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "yesterday";
  return `${days}d ago`;
};

const RecentOpenings = ({ parkId }: { parkId: string }) => {
  const [finds, setFinds] = useState<RecentFind[]>([]);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("recent_finds")
        .select("id, permit_name, found_at, location_name")
        .eq("park_id", parkId)
        .order("found_at", { ascending: false })
        .limit(5);
      if (data) setFinds(data);
    };
    fetch();
  }, [parkId]);

  if (finds.length === 0) return null;

  return (
    <div className="px-5 mb-4">
      <p className="section-header mb-2">Recent Openings</p>
      <div className="rounded-xl border border-border bg-card/50 divide-y divide-border">
        {finds.map((f, i) => (
          <motion.div
            key={f.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className="flex items-center gap-3 px-3.5 py-2.5"
          >
            <Radio size={10} className="text-status-found shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="text-[12px] font-semibold text-foreground">
                {f.permit_name}
              </span>
              {f.location_name && (
                <span className="text-[11px] text-muted-foreground"> · {f.location_name}</span>
              )}
            </div>
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground font-medium shrink-0">
              <Clock size={8} />
              {formatTimeAgo(f.found_at)}
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default RecentOpenings;
