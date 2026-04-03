import { useState, useEffect, useCallback, useRef } from "react";
import ProModal from "@/components/ProModal";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useProStatus } from "@/hooks/useProStatus";
import { useMochiStats } from "@/hooks/useMochiStats";
import { useToast } from "@/hooks/use-toast";
import { User, Mail, Phone, Loader2, LogOut, MessageSquare, Trash2, Crown, ExternalLink, Zap, Shield, Check, CheckCircle, RotateCcw, ChevronRight, Bell, BellRing, Info, FileText, Scale, Lock, ArrowRight, Eye, EyeOff, Undo2, AlertTriangle } from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import BottomNav from "@/components/BottomNav";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toE164, formatPhoneDisplay, isValidUSPhone } from "@/lib/phone";
import { resetAllTips } from "@/lib/dismissable-tips";
import EmailPreviewModal from "@/components/EmailPreviewModal";
import ScrollableFooter from "@/components/ScrollableFooter";
import { useScrollFadeHeader } from "@/hooks/useScrollFadeHeader";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const PRO_BENEFITS = [
  "Track every park on your list",
  "Instant SMS alerts the moment permits drop",
  "Coverage across all monitored parks",
];

const SettingsPage = ({ embedded }: { embedded?: boolean }) => {
  const { user, displayName, signOut, scheduledDeletionAt, clearDeletionSchedule, refreshProfile } = useAuth();
  const { isPro, subscriptionEnd, refreshProStatus } = useProStatus();
  const mochiStats = useMochiStats();
  const { toast } = useToast();
  const navigate = useNavigate();
  const headerFadeRef = useScrollFadeHeader();
  const googleName = user?.user_metadata?.full_name || user?.user_metadata?.name || "";
  const [name, setName] = useState(displayName ?? googleName);
  const [savedName, setSavedName] = useState(displayName ?? googleName);
  const [phone, setPhone] = useState(""); // raw 10 digits only
  const [savedPhone, setSavedPhone] = useState(""); // what's in DB (raw 10 digits)
  const [phoneEditing, setPhoneEditing] = useState(false);
  const [phoneError, setPhoneError] = useState("");
  const [phoneSaving, setPhoneSaving] = useState(false);
  const [phoneRemoving, setPhoneRemoving] = useState(false);
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [notifySms, setNotifySms] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [showVerifyOtp, setShowVerifyOtp] = useState(false);
  const [otpDigits, setOtpDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [otpError, setOtpError] = useState("");
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [otpResendTimer, setOtpResendTimer] = useState(0);
  const [otpSuccess, setOtpSuccess] = useState(false);
  const [emailRevealed, setEmailRevealed] = useState(false);
  const emailRevealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [managingPortal, setManagingPortal] = useState(false);
  const [proModalOpen, setProModalOpen] = useState(false);
  const [showInlinePhone, setShowInlinePhone] = useState(false);
  const [inlinePhoneNumber, setInlinePhoneNumber] = useState("");
  const [inlinePhoneSaving, setInlinePhoneSaving] = useState(false);
  const [inlinePhoneSaved, setInlinePhoneSaved] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const [emailPreviewOpen, setEmailPreviewOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveVersionRef = useRef(0); // prevents stale fetches overwriting saves

  const showSaveStatus = useCallback((status: "saving" | "saved" | "error") => {
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    setSaveStatus(status);
    if (status === "saved" || status === "error") {
      savedTimerRef.current = setTimeout(() => setSaveStatus("idle"), 2500);
    }
  }, []);

  const persistProfile = useCallback(async (updates: Record<string, unknown>) => {
    if (!user) return false;
    showSaveStatus("saving");
    saveVersionRef.current += 1;
    const { error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("user_id", user.id);
    if (error) {
      showSaveStatus("error");
      toast({ title: "Failed to save", description: "Your changes couldn't be saved. Please try again.", variant: "destructive" });
      return false;
    } else {
      showSaveStatus("saved");
      await refreshProfile();
      return true;
    }
  }, [user, toast, refreshProfile, showSaveStatus]);

  const debouncedSaveField = useCallback((field: string, value: unknown, rollback: () => void) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      const ok = await persistProfile({ [field]: value });
      if (ok && field === "display_name") {
        setSavedName(typeof value === "string" ? value : "");
      }
      if (!ok) rollback();
    }, 700);
  }, [persistProfile]);


  // Sync displayName from context into local state whenever it changes,
  // but only if the user hasn't made a local edit (name matches last saved value)
  useEffect(() => {
    if (!displayName) return;
    // Only sync if name is still equal to savedName (no pending edit)
    setName((prev) => {
      // On first mount prev will be the initial value; always accept context value
      // if it differs from what we think is saved
      return prev === savedName ? displayName : prev;
    });
    setSavedName(displayName);
  }, [displayName]);

  // Load phone/notification data once
  useEffect(() => {
    if (!user || loaded) return;
    const loadVersion = saveVersionRef.current;
    supabase
      .from("profiles")
      .select("phone_number, notify_email, notify_sms, phone_verified")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        // Don't overwrite if a save happened while we were loading
        if (saveVersionRef.current > loadVersion) return;
        if (data?.phone_number) {
          const raw = data.phone_number.replace(/^\+1/, "");
          setPhone(raw);
          setSavedPhone(raw);
        }
        if (data?.notify_email !== undefined && data.notify_email !== null) setNotifyEmail(data.notify_email);
        if (data?.notify_sms !== undefined && data.notify_sms !== null) setNotifySms(data.notify_sms);
        if (data?.phone_verified) setPhoneVerified(true);
        setLoaded(true);
      });
  }, [user, loaded]);

  // OTP resend countdown
  useEffect(() => {
    if (otpResendTimer <= 0) return;
    const t = setTimeout(() => setOtpResendTimer((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [otpResendTimer]);

  if (!user) return null;

  // ── Masking helpers ──
  const maskEmail = (email: string) => {
    const [local, domain] = email.split("@");
    if (!domain) return email;
    const visible = local.slice(0, 2);
    return `${visible}${"*".repeat(Math.max(local.length - 2, 4))}@${domain}`;
  };

  const maskPhone = (raw: string) => {
    if (raw.length < 4) return "(***) ***-****";
    const last4 = raw.slice(-4);
    return `(***) ***-${last4}`;
  };

  const revealEmail = () => {
    setEmailRevealed(true);
    if (emailRevealTimer.current) clearTimeout(emailRevealTimer.current);
    emailRevealTimer.current = setTimeout(() => setEmailRevealed(false), 3000);
  };

  const handlePhoneEdit = () => {
    setPhone(savedPhone);
    setPhoneEditing(true);
    setPhoneError("");
  };

  const handlePhoneSave = async () => {
    if (!phone) {
      setPhoneError("");
      setPhoneEditing(false);
      return;
    }
    if (!isValidUSPhone(phone)) {
      setPhoneError("Please enter a valid phone number.");
      return;
    }
    setPhoneSaving(true);
    const e164 = toE164(phone)!;
    const { error } = await supabase
      .from("profiles")
      .update({ phone_number: e164, sms_consent_at: new Date().toISOString(), sms_consent_version: 'v1-2026-03' })
      .eq("user_id", user.id);
    setPhoneSaving(false);
    if (error) {
      toast({ title: "Couldn't save", description: "Please try again.", variant: "destructive" });
    } else {
      setSavedPhone(phone);
      setPhoneEditing(false);
      setPhoneVerified(false);
      setShowVerifyOtp(false);
      setPhoneError("");
      toast({ title: "Phone number saved" });
    }
  };

  const handlePhoneRemove = async () => {
    setPhoneRemoving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ phone_number: null, phone_verified: false, notify_sms: false })
      .eq("user_id", user.id);
    setPhoneRemoving(false);
    if (error) {
      toast({ title: "Couldn't remove", description: "Please try again.", variant: "destructive" });
    } else {
      setPhone("");
      setSavedPhone("");
      setPhoneEditing(false);
      setPhoneVerified(false);
      setNotifySms(false);
      setShowVerifyOtp(false);
      toast({ title: "Phone number removed" });
    }
  };

  const sendVerificationCode = async () => {
    const e164 = toE164(savedPhone);
    if (!e164) return;
    setOtpSending(true);
    setOtpError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke("send-verification-code", {
        body: { phone: e164 },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (error) {
        console.error("send-verification-code invoke error:", error);
        setOtpError("Failed to send verification code — please try again.");
        return;
      }
      if (data?.error) {
        console.error("send-verification-code response error:", data.error);
        setOtpError(data.error === "Failed to send SMS"
          ? "Failed to send verification code — please try again."
          : data.error);
        return;
      }
      setOtpResendTimer(30);
    } catch (e) {
      console.error("send-verification-code exception:", e);
      setOtpError("Failed to send verification code — please try again.");
    } finally {
      setOtpSending(false);
    }
  };

  const startVerification = async () => {
    setShowVerifyOtp(true);
    setOtpDigits(["", "", "", "", "", ""]);
    setOtpError("");
    setOtpSuccess(false);
    const e164 = toE164(savedPhone);
    if (!e164) return;
    setOtpSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke("send-verification-code", {
        body: { phone: e164 },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (error || data?.error) {
        const msg = data?.error === "Failed to send SMS"
          ? "Failed to send verification code — please try again."
          : (data?.error || "Failed to send verification code — please try again.");
        console.error("send-verification-code error:", error || data?.error);
        setOtpError(msg);
        return;
      }
      setOtpResendTimer(30);
    } catch (e) {
      console.error("send-verification-code exception:", e);
      setOtpError("Failed to send verification code — please try again.");
    } finally {
      setOtpSending(false);
    }
  };

  const handleOtpDigitChange = (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return;
    setOtpError("");
    const next = [...otpDigits];
    next[index] = value;
    setOtpDigits(next);
    if (value && index < 5) {
      document.getElementById(`settings-otp-${index + 1}`)?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otpDigits[index] && index > 0) {
      document.getElementById(`settings-otp-${index - 1}`)?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) {
      setOtpDigits(pasted.split(""));
      document.getElementById("settings-otp-5")?.focus();
    }
  };

  const verifyCode = async () => {
    const code = otpDigits.join("");
    if (code.length !== 6) return;
    setOtpVerifying(true);
    setOtpError("");
    try {
      const e164 = toE164(savedPhone);
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error: fnError } = await supabase.functions.invoke("verify-phone-code", {
        body: { phone: e164, code },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (fnError) {
        setOtpError("Verification failed. Try again.");
        setOtpVerifying(false);
        return;
      }
      if (data?.verified) {
        setOtpSuccess(true);
        setPhoneVerified(true);
        setTimeout(() => {
          setShowVerifyOtp(false);
          setOtpSuccess(false);
          toast({ title: "Phone verified ✓", description: "SMS alerts are now available." });
        }, 1500);
      } else {
        setOtpError(data?.error || "Incorrect code — please try again.");
      }
    } catch {
      setOtpError("Verification failed. Try again.");
    } finally {
      setOtpVerifying(false);
    }
  };


  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    setDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated — please sign in again.");

      const { data, error } = await supabase.functions.invoke("delete-account", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error) throw new Error(error.message || "Failed to reach the server.");
      if (data?.error) throw new Error(data.error);
      const deletionDate = data?.deletion_date
        ? new Date(data.deletion_date).toLocaleDateString()
        : "7 days";
      const subNote = data?.subscription_cancelled
        ? " Your Pro subscription has been cancelled."
        : "";
      toast({
        title: "Account scheduled for deletion",
        description: `Your account will be permanently deleted on ${deletionDate}.${subNote} Log back in anytime before then to restore it.`,
      });
      await signOut();
      navigate("/");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Couldn't schedule account deletion. Please try again or contact support at support@wildatlas.app.";
      toast({ title: "Couldn't delete account", description: msg });
      setDeleting(false);
    }
  };

  const handleCancelDeletion = async () => {
    if (!user) return;
    setCancelling(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated — please sign in again.");

      const { data, error } = await supabase.functions.invoke("cancel-deletion", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error) {
        console.error("[cancel-deletion] invoke error:", error);
        throw new Error(error.message || "Failed to reach the server. Please check your connection and try again.");
      }
      if (data?.error) {
        console.error("[cancel-deletion] response error:", data.error);
        throw new Error(data.error);
      }
      clearDeletionSchedule();
      await refreshProfile();
      toast({
        title: "Account restored!",
        description: "Your account deletion has been cancelled. Welcome back!",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      toast({ title: "Couldn't cancel deletion", description: msg, variant: "destructive" });
    } finally {
      setCancelling(false);
    }
  };

  const handleManageSubscription = async () => {
    setManagingPortal(true);
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal");
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (e) {
      console.error("Portal error:", e);
      toast({ title: "Couldn't open portal", description: "Please try again." });
    } finally {
      setManagingPortal(false);
    }
  };

  return (
    <div className={`bg-background max-w-lg mx-auto px-5 py-6 ${embedded ? 'pb-4 h-full overflow-y-auto' : 'min-h-screen pb-20'}`} {...(embedded ? { 'data-tab-scroll': '' } : {})}>
      {/* Header */}
      <div className="mb-8" ref={headerFadeRef}>
        <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 32, fontWeight: 300, letterSpacing: '0.02em', color: '#1A1814', lineHeight: 1.2, opacity: "var(--header-opacity, 1)" as any, willChange: "opacity" }}>Settings</h1>
        {displayName && (
          <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 16, fontStyle: 'italic', fontWeight: 300, color: 'rgba(26,24,20,0.45)', marginTop: 2, opacity: "var(--header-opacity, 1)" as any, willChange: "opacity" }}>
            Hello, {displayName.split(" ")[0]}
          </p>
        )}
      </div>

      {/* Subscription */}
      <div className="mb-8">
        {isPro ? (
          /* Pro user — single confirmation card */
          <div className="tactile-card rounded-[18px] border border-secondary/30 bg-secondary/5 overflow-hidden" style={{ boxShadow: "var(--card-shadow)" }}>
            <div className="h-1 w-full rounded-t-[18px]" style={{ background: 'linear-gradient(90deg, #2F6F4E 0%, #4A9B70 100%)' }} />
            <div className="px-4 pt-4 pb-3">
              <div className="flex items-center gap-2.5 mb-1">
                <Crown size={18} className="text-secondary" />
                <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 500, color: '#3A3E3B' }}>Pro Plan ✓</p>
              </div>
              {subscriptionEnd && (
                <p className="text-[12px] text-muted-foreground">
                  Renews {new Date(subscriptionEnd).toLocaleDateString()}
                </p>
              )}
              {!mochiStats.loading && mochiStats.scanCount !== null && mochiStats.scanCount > 0 && (
                <div className="flex items-center gap-1.5 mt-1">
                  <Zap size={11} className="text-primary shrink-0" />
                  <p className="text-[11px] text-muted-foreground">
                    Mochi has scanned {mochiStats.scanCount.toLocaleString()} permits this month
                  </p>
                </div>
              )}
            </div>
            <div className="px-4 pb-4">
              {/* Cancel Subscription — two-step confirmation */}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button
                    disabled={managingPortal}
                    className="w-full flex items-center justify-center gap-2 rounded-lg py-2.5 text-[12px] font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                    style={{ background: 'rgba(226,75,74,0.08)', color: '#E24B4A', border: '1px solid rgba(226,75,74,0.2)' }}
                  >
                    {managingPortal && <Loader2 size={14} className="animate-spin" />}
                    {managingPortal ? "Opening…" : "Cancel Subscription"}
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Cancel Pro subscription?</AlertDialogTitle>
                    <AlertDialogDescription>
                      You'll keep Pro access until the end of your billing period.
                      <span className="block mt-2 italic text-[11px] text-muted-foreground">
                        Mochi is actively watching your permits — cancelling will pause all scans.
                      </span>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel
                      onClick={handleManageSubscription}
                      className="text-muted-foreground"
                    >
                      Cancel Subscription
                    </AlertDialogCancel>
                    <AlertDialogAction className="bg-primary text-primary-foreground hover:bg-primary/90">
                      Keep Pro
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <button
                onClick={handleManageSubscription}
                disabled={managingPortal}
                className="w-full text-center text-[11px] text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors mt-2 disabled:opacity-50 min-h-[36px] flex items-center justify-center"
              >
                Manage Subscription
              </button>

              <button
                onClick={() => setRefundOpen(true)}
                className="w-full text-center text-[11px] text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors mt-2 min-h-[36px] flex items-center justify-center"
              >
                Refund Policy
              </button>
            </div>

            {/* Refund Policy Modal */}
            <Dialog open={refundOpen} onOpenChange={setRefundOpen}>
              <DialogContent className="max-w-sm rounded-2xl p-6">
                <h3 className="text-[15px] font-heading font-bold text-foreground mb-3">Refund Policy</h3>
                <div className="space-y-2.5 text-[12px] text-muted-foreground leading-relaxed">
                  <p>We want you to be happy with WildAtlas Pro. If you're not satisfied, here's how refunds work:</p>
                  <ul className="list-disc pl-4 space-y-1.5">
                    <li>Request a refund within <strong className="text-foreground">7 days</strong> of your first payment for a full refund — no questions asked.</li>
                    <li>After 7 days, refunds are prorated based on remaining time in your billing cycle.</li>
                    <li>Cancel anytime from Settings to stop future charges immediately.</li>
                  </ul>
                  <p>Contact us at <strong className="text-foreground">wildatlasnp@gmail.com</strong> for refund requests.</p>
                </div>
                <button
                  onClick={() => setRefundOpen(false)}
                  className="mt-4 w-full py-2.5 rounded-xl bg-muted text-foreground text-[13px] font-semibold hover:bg-muted/80 transition-colors"
                >
                  Got it
                </button>
              </DialogContent>
            </Dialog>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {/* Card A — Your Plan (Free) */}
            <div className="tactile-card rounded-[18px] overflow-hidden" style={{ backgroundColor: '#F7F5F2', border: '0.5px solid rgba(0,0,0,0.07)', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <div className="px-4 py-4">
                <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 9, fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: 'rgba(26,24,20,0.35)', marginBottom: 4 }}>Current Plan</p>
                <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 500, color: '#3A3E3B' }}>Free Plan</p>
                <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: 'rgba(58,62,59,0.5)', marginTop: 4 }}>
                  1 park alert · 5-min scans · Mochi (20 msg/day)
                </p>
              </div>
            </div>

            {/* Card B — Go Pro */}
            <div
              className="tactile-card rounded-[18px] overflow-hidden transition-all duration-200"
              style={{
                background: '#EDE8E1',
                border: '1.5px solid rgba(47,111,78,0.85)',
                boxShadow: '0 4px 24px rgba(47,111,78,0.15)',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(47,111,78,1)'; e.currentTarget.style.boxShadow = '0 6px 32px rgba(47,111,78,0.22)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(47,111,78,0.85)'; e.currentTarget.style.boxShadow = '0 4px 24px rgba(47,111,78,0.15)'; }}
            >
              <div className="p-4">
                {/* RECOMMENDED badge */}
                <div className="flex items-center gap-2.5 mb-3">
                  <span
                    className="font-body"
                    style={{
                      fontSize: 9,
                      fontWeight: 700,
                      letterSpacing: '0.14em',
                      textTransform: 'uppercase',
                      color: '#FFFFFF',
                      background: '#2F6F4E',
                      borderRadius: 99,
                      padding: '3px 10px',
                    }}
                  >
                    Recommended
                  </span>
                  <span className="font-body" style={{ fontSize: 12, color: 'rgba(26,24,20,0.4)' }}>
                    · $9.99/mo
                  </span>
                </div>

                {/* Headline */}
                <p
                  className="font-heading"
                  style={{
                    fontSize: 20,
                    fontWeight: 500,
                    fontStyle: 'italic',
                    color: '#1A2E1F',
                    lineHeight: 1.25,
                    marginBottom: 4,
                  }}
                >
                  Permits open. Then vanish. Be first.
                </p>

                {/* Mochi row */}
                <div className="flex items-center gap-3 mt-3 mb-3">
                  <img
                    src="/mochi-standing.png"
                    alt="Mochi companion"
                    className="shrink-0 object-contain"
                    style={{ width: 40, height: 40 }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-body" style={{ fontSize: 13, fontWeight: 500, color: '#1A2E1F' }}>Pro Plan</p>
                    <p className="font-body" style={{ fontSize: 11, color: 'rgba(58,62,59,0.5)', marginTop: 1 }}>
                      Mochi scans every 2 minutes, 24/7
                    </p>
                  </div>
                </div>

                {/* Feature comparison */}
                <div className="grid grid-cols-2 gap-3 mt-1 mb-4">
                  {/* Free column */}
                  <div>
                    <p className="font-body" style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(26,24,20,0.35)', marginBottom: 6 }}>Free</p>
                    <div className="flex flex-col gap-2">
                      {["1 park alert", "5-min scans", "Email only"].map((f) => (
                        <div key={f} className="flex items-center gap-2">
                          <span className="font-body" style={{ fontSize: 11, color: 'rgba(26,24,20,0.35)', width: 12, textAlign: 'center' }}>—</span>
                          <span className="font-body" style={{ fontSize: 11, color: 'rgba(26,24,20,0.45)' }}>{f}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Pro column */}
                  <div>
                    <p className="font-body" style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#2F6F4E', marginBottom: 6 }}>Pro</p>
                    <div className="flex flex-col gap-2">
                      {[
                        { text: "All parks", bold: false },
                        { text: "⚡ 2-min scans", bold: true },
                        { text: "SMS + email alerts", bold: false },
                      ].map((f) => (
                        <div key={f.text} className="flex items-center gap-2">
                          <Check size={12} style={{ color: '#2F6F4E', flexShrink: 0 }} />
                          <span className="font-body" style={{ fontSize: 11, color: '#1A2E1F', fontWeight: f.bold ? 700 : 400 }}>{f.text}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* CTA */}
                <button
                  onClick={() => setProModalOpen(true)}
                  className="tactile-button w-full flex items-center justify-center hover:brightness-110 active:scale-[0.98] transition-all font-body"
                  style={{
                    height: 48,
                    borderRadius: 10,
                    backgroundColor: '#2F6F4E',
                    color: '#F0EDEA',
                    fontSize: 14,
                    fontWeight: 600,
                  }}
                >
                  Upgrade — $9.99/mo
                </button>

                {/* Trust bar */}
                <div className="flex items-center justify-center gap-3 mt-3">
                  <div className="flex items-center gap-1">
                    <Shield size={10} style={{ color: 'rgba(47,111,78,0.5)' }} />
                    <span className="font-body" style={{ fontSize: 9, color: 'rgba(26,24,20,0.35)' }}>Cancel anytime</span>
                  </div>
                  <span style={{ color: 'rgba(26,24,20,0.15)' }}>·</span>
                  <div className="flex items-center gap-1">
                    <RotateCcw size={10} style={{ color: 'rgba(47,111,78,0.5)' }} />
                    <span className="font-body" style={{ fontSize: 9, color: 'rgba(26,24,20,0.35)' }}>7-day refund</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Profile */}
      <div className="mt-6 flex items-center justify-between mb-1.5">
        <p className="text-[11px] font-semibold tracking-[0.06em] uppercase text-muted-foreground">Profile</p>
        {saveStatus !== "idle" && (
          <span className={`text-[10px] font-medium flex items-center gap-1 transition-opacity ${
            saveStatus === "saving" ? "text-muted-foreground" :
            saveStatus === "saved" ? "text-secondary" :
            "text-destructive"
          }`}>
            {saveStatus === "saving" && <><Loader2 size={10} className="animate-spin" /> Saving…</>}
            {saveStatus === "saved" && <><Check size={10} /> Saved</>}
            {saveStatus === "error" && <><AlertTriangle size={10} /> Failed to save</>}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1.5 mb-3">
        <Lock size={10} className="text-muted-foreground/50" aria-hidden="true" />
        <p className="text-[9px] text-muted-foreground/55">Your information is masked for privacy</p>
      </div>
        <div className="mb-8">
        <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
          {/* Row: Email */}
          <div className="flex items-center gap-3" style={{ padding: '14px 16px' }}>
            <Mail size={15} className="text-muted-foreground shrink-0" />
            <span className="text-[13px] text-foreground truncate flex-1">
              {emailRevealed ? (user?.email ?? "—") : maskEmail(user?.email ?? "—")}
            </span>
            <button
              onClick={revealEmail}
              className="p-1 rounded-md text-muted-foreground/40 hover:text-muted-foreground transition-colors shrink-0"
              aria-label={emailRevealed ? "Email visible" : "Reveal email"}
            >
              {emailRevealed ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>

          {/* Divider */}
          <div className="w-full h-px" style={{ backgroundColor: '#E8E6E1' }} />

          {/* Row: Name */}
          <div className="flex items-center gap-3" style={{ padding: '14px 16px' }}>
            <User size={15} className="text-muted-foreground shrink-0" />
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                const trimmed = e.target.value.trim() || null;
                debouncedSaveField("display_name", trimmed, () => {
                  setName(savedName);
                });
              }}
              onBlur={() => {
                if (saveTimeoutRef.current) {
                  clearTimeout(saveTimeoutRef.current);
                  const trimmed = name.trim() || null;
                  persistProfile({ display_name: trimmed }).then((ok) => {
                    if (ok) {
                      setSavedName(name);
                    } else {
                      setName(savedName);
                    }
                  });
                }
              }}
              placeholder="Your name"
              aria-label="Display name"
              className="flex-1 bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground outline-none"
            />
          </div>

          {/* Divider */}
          <div className="w-full h-px" style={{ backgroundColor: '#E8E6E1' }} />

          {/* Row: Phone */}
          {!phoneEditing ? (
            <div className="flex items-center gap-3" style={{ padding: '14px 16px' }}>
              <Phone size={15} className="text-muted-foreground shrink-0" />
              <span className="flex-1 text-[13px] text-foreground">
                {savedPhone ? maskPhone(savedPhone) : <span className="text-muted-foreground italic">No phone number</span>}
              </span>
              {phoneVerified && (
                <span className="flex items-center gap-1 text-[11px] font-semibold text-secondary shrink-0">
                  <Check size={12} /> Verified
                </span>
              )}
              <button
                onClick={handlePhoneEdit}
                className="text-[11px] font-semibold text-primary hover:opacity-80 transition-opacity shrink-0"
              >
                {savedPhone ? "Edit" : "Add"}
              </button>
            </div>
          ) : (
            <div style={{ padding: '14px 16px' }}>
              <div className="flex items-center gap-3">
                <Phone size={15} className="text-muted-foreground shrink-0" />
                <input
                  type="tel"
                  value={formatPhoneDisplay(phone)}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/\D/g, "").slice(0, 10);
                    setPhone(raw);
                    setPhoneError("");
                  }}
                  placeholder="(555) 123-4567"
                  aria-label="Phone number"
                  className="flex-1 bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground outline-none"
                  autoFocus
                />
                <button
                  onClick={handlePhoneSave}
                  disabled={phoneSaving}
                  className="text-[11px] font-semibold text-secondary hover:opacity-80 transition-opacity shrink-0 disabled:opacity-40"
                >
                  {phoneSaving ? "Saving…" : "Save"}
                </button>
                <button
                  onClick={() => { setPhoneEditing(false); setPhone(savedPhone); setPhoneError(""); }}
                  className="text-[11px] text-muted-foreground hover:text-foreground transition-colors shrink-0"
                >
                  Cancel
                </button>
              </div>
              {phoneError && (
                <p className="text-[10px] text-destructive mt-2 px-1" role="alert">{phoneError}</p>
              )}
              <p className="text-[10px] text-muted-foreground mt-2 px-1">By saving, you agree to receive permit alerts via SMS. Msg &amp; data rates may apply. Text STOP to cancel.</p>
            </div>
          )}
        </div>

        {/* Phone actions below card */}
        <div>
          {savedPhone && !phoneEditing && (
            <button
              onClick={handlePhoneRemove}
              disabled={phoneRemoving}
              className="text-[10px] text-destructive/70 hover:text-destructive mt-1.5 px-1 underline transition-colors disabled:opacity-40"
            >
              {phoneRemoving ? "Removing…" : "Remove phone number"}
            </button>
          )}

          {savedPhone && !phoneEditing && !phoneVerified && !showVerifyOtp && (
            <button
              onClick={startVerification}
              disabled={otpSending || !isValidUSPhone(savedPhone)}
              className="mt-3 flex items-center gap-2 text-[11px] font-semibold rounded-lg px-3 py-2 transition-colors disabled:opacity-40"
              style={{
                background: 'rgba(47,111,78,0.08)',
                color: '#2F6F4E',
                border: '1px solid rgba(47,111,78,0.2)'
              }}
            >
              <Check size={12} />
              {otpSending ? "Sending code…" : "Verify phone for SMS alerts"}
            </button>
          )}

          {showVerifyOtp && !otpSuccess && (
            <div className="mt-3 bg-card border border-border/70 rounded-[18px] px-4 py-4">
              <p className="text-[12px] text-muted-foreground text-center mb-4">
                Enter the 6-digit code sent to {formatPhoneDisplay(savedPhone)}
              </p>
              <div className="flex items-center justify-center gap-2" onPaste={handleOtpPaste}>
                {otpDigits.map((d, i) => (
                  <input
                    key={i}
                    id={`settings-otp-${i}`}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={d}
                    onChange={(e) => handleOtpDigitChange(i, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(i, e)}
                    className={`w-10 h-12 rounded-lg border-2 bg-background text-center text-[18px] font-bold text-foreground focus:outline-none transition-all ${
                      otpError
                        ? "border-destructive/50 focus:ring-2 focus:ring-destructive/30 focus:border-destructive"
                        : "border-border focus:ring-2 focus:ring-secondary/40 focus:border-secondary"
                    }`}
                    autoFocus={i === 0}
                  />
                ))}
              </div>
              {otpError && (
                <p className="text-[11px] text-destructive text-center mt-2.5" role="alert">{otpError}</p>
              )}
              <div className="flex items-center justify-center gap-4 mt-4">
                <button
                  onClick={verifyCode}
                  disabled={otpDigits.join("").length !== 6 || otpVerifying}
                  className="flex items-center gap-1.5 bg-secondary text-secondary-foreground font-semibold text-[12px] px-5 py-2 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-40"
                >
                  {otpVerifying ? "Verifying…" : "Verify"}
                  {!otpVerifying && <ArrowRight size={12} />}
                </button>
              </div>
              <div className="flex items-center justify-center gap-3 mt-3">
                {otpResendTimer > 0 ? (
                  <p className="text-[10px] text-muted-foreground/50">Resend in {otpResendTimer}s</p>
                ) : (
                  <button
                    onClick={sendVerificationCode}
                    disabled={otpSending}
                    className="text-[10px] text-muted-foreground hover:text-foreground underline transition-colors"
                  >
                    {otpSending ? "Sending…" : "Resend code"}
                  </button>
                )}
                <button
                  onClick={() => setShowVerifyOtp(false)}
                  className="text-[10px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {otpSuccess && (
            <div className="mt-3 bg-secondary/10 border border-secondary/30 rounded-[18px] px-4 py-3 flex items-center justify-center gap-2">
              <Check size={14} className="text-secondary" />
              <span className="text-[13px] font-semibold text-secondary">Number verified</span>
            </div>
          )}

          <p className="text-[10px] text-muted-foreground mt-1.5 px-1">
            {phoneVerified ? "Your phone number is verified for SMS alerts." : "SMS alerts require a verified US phone number."}
          </p>
        </div>
      </div>

      {/* Alerts — unified section with explanations */}
      <p className="text-[11px] font-semibold tracking-[0.06em] uppercase text-muted-foreground mb-3">Alerts</p>
      <div className="rounded-2xl overflow-hidden border border-border/70 bg-background mb-6">
        <div className="bg-card px-4 py-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-start gap-3 min-w-0">
              <Zap size={15} className={`shrink-0 mt-0.5 ${!savedPhone || !phoneVerified ? "text-muted-foreground/40" : "text-secondary"}`} />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className={`text-[13px] font-semibold ${savedPhone && phoneVerified ? "text-foreground" : "text-foreground/60"}`}>SMS Alerts</p>
                  {!isPro && (
                    <span className="text-[8px] font-extrabold uppercase tracking-wider bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded-full leading-none">
                      PRO
                    </span>
                  )}
                </div>
                {savedPhone && phoneVerified ? (
                  <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: 'rgba(58,62,59,0.5)', marginTop: 2 }}>
                    SMS to ···· {savedPhone.slice(-4)}
                  </p>
                ) : !savedPhone ? (
                  <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: 'rgba(58,62,59,0.5)', marginTop: 2 }}>
                    Add a number to enable SMS alerts
                  </p>
                ) : (
                  <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: 'rgba(58,62,59,0.5)', marginTop: 2 }}>
                    Verify your phone to enable SMS alerts
                  </p>
                )}
              </div>
            </div>
            <Switch
              checked={isPro && phoneVerified ? notifySms : false}
              onCheckedChange={async (checked) => {
                const prev = notifySms;
                setNotifySms(checked);
                const e164Phone = toE164(phone) ?? null;
                const ok = await persistProfile({ notify_sms: checked && !!e164Phone });
                if (!ok) setNotifySms(prev);
              }}
              disabled={!isPro || !isValidUSPhone(phone) || !phoneVerified}
              className={!savedPhone || !phoneVerified ? "opacity-40" : ""}
              role="switch"
              aria-checked={isPro && phoneVerified ? notifySms : false}
              aria-label="SMS Alerts"
            />
          </div>

          {/* Inline add phone flow */}
          {!savedPhone && !inlinePhoneSaved && (
            <div className="ml-[27px] mt-1.5">
              {!showInlinePhone ? (
                <button
                  onClick={() => setShowInlinePhone(true)}
                  style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: '#2F6F4E', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                >
                  Add phone number →
                </button>
              ) : (
                <div className="mt-2 space-y-2">
                  <input
                    type="tel"
                    value={formatPhoneDisplay(inlinePhoneNumber)}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/\D/g, "").slice(0, 10);
                      setInlinePhoneNumber(raw);
                    }}
                    placeholder="(555) 123-4567"
                    aria-label="Phone number"
                    className="w-full bg-background text-[13px] text-foreground placeholder:text-muted-foreground outline-none border border-border/70 rounded-lg px-3 py-2"
                    autoFocus
                  />
                  <button
                    onClick={async () => {
                      if (!isValidUSPhone(inlinePhoneNumber)) return;
                      setInlinePhoneSaving(true);
                      const e164 = toE164(inlinePhoneNumber)!;
                      const { error } = await supabase
                        .from("profiles")
                        .update({ phone_number: e164, sms_consent_at: new Date().toISOString(), sms_consent_version: 'v1-2026-03' })
                        .eq("user_id", user.id);
                      setInlinePhoneSaving(false);
                      if (!error) {
                        const raw = inlinePhoneNumber;
                        setPhone(raw);
                        setSavedPhone(raw);
                        setShowInlinePhone(false);
                        setInlinePhoneSaved(true);
                        setPhoneVerified(false);
                        startVerification();
                      } else {
                        toast({ title: "Couldn't save", description: "Please try again.", variant: "destructive" });
                      }
                    }}
                    disabled={!isValidUSPhone(inlinePhoneNumber) || inlinePhoneSaving}
                    className="w-full flex items-center justify-center disabled:opacity-40 transition-all"
                    style={{
                      height: 40,
                      borderRadius: 10,
                      backgroundColor: '#2F6F4E',
                      color: '#F0EDEA',
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: 13,
                      fontWeight: 500,
                    }}
                  >
                    {inlinePhoneSaving ? "Saving…" : "Send Code"}
                  </button>
                  <p className="text-[10px] text-muted-foreground">By saving, you agree to receive permit alerts via SMS. Msg &amp; data rates may apply.</p>
                </div>
              )}
            </div>
          )}

          {/* Inline saved confirmation */}
          {inlinePhoneSaved && !showVerifyOtp && !otpSuccess && (
            <div className="ml-[27px] mt-2 flex items-center gap-1.5">
              <Check size={12} className="text-secondary" />
              <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: '#2F6F4E' }}>Number saved</span>
            </div>
          )}
        </div>

        <div className="h-px bg-border/50 mx-4" />

        <div className="flex items-center justify-between bg-card px-4 py-3.5">
          <div className="flex items-start gap-3 min-w-0">
            <Mail size={15} className="text-primary shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-foreground">Email Alerts</p>
              <p className="text-[10px] text-muted-foreground leading-snug mt-0.5">
                Permit alerts with available dates and booking links.
              </p>
            </div>
          </div>
          <Switch checked={notifyEmail} onCheckedChange={async (checked) => {
              const prev = notifyEmail;
              setNotifyEmail(checked);
              const ok = await persistProfile({ notify_email: checked });
              if (!ok) setNotifyEmail(prev);
            }}
              role="switch"
              aria-checked={notifyEmail}
              aria-label="Email Alerts"
            />
        </div>

        <div className="h-px bg-border/50 mx-4" />

        {/* Push Notifications */}
        <div className="flex items-center justify-between bg-card px-4 py-3.5">
          <div className="flex items-start gap-3 min-w-0">
            <BellRing size={15} className="text-primary shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-foreground">Push Notifications</p>
              <p className="text-[10px] text-muted-foreground leading-snug mt-0.5">
                {"Notification" in window && Notification.permission === "granted"
                  ? "Browser push notifications are enabled."
                  : "Enable browser push notifications for permit alerts."}
              </p>
            </div>
          </div>
          <Switch
            checked={"Notification" in window && Notification.permission === "granted"}
            onCheckedChange={async (checked) => {
              if (checked && "Notification" in window) {
                const result = await Notification.requestPermission();
                if (result === "granted") {
                  toast({ title: "Notifications enabled", description: "You'll receive push alerts for permits." });
                } else {
                  toast({ title: "Permission denied", description: "Enable notifications in your browser settings." });
                }
              }
            }}
            disabled={"Notification" in window && Notification.permission === "denied"}
            role="switch"
            aria-checked={"Notification" in window && Notification.permission === "granted"}
            aria-label="Push Notifications"
          />
        </div>
      </div>
      {"Notification" in window && Notification.permission === "granted" && (
        <p className="text-[10px] text-muted-foreground/60 -mt-5 mb-6 px-4">
          To disable, adjust notification settings in your browser.
        </p>
      )}


      <div className="pt-6 border-t border-border/60 mb-8">
        <p className="text-[11px] font-semibold tracking-[0.06em] uppercase text-muted-foreground mb-3">Support</p>
        <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
            <Link
              to="/privacy"
              className="tactile-small w-full flex items-center gap-3 hover:bg-muted transition-colors"
              style={{ padding: '14px 16px' }}
            >
              <FileText size={15} className="text-muted-foreground shrink-0" />
              <span className="flex-1 text-left text-[15px] font-medium text-foreground">Privacy Policy</span>
            </Link>
            <div className="w-full h-px" style={{ backgroundColor: '#E8E6E1' }} />
            <Link
              to="/terms"
              className="tactile-small w-full flex items-center gap-3 hover:bg-muted transition-colors"
              style={{ padding: '14px 16px' }}
            >
              <FileText size={15} className="text-muted-foreground shrink-0" />
              <span className="flex-1 text-left text-[15px] font-medium text-foreground">Terms & Conditions</span>
            </Link>
            <div className="w-full h-px" style={{ backgroundColor: '#E8E6E1' }} />
            <button
              onClick={() => window.open("mailto:wildatlasnp@gmail.com?subject=WildAtlas Feedback", "_blank")}
              className="tactile-small w-full flex items-center gap-3 hover:bg-muted transition-colors"
              style={{ padding: '14px 16px' }}
            >
              <MessageSquare size={15} className="text-muted-foreground shrink-0" />
              <div className="flex-1 text-left">
                <p className="text-[15px] font-medium text-foreground">Send Feedback</p>
                <p className="text-[12px] text-muted-foreground leading-snug mt-0.5">Bug reports, feature requests, or questions</p>
              </div>
              <ChevronRight size={14} className="text-muted-foreground/40 shrink-0" aria-hidden="true" />
            </button>
            <div className="w-full h-px" style={{ backgroundColor: '#E8E6E1' }} />
            <a
              href="https://tally.so/r/XxGJXP"
              target="_blank"
              rel="noopener noreferrer"
              className="tactile-small w-full flex items-center gap-3 hover:bg-muted transition-colors"
              style={{ padding: '14px 16px' }}
            >
              <Shield size={15} className="text-muted-foreground shrink-0" />
              <div className="flex-1 text-left">
                <p className="text-[15px] font-medium text-foreground">Privacy Request</p>
                <p className="text-[12px] text-muted-foreground leading-snug mt-0.5">Data access, deletion, and opt-out requests</p>
              </div>
              <ChevronRight size={14} className="text-muted-foreground/40 shrink-0" aria-hidden="true" />
            </a>
            <div className="w-full h-px" style={{ backgroundColor: '#E8E6E1' }} />
            <div className="flex items-center gap-3" style={{ padding: '14px 16px' }}>
              <Info size={15} className="text-muted-foreground shrink-0" />
              <span className="flex-1 text-[15px] font-medium text-foreground">App Version</span>
              <span className="text-[12px] text-muted-foreground">v1.0.0</span>
            </div>
        </div>
      </div>

      {/* Account */}
      <div className="pt-6 border-t border-border/60">
        <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' as const, color: 'rgba(58,62,59,0.5)', marginBottom: 12 }}>Account</p>

        {/* Sign Out — outlined button */}
        <button
          onClick={handleSignOut}
          className="tactile-button w-full flex items-center justify-center hover:bg-muted/50 transition-colors"
          style={{
            height: 44,
            borderRadius: 10,
            border: '1px solid #3A3E3B',
            background: 'transparent',
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 14,
            fontWeight: 400,
            color: '#3A3E3B',
          }}
        >
          Sign Out
        </button>

        {/* Delete Account */}
        <div className="mt-5 flex justify-center">
          {scheduledDeletionAt ? (
            <div className="w-full px-4 py-3.5 rounded-[18px] border border-destructive/20 bg-destructive/5">
              <div className="flex items-start gap-2.5">
                <AlertTriangle size={16} className="text-destructive shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-[13px] font-semibold text-destructive">
                    Account deletion scheduled
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                    Your account and all data will be permanently deleted on{" "}
                    <strong className="text-foreground">
                      {new Date(scheduledDeletionAt).toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </strong>
                    . Cancel now to keep your account.
                  </p>
                  <button
                    onClick={handleCancelDeletion}
                    disabled={cancelling}
                    className="mt-3 w-full flex items-center justify-center gap-2 bg-card border border-border/70 text-foreground rounded-xl py-2.5 text-[12px] font-semibold hover:bg-muted transition-colors disabled:opacity-50"
                  >
                    {cancelling ? <Loader2 size={14} className="animate-spin" /> : <Undo2 size={14} />}
                    {cancelling ? "Restoring…" : "Cancel Deletion & Restore Account"}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button
                  className="transition-opacity hover:opacity-70"
                  style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: '#E24B4A', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  Delete Account
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete your account?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete your account and all alerts. This cannot be undone.
                    {isPro && (
                      <span className="block mt-2 font-medium text-destructive">
                        Your Pro subscription will be cancelled immediately and you will not be charged again.
                      </span>
                    )}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteAccount}
                    disabled={deleting}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {deleting ? <Loader2 size={16} className="animate-spin mr-1" /> : null}
                    {deleting ? "Scheduling…" : "Delete"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      {/* Disclaimer */}
      <p className="text-[11px] text-muted-foreground/70 text-center leading-relaxed mt-6 px-2">
        WildAtlas is an independent service and is not affiliated with, endorsed by, or officially connected to Recreation.gov, the National Park Service, or any government agency.
      </p>

      <ScrollableFooter />

      {!embedded && <BottomNav activeTab="settings" onTabChange={(tab) => navigate(`/app?tab=${tab}`)} />}
      <ProModal open={proModalOpen} onOpenChange={setProModalOpen} />
      <EmailPreviewModal open={emailPreviewOpen} onOpenChange={setEmailPreviewOpen} />
    </div>
  );
};

export default SettingsPage;