import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshCw, ShieldAlert, Database, Activity, ArrowLeft, AlertTriangle, Heart, Search, Skull } from "lucide-react";
import NotificationLogSection from "@/components/NotificationLogSection";

interface NpsAlertStats {
  total_alerts: number;
  by_park: Array<{ park_id: string; park_name: string; count: number }>;
  by_category: Record<string, number>;
  last_fetched: string | null;
}

interface ScannerHealth {
  heartbeatAge: string | null;
  heartbeatAgeMs: number | null;
  heartbeatStatus: "healthy" | "stale" | "missing";
  errorCount: number;
  lastError: string | null;
  circuitBreakersTripped: number;
  zeroFinds24h: boolean;
  activeWatches: number;
  recentFindsCount: number;
}

interface DeadLetterItem {
  id: string;
  permit_name: string;
  park_id: string;
  channel: string;
  error_message: string | null;
  retry_count: number;
  max_retries: number;
  created_at: string;
  user_id: string;
}

interface HealthData {
  generated_at: string;
  api_health: {
    total_requests_24h: number;
    success_count: number;
    error_count: number;
    rate_limit_count: number;
    success_rate: string;
    avg_response_time_ms: number;
  };
  cache_status: {
    total_entries: number;
    hot: number;
    stale: number;
    expired: number;
  };
  circuit_breaker: {
    tripped_count: number;
    tripped_permits: Array<{
      cache_key: string;
      recgov_id: string;
      error_count: number;
      last_error: string | null;
      last_status_code: number | null;
      fetched_at: string;
    }>;
  };
  recent_errors: Array<{
    endpoint: string;
    status_code: number | null;
    error_message: string | null;
    response_time_ms: number | null;
    created_at: string;
  }>;
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

const AdminHealthPage = () => {
  const { isAdmin, loading: adminLoading } = useAdminCheck();
  const navigate = useNavigate();
  const [data, setData] = useState<HealthData | null>(null);
  const [npsStats, setNpsStats] = useState<NpsAlertStats | null>(null);
  const [scannerHealth, setScannerHealth] = useState<ScannerHealth | null>(null);
  const [loading, setLoading] = useState(false);
  const [npsRefreshing, setNpsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshNpsAlerts = async () => {
    setNpsRefreshing(true);
    try {
      await supabase.functions.invoke("nps-alerts");
      await fetchNpsStats();
    } catch {} finally {
      setNpsRefreshing(false);
    }
  };

  const fetchNpsStats = async () => {
    const [alertsRes, parksRes] = await Promise.all([
      supabase.from("park_alerts").select("park_id, category, fetched_at"),
      supabase.from("parks").select("id, name"),
    ]);
    const alerts = alertsRes.data ?? [];
    const parks = parksRes.data ?? [];
    const parkMap: Record<string, string> = {};
    for (const p of parks) parkMap[p.id] = p.name;

    const byParkMap: Record<string, number> = {};
    const byCat: Record<string, number> = {};
    let lastFetched: string | null = null;
    for (const a of alerts) {
      byParkMap[a.park_id] = (byParkMap[a.park_id] ?? 0) + 1;
      byCat[a.category] = (byCat[a.category] ?? 0) + 1;
      if (!lastFetched || a.fetched_at > lastFetched) lastFetched = a.fetched_at;
    }
    setNpsStats({
      total_alerts: alerts.length,
      by_park: Object.entries(byParkMap).map(([park_id, count]) => ({ park_id, park_name: parkMap[park_id] ?? park_id, count })),
      by_category: byCat,
      last_fetched: lastFetched,
    });
  };

  const fetchHealth = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: result, error: fnError } = await supabase.functions.invoke("api-health");
      if (fnError) throw fnError;
      setData(result);
    } catch (e: any) {
      setError(e.message || "Failed to fetch health data");
    } finally {
      setLoading(false);
    }
  };

  const fetchScannerHealth = async () => {
    const now = Date.now();

    // Heartbeat
    const { data: hb } = await supabase
      .from("permit_cache")
      .select("fetched_at, error_count, last_error")
      .eq("cache_key", "__scanner_heartbeat__")
      .maybeSingle();

    // Circuit breakers tripped
    const { count: cbCount } = await supabase
      .from("permit_cache")
      .select("*", { count: "exact", head: true })
      .gte("error_count", 3)
      .neq("cache_key", "__scanner_heartbeat__")
      .neq("cache_key", "__global_rate_limit__");

    // Active watches
    const { count: watchCount } = await supabase
      .from("active_watches")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true);

    // Recent finds (24h)
    const cutoff = new Date(now - 24 * 3600_000).toISOString();
    const { count: findCount } = await supabase
      .from("recent_finds")
      .select("*", { count: "exact", head: true })
      .gte("found_at", cutoff);

    let heartbeatStatus: ScannerHealth["heartbeatStatus"] = "missing";
    let heartbeatAgeMs: number | null = null;
    let heartbeatAge: string | null = null;

    if (hb) {
      heartbeatAgeMs = now - new Date(hb.fetched_at).getTime();
      heartbeatAge = formatDuration(heartbeatAgeMs);
      heartbeatStatus = heartbeatAgeMs > 10 * 60_000 ? "stale" : "healthy";
    }

    setScannerHealth({
      heartbeatAge,
      heartbeatAgeMs,
      heartbeatStatus,
      errorCount: hb?.error_count ?? 0,
      lastError: hb?.last_error ?? null,
      circuitBreakersTripped: cbCount ?? 0,
      zeroFinds24h: (watchCount ?? 0) > 0 && (findCount ?? 0) === 0,
      activeWatches: watchCount ?? 0,
      recentFindsCount: findCount ?? 0,
    });
  };

  useEffect(() => {
    if (adminLoading) return;
    if (!isAdmin) {
      navigate("/app");
      return;
    }
    fetchHealth();
    fetchNpsStats();
    fetchScannerHealth();
  }, [isAdmin, adminLoading]);

  if (adminLoading) return <div className="flex items-center justify-center min-h-screen text-muted-foreground">Loading...</div>;

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/app")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold text-foreground">API Health Monitor</h1>
        </div>
        <Button onClick={fetchHealth} disabled={loading} variant="outline" size="sm">
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="p-4 text-destructive">{error}</CardContent>
        </Card>
      )}

      {data && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <Activity className="h-3 w-3" /> Requests (24h)
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="text-2xl font-bold text-foreground">{data.api_health.total_requests_24h}</div>
                <p className="text-xs text-muted-foreground">{data.api_health.success_rate} success</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-xs font-medium text-muted-foreground">Avg Response</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="text-2xl font-bold text-foreground">{data.api_health.avg_response_time_ms}ms</div>
                <p className="text-xs text-muted-foreground">{data.api_health.rate_limit_count} rate limits</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <Database className="h-3 w-3" /> Cache
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="flex items-center gap-2">
                  <Badge variant="default" className="text-xs">{data.cache_status.hot} hot</Badge>
                  <Badge variant="secondary" className="text-xs">{data.cache_status.stale} stale</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{data.cache_status.total_entries} total</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <ShieldAlert className="h-3 w-3" /> Circuit Breaker
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="text-2xl font-bold text-foreground">
                  {data.circuit_breaker.tripped_count === 0 ? (
                    <span className="text-status-scanning">OK</span>
                  ) : (
                    <span className="text-destructive">{data.circuit_breaker.tripped_count} tripped</span>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Scanner Health Widget */}
          {scannerHealth && (
            <Card className={scannerHealth.heartbeatStatus === "stale" || scannerHealth.zeroFinds24h ? "border-destructive/50" : ""}>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Heart className="h-4 w-4" /> Scanner Health
                </CardTitle>
                <Button onClick={fetchScannerHealth} variant="outline" size="sm">
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                  Refresh
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Status indicators grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {/* Heartbeat */}
                  <div className="rounded-lg border p-3 space-y-1">
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Heartbeat</p>
                    <div className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${
                        scannerHealth.heartbeatStatus === "healthy" ? "bg-status-scanning" :
                        scannerHealth.heartbeatStatus === "stale" ? "bg-status-busy" : "bg-muted-foreground/40"
                      }`} />
                      <span className="text-sm font-bold text-foreground capitalize">{scannerHealth.heartbeatStatus}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {scannerHealth.heartbeatAge ? `${scannerHealth.heartbeatAge} ago` : "No heartbeat"}
                    </p>
                  </div>

                  {/* Circuit Breakers */}
                  <div className="rounded-lg border p-3 space-y-1">
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Circuit Breakers</p>
                    <p className={`text-xl font-bold ${scannerHealth.circuitBreakersTripped > 0 ? "text-destructive" : "text-foreground"}`}>
                      {scannerHealth.circuitBreakersTripped}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {scannerHealth.circuitBreakersTripped === 0 ? "All clear" : "permits paused"}
                    </p>
                  </div>

                  {/* Finds (24h) */}
                  <div className="rounded-lg border p-3 space-y-1">
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                      <Search className="h-2.5 w-2.5" /> Finds (24h)
                    </p>
                    <p className={`text-xl font-bold ${scannerHealth.zeroFinds24h ? "text-destructive" : "text-foreground"}`}>
                      {scannerHealth.recentFindsCount}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {scannerHealth.activeWatches} active watches
                    </p>
                  </div>

                  {/* Worker Errors */}
                  <div className="rounded-lg border p-3 space-y-1">
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Last Cycle Errors</p>
                    <p className={`text-xl font-bold ${scannerHealth.errorCount > 0 ? "text-status-busy" : "text-foreground"}`}>
                      {scannerHealth.errorCount}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate" title={scannerHealth.lastError ?? ""}>
                      {scannerHealth.lastError ?? "No errors"}
                    </p>
                  </div>
                </div>

                {/* Warnings */}
                {scannerHealth.zeroFinds24h && (
                  <div className="flex items-center gap-2 rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2">
                    <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                    <p className="text-xs text-destructive font-medium">
                      Zero permit detections in the last 24 hours despite {scannerHealth.activeWatches} active watches — check for API changes or scanner failures.
                    </p>
                  </div>
                )}
                {scannerHealth.heartbeatStatus === "stale" && (
                  <div className="flex items-center gap-2 rounded-lg bg-status-busy/10 border border-status-busy/20 px-3 py-2">
                    <AlertTriangle className="h-4 w-4 text-status-busy shrink-0" />
                    <p className="text-xs text-status-busy font-medium">
                      Scanner heartbeat is {scannerHealth.heartbeatAge} old — the cron job may have stopped.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* NPS Alerts Stats */}
          {npsStats && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" /> NPS Park Alerts
                </CardTitle>
                <Button onClick={refreshNpsAlerts} disabled={npsRefreshing} variant="outline" size="sm">
                  <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${npsRefreshing ? "animate-spin" : ""}`} />
                  {npsRefreshing ? "Fetching…" : "Refresh NPS"}
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-4 flex-wrap">
                  <div>
                    <span className="text-2xl font-bold text-foreground">{npsStats.total_alerts}</span>
                    <span className="text-xs text-muted-foreground ml-1.5">active alerts</span>
                  </div>
                  {npsStats.last_fetched && (
                    <Badge variant="outline" className="text-xs">
                      Last fetched: {new Date(npsStats.last_fetched).toLocaleString()}
                    </Badge>
                  )}
                </div>
                <div className="flex gap-2 flex-wrap">
                  {npsStats.by_park.map((p) => (
                    <Badge key={p.park_id} variant="secondary" className="text-xs">
                      {p.park_name}: {p.count}
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2 flex-wrap">
                  {Object.entries(npsStats.by_category).map(([cat, count]) => (
                    <Badge key={cat} variant={cat.includes("Closure") || cat === "Danger" ? "destructive" : "outline"} className="text-xs">
                      {cat}: {count}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Circuit Breaker Details */}
          {data.circuit_breaker.tripped_permits.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base text-destructive">⚠ Tripped Circuit Breakers</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Permit</TableHead>
                      <TableHead>Errors</TableHead>
                      <TableHead>Last Status</TableHead>
                      <TableHead>Last Error</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.circuit_breaker.tripped_permits.map((p) => (
                      <TableRow key={p.cache_key}>
                        <TableCell className="font-mono text-xs">{p.cache_key}</TableCell>
                        <TableCell><Badge variant="destructive">{p.error_count}</Badge></TableCell>
                        <TableCell>{p.last_status_code ?? "—"}</TableCell>
                        <TableCell className="text-xs max-w-[200px] truncate">{p.last_error ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Recent Errors */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent Errors (last 24h)</CardTitle>
            </CardHeader>
            <CardContent>
              {data.recent_errors.length === 0 ? (
                <p className="text-sm text-muted-foreground">No errors 🎉</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>Endpoint</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Latency</TableHead>
                      <TableHead>Error</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.recent_errors.map((e, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-xs whitespace-nowrap">
                          {new Date(e.created_at).toLocaleTimeString()}
                        </TableCell>
                        <TableCell className="font-mono text-xs max-w-[200px] truncate">{e.endpoint}</TableCell>
                        <TableCell><Badge variant="destructive">{e.status_code}</Badge></TableCell>
                        <TableCell className="text-xs">{e.response_time_ms ?? "—"}ms</TableCell>
                        <TableCell className="text-xs max-w-[200px] truncate">{e.error_message ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Notification Log */}
          <NotificationLogSection />
        </>
      )}
    </div>
  );
};

export default AdminHealthPage;
