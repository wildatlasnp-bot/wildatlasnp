import { useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface DeletionBannerProps {
  scheduledDeletionAt: string;
  onCancelDeletion: () => void;
}

const DeletionBanner = ({ scheduledDeletionAt, onCancelDeletion }: DeletionBannerProps) => {
  const [cancelling, setCancelling] = useState(false);
  const { toast } = useToast();

  const formattedDate = new Date(scheduledDeletionAt).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  const handleRestore = async () => {
    setCancelling(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated — please sign in again.");

      const { data, error } = await supabase.functions.invoke("cancel-deletion", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) {
        console.error("[cancel-deletion] invoke error:", error);
        throw new Error(error.message || "Failed to reach the server. Please check your connection.");
      }
      if (data?.error) {
        console.error("[cancel-deletion] response error:", data.error);
        throw new Error(data.error);
      }

      onCancelDeletion();
      toast({ title: "Account restored", description: "Your account is fully active again." });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Please try again.";
      toast({ title: "Restore failed", description: msg, variant: "destructive" });
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="mx-4 mt-2 rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 flex items-start gap-3">
      <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">Account deletion pending</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Your data will be permanently deleted on <strong>{formattedDate}</strong>.
        </p>
        <button
          onClick={handleRestore}
          disabled={cancelling}
          className="mt-2 text-xs font-semibold text-primary hover:underline disabled:opacity-50 flex items-center gap-1"
        >
          {cancelling && <Loader2 className="h-3 w-3 animate-spin" />}
          Restore my account
        </button>
      </div>
    </div>
  );
};

export default DeletionBanner;
