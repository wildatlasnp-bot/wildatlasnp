import { useSyncExternalStore } from "react";
import { useNavigate } from "react-router-dom";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Trash2, Activity, Gauge, Zap, MapPin } from "lucide-react";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ReferenceLine } from "recharts";
import {
  type PerfEvent,
  getPerfEvents,
  subscribePerfEvents,
  clearPerfEvents,
} from "@/lib/perf-telemetry";

const chartConfig = {
  render_ms: { label: "Render (ms)", color: "hsl(var(--primary))" },
  network_ms: { label: "Network (ms)", color: "hsl(var(--accent))" },
};

const AdminPerformancePage = () => {
  const { isAdmin, loading } = useAdminCheck();
  const navigate = useNavigate();

  const events = useSyncExternalStore(
    subscribePerfEvents,
    getPerfEvents,
    getPerfEvents,
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Activity className="animate-spin text-primary" size={28} />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Admin access required.</p>
      </div>
    );
  }

  const tabSwitchEvents = events.filter((e) => e.type === "tab_switch_slow");
  const longTaskEvents = events.filter((e) => e.type === "long_tasks_batch");
  const parkSwitchEvents = events.filter((e) => e.type === "park_switch_timing");

  const avgTabSwitch =
    tabSwitchEvents.length > 0
      ? Math.round(
          tabSwitchEvents.reduce((sum, e) => sum + (e.data.duration_ms as number), 0) /
            tabSwitchEvents.length,
        )
      : null;

  const maxLongTask = longTaskEvents.length > 0
    ? Math.max(...longTaskEvents.map((e) => e.data.max_ms as number))
    : null;

  const parkChartData = parkSwitchEvents.map((e) => ({
    time: new Date(e.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    label: `${e.data.from} → ${e.data.to}`,
    render_ms: e.data.render_ms as number,
    network_ms: (e.data.network_ms as number | null) ?? undefined,
  }));

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin/health")}>
            <ArrowLeft size={18} />
          </Button>
          <div>
            <h1 className="text-xl font-heading font-bold">Performance Telemetry</h1>
            <p className="text-sm text-muted-foreground">
              In-memory session events · {events.length} captured
            </p>
          </div>
          <div className="ml-auto">
            <Button variant="outline" size="sm" onClick={clearPerfEvents} className="gap-1.5">
              <Trash2 size={14} />
              Clear
            </Button>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <Gauge size={18} className="mx-auto mb-1 text-muted-foreground" />
              <p className="text-2xl font-bold font-heading">{tabSwitchEvents.length}</p>
              <p className="text-xs text-muted-foreground">Slow switches</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <Activity size={18} className="mx-auto mb-1 text-muted-foreground" />
              <p className="text-2xl font-bold font-heading">
                {avgTabSwitch !== null ? `${avgTabSwitch}ms` : "—"}
              </p>
              <p className="text-xs text-muted-foreground">Avg switch time</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <Zap size={18} className="mx-auto mb-1 text-muted-foreground" />
              <p className="text-2xl font-bold font-heading">
                {maxLongTask !== null ? `${maxLongTask}ms` : "—"}
              </p>
              <p className="text-xs text-muted-foreground">Max long task</p>
            </CardContent>
          </Card>
        </div>

        {/* Park switch timing chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin size={16} />
              Park Switch Timing
              <Badge variant="secondary" className="ml-auto">
                {parkSwitchEvents.length} events
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {parkChartData.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No park switches recorded yet. Switch parks on Discover to generate data.
              </p>
            ) : (
              <ChartContainer config={chartConfig} className="aspect-[2/1] w-full">
                <LineChart data={parkChartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                  <XAxis dataKey="time" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                  <YAxis tick={{ fontSize: 10 }} unit="ms" className="fill-muted-foreground" />
                  <ChartTooltip
                    content={<ChartTooltipContent labelKey="label" />}
                  />
                  <Line
                    type="monotone"
                    dataKey="render_ms"
                    stroke="var(--color-render_ms)"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    name="Render"
                  />
                  <Line
                    type="monotone"
                    dataKey="network_ms"
                    stroke="var(--color-network_ms)"
                    strokeWidth={2}
                    strokeDasharray="4 2"
                    dot={{ r: 3 }}
                    name="Network"
                    connectNulls={false}
                  />
                  <ReferenceLine
                    y={200}
                    stroke="hsl(var(--destructive))"
                    strokeDasharray="6 3"
                    strokeWidth={1.5}
                    label={{ value: "200ms", position: "right", fill: "hsl(var(--destructive))", fontSize: 10 }}
                  />
                </LineChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        {/* Slow Tab Switches */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Gauge size={16} />
              Slow Tab Switches
              <Badge variant="secondary" className="ml-auto">&gt;80ms</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {tabSwitchEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No slow tab switches detected this session. 🎉
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>From → To</TableHead>
                    <TableHead className="text-right">Duration</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...tabSwitchEvents].reverse().map((e, i) => (
                    <TableRow key={`ts-${i}`}>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(e.timestamp).toLocaleTimeString()}
                      </TableCell>
                      <TableCell className="text-sm">
                        {e.data.from as string} → {e.data.to as string}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant={(e.data.duration_ms as number) > 200 ? "destructive" : "secondary"}>
                          {e.data.duration_ms as number}ms
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Long tasks */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap size={16} />
              Long Task Batches
              <Badge variant="secondary" className="ml-auto">&gt;100ms</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {longTaskEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No long tasks captured this session.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead className="text-right">Count</TableHead>
                    <TableHead className="text-right">Max</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...longTaskEvents].reverse().map((e, i) => (
                    <TableRow key={`lt-${i}`}>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(e.timestamp).toLocaleTimeString()}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {e.data.count as number}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant={(e.data.max_ms as number) > 200 ? "destructive" : "secondary"}>
                          {e.data.max_ms as number}ms
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminPerformancePage;
