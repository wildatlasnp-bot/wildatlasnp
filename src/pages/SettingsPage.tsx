import { useState, useEffect, useCallback, useRef } from "react";
import ProModal from "@/components/ProModal";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useProStatus } from "@/hooks/useProStatus";
import { useMochiStats } from "@/hooks/useMochiStats";
import { useToast } from "@/hooks/use-toast";
import { User, Mail, Phone, Loader2, LogOut, MessageSquare, Trash2, Crown, ExternalLink, Zap, Shield, Check, CheckCircle, RotateCcw, ChevronRight, Bell, BellRing, Info, FileText, Scale, Lock, ArrowRight, Eye, EyeOff, Undo2, AlertTriangle, Download, RefreshCw } from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import BottomNav from "@/components/BottomNav";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toE164, formatPhoneDisplay, isValidUSPhone } from "@/lib/phone";
import { resetAllTips } from "@/lib/dismissable-tips";
import EmailPreviewModal from "@/components/EmailPreviewModal";

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

/* ──────────────── Editorial primitives ────────────────
   Local visual atoms for the Settings page only.
   Premium Field Gear: ivory cards, gold hairlines, italic
   Cormorant section headers, embossed icon chips. */

const GOLD = "#C9A96E";
const IVORY_BORDER = "#E8E4E0";
const ROW_DIVIDER = "#F0EDEA";
const CHIP_BG = "#FAF7F2";
const FOREST = "#1A2F1E";
const SAGE_ITALIC = "#8A9E8A";
const MUTED = "#8A9E8A";

/* Editorial card surface — white over cream page, soft ink shadow.
   Consumed by Identity, Alerts, Support. Membership Free card overrides
   to a tinted-green surface inline. */
const CARD_SURFACE: React.CSSProperties = {
  backgroundColor: "#FFFFFF",
  borderRadius: 16,
  border: `1px solid ${IVORY_BORDER}`,
  boxShadow: "0 2px 8px rgba(26,47,30,0.05)",
  overflow: "hidden",
};

/* Section label — chapter marker, not form label.
   Editorial spec asks for 9px/0.25em amber. We honor the project's 12px
   typography floor (mem://style/typography/legibility-floor) and use 12px
   with tightened weight + tracking to read as a chapter mark. */
const SectionHeader = ({
  label,
  trailing,
}: {
  label: string;
  trailing?: React.ReactNode;
}) => (
  <div className="flex items-center gap-3 mb-3" style={{ marginTop: 36 }}>
    <span
      aria-hidden
      style={{
        display: "inline-block",
        width: 24,
        height: 1,
        background: `linear-gradient(to right, ${GOLD}, transparent)`,
      }}
    />
    <span
      style={{
        fontFamily: "'DM Sans', sans-serif",
        fontSize: 12,
        fontWeight: 500,
        letterSpacing: "0.25em",
        textTransform: "uppercase",
        color: GOLD,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
    <span
      aria-hidden
      style={{ flex: 1, height: 1, backgroundColor: IVORY_BORDER }}
    />
    {trailing && <span className="shrink-0">{trailing}</span>}
  </div>
);

const IconChip = ({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "muted";
}) => (
  <span
    aria-hidden
    className="inline-flex items-center justify-center shrink-0 transition-shadow duration-200 ease-smooth"
    style={{
      width: 28,
      height: 28,
      borderRadius: 999,
      background: CHIP_BG,
      border: `1px solid ${IVORY_BORDER}`,
      color: tone === "muted" ? MUTED : FOREST,
    }}
  >
    {children}
  </span>
);

/* Row eyebrow — tiny uppercase metadata label.
   Spec asks for 9px/0.20em; honored at 12px floor with tight tracking. */
const RowEyebrow = ({ children }: { children: React.ReactNode }) => (
  <p
    style={{
      fontFamily: "'DM Sans', sans-serif",
      fontSize: 12,
      fontWeight: 500,
      letterSpacing: "0.20em",
      textTransform: "uppercase",
      color: MUTED,
      lineHeight: 1.2,
      marginBottom: 2,
    }}
  >
    {children}
  </p>
);

const RefreshSubStatus = ({ refreshProStatus }: { refreshProStatus: () => Promise<void> }) => {
  const [state, setState] = useState<"idle" | "checking" | "active" | "inactive">("idle");

  const handleRefresh = async () => {
    setState("checking");
    await refreshProStatus();
    const { data } = await supabase.from("profiles").select("is_pro").eq("user_id", (await supabase.auth.getUser()).data.user?.id ?? "").maybeSingle();
    setState(data?.is_pro ? "active" : "inactive");
    setTimeout(() => setState("idle"), 6000);
  };

  if (state === "idle") {
    return (
      <button onClick={handleRefresh} className="flex items-center gap-1 cursor-pointer hover:opacity-70 transition-opacity" style={{ fontSize: 12, color: '#A8C4B8', background: "none", border: "none", padding: 0 }}>
        <span>Already Pro? Tap to refresh</span>
        <RefreshCw size={11} strokeWidth={2} />
      </button>
    );
  }
  if (state === "checking") {
    return <span className="flex items-center gap-1" style={{ fontSize: 12, color: "#6B7280" }}><Loader2 size={12} className="animate-spin" /> Checking…</span>;
  }
  if (state === "active") {
    return <span className="flex items-center gap-1" style={{ fontSize: 12, color: "#2F6F4E" }}><CheckCircle size={12} /> Pro active</span>;
  }
  return (
    <p className="w-full text-center mt-3" style={{ fontSize: 12, color: "#6B7280" }}>
      Still not active — contact support at <a href="mailto:support@wildatlas.app" className="underline">support@wildatlas.app</a>
    </p>
  );
};

const DownloadDataButton = ({ user }: { user: any }) => {
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Fetch profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name, phone_number, notify_email, notify_sms, created_at")
        .eq("user_id", user.id)
        .maybeSingle();

      const maskPhone = (p: string | null) => {
        if (!p || p.length < 4) return null;
        return "····" + p.slice(-4);
      };

      // Fetch active watches with scan target details
      const { data: watchers } = await supabase
        .from("user_watchers")
        .select("created_at, status, is_active, scan_target_id, scan_targets(park_id, permit_type)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      // Fetch notification log (alert history)
      const { data: alerts } = await supabase
        .from("notification_log")
        .select("park_id, permit_name, available_dates, created_at, channel, status")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(200);

      const exportData = {
        exported_at: new Date().toISOString(),
        profile: {
          name: profile?.display_name ?? null,
          email: user.email,
          phone: maskPhone(profile?.phone_number ?? null),
          notify_email: profile?.notify_email ?? null,
          notify_sms: profile?.notify_sms ?? null,
          account_created: profile?.created_at ?? null,
        },
        watches: (watchers ?? []).map((w: any) => ({
          park: w.scan_targets?.park_id ?? "unknown",
          permit_type: w.scan_targets?.permit_type ?? "unknown",
          status: w.status,
          is_active: w.is_active,
          created_at: w.created_at,
        })),
        alert_history: (alerts ?? []).map((a: any) => ({
          park: a.park_id,
          permit: a.permit_name,
          dates_found: a.available_dates,
          found_at: a.created_at,
          channel: a.channel,
          status: a.status,
        })),
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "wildatlas-data-export.json";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Data export error:", e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleDownload}
      disabled={loading}
      className="w-full flex items-center justify-between transition-opacity hover:opacity-70 disabled:opacity-50"
      style={{
        minHeight: 44,
        background: 'none',
        border: 'none',
        fontFamily: "'DM Sans', sans-serif",
        fontSize: 15,
        fontWeight: 400,
        color: '#1A2F1E',
        cursor: loading ? 'default' : 'pointer',
        padding: '10px 0',
        textAlign: 'left',
      }}
    >
      <span className="flex items-center gap-2">
        {loading ? (
          <><Loader2 size={14} className="animate-spin" /> Exporting…</>
        ) : (
          <>Download my data</>
        )}
      </span>
      {!loading && <ArrowRight size={14} style={{ color: '#8A9E8A' }} aria-hidden="true" />}
    </button>
  );
};

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
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const [nameFocused, setNameFocused] = useState(false);

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
      // Handle 401 = incorrect code (not a network failure)
      if (fnError) {
        let errBody: any = null;
        try { errBody = fnError.context ? await fnError.context.json() : null; } catch {}
        if (errBody?.verified === false) {
          setOtpError(errBody?.error || "Incorrect code — please try again.");
          setOtpVerifying(false);
          return;
        }
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

  if (!loaded) {
    return (
      <div className={`bg-background max-w-lg mx-auto px-5 py-6 ${embedded ? 'h-full min-h-0 overflow-y-auto pb-[104px]' : 'min-h-screen pb-[80px]'}`} {...(embedded ? { 'data-tab-scroll': '' } : {})}>
        <div className="mb-8">
          <div className="h-8 w-28 rounded bg-muted animate-pulse" />
          <div className="h-4 w-36 rounded bg-muted animate-pulse mt-2" />
        </div>
        {/* Subscription card skeleton */}
        <div className="mb-8">
          <div className="rounded-[18px] border border-border/40 bg-card p-5 space-y-3 animate-pulse">
            <div className="h-5 w-40 rounded bg-muted" />
            <div className="h-4 w-56 rounded bg-muted" />
            <div className="h-10 w-full rounded-lg bg-muted mt-2" />
          </div>
        </div>
        {/* Profile fields skeleton */}
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-[14px] border border-border/40 bg-card p-4 animate-pulse" style={{ animationDelay: `${i * 100}ms` }}>
              <div className="flex items-center gap-3">
                <div className="h-5 w-5 rounded bg-muted" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-16 rounded bg-muted" />
                  <div className="h-4 w-40 rounded bg-muted" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div data-settings-root className={`bg-background max-w-lg mx-auto px-5 py-6 ${embedded ? 'h-full min-h-0 overflow-y-auto pb-[104px]' : 'min-h-screen pb-[80px]'}`} {...(embedded ? { 'data-tab-scroll': '' } : {})}>
      {/* Settings-scoped Switch tones — warmer off-state per editorial spec */}
      <style>{`
        [data-settings-root] [role="switch"][data-state="unchecked"] { background-color: #E5E1DD !important; }
        [data-settings-root] [role="switch"][data-state="checked"] { background-color: #2F6F4E !important; }
      `}</style>
      {/* Header */}
      <div style={{ marginTop: 36 }} ref={headerFadeRef}>
        <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 52, fontWeight: 300, letterSpacing: '-0.02em', color: FOREST, lineHeight: 1.05, opacity: "var(--header-opacity, 1)" as any, willChange: "opacity" }}>Settings</h1>
        {displayName && (
           <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontStyle: 'italic', fontWeight: 400, color: SAGE_ITALIC, marginTop: 8, opacity: "var(--header-opacity, 1)" as any, willChange: "opacity" }}>
             Hello, {displayName.split(" ")[0]}.
           </p>
        )}
        {/* 32×1px solid amber rule. SectionHeader supplies the ~36px clearance below. */}
        <span aria-hidden style={{ display: 'block', width: 32, height: 1, marginTop: 14, backgroundColor: GOLD }} />
      </div>

      {/* ───────────── MEMBERSHIP ───────────── */}
      <SectionHeader label="Membership" />
      <div className="mb-2">
        {isPro ? (
          /* Pro — quiet confirmation card */
          <div style={{ ...CARD_SURFACE, borderColor: "rgba(var(--park-accent-rgb), 0.18)", background: "linear-gradient(180deg, rgba(var(--park-accent-rgb), 0.03) 0%, #FFFFFF 60%)", transition: "border-color 300ms ease-out, background 300ms ease-out" }}>
            <div className="px-5 pt-5 pb-4 flex flex-col items-center text-center">
              <span
                aria-hidden
                className="inline-flex items-center justify-center"
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 999,
                  border: `1px solid ${GOLD}`,
                  background: CHIP_BG,
                  marginBottom: 10,
                }}
              >
                <Crown size={16} style={{ color: GOLD }} />
              </span>
              <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontStyle: 'italic', fontWeight: 500, color: FOREST, lineHeight: 1.15 }}>
                You're a Pro member.
              </p>
              {subscriptionEnd && (
                <p style={{ fontSize: 12, color: '#7A8A82', marginTop: 6, fontFamily: "'DM Sans', sans-serif" }}>
                  Renews {new Date(subscriptionEnd).toLocaleDateString()}
                </p>
              )}
              {!mochiStats.loading && mochiStats.scanCount !== null && mochiStats.scanCount > 0 && (
                <div className="flex items-center gap-1.5 mt-1.5">
                  <Zap size={11} style={{ color: '#7A8A82' }} className="shrink-0" />
                  <p style={{ fontSize: 12, color: '#7A8A82', fontFamily: "'DM Sans', sans-serif" }}>
                    Poko has scanned {mochiStats.scanCount.toLocaleString()} permits this month
                  </p>
                </div>
              )}
            </div>

            <div className="px-5 pb-5">
              {/* Cancel — two-step confirmation */}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button
                    disabled={managingPortal}
                    className="w-full text-center transition-opacity hover:opacity-80 disabled:opacity-50"
                    style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: 12,
                      color: MUTED,
                      textDecoration: 'underline',
                      textUnderlineOffset: 3,
                      background: 'none',
                      border: 'none',
                      padding: '6px 0',
                      cursor: 'pointer',
                    }}
                  >
                    {managingPortal ? "Opening…" : "Cancel subscription"}
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Cancel Pro subscription?</AlertDialogTitle>
                    <AlertDialogDescription>
                      You'll keep Pro access until the end of your billing period.
                      <span className="block mt-2 italic text-[12px] text-muted-foreground">
                        Poko is actively watching your permits — cancelling will pause all scans.
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

              {/* Manage · Refund — middot row */}
              <div className="flex items-center justify-center gap-2 mt-1">
                <button
                  onClick={handleManageSubscription}
                  disabled={managingPortal}
                  className="transition-opacity hover:opacity-80 disabled:opacity-50"
                  style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: MUTED, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0' }}
                >
                  Manage subscription
                </button>
                <span style={{ color: GOLD, opacity: 0.5, fontSize: 12 }}>·</span>
                <button
                  onClick={() => setRefundOpen(true)}
                  className="transition-opacity hover:opacity-80"
                  style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: MUTED, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0' }}
                >
                  Refund policy
                </button>
              </div>
            </div>

            {/* Refund Policy Modal */}
            <Dialog open={refundOpen} onOpenChange={setRefundOpen}>
              <DialogContent className="max-w-sm rounded-2xl p-6 bg-card">
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
          /* Free — editorial upgrade card (tinted-green surface) */
          <div
            style={{
              background: 'rgba(47,111,78,0.04)',
              border: '1px solid rgba(47,111,78,0.12)',
              borderRadius: 16,
              boxShadow: '0 2px 8px rgba(26,47,30,0.05)',
              overflow: 'hidden',
            }}
          >
            {/* Top — Current plan */}
            <div className="px-5 pt-5 pb-4">
              <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 500, letterSpacing: '0.20em', textTransform: 'uppercase', color: MUTED, marginBottom: 6 }}>Current plan</p>
              <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 28, fontWeight: 400, color: FOREST, lineHeight: 1.1 }}>Free Plan</p>
              <div className="mt-4">
                <div className="flex items-center justify-between mb-1.5">
                  <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: 'rgba(58,62,59,0.6)' }}>Permit limit reached</span>
                  <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: '#2F6F4E', fontWeight: 500 }}>Upgrade for unlimited</span>
                </div>
                {/* Fully-rounded progress track + fill */}
                <div style={{ height: 4, borderRadius: 9999, backgroundColor: '#EFEAE0', overflow: 'hidden' }}>
                  <div style={{ height: 4, borderRadius: 9999, background: `linear-gradient(90deg, ${GOLD} 0%, #2F6F4E 100%)`, width: '100%' }} />
                </div>
              </div>
            </div>

            <div style={{ height: 1, marginLeft: 20, marginRight: 20, backgroundColor: IVORY_BORDER }} />

            {/* Bottom — Upgrade */}
            <div className="px-5 pt-5 pb-5">
              {/* Gold ornament */}
              <span aria-hidden style={{ display: 'block', width: 24, height: 1, backgroundColor: GOLD, opacity: 0.6, marginBottom: 14 }} />

              <div className="flex items-center gap-2.5 mb-3">
                <span
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 12,
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
                <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: 'rgba(26,24,20,0.4)' }}>
                  · $9.99/mo
                </span>
              </div>

              <p
                style={{
                  fontFamily: "'Cormorant Garamond', serif",
                  fontSize: 24,
                  fontWeight: 500,
                  fontStyle: 'italic',
                  color: FOREST,
                  lineHeight: 1.2,
                  marginBottom: 6,
                  letterSpacing: '-0.005em',
                }}
              >
                Permits open. Then vanish. Be first.
              </p>

              <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: '#9A9A9A', textAlign: 'center', marginTop: 10, marginBottom: 18 }}>
                2-min scans · <strong style={{ fontWeight: 600 }}>Unlimited permits</strong> · SMS alerts
              </p>

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
                  letterSpacing: '0.01em',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.18), 0 1px 2px rgba(26,47,30,0.18)',
                }}
              >
                Upgrade — $9.99/mo
              </button>

              <div className="flex items-center justify-center gap-3 mt-3">
                <div className="flex items-center gap-1">
                  <Shield size={10} style={{ color: 'rgba(47,111,78,0.5)' }} />
                  <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: 'rgba(26,24,20,0.4)' }}>Cancel anytime</span>
                </div>
                <span style={{ color: 'rgba(26,24,20,0.15)' }}>·</span>
                <div className="flex items-center gap-1">
                  <RotateCcw size={10} style={{ color: 'rgba(47,111,78,0.5)' }} />
                  <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: 'rgba(26,24,20,0.4)' }}>7-day refund</span>
                </div>
              </div>

              <div className="flex justify-center mt-2">
                <RefreshSubStatus refreshProStatus={refreshProStatus} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ───────────── IDENTITY ───────────── */}
      <SectionHeader
        label="Identity"
        trailing={
          saveStatus !== "idle" ? (
            <span
              className="flex items-center gap-1 transition-opacity"
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 12,
                fontWeight: 500,
                color:
                  saveStatus === "saving" ? MUTED :
                  saveStatus === "saved" ? '#2F6F4E' : '#E24B4A',
              }}
            >
              {saveStatus === "saving" && <><Loader2 size={10} className="animate-spin" /> Saving…</>}
              {saveStatus === "saved" && <><Check size={10} /> Saved</>}
              {saveStatus === "error" && <><AlertTriangle size={10} /> Failed</>}
            </span>
          ) : (
            <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 12, fontStyle: 'italic', color: MUTED }}>
              masked for privacy
            </span>
          )
        }
      />

      <div className="mb-2">
        <div style={CARD_SURFACE}>
          {/* Email row */}
          <div className="flex items-center gap-3" style={{ padding: '14px 16px' }}>
            <IconChip><Mail size={13} /></IconChip>
            <div className="flex-1 min-w-0">
              <RowEyebrow>Email</RowEyebrow>
              <span style={{ fontSize: 14, fontWeight: 500, color: FOREST, fontFamily: "'DM Sans', sans-serif" }} className="truncate block">
                {emailRevealed ? (user?.email ?? "—") : maskEmail(user?.email ?? "—")}
              </span>
            </div>
            <button
              onClick={revealEmail}
              className="hover:opacity-80 transition-opacity shrink-0"
              style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 13, fontStyle: 'italic', color: '#2F6F4E', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 4px' }}
              aria-label={emailRevealed ? "Hide email" : "Show email"}
            >
              {emailRevealed ? "Hide" : "Show"}
            </button>
          </div>

          <div className="w-full h-px" style={{ backgroundColor: ROW_DIVIDER }} />

          {/* Name row */}
          <div className="flex items-center gap-3" style={{ padding: '14px 16px' }}>
            <IconChip><User size={13} /></IconChip>
            <div className="flex-1 min-w-0">
              <RowEyebrow>Name</RowEyebrow>
              <input
                ref={nameInputRef}
                type="text"
                value={name}
                onFocus={() => setNameFocused(true)}
                onChange={(e) => {
                  setName(e.target.value);
                  const trimmed = e.target.value.trim() || null;
                  debouncedSaveField("display_name", trimmed, () => {
                    setName(savedName);
                  });
                }}
                onBlur={() => {
                  setNameFocused(false);
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
                className="w-full bg-transparent placeholder:text-muted-foreground outline-none focus:border-b focus:border-secondary transition-all"
                style={{ fontSize: 14, fontWeight: 500, color: FOREST, fontFamily: "'DM Sans', sans-serif", paddingBottom: 1, borderBottom: '1px solid transparent' }}
              />
            </div>
            {!nameFocused && (
              <button
                onClick={() => nameInputRef.current?.focus()}
                className="hover:opacity-80 transition-opacity shrink-0"
                style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 13, fontStyle: 'italic', color: '#2F6F4E', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 4px' }}
                aria-label="Edit name"
              >
                {savedName ? "Edit" : "Add"}
              </button>
            )}
          </div>

          <div className="w-full h-px" style={{ backgroundColor: ROW_DIVIDER }} />

          {/* Phone row */}
          {!phoneEditing ? (
            <div className="flex items-center gap-3" style={{ padding: '14px 16px' }}>
              <IconChip><Phone size={13} /></IconChip>
              <div className="flex-1 min-w-0">
                <RowEyebrow>Phone</RowEyebrow>
                <span style={{ fontSize: 14, fontWeight: 500, color: savedPhone ? FOREST : MUTED, fontFamily: "'DM Sans', sans-serif", fontStyle: savedPhone ? 'normal' : 'italic' }}>
                  {savedPhone ? maskPhone(savedPhone) : "No phone number"}
                </span>
              </div>
              {phoneVerified && (
                <span className="flex items-center gap-1 shrink-0" style={{ fontSize: 12, fontWeight: 600, color: '#2F6F4E' }}>
                  <Check size={12} /> Verified
                </span>
              )}
              <div className="flex items-center shrink-0">
                <button
                  onClick={handlePhoneEdit}
                  className="hover:opacity-80 transition-opacity"
                  style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 13, fontStyle: 'italic', color: '#2F6F4E', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 4px' }}
                >
                  {savedPhone ? "Edit" : "Add"}
                </button>
                {savedPhone && (
                  <>
                    <span style={{ color: GOLD, opacity: 0.5, fontSize: 12, margin: '0 6px' }}>·</span>
                    <button
                      onClick={handlePhoneRemove}
                      disabled={phoneRemoving}
                      className="hover:opacity-80 transition-opacity disabled:opacity-40"
                      style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 13, fontStyle: 'italic', color: '#E24B4A', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 4px' }}
                    >
                      {phoneRemoving ? "…" : "Remove"}
                    </button>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div style={{ padding: '14px 16px' }}>
              <div className="flex items-center gap-3">
                <IconChip><Phone size={13} /></IconChip>
                <div className="flex-1 min-w-0">
                  <RowEyebrow>Phone</RowEyebrow>
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
                    className="w-full bg-transparent placeholder:text-muted-foreground outline-none"
                    style={{ fontSize: 14, fontWeight: 500, color: FOREST, fontFamily: "'DM Sans', sans-serif", borderBottom: '1px solid #2F6F4E', paddingBottom: 1 }}
                    autoFocus
                  />
                </div>
                <button
                  onClick={handlePhoneSave}
                  disabled={phoneSaving}
                  className="hover:opacity-80 transition-opacity shrink-0 disabled:opacity-40"
                  style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 13, fontStyle: 'italic', color: '#2F6F4E', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 4px' }}
                >
                  {phoneSaving ? "Saving…" : "Save"}
                </button>
                <button
                  onClick={() => { setPhoneEditing(false); setPhone(savedPhone); setPhoneError(""); }}
                  className="hover:opacity-80 transition-opacity shrink-0"
                  style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 13, fontStyle: 'italic', color: MUTED, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 4px' }}
                >
                  Cancel
                </button>
              </div>
              {phoneError && (
                <p className="text-[12px] text-destructive mt-2 px-1" role="alert">{phoneError}</p>
              )}
              <p className="text-[12px] text-muted-foreground mt-2 px-1">By saving, you consent to receive automated permit alert texts from WildAtlas. Msg &amp; data rates may apply. Reply STOP to cancel.</p>
            </div>
          )}
        </div>

        {/* Unverified phone — editorial cream warning */}
        {isPro && savedPhone && !phoneEditing && !phoneVerified && (
          <div
            className="flex items-center justify-between gap-3 mt-2 px-3 py-2.5"
            style={{ backgroundColor: '#FAF3E4', border: `1px solid ${GOLD}`, borderRadius: 10 }}
          >
            <p style={{ fontSize: 12, color: '#7A5E1E', lineHeight: 1.4, fontFamily: "'DM Sans', sans-serif" }}>
              Your number isn't verified — SMS alerts are off.
            </p>
            <button
              onClick={startVerification}
              disabled={otpSending}
              className="shrink-0 transition-opacity hover:opacity-80 disabled:opacity-40"
              style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 13, fontStyle: 'italic', color: '#7A5E1E', textDecoration: 'underline', textUnderlineOffset: 3, background: 'none', border: 'none', cursor: 'pointer' }}
            >
              Verify now →
            </button>
          </div>
        )}

        {/* OTP card */}
        <div>
          {showVerifyOtp && !otpSuccess && (
            <div className="mt-3 px-4 py-4" style={CARD_SURFACE}>
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
                <p className="text-[12px] text-destructive text-center mt-2.5" role="alert">{otpError}</p>
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
                  <p className="text-[12px] text-muted-foreground/50">Resend in {otpResendTimer}s</p>
                ) : (
                  <button
                    onClick={sendVerificationCode}
                    disabled={otpSending}
                    className="text-[12px] text-muted-foreground hover:text-foreground underline transition-colors"
                  >
                    {otpSending ? "Sending…" : "Resend code"}
                  </button>
                )}
                <button
                  onClick={() => setShowVerifyOtp(false)}
                  className="text-[12px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
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

          <p style={{ fontSize: 12, color: MUTED, marginTop: 8, paddingLeft: 4, paddingRight: 4, fontStyle: 'italic', fontFamily: "'Cormorant Garamond', serif" }}>
            {phoneVerified ? "Your phone number is verified for SMS alerts." : "SMS alerts require a verified US phone number."}
          </p>
        </div>
      </div>

      {/* ───────────── ALERTS ───────────── */}
      <SectionHeader label="Alerts" />
      <div className="mb-2" style={CARD_SURFACE}>
        {/* SMS row */}
        <div className="px-4" style={{ paddingTop: 14, paddingBottom: 14 }}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <IconChip tone={!savedPhone || !phoneVerified ? "muted" : "default"}>
                <Zap size={13} />
              </IconChip>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <RowEyebrow>SMS Alerts</RowEyebrow>
                  {!isPro && (
                    <span
                      style={{
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: 12,
                        fontWeight: 700,
                        letterSpacing: '0.14em',
                        textTransform: 'uppercase',
                        color: GOLD,
                        border: `1px solid ${GOLD}`,
                        borderRadius: 99,
                        padding: '1px 6px',
                        lineHeight: 1.2,
                        marginBottom: 2,
                      }}
                    >
                      Pro
                    </span>
                  )}
                </div>
                <span style={{ fontSize: 13, fontWeight: 500, color: savedPhone && phoneVerified ? FOREST : 'rgba(26,47,30,0.5)', fontFamily: "'DM Sans', sans-serif" }}>
                  {savedPhone && phoneVerified
                    ? `SMS to ···· ${savedPhone.slice(-4)}`
                    : !isPro
                      ? "Upgrade to Pro to enable"
                      : !savedPhone
                        ? "Add a number to enable"
                        : "Tap Verify now above to enable"}
                </span>
              </div>
            </div>
            {isPro && !savedPhone && (
              <button
                onClick={handlePhoneEdit}
                className="hover:opacity-80 transition-opacity shrink-0"
                style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 13, fontStyle: 'italic', color: '#2F6F4E', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px' }}
              >
                Add
              </button>
            )}
            {isPro && savedPhone && !phoneVerified && (
              <button
                onClick={startVerification}
                disabled={otpSending}
                className="hover:opacity-80 transition-opacity shrink-0 disabled:opacity-40"
                style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 13, fontStyle: 'italic', color: '#7A5E1E', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px' }}
              >
                Verify
              </button>
            )}
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
        </div>

        <div className="w-full h-px" style={{ backgroundColor: ROW_DIVIDER }} />

        {/* Email row */}
        <div className="px-4" style={{ paddingTop: 14, paddingBottom: 14 }}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <IconChip><Mail size={13} /></IconChip>
              <div className="min-w-0 flex-1">
                <RowEyebrow>Email Alerts</RowEyebrow>
                <span style={{ fontSize: 13, fontWeight: 500, color: FOREST, fontFamily: "'DM Sans', sans-serif" }}>
                  Permit alerts with dates and booking links
                </span>
              </div>
            </div>
            <button
              onClick={() => setEmailPreviewOpen(true)}
              className="hover:opacity-80 transition-opacity shrink-0"
              style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 13, fontStyle: 'italic', color: '#2F6F4E', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px' }}
              aria-label="Preview alert email"
            >
              Preview
            </button>
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
        </div>

        <div className="w-full h-px" style={{ backgroundColor: ROW_DIVIDER }} />

        {/* Push row */}
        {(() => {
          const notifSupported = "Notification" in window;
          const notifPerm = notifSupported ? Notification.permission : "default";
          const isGranted = notifPerm === "granted";
          return (
            <div className="px-4" style={{ paddingTop: 14, paddingBottom: 14 }}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <IconChip><BellRing size={13} /></IconChip>
                  <div className="min-w-0 flex-1">
                    <RowEyebrow>Push Notifications</RowEyebrow>
                    <span style={{ fontSize: 13, fontWeight: 500, color: FOREST, fontFamily: "'DM Sans', sans-serif" }}>
                      {isGranted ? "Browser push enabled" : "Enable browser push for permit alerts"}
                    </span>
                  </div>
                </div>
                <Switch
                  checked={isGranted}
                  onCheckedChange={async (checked) => {
                    if (checked && notifSupported) {
                      const result = await Notification.requestPermission();
                      if (result === "granted") {
                        toast({ title: "Notifications enabled", description: "You'll receive push alerts for permits." });
                      } else {
                        toast({ title: "Permission denied", description: "Enable notifications in your browser settings." });
                      }
                    }
                  }}
                  disabled={notifPerm === "denied"}
                  role="switch"
                  aria-checked={isGranted}
                  aria-label="Push Notifications"
                />
              </div>
              {isGranted && (
                <p style={{ fontSize: 12, color: MUTED, fontStyle: 'italic', fontFamily: "'Cormorant Garamond', serif", marginTop: 8, marginLeft: 40 }}>
                  {/iPad|iPhone|iPod/.test(navigator.userAgent)
                    ? "To disable: Settings → Safari → Notifications → WildAtlas"
                    : "To disable: tap the lock icon in your browser address bar"}
                </p>
              )}
              {notifPerm === "denied" && (
                <p style={{ fontSize: 12, color: MUTED, fontStyle: 'italic', fontFamily: "'Cormorant Garamond', serif", marginTop: 8, marginLeft: 40 }}>
                  Enable notifications in your browser settings.
                </p>
              )}
            </div>
          );
        })()}
      </div>

      {/* ───────────── SUPPORT ───────────── */}
      <SectionHeader label="Support" />
      <div className="mb-2" style={CARD_SURFACE}>
        <button
          onClick={() => window.open("mailto:wildatlasnp@gmail.com?subject=WildAtlas Feedback", "_blank")}
          className="w-full flex items-center gap-3 hover:bg-[#FAF7F2] transition-colors"
          style={{ padding: '14px 16px' }}
        >
          <IconChip><MessageSquare size={13} /></IconChip>
          <div className="flex-1 text-left">
            <RowEyebrow>Send feedback</RowEyebrow>
            <span style={{ fontSize: 13, fontWeight: 500, color: FOREST, fontFamily: "'DM Sans', sans-serif" }}>
              Bug reports, feature requests, or questions
            </span>
          </div>
          <ChevronRight size={14} style={{ color: MUTED }} className="shrink-0" aria-hidden="true" />
        </button>
        <div className="w-full h-px" style={{ backgroundColor: ROW_DIVIDER }} />
        <a
          href="https://tally.so/r/XxGJXP"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full flex items-center gap-3 hover:bg-[#FAF7F2] transition-colors"
          style={{ padding: '14px 16px' }}
        >
          <IconChip><Shield size={13} /></IconChip>
          <div className="flex-1 text-left">
            <RowEyebrow>Privacy request</RowEyebrow>
            <span style={{ fontSize: 13, fontWeight: 500, color: FOREST, fontFamily: "'DM Sans', sans-serif" }}>
              Data access, deletion, and opt-out requests
            </span>
          </div>
          <ChevronRight size={14} style={{ color: MUTED }} className="shrink-0" aria-hidden="true" />
        </a>
        <div className="w-full h-px" style={{ backgroundColor: ROW_DIVIDER }} />
        <div className="flex items-center gap-3" style={{ padding: '14px 16px' }}>
          <IconChip><Info size={13} /></IconChip>
          <div className="flex-1">
            <RowEyebrow>App version</RowEyebrow>
          </div>
          <span style={{ fontSize: 12, color: MUTED, fontFamily: "'DM Sans', sans-serif", fontVariantNumeric: 'tabular-nums' }}>v1.0.0</span>
        </div>
      </div>

      {/* ───────────── ACCOUNT ───────────── */}
      <SectionHeader label="Account" />
      <div className="mb-2">
        {/* Editorial utility links — full-width tappable rows with → chevron */}
        <div className="flex flex-col">
          <button
            onClick={handleSignOut}
            className="w-full flex items-center justify-between transition-opacity hover:opacity-70"
            style={{
              minHeight: 44,
              background: 'none',
              border: 'none',
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 15,
              fontWeight: 400,
              color: FOREST,
              cursor: 'pointer',
              padding: '10px 0',
              textAlign: 'left',
            }}
          >
            <span>Sign out</span>
            <ArrowRight size={14} style={{ color: MUTED }} aria-hidden="true" />
          </button>

          <DownloadDataButton user={user} />
        </div>

        {/* Delete Account — separated by 24px spacer + 1px hairline */}
        <div className="flex flex-col items-start" style={{ marginTop: 24, paddingTop: 24, borderTop: `1px solid ${IVORY_BORDER}` }}>
          {scheduledDeletionAt ? (
            <div className="w-full px-4 py-3.5" style={{ ...CARD_SURFACE, borderLeft: '3px solid #C0392B' }}>
              <div className="flex items-start gap-2.5">
                <AlertTriangle size={16} className="text-destructive shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 18, fontStyle: 'italic', fontWeight: 500, color: '#C0392B' }}>
                    Account deletion scheduled
                  </p>
                  <p className="text-[12px] text-muted-foreground mt-1 leading-relaxed">
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
            <>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button
                    className="transition-opacity hover:opacity-70"
                    style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 18, fontStyle: 'italic', fontWeight: 500, color: '#C0392B', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0' }}
                  >
                    Delete account
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
              <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: MUTED, marginTop: 6 }}>
                Permanent. Cannot be undone after 7 days.
              </p>
            </>
          )}
        </div>
      </div>

      {/* ───────────── FOOTER ───────────── */}
      {/* Spec asks for 11px DM Sans #8A9E8A; honored at 12px floor (mem://style/typography/legibility-floor). */}
      <div className="flex flex-col items-center" style={{ marginTop: 48 }}>
        <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: '#8A9E8A', textAlign: 'center', margin: 0, lineHeight: 1.5 }} className="px-2">
          Independent service — not affiliated with NPS or Recreation.gov
        </p>
        <div className="flex items-center justify-center gap-2 mt-3">
          <Link to="/privacy" className="hover:opacity-70 transition-opacity" style={{ fontSize: 12, color: '#8A9E8A', fontFamily: "'DM Sans', sans-serif" }}>Privacy Policy</Link>
          <span style={{ fontSize: 12, color: '#8A9E8A' }}>·</span>
          <Link to="/terms" className="hover:opacity-70 transition-opacity" style={{ fontSize: 12, color: '#8A9E8A', fontFamily: "'DM Sans', sans-serif" }}>Terms &amp; Conditions</Link>
        </div>
        <p style={{ fontSize: 12, color: '#8A9E8A', marginTop: 8, fontFamily: "'DM Sans', sans-serif", paddingBottom: embedded ? 0 : 48 }}>© 2026 WildAtlas</p>
      </div>

      {!embedded && <BottomNav activeTab="settings" onTabChange={(tab) => navigate(`/app?tab=${tab}`)} />}
      <ProModal open={proModalOpen} onOpenChange={setProModalOpen} />
      <EmailPreviewModal open={emailPreviewOpen} onOpenChange={setEmailPreviewOpen} />
    </div>
  );
};

export default SettingsPage;