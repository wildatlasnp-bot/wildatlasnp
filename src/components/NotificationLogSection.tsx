import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshCw, Bell, Inbox } from "lucide-react";

interface NotificationEntry {
  id: string;
  watch_id: string;
  channel: string;
  status: string;
  error_message: string | null;
  permit_name: string;
  park_id: string;
  retry_count: number;
  max_retries: number;
  next_retry_at: string | null;
  created_at: string;
}

interface NotificationSummary {
  total: number;
  sent: number;
  failed: number;
  pending_retry: number;
  exhausted: number;
}

interface QueueDepth {
  pending: number;
  sent: number;
  exhausted: number;
  total: number;
}

interface NotificationData {
  summary: NotificationSummary;
  queue: QueueDepth;
  recent: NotificationEntry[];
}

const NotificationLogSection = () => {
  const [data, setData] = useState<NotificationData | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const { data: result, error } = await supabase.functions.invoke("admin-notifications");
      if (error) throw error;
      setData(result);
    } catch (e) {
      console.error("Failed to fetch notification log:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const statusBadge = (status: string, retryCount: number, maxRetries: number, nextRetryAt: string | null) => {
    if (status === "sent") return <Badge className="text-xs bg-green-600/15 text-green-700 border-green-300">Sent</Badge>;
    if (status === "failed" && retryCount >= maxRetries) return <Badge variant="destructive" className="text-xs">Exhausted</Badge>;
    if (status === "failed" && nextRetryAt) return <Badge className="text-xs bg-amber-500/15 text-amber-700 border-amber-300">Retry {retryCount}/{maxRetries}</Badge>;
    return <Badge variant="secondary" className="text-xs">Failed</Badge>;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <Bell className="h-4 w-4" /> Notification Log (48h)
        </CardTitle>
        <Button onClick={fetchNotifications} disabled={loading} variant="outline" size="sm">
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {data?.summary && (
          <div className="flex items-center gap-3 flex-wrap">
            <div>
              <span className="text-2xl font-bold text-foreground">{data.summary.total}</span>
              <span className="text-xs text-muted-foreground ml-1.5">total</span>
            </div>
            <Badge className="text-xs bg-green-600/15 text-green-700 border-green-300">{data.summary.sent} sent</Badge>
            <Badge className="text-xs bg-amber-500/15 text-amber-700 border-amber-300">{data.summary.pending_retry} retrying</Badge>
            {data.summary.exhausted > 0 && (
              <Badge variant="destructive" className="text-xs">{data.summary.exhausted} exhausted</Badge>
            )}
          </div>
        )}

        {data?.queue && (
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <Inbox className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Queue Depth</span>
            </div>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="text-center">
                <span className="text-xl font-bold text-foreground">{data.queue.pending}</span>
                <p className="text-[10px] text-muted-foreground">Pending</p>
              </div>
              <div className="text-center">
                <span className="text-xl font-bold text-green-700">{data.queue.sent}</span>
                <p className="text-[10px] text-muted-foreground">Sent</p>
              </div>
              <div className="text-center">
                <span className="text-xl font-bold text-destructive">{data.queue.exhausted}</span>
                <p className="text-[10px] text-muted-foreground">Exhausted</p>
              </div>
              <div className="ml-auto text-right">
                <span className="text-sm text-muted-foreground">{data.queue.total} total</span>
              </div>
            </div>
          </div>
        )}

        {!data?.recent?.length ? (
          <p className="text-sm text-muted-foreground">No notifications in the last 48 hours</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead>Permit</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Error</TableHead>
                <TableHead>Next Retry</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.recent.map((n) => (
                <TableRow key={n.id}>
                  <TableCell className="text-xs whitespace-nowrap">
                    {new Date(n.created_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {n.channel === "sms" ? "📱 SMS" : "📧 Email"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs font-medium max-w-[150px] truncate">{n.permit_name}</TableCell>
                  <TableCell>{statusBadge(n.status, n.retry_count, n.max_retries, n.next_retry_at)}</TableCell>
                  <TableCell className="text-xs max-w-[180px] truncate text-muted-foreground">{n.error_message ?? "—"}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap">
                    {n.next_retry_at
                      ? new Date(n.next_retry_at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
                      : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

export default NotificationLogSection;
