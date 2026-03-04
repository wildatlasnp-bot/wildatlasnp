import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, User, Mail, Phone, Save, Loader2, LogOut, Bell, MessageSquare, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Switch } from "@/components/ui/switch";
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

const SettingsPage = () => {
  const { user, displayName, signOut } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [name, setName] = useState(displayName ?? "");
  const [phone, setPhone] = useState("");
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [notifySms, setNotifySms] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate("/auth", { replace: true });
    }
  }, [user, navigate]);

  useEffect(() => {
    if (!user) return;
    if (!loaded) {
      if (displayName !== null) setName(displayName);
      supabase
        .from("profiles")
        .select("phone_number, notify_email, notify_sms")
        .eq("user_id", user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data?.phone_number) setPhone(data.phone_number);
          if (data?.notify_email !== undefined && data.notify_email !== null) setNotifyEmail(data.notify_email);
          if (data?.notify_sms !== undefined && data.notify_sms !== null) setNotifySms(data.notify_sms);
        });
      setLoaded(true);
    }
  }, [user, displayName, loaded]);

  if (!user) return null;

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const trimmedPhone = phone.trim().replace(/[^\d+]/g, "");
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: name.trim() || null,
        phone_number: trimmedPhone || null,
        notify_email: notifyEmail,
        notify_sms: notifySms,
      })
      .eq("user_id", user.id);
    setSaving(false);

    if (error) {
      toast({ title: "🐻 Couldn't save", description: "I'm having trouble reaching the park gates. Give me a moment!" });
    } else {
      toast({ title: "Profile updated", description: "Your display name has been saved." });
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

  return (
    <div className="min-h-screen bg-background max-w-lg mx-auto px-5 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <button
          onClick={() => navigate("/app")}
          className="w-9 h-9 rounded-xl bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Go back"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-[22px] font-heading font-bold text-foreground">Settings</h1>
      </div>

      {/* Profile section */}
      <div className="space-y-5">
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2 block">
            Email
          </label>
          <div className="flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-3">
            <Mail size={16} className="text-muted-foreground shrink-0" />
            <span className="text-sm text-foreground truncate">{user?.email ?? "—"}</span>
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2 block">
            Display Name
          </label>
          <div className="flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-3">
            <User size={16} className="text-muted-foreground shrink-0" />
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2 block">
            Phone Number
          </label>
          <div className="flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-3">
            <Phone size={16} className="text-muted-foreground shrink-0" />
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 (555) 123-4567"
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
            />
          </div>
          <p className="text-[11px] text-muted-foreground mt-1.5 px-1">Required for SMS permit alerts. Standard messaging rates apply.</p>
        </div>

        {/* Notification Preferences */}
        <div className="pt-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3 block">
            Notification Preferences
          </label>
          <div className="space-y-3">
            <div className="flex items-center justify-between bg-card border border-border rounded-xl px-4 py-3">
              <div className="flex items-center gap-3">
                <Mail size={16} className="text-muted-foreground shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">Email Alerts</p>
                  <p className="text-[11px] text-muted-foreground">Get notified when permits become available</p>
                </div>
              </div>
              <Switch checked={notifyEmail} onCheckedChange={setNotifyEmail} />
            </div>
            <div className="flex items-center justify-between bg-card border border-border rounded-xl px-4 py-3">
              <div className="flex items-center gap-3">
                <MessageSquare size={16} className="text-muted-foreground shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">SMS Alerts</p>
                  <p className="text-[11px] text-muted-foreground">
                    {phone.replace(/\D/g, "").length >= 10
                      ? "Real-time texts when permits open up"
                      : "Add a phone number above to enable"}
                  </p>
                </div>
              </div>
              <Switch
                checked={notifySms}
                onCheckedChange={setNotifySms}
                disabled={phone.replace(/\D/g, "").length < 10}
              />
            </div>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-xl py-3 text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {saving ? "Saving…" : "Save Changes"}
        </button>
      </div>

      {/* Danger zone */}
      <div className="mt-12 pt-6 border-t border-border">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-4">Account</h2>
        <div className="space-y-3">
          <button
            onClick={handleSignOut}
            className="w-full flex items-center justify-center gap-2 bg-destructive/10 text-destructive rounded-xl py-3 text-sm font-semibold hover:bg-destructive/20 transition-colors"
          >
            <LogOut size={16} />
            Sign Out
          </button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button className="w-full flex items-center justify-center gap-2 border border-destructive/30 text-destructive rounded-xl py-3 text-sm font-semibold hover:bg-destructive/10 transition-colors">
                <Trash2 size={16} />
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
    </div>
  );
};

export default SettingsPage;
