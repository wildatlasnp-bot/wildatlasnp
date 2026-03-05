import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, ShieldAlert, Info, ExternalLink, RefreshCw, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";

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
  const [refreshing, setRefreshing] = useState(false);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("wildatlas_alerts_collapsed") === "true");
  const { toast } = useToast();

  const loadAlerts = useCallback(async () => {
    const { data } = await supabase
      .from("park_alerts")
      .select("id, title, description, category, url, last_updated")
      .eq("park_id", parkId)
      .order("last_updated", { ascending: false })
      .limit(10);
    setAlerts(data ?? []);
  }, [parkId]);

  useEffect(() => {
    setLoading(true);
    loadAlerts().finally(() => setLoading(false));
  }, [loadAlerts]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const { error } = await supabase.functions.invoke("nps-alerts");
      if (error) throw error;
      await loadAlerts();
      toast({ title: "✅ Alerts refreshed", description: "Latest NPS alerts have been fetched." });
    } catch {
      toast({ title: "⚠️ Refresh failed", description: "Couldn't fetch latest alerts. Try again later." });
    } finally {
      setRefreshing(false);
    }
  };

  if (loading || alerts.length === 0) return null;

  return (
    <div className="px-5 mb-4">
      <div className="flex items-center gap-2 mb-2">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
          NPS Park Alerts
        </p>
        <span className="text-[9px] text-muted-foreground/60 font-medium">{alerts.length}</span>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-secondary transition-colors disabled:opacity-50"
          aria-label="Refresh NPS alerts"
        >
          <RefreshCw size={9} className={refreshing ? "animate-spin" : ""} />
          <span>{refreshing ? "Updating…" : "Refresh"}</span>
        </button>
        <button
          onClick={() => setCollapsed((c) => { const next = !c; localStorage.setItem("wildatlas_alerts_collapsed", String(next)); return next; })}
          className="ml-auto flex items-center text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          aria-label={collapsed ? "Expand alerts" : "Collapse alerts"}
        >
          <ChevronDown size={12} className={`transition-transform duration-200 ${collapsed ? "-rotate-90" : ""}`} />
        </button>
      </div>
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="space-y-2">
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
                      {alert.category} · Updated {alert.last_updated.slice(0, 10).replace(/-/g, "/").replace(/^(\d{4})\/(\d{2})\/(\d{2})$/, (_m, y, mo, d) => `${parseInt(mo)}/${parseInt(d)}/${y}`)}
                    </span>
                  </div>
                </div>
              </motion.div>
            );
          })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ParkAlerts;
