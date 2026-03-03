import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { Zap } from "lucide-react";
import { PARKS } from "@/lib/parks";
import { formatDistanceToNow } from "date-fns";

interface Find {
  id: string;
  park_id: string;
  permit_name: string;
  found_at: string;
  available_dates: string[];
}

const RecentFinds = () => {
  const [finds, setFinds] = useState<Find[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("recent_finds")
      .select("*")
      .order("found_at", { ascending: false })
      .limit(10)
      .then(({ data }) => {
        if (data) setFinds(data as Find[]);
        setLoading(false);
      });
  }, []);

  if (loading || finds.length === 0) return null;

  return (
    <div className="px-5 mb-4">
      <div className="flex items-center gap-1.5 mb-2.5">
        <Zap size={12} className="text-secondary" />
        <span className="text-[10px] font-bold text-secondary uppercase tracking-widest">
          Recent Finds
        </span>
      </div>
      <div className="space-y-1.5 max-h-[140px] overflow-y-auto">
        <AnimatePresence>
          {finds.map((f, i) => {
            const parkName = PARKS[f.park_id]?.shortName ?? f.park_id;
            return (
              <motion.div
                key={f.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className="flex items-center gap-2 rounded-lg bg-secondary/5 border border-secondary/10 px-3 py-2"
              >
                <span className="relative flex h-1.5 w-1.5 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-secondary" />
                </span>
                <span className="text-[11px] text-foreground font-medium truncate flex-1">
                  {f.permit_name}
                </span>
                <span className="text-[10px] text-muted-foreground shrink-0">{parkName}</span>
                <span className="text-[9px] text-muted-foreground/60 shrink-0">
                  {formatDistanceToNow(new Date(f.found_at), { addSuffix: true })}
                </span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default RecentFinds;
