import { useMemo, useState } from "react";
import { CreditCard, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface PaymentIssueBannerProps {
  /** ISO timestamp when the past_due flag was first set */
  paymentStatusSince: string | null;
}

/**
 * Surfaced when a user's most recent subscription invoice failed.
 * They keep Pro access during a 3-day grace period so they aren't
 * suddenly downgraded; this banner is the conversion path back to "ok".
 */
const GRACE_DAYS = 3;

const PaymentIssueBanner = ({ paymentStatusSince }: PaymentIssueBannerProps) => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const { daysLeft, urgent } = useMemo(() => {
    if (!paymentStatusSince) return { daysLeft: GRACE_DAYS, urgent: false };
    const elapsedMs = Date.now() - new Date(paymentStatusSince).getTime();
    const elapsedDays = Math.floor(elapsedMs / (1000 * 60 * 60 * 24));
    const remaining = Math.max(0, GRACE_DAYS - elapsedDays);
    return { daysLeft: remaining, urgent: remaining <= 1 };
  }, [paymentStatusSince]);

  const handleUpdatePayment = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated — please sign in again.");

      const { data, error } = await supabase.functions.invoke("customer-portal", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) throw new Error(error.message || "Couldn't open the billing portal.");
      if (data?.error) throw new Error(data.error);
      if (!data?.url) throw new Error("Billing portal returned no URL.");

      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Please try again.";
      toast({ title: "Couldn't open billing", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const headline = urgent
    ? "Last chance — payment needed today"
    : "Payment failed";
  const body = daysLeft > 0
    ? `Your last charge didn't go through. Update your card within ${daysLeft} day${daysLeft === 1 ? "" : "s"} to keep Pro active.`
    : "Your Pro access will be revoked shortly. Update your payment method to restore it.";

  return (
    <div
      className={`mx-4 mt-2 rounded-2xl border px-4 py-3 flex items-start gap-3 ${
        urgent
          ? "border-destructive/40 bg-destructive/10"
          : "border-amber-500/30 bg-amber-50/60"
      }`}
      role="alert"
    >
      <CreditCard
        className={`h-5 w-5 shrink-0 mt-0.5 ${urgent ? "text-destructive" : "text-amber-700"}`}
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{headline}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{body}</p>
        <button
          onClick={handleUpdatePayment}
          disabled={loading}
          className="mt-2 text-xs font-semibold text-primary hover:underline disabled:opacity-50 flex items-center gap-1 min-h-[44px] py-2 -my-2"
        >
          {loading && <Loader2 className="h-3 w-3 animate-spin" />}
          Update payment method →
        </button>
      </div>
    </div>
  );
};

export default PaymentIssueBanner;
