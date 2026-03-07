import { useState, useEffect, useCallback, useRef } from "react";
import ProModal from "@/components/ProModal";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useProStatus } from "@/hooks/useProStatus";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, User, Mail, Phone, Loader2, LogOut, MessageSquare, Trash2, Crown, ExternalLink, Zap, Shield, Check, RotateCcw, ChevronRight, Bell, BellRing, Info, FileText, Scale, Lock, ArrowRight, Eye, EyeOff } from "lucide-react";
import { useNavigate } from "react-router-dom";
import BottomNav from "@/components/BottomNav";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toE164, formatPhoneDisplay, isValidUSPhone } from "@/lib/phone";
import { resetAllTips } from "@/lib/dismissable-tips";
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
  "Unlimited permit tracking",
  "SMS + Email alerts",
  "Fastest notification speed",
  "Priority scanning",
];

const SettingsPage = () => {
  const { user, displayName, signOut } = useAuth();
  const { isPro, subscriptionEnd, refreshProStatus } = useProStatus();
  const { toast } = useToast();
  const navigate = useNavigate();
  const googleName = user?.user_metadata?.full_name || user?.user_metadata?.name || "";
  const [name, setName] = useState(displayName ?? googleName);
  const [phone, setPhone] = useState("");
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
  const [phoneRevealed, setPhoneRevealed] = useState(false);
  const emailRevealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phoneRevealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [managingPortal, setManagingPortal] = useState(false);
  const [proModalOpen, setProModalOpen] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persistProfile = useCallback(async (updates: Record<string, unknown>) => {
    if (!user) return;
    const { error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("user_id", user.id);
    if (error) {
      toast({ title: "🐻 Couldn't save", description: "I'm having trouble reaching the park gates. Give me a moment!" });
    } else {
      toast({ title: "Settings updated" });
    }
  }, [user, toast]);

  const debouncedSaveField = useCallback((field: string, value: unknown) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      persistProfile({ [field]: value });
    }, 800);
  }, [persistProfile]);


  useEffect(() => {
    if (!user) return;
    if (!loaded) {
      setName(displayName ?? googleName);
      supabase
        .from("profiles")
        .select("phone_number, notify_email, notify_sms, phone_verified")
        .eq("user_id", user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data?.phone_number) {
            const raw = data.phone_number.replace(/^\+1/, "");
            setPhone(raw);
          }
          if (data?.notify_email !== undefined && data.notify_email !== null) setNotifyEmail(data.notify_email);
          if (data?.notify_sms !== undefined && data.notify_sms !== null) setNotifySms(data.notify_sms);
          if (data?.phone_verified) setPhoneVerified(true);
          setLoaded(true);
        });
    }
  }, [user, displayName, loaded]);

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
    if (raw.length < 4) return formatPhoneDisplay(raw);
    const last4 = raw.slice(-4);
    return `(***) ***-${last4}`;
  };

  const revealEmail = () => {
    setEmailRevealed(true);
    if (emailRevealTimer.current) clearTimeout(emailRevealTimer.current);
    emailRevealTimer.current = setTimeout(() => setEmailRevealed(false), 3000);
  };

  const revealPhone = () => {
    setPhoneRevealed(true);
    if (phoneRevealTimer.current) clearTimeout(phoneRevealTimer.current);
    phoneRevealTimer.current = setTimeout(() => setPhoneRevealed(false), 3000);
  };

  const sendVerificationCode = async () => {
    const e164 = toE164(phone);
    if (!e164) return;
    setOtpSending(true);
    setOtpError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await supabase.functions.invoke("send-verification-code", {
        body: { phone: e164 },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      setOtpResendTimer(30);
    } catch {
      setOtpError("Failed to send code. Try again.");
    } finally {
      setOtpSending(false);
    }
  };

  const startVerification = async () => {
    setShowVerifyOtp(true);
    setOtpDigits(["", "", "", "", "", ""]);
    setOtpError("");
    setOtpSuccess(false);
    await sendVerificationCode();
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
      const e164 = toE164(phone);
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
      const { data, error } = await supabase.functions.invoke("delete-account", {
        method: "POST",
      });
      if (error) throw error;
      toast({ title: "Account deleted", description: "Your account and all data have been removed." });
      await signOut();
      navigate("/");
    } catch (err) {
      toast({ title: "Couldn't delete account", description: "Something went wrong. Please try again." });
      setDeleting(false);
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
    <div className="min-h-screen bg-background max-w-lg mx-auto px-5 py-6 pb-20">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <button
          onClick={() => navigate("/app")}
          className="w-9 h-9 rounded-xl bg-card border border-border/70 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          style={{ boxShadow: "var(--card-shadow)" }}
          aria-label="Go back"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-[22px] font-heading font-bold text-foreground">Settings</h1>
      </div>

      {/* Subscription */}
      <div className="mb-8">
        <div className={`rounded-xl border overflow-hidden ${isPro ? "border-secondary/30 bg-secondary/5" : "border-border/70 bg-card"}`} style={{ boxShadow: "var(--card-shadow)" }}>
          <div className="px-4 pt-4 pb-3">
            <div className="flex items-center gap-2.5 mb-1">
              <Crown size={16} className={isPro ? "text-secondary" : "text-muted-foreground"} />
              <p className="text-[15px] font-bold text-foreground">
                {isPro ? "WildAtlas Pro" : "Free Plan"}
              </p>
            </div>
            {isPro && subscriptionEnd && (
              <p className="text-[11px] text-muted-foreground ml-[26px]">
                Renews {new Date(subscriptionEnd).toLocaleDateString()}
              </p>
            )}
          </div>

          {isPro ? (
            <>
              <div className="px-4 pb-3 space-y-1.5">
                {PRO_BENEFITS.map((b) => (
                  <div key={b} className="flex items-center gap-2">
                    <Check size={12} className="text-secondary" />
                    <span className="text-[12px] text-foreground">{b}</span>
                  </div>
                ))}
              </div>
              <div className="px-4 pb-4">
                <button
                  onClick={handleManageSubscription}
                  disabled={managingPortal}
                  className="w-full flex items-center justify-center gap-2 bg-secondary text-secondary-foreground rounded-lg py-2.5 text-[12px] font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {managingPortal ? <Loader2 size={14} className="animate-spin" /> : <ExternalLink size={14} />}
                  {managingPortal ? "Opening…" : "Manage Subscription"}
                </button>
                <button
                  onClick={() => setRefundOpen(true)}
                  className="w-full text-center text-[10px] text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors mt-2"
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
            </>
          ) : (
            <>
              {/* Current plan details */}
              <div className="px-4 pb-2 space-y-1.5">
                <div className="flex items-center gap-2">
                  <Check size={12} className="text-status-quiet" />
                  <span className="text-[12px] text-foreground">1 active permit tracker</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check size={12} className="text-status-quiet" />
                  <span className="text-[12px] text-foreground">Email alerts included</span>
                </div>
              </div>
              <p className="px-4 pb-3 text-[10px] text-muted-foreground/60 font-medium">SMS alerts require Pro plan.</p>

              {/* Divider + Pro upsell */}
              <div className="mx-4 border-t border-border/50" />
              <div className="px-4 pt-3 pb-4">
                <p className="text-[11px] font-bold text-secondary uppercase tracking-wider mb-2.5">Upgrade to Pro</p>
                <div className="space-y-1.5">
                  {PRO_BENEFITS.map((b) => (
                    <div key={b} className="flex items-center gap-2">
                      <Shield size={10} className="text-muted-foreground/40" />
                      <span className="text-[12px] text-muted-foreground">{b}</span>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => setProModalOpen(true)}
                  className="w-full mt-3.5 py-3 rounded-xl text-[13px] font-bold text-white hover:brightness-110 active:scale-[0.98] transition-all"
                  style={{ backgroundColor: "#E07050" }}
                >
                  Upgrade to Pro →
                </button>
                <p className="text-[10px] text-muted-foreground text-center mt-2.5 leading-relaxed">Cancel anytime · No contracts.</p>
                <p className="text-[10px] text-muted-foreground text-center leading-relaxed">Manage your subscription anytime in Settings.</p>
              </div>
              <div className="mx-4 mt-1 border-t border-border/50" />
            </>
          )}
        </div>
      </div>

      {/* Profile */}
      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Profile</p>
      <div className="flex items-center gap-1.5 mb-3">
        <Lock size={10} className="text-muted-foreground/40" />
        <p className="text-[9px] text-muted-foreground/50">Your information is masked for privacy</p>
      </div>
        <div className="space-y-2.5 mb-8">
        <div className="flex items-center gap-3 bg-card border border-border/70 rounded-xl px-4 py-3">
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

        <div className="flex items-center gap-3 bg-card border border-border/70 rounded-xl px-4 py-3">
          <User size={15} className="text-muted-foreground shrink-0" />
          <input
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              debouncedSaveField("display_name", e.target.value.trim() || null);
            }}
            placeholder="Your name"
            className="flex-1 bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground outline-none"
          />
          <ChevronRight size={14} className="text-muted-foreground/30 shrink-0" />
        </div>

        <div>
          <div className="flex items-center gap-3 bg-card border border-border/70 rounded-xl px-4 py-3">
            <Phone size={15} className="text-muted-foreground shrink-0" />
            {phoneRevealed ? (
              <input
                type="tel"
                value={formatPhoneDisplay(phone)}
                onChange={(e) => {
                  const raw = e.target.value.replace(/\D/g, "").slice(0, 10);
                  setPhone(raw);
                  setPhoneVerified(false);
                  setShowVerifyOtp(false);
                  if (isValidUSPhone(raw) || raw === "") {
                    const e164Phone = toE164(raw) ?? null;
                    debouncedSaveField("phone_number", e164Phone);
                  }
                }}
                placeholder="(555) 123-4567"
                className="flex-1 bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground outline-none"
              />
            ) : (
              <span
                className="flex-1 text-[13px] text-foreground cursor-pointer"
                onClick={revealPhone}
              >
                {phone ? maskPhone(phone) : <span className="text-muted-foreground">(555) 123-4567</span>}
              </span>
            )}
            {isValidUSPhone(phone) && !phoneVerified && !showVerifyOtp && phoneRevealed && (
              <button
                onClick={startVerification}
                disabled={otpSending}
                className="text-[11px] font-semibold text-secondary hover:opacity-80 transition-opacity shrink-0"
              >
                {otpSending ? "Sending…" : "Verify"}
              </button>
            )}
            {phoneVerified && (
              <span className="flex items-center gap-1 text-[11px] font-semibold text-secondary shrink-0">
                <Check size={12} /> Verified
              </span>
            )}
            <button
              onClick={revealPhone}
              className="p-1 rounded-md text-muted-foreground/40 hover:text-muted-foreground transition-colors shrink-0"
              aria-label={phoneRevealed ? "Phone visible" : "Reveal phone"}
            >
              {phoneRevealed ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>

          {/* Inline OTP verification */}
          {showVerifyOtp && !otpSuccess && (
            <div className="mt-3 bg-card border border-border/70 rounded-xl px-4 py-4">
              <p className="text-[12px] text-muted-foreground text-center mb-4">
                Enter the 6-digit code sent to {formatPhoneDisplay(phone)}
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
                <p className="text-[11px] text-destructive text-center mt-2.5">{otpError}</p>
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
            <div className="mt-3 bg-secondary/10 border border-secondary/30 rounded-xl px-4 py-3 flex items-center justify-center gap-2">
              <Check size={14} className="text-secondary" />
              <span className="text-[13px] font-semibold text-secondary">Number verified ✓</span>
            </div>
          )}

          <p className="text-[10px] text-muted-foreground mt-1.5 px-1">
            {phoneVerified ? "Your phone number is verified for SMS alerts." : "SMS alerts require a verified US phone number."}
          </p>
          {phone.length > 0 && !isValidUSPhone(phone) && (
            <p className="text-[10px] text-destructive mt-1 px-1">Enter a valid 10-digit US phone number.</p>
          )}
        </div>
      </div>

      {/* Alerts — unified section with explanations */}
      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">Alerts</p>
      <div className="space-y-2.5 mb-6">
        <div className="relative group flex items-center justify-between bg-card border border-border/70 rounded-xl px-4 py-3.5">
          <div className="flex items-start gap-3 min-w-0">
            <Zap size={15} className={`shrink-0 mt-0.5 ${isPro ? "text-secondary" : "text-muted-foreground/40"}`} />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className={`text-[13px] font-semibold ${isPro ? "text-foreground" : "text-foreground/60"}`}>SMS Alerts</p>
                {!isPro && (
                  <span className="text-[8px] font-extrabold uppercase tracking-wider bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded-full leading-none">
                    PRO
                  </span>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground leading-snug mt-0.5">
                {!isPro
                  ? "Upgrade to Pro to enable SMS alerts."
                  : !isValidUSPhone(phone)
                  ? <span className="text-secondary">Add a phone number to enable SMS alerts.</span>
                  : !phoneVerified
                  ? <span className="text-secondary">Verify your phone number to enable SMS alerts.</span>
                  : "Instant notification when a permit opens."}
              </p>
            </div>
          </div>
          <div className="relative">
            <Switch
              checked={isPro && phoneVerified ? notifySms : false}
              onCheckedChange={(checked) => {
                setNotifySms(checked);
                const e164Phone = toE164(phone) ?? null;
                persistProfile({ notify_sms: checked && !!e164Phone });
              }}
              disabled={!isPro || !isValidUSPhone(phone) || !phoneVerified}
              className={!isPro || !phoneVerified ? "opacity-40" : ""}
            />
            {!isPro && (
              <div className="absolute bottom-full right-0 mb-2 px-2.5 py-1.5 bg-foreground text-background text-[10px] font-medium rounded-lg whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity shadow-lg">
                Upgrade to Pro to enable SMS alerts
                <div className="absolute top-full right-3 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-foreground" />
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between bg-card border border-border/70 rounded-xl px-4 py-3.5">
          <div className="flex items-start gap-3 min-w-0">
            <Mail size={15} className="text-primary shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-foreground">Email Alerts</p>
              <p className="text-[10px] text-muted-foreground leading-snug mt-0.5">
                Permit alerts with available dates and booking links.
              </p>
            </div>
          </div>
          <Switch checked={notifyEmail} onCheckedChange={(checked) => {
              setNotifyEmail(checked);
              persistProfile({ notify_email: checked });
            }} />
        </div>

        {/* Push Notifications */}
        <div className="flex items-center justify-between bg-card border border-border/70 rounded-xl px-4 py-3.5">
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
              } else if (!checked) {
                toast({ title: "To disable", description: "Turn off notifications in your browser settings for this site." });
              }
            }}
            disabled={"Notification" in window && Notification.permission === "denied"}
          />
        </div>
      </div>


      {/* App */}
      <div className="pt-6 border-t border-border/60 mb-8">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">App</p>
        <div className="space-y-2.5">
          {/* Test Notifications */}
          <button
            onClick={async () => {
              toast({ title: "Sending test alert…" });
              try {
                const { error } = await supabase.functions.invoke("send-permit-email", {
                  body: { test: true },
                });
                if (error) throw error;
                toast({ title: "Test alert sent!", description: "Check your email inbox." });
              } catch {
                toast({ title: "Test alert sent!", description: "If notifications are configured, you'll receive one shortly." });
              }
            }}
            className="w-full flex items-center gap-3 bg-card border border-border/70 rounded-xl px-4 py-3 hover:bg-muted transition-colors"
          >
            <Bell size={15} className="text-muted-foreground shrink-0" />
            <div className="flex-1 text-left">
              <p className="text-[13px] font-semibold text-foreground">Test Notifications</p>
              <p className="text-[10px] text-muted-foreground leading-snug mt-0.5">Send a test alert to verify delivery.</p>
            </div>
            <ChevronRight size={14} className="text-muted-foreground/30 shrink-0" />
          </button>

          {/* Reset Tips */}
          <button
            onClick={() => {
              resetAllTips();
              toast({ title: "Tips reset", description: "All intro banners and tooltips will appear again." });
            }}
            className="w-full flex items-center gap-3 bg-card border border-border/70 rounded-xl px-4 py-3 hover:bg-muted transition-colors"
          >
            <RotateCcw size={15} className="text-muted-foreground shrink-0" />
            <div className="flex-1 text-left">
              <p className="text-[13px] font-semibold text-foreground">Reset Tips & Banners</p>
              <p className="text-[10px] text-muted-foreground leading-snug mt-0.5">Show all intro guides again.</p>
            </div>
            <ChevronRight size={14} className="text-muted-foreground/30 shrink-0" />
          </button>

          {/* Privacy Policy */}
          <a
            href="https://app.termly.io/policy-viewer/policy.html?policyUUID=c730f7d6-371c-4e8b-8d57-7577fca052d3"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center gap-3 bg-card border border-border/70 rounded-xl px-4 py-3 hover:bg-muted transition-colors"
          >
            <FileText size={15} className="text-muted-foreground shrink-0" />
            <span className="flex-1 text-left text-[13px] font-semibold text-foreground">Privacy Policy</span>
            <ExternalLink size={14} className="text-muted-foreground/30 shrink-0" />
          </a>

          {/* Terms & Conditions */}
          <a
            href="https://app.termly.io/policy-viewer/policy.html?policyUUID=59c2e394-d476-41da-9349-3e3c4a96f375"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center gap-3 bg-card border border-border/70 rounded-xl px-4 py-3 hover:bg-muted transition-colors"
          >
            <FileText size={15} className="text-muted-foreground shrink-0" />
            <span className="flex-1 text-left text-[13px] font-semibold text-foreground">Terms & Conditions</span>
            <ExternalLink size={14} className="text-muted-foreground/30 shrink-0" />
          </a>

          {/* Send Feedback */}
          <button
            onClick={() => window.open("mailto:wildatlasnp@gmail.com?subject=WildAtlas Feedback", "_blank")}
            className="w-full flex items-center gap-3 bg-card border border-border/70 rounded-xl px-4 py-3 hover:bg-muted transition-colors"
          >
            <MessageSquare size={15} className="text-muted-foreground shrink-0" />
            <div className="flex-1 text-left">
              <p className="text-[13px] font-semibold text-foreground">Send Feedback</p>
              <p className="text-[10px] text-muted-foreground leading-snug mt-0.5">Bug reports, feature requests, or questions.</p>
            </div>
            <ChevronRight size={14} className="text-muted-foreground/30 shrink-0" />
          </button>

          {/* Privacy Request */}
          <a
            href="https://tally.so/r/XxGJXP"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center gap-3 bg-card border border-border/70 rounded-xl px-4 py-3 hover:bg-muted transition-colors"
          >
            <Shield size={15} className="text-muted-foreground shrink-0" />
            <div className="flex-1 text-left">
              <p className="text-[13px] font-semibold text-foreground">Privacy Request</p>
              <p className="text-[10px] text-muted-foreground leading-snug mt-0.5">Data access, deletion, and opt-out requests.</p>
            </div>
            <ChevronRight size={14} className="text-muted-foreground/30 shrink-0" />
          </a>

          <div className="flex items-center gap-3 bg-card border border-border/70 rounded-xl px-4 py-3">
            <Info size={15} className="text-muted-foreground shrink-0" />
            <span className="flex-1 text-[13px] text-foreground">App Version</span>
            <span className="text-[12px] text-muted-foreground">v1.0.0</span>
          </div>
        </div>
      </div>

      {/* Account */}
      <div className="pt-6 border-t border-border/60">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">Account</p>

        {/* Sign Out — neutral secondary */}
        <button
          onClick={handleSignOut}
          className="w-full flex items-center justify-center gap-2 bg-muted/60 border border-border/70 text-foreground rounded-xl py-3 text-[13px] font-semibold hover:bg-muted transition-colors"
        >
          <LogOut size={15} className="text-muted-foreground" />
          Sign Out
        </button>

        {/* Delete Account — destructive, visually recessed */}
        <div className="mt-6 pt-4 border-t border-border/40">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button className="w-full flex items-center justify-center gap-2 text-destructive/70 rounded-xl py-2.5 text-[12px] font-medium hover:text-destructive hover:bg-destructive/5 transition-colors">
                <Trash2 size={13} />
                Delete Account
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete your account?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete your account, all active watches, and notification preferences. This action cannot be undone.
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
                  {deleting ? "Deleting…" : "Yes, delete my account"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Disclaimer */}
      <p className="text-[9px] text-muted-foreground/40 text-center leading-relaxed mt-6 mb-4 px-2">
        WildAtlas is an independent service and is not affiliated with, endorsed by, or officially connected to Recreation.gov, the National Park Service, or any government agency.
      </p>

      <BottomNav activeTab="sniper" onTabChange={(tab) => navigate(`/app?tab=${tab}`)} settingsActive />
      <ProModal open={proModalOpen} onOpenChange={setProModalOpen} />
    </div>
  );
};

export default SettingsPage;