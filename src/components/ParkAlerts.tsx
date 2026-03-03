import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, ShieldAlert, Info, ExternalLink } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface ParkAlert {
  id: string;
  title: string;
  description: string | null;
  category: string;
  url: string | null;
  last_updated: string;
}

const CATEGORY_CONFIG: Record<string, { icon: typeof AlertTriangle; className: string }> = {
  Danger: { icon: AlertTriangle, className: "bg-destructive/10 text-destructive border-destructive/20" },
  Caution: { icon: ShieldAlert, className: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
  "Park Closure": { icon: AlertTriangle, className: "bg-destructive/10 text-destructive border-destructive/20" },
  Information: { icon: Info, className: "bg-primary/8 text-primary border-primary/20" },
};

const ParkAlerts = ({ parkId }: { parkId: string }) => {
  const [alerts, setAlerts] = useState<ParkAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("park_alerts")
        .select("id, title, description, category, url, last_updated")
        .eq("park_id", parkId)
        .order("last_updated", { ascending: false })
        .limit(10);
      setAlerts(data ?? []);
      setLoading(false);
    };
    load();
  }, [parkId]);

  if (loading || alerts.length === 0) return null;

  return (
    <div className="px-5 mb-4">
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">
        NPS Park Alerts
      </p>
      <div className="space-y-2">
        <AnimatePresence>
          {alerts.map((alert, i) => {
            const config = CATEGORY_CONFIG[alert.category] ?? CATEGORY_CONFIG.Information;
            const Icon = config.icon;
            return (
              <motion.div
                key={alert.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`rounded-xl border p-3 ${config.className}`}
              >
                <div className="flex items-start gap-2.5">
                  <Icon size={14} className="shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold leading-tight line-clamp-2">
                        {alert.title}
                      </span>
                      {alert.url && (
                        <a
                          href={alert.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
                        >
                          <ExternalLink size={11} />
                        </a>
                      )}
                    </div>
                    {alert.description && (
                      <p className="text-[10px] opacity-80 mt-1 line-clamp-2 leading-relaxed">
                        {alert.description}
                      </p>
                    )}
                    <span className="text-[9px] opacity-50 mt-1 block">
                      {alert.category} · Updated {new Date(alert.last_updated).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default ParkAlerts;
