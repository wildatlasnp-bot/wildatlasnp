import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshCw, ShieldAlert, Database, Activity, ArrowLeft } from "lucide-react";

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

const AdminHealthPage = () => {
  const { isAdmin, loading: adminLoading } = useAdminCheck();
  const navigate = useNavigate();
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    if (adminLoading) return;
    if (!isAdmin) {
      navigate("/app");
      return;
    }
    fetchHealth();
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
                    <span className="text-green-600">OK</span>
                  ) : (
                    <span className="text-destructive">{data.circuit_breaker.tripped_count} tripped</span>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

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
        </>
      )}
    </div>
  );
};

export default AdminHealthPage;
