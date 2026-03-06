import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useProStatus } from "@/hooks/useProStatus";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, User, Mail, Phone, Loader2, LogOut, MessageSquare, Trash2, Crown, ExternalLink, Zap, Shield, Check, RotateCcw, ChevronRight, Bell, Info, FileText, Scale } from "lucide-react";
import { useNavigate } from "react-router-dom";
import BottomNav from "@/components/BottomNav";
import { Switch } from "@/components/ui/switch";
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
  const [deleting, setDeleting] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [managingPortal, setManagingPortal] = useState(false);
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
    if (!user) {
      navigate("/auth", { replace: true });
    }
  }, [user, navigate]);

  useEffect(() => {
    if (!user) return;
    if (!loaded) {
      setName(displayName ?? googleName);
      supabase
        .from("profiles")
        .select("phone_number, notify_email, notify_sms")
        .eq("user_id", user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data?.phone_number) {
            const raw = data.phone_number.replace(/^\+1/, "");
            setPhone(raw);
          }
          if (data?.notify_email !== undefined && data.notify_email !== null) setNotifyEmail(data.notify_email);
          if (data?.notify_sms !== undefined && data.notify_sms !== null) setNotifySms(data.notify_sms);
          setLoaded(true);
        });
    }
  }, [user, displayName, loaded]);

  if (!user) return null;


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
              </div>
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
              </div>
            </>
          )}
        </div>
      </div>

      {/* Profile */}
      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">Profile</p>
        <div className="space-y-2.5 mb-8">
        <div className="flex items-center gap-3 bg-card border border-border/70 rounded-xl px-4 py-3">
          <Mail size={15} className="text-muted-foreground shrink-0" />
          <span className="text-[13px] text-foreground truncate flex-1">{user?.email ?? "—"}</span>
          <ChevronRight size={14} className="text-muted-foreground/30 shrink-0" />
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
            <input
              type="tel"
              value={formatPhoneDisplay(phone)}
              onChange={(e) => {
                const raw = e.target.value.replace(/\D/g, "").slice(0, 10);
                setPhone(raw);
                if (isValidUSPhone(raw) || raw === "") {
                  const e164Phone = toE164(raw) ?? null;
                  debouncedSaveField("phone_number", e164Phone);
                }
              }}
              placeholder="(555) 123-4567"
              className="flex-1 bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground outline-none"
            />
            <ChevronRight size={14} className="text-muted-foreground/30 shrink-0" />
          </div>
          <p className="text-[10px] text-muted-foreground mt-1.5 px-1">SMS alerts require a US phone number.</p>
          {phone.length > 0 && !isValidUSPhone(phone) && (
            <p className="text-[10px] text-destructive mt-1 px-1">Enter a valid 10-digit US phone number.</p>
          )}
        </div>
      </div>

      {/* Alerts — unified section with explanations */}
      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">Alerts</p>
      <div className="space-y-2.5 mb-6">
        <div className="flex items-center justify-between bg-card border border-border/70 rounded-xl px-4 py-3.5">
          <div className="flex items-start gap-3 min-w-0">
            <Zap size={15} className="text-secondary shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-foreground">SMS Alerts</p>
              <p className="text-[10px] text-muted-foreground leading-snug mt-0.5">
                {!isValidUSPhone(phone)
                  ? <span className="text-secondary">Add a phone number to enable SMS alerts.</span>
                  : "Instant notification when a permit opens."}
              </p>
            </div>
          </div>
          <Switch
            checked={notifySms}
            onCheckedChange={(checked) => {
              setNotifySms(checked);
              const e164Phone = toE164(phone) ?? null;
              persistProfile({ notify_sms: checked && !!e164Phone });
            }}
            disabled={!isValidUSPhone(phone)}
          />
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
          <button
            onClick={() => navigate("/privacy")}
            className="w-full flex items-center gap-3 bg-card border border-border/70 rounded-xl px-4 py-3 hover:bg-muted transition-colors"
          >
            <Shield size={15} className="text-muted-foreground shrink-0" />
            <span className="flex-1 text-left text-[13px] font-semibold text-foreground">Privacy Policy</span>
            <ChevronRight size={14} className="text-muted-foreground/30 shrink-0" />
          </button>

          {/* Terms of Service */}
          <button
            onClick={() => navigate("/terms")}
            className="w-full flex items-center gap-3 bg-card border border-border/70 rounded-xl px-4 py-3 hover:bg-muted transition-colors"
          >
            <Scale size={15} className="text-muted-foreground shrink-0" />
            <span className="flex-1 text-left text-[13px] font-semibold text-foreground">Terms of Service</span>
            <ChevronRight size={14} className="text-muted-foreground/30 shrink-0" />
          </button>

          {/* Send Feedback */}
          <button
            onClick={() => window.open("mailto:support@wildatlas.app?subject=WildAtlas Feedback", "_blank")}
            className="w-full flex items-center gap-3 bg-card border border-border/70 rounded-xl px-4 py-3 hover:bg-muted transition-colors"
          >
            <MessageSquare size={15} className="text-muted-foreground shrink-0" />
            <div className="flex-1 text-left">
              <p className="text-[13px] font-semibold text-foreground">Send Feedback</p>
              <p className="text-[10px] text-muted-foreground leading-snug mt-0.5">Bug reports, feature requests, or questions.</p>
            </div>
            <ChevronRight size={14} className="text-muted-foreground/30 shrink-0" />
          </button>

          {/* App Version */}
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
      <BottomNav activeTab="sniper" onTabChange={(tab) => navigate(`/app?tab=${tab}`)} settingsActive />
    </div>
  );
};

export default SettingsPage;