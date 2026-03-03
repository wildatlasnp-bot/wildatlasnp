import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, User, Mail, Save, Loader2, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";

const SettingsPage = () => {
  const { user, displayName, signOut } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [name, setName] = useState(displayName ?? "");
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (displayName !== null && !loaded) {
      setName(displayName);
      setLoaded(true);
    }
  }, [displayName, loaded]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: name.trim() || null })
      .eq("user_id", user.id);
    setSaving(false);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Profile updated", description: "Your display name has been saved." });
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background max-w-lg mx-auto px-5 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <button
          onClick={() => navigate("/")}
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
        <button
          onClick={handleSignOut}
          className="w-full flex items-center justify-center gap-2 bg-destructive/10 text-destructive rounded-xl py-3 text-sm font-semibold hover:bg-destructive/20 transition-colors"
        >
          <LogOut size={16} />
          Sign Out
        </button>
      </div>
    </div>
  );
};

export default SettingsPage;
