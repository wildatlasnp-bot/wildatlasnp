import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useProStatus } from "@/hooks/useProStatus";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, User, Mail, Phone, Save, Loader2, LogOut, MessageSquare, Trash2, Crown, ExternalLink, Zap, Shield, Check, RotateCcw, ChevronRight } from "lucide-react";
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
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [managingPortal, setManagingPortal] = useState(false);

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

  const handleSave = async () => {
    if (!user) return;
    if (phone && !isValidUSPhone(phone)) {
      toast({ title: "🐻 Invalid phone", description: "Please enter a valid 10-digit US phone number." });
      return;
    }
    setSaving(true);
    const e164Phone = toE164(phone) ?? null;
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: name.trim() || null,
        phone_number: e164Phone,
        notify_email: notifyEmail,
        notify_sms: notifySms && !!e164Phone,
      })
      .eq("user_id", user.id);
    setSaving(false);

    if (error) {
      toast({ title: "🐻 Couldn't save", description: "I'm having trouble reaching the park gates. Give me a moment!" });
    } else {
      toast({ title: "Profile updated", description: "Your settings have been saved." });
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
              </div>
            </>
          ) : (
            <>
              {/* Current plan details */}
              <div className="px-4 pb-3 space-y-1.5">
                <div className="flex items-center gap-2">
                  <Check size={12} className="text-status-quiet" />
                  <span className="text-[12px] text-foreground">1 active permit tracker</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check size={12} className="text-status-quiet" />
                  <span className="text-[12px] text-foreground">Email alerts included</span>
                </div>
              </div>

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
          <span className="text-[13px] text-foreground truncate">{user?.email ?? "—"}</span>
        </div>

        <div className="flex items-center gap-3 bg-card border border-border/70 rounded-xl px-4 py-3">
          <User size={15} className="text-muted-foreground shrink-0" />
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            className="flex-1 bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground outline-none"
          />
        </div>

        <div>
          <div className="flex items-center gap-3 bg-card border border-border/70 rounded-xl px-4 py-3">
            <Phone size={15} className="text-muted-foreground shrink-0" />
            <input
              type="tel"
              value={formatPhoneDisplay(phone)}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
              placeholder="(555) 123-4567"
              className="flex-1 bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground outline-none"
            />
          </div>
          <p className="text-[10px] text-muted-foreground mt-1.5 px-1">US numbers only. Required for SMS alerts.</p>
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
                Immediate notification when a permit opens.{" "}
                {!isValidUSPhone(phone) && <span className="text-secondary">Add a phone number to enable.</span>}
              </p>
            </div>
          </div>
          <Switch
            checked={notifySms}
            onCheckedChange={setNotifySms}
            disabled={!isValidUSPhone(phone)}
          />
        </div>

        <div className="flex items-center justify-between bg-card border border-border/70 rounded-xl px-4 py-3.5">
          <div className="flex items-start gap-3 min-w-0">
            <Mail size={15} className="text-primary shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-foreground">Email Alerts</p>
              <p className="text-[10px] text-muted-foreground leading-snug mt-0.5">
                Summary alerts with available dates and booking links.
              </p>
            </div>
          </div>
          <Switch checked={notifyEmail} onCheckedChange={setNotifyEmail} />
        </div>
      </div>

      {/* Save */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-xl py-3.5 text-[13px] font-bold hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 mb-12"
      >
        {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
        {saving ? "Saving…" : "Save Changes"}
      </button>

      {/* Reset tips */}
      <div className="pt-6 border-t border-border/60 mb-8">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">App</p>
        <button
          onClick={() => {
            resetAllTips();
            toast({ title: "Tips reset", description: "All intro banners and tooltips will appear again." });
          }}
          className="w-full flex items-center justify-center gap-2 bg-card border border-border/70 text-foreground rounded-xl py-3 text-[13px] font-semibold hover:bg-muted transition-colors"
        >
          <RotateCcw size={15} />
          Reset Tips &amp; Banners
        </button>
      </div>

      {/* Account — danger zone */}
      <div className="pt-6 border-t border-border/60">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">Account</p>
        <div className="space-y-2.5">
          <button
            onClick={handleSignOut}
            className="w-full flex items-center justify-center gap-2 bg-destructive/10 text-destructive rounded-xl py-3 text-[13px] font-semibold hover:bg-destructive/20 transition-colors"
          >
            <LogOut size={15} />
            Sign Out
          </button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button className="w-full flex items-center justify-center gap-2 border border-destructive/30 text-destructive rounded-xl py-3 text-[13px] font-semibold hover:bg-destructive/10 transition-colors">
                <Trash2 size={15} />
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