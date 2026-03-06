import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, Mail, MousePointerClick, Eye } from "lucide-react";

interface EmailTypeStats {
  type: string;
  sent: number;
  opens: number;
  uniqueOpens: number;
  clicks: number;
  uniqueClicks: number;
  openRate: number;
  clickRate: number;
  topLinks: Array<{ label: string; clicks: number }>;
}

const EmailAnalyticsCard = () => {
  const [stats, setStats] = useState<EmailTypeStats[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchStats = async () => {
    setLoading(true);
    try {
      // Fetch email logs and tracking data
      const [logsRes, trackingRes] = await Promise.all([
        supabase.from("email_logs").select("id, email_type, status"),
        supabase.from("email_tracking").select("email_log_id, event_type, link_url"),
      ]);

      const logs = logsRes.data ?? [];
      const tracking = trackingRes.data ?? [];

      // Group logs by type
      const typeMap = new Map<string, { sent: number; logIds: Set<string> }>();
      for (const log of logs) {
        if (log.status !== "sent") continue;
        const t = log.email_type || "unknown";
        if (!typeMap.has(t)) typeMap.set(t, { sent: 0, logIds: new Set() });
        const entry = typeMap.get(t)!;
        entry.sent++;
        entry.logIds.add(log.id);
      }

      // Build tracking maps per type
      const logToType = new Map<string, string>();
      for (const log of logs) {
        logToType.set(log.id, log.email_type || "unknown");
      }

      const result: EmailTypeStats[] = [];

      for (const [type, { sent, logIds }] of typeMap) {
        const typeTracking = tracking.filter(
          (t) => t.email_log_id && logIds.has(t.email_log_id)
        );

        const opens = typeTracking.filter((t) => t.event_type === "open");
        const clicks = typeTracking.filter((t) => t.event_type === "click");

        const uniqueOpenIds = new Set(opens.map((o) => o.email_log_id));
        const uniqueClickIds = new Set(clicks.map((c) => c.email_log_id));

        // Top clicked links
        const linkCounts = new Map<string, number>();
        for (const c of clicks) {
          const url = c.link_url || "unknown";
          // Extract label from URL param if available
          let label = url;
          try {
            const parsed = new URL(url);
            label = parsed.searchParams.get("l") || parsed.pathname;
          } catch {
            // If it's a tracking redirect URL, try to get the label
            if (url.includes("l=")) {
              const match = url.match(/[?&]l=([^&]+)/);
              if (match) label = decodeURIComponent(match[1]);
            }
          }
          linkCounts.set(label, (linkCounts.get(label) || 0) + 1);
        }

        const topLinks = [...linkCounts.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([label, count]) => ({ label, clicks: count }));

        result.push({
          type,
          sent,
          opens: opens.length,
          uniqueOpens: uniqueOpenIds.size,
          clicks: clicks.length,
          uniqueClicks: uniqueClickIds.size,
          openRate: sent > 0 ? Math.round((uniqueOpenIds.size / sent) * 100) : 0,
          clickRate: sent > 0 ? Math.round((uniqueClickIds.size / sent) * 100) : 0,
          topLinks,
        });
      }

      // Sort by sent count descending
      result.sort((a, b) => b.sent - a.sent);
      setStats(result);
    } catch (e) {
      console.error("Failed to fetch email analytics:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const totalSent = stats.reduce((s, t) => s + t.sent, 0);
  const totalUniqueOpens = stats.reduce((s, t) => s + t.uniqueOpens, 0);
  const totalUniqueClicks = stats.reduce((s, t) => s + t.uniqueClicks, 0);
  const overallOpenRate = totalSent > 0 ? Math.round((totalUniqueOpens / totalSent) * 100) : 0;
  const overallClickRate = totalSent > 0 ? Math.round((totalUniqueClicks / totalSent) * 100) : 0;

  const typeLabel = (t: string) => {
    if (t === "welcome") return "Welcome";
    if (t === "permit_alert") return "Permit Alert";
    return t;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <Mail className="h-4 w-4" /> Email Analytics
        </CardTitle>
        <Button onClick={fetchStats} disabled={loading} variant="outline" size="sm">
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overall summary */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border p-3 space-y-1">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              <Mail className="h-2.5 w-2.5" /> Sent
            </p>
            <p className="text-xl font-bold text-foreground">{totalSent}</p>
          </div>
          <div className="rounded-lg border p-3 space-y-1">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              <Eye className="h-2.5 w-2.5" /> Open Rate
            </p>
            <p className="text-xl font-bold text-foreground">{overallOpenRate}%</p>
            <p className="text-[11px] text-muted-foreground">{totalUniqueOpens} unique</p>
          </div>
          <div className="rounded-lg border p-3 space-y-1">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              <MousePointerClick className="h-2.5 w-2.5" /> Click Rate
            </p>
            <p className="text-xl font-bold text-foreground">{overallClickRate}%</p>
            <p className="text-[11px] text-muted-foreground">{totalUniqueClicks} unique</p>
          </div>
        </div>

        {/* Per-type breakdown */}
        {stats.length === 0 && !loading && (
          <p className="text-sm text-muted-foreground">No email data yet</p>
        )}

        {stats.map((s) => (
          <div key={s.type} className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge
                  variant={s.type === "permit_alert" ? "destructive" : "default"}
                  className="text-xs"
                >
                  {typeLabel(s.type)}
                </Badge>
                <span className="text-xs text-muted-foreground">{s.sent} sent</span>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-3 text-center">
              <div>
                <p className="text-lg font-bold text-foreground">{s.opens}</p>
                <p className="text-[10px] text-muted-foreground">Opens</p>
              </div>
              <div>
                <p className="text-lg font-bold text-foreground">{s.openRate}%</p>
                <p className="text-[10px] text-muted-foreground">Open Rate</p>
              </div>
              <div>
                <p className="text-lg font-bold text-foreground">{s.clicks}</p>
                <p className="text-[10px] text-muted-foreground">Clicks</p>
              </div>
              <div>
                <p className="text-lg font-bold text-foreground">{s.clickRate}%</p>
                <p className="text-[10px] text-muted-foreground">Click Rate</p>
              </div>
            </div>

            {s.topLinks.length > 0 && (
              <div className="space-y-1">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Top Links</p>
                {s.topLinks.map((link, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="text-foreground truncate max-w-[200px]">{link.label}</span>
                    <Badge variant="outline" className="text-[10px] ml-2">{link.clicks}</Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default EmailAnalyticsCard;
