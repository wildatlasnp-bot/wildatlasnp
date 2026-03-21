import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Loader2, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getPermitIcon } from "@/lib/parks";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import posthog from "@/lib/posthog";

interface PermitOption {
  name: string;
  description: string | null;
}

interface AddPermitModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parkId: string;
  parkName: string;
  trackedPermits: string[];
  onPermitAdded: () => void;
}

const AddPermitModal = ({ open, onOpenChange, parkId, parkName, trackedPermits, onPermitAdded }: AddPermitModalProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [permitOptions, setPermitOptions] = useState<PermitOption[]>([]);
  const [selectedPermit, setSelectedPermit] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    setSelectedPermit(null);
    setLoading(true);
    supabase
      .from("park_permits")
      .select("name, description")
      .eq("park_id", parkId)
      .eq("is_active", true)
      .then(({ data }) => {
        const available = (data ?? []).filter((p) => !trackedPermits.includes(p.name));
        setPermitOptions(available);
        if (available.length > 0) setSelectedPermit(available[0].name);
        setLoading(false);
      });
  }, [open, parkId, trackedPermits]);

  const handleSave = async () => {
    if (!user || !selectedPermit) return;
    setSaving(true);
    try {
      // Use the security definer function to find-or-create scan_target + user_watcher
      const { error } = await supabase.rpc("create_or_join_watch", {
        p_user_id: user.id,
        p_park_id: parkId,
        p_permit_name: selectedPermit,
      });
      if (error) throw error;
      posthog.capture("permit_tracker_added", { permit_name: selectedPermit, park_id: parkId });
      toast({ title: "🎯 Permit added!", description: `Now tracking ${selectedPermit}.` });
      onPermitAdded();
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Trail hiccup", description: e?.message || "Couldn't add permit. Try again!" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm p-0 gap-0 overflow-hidden border-0 rounded-2xl bg-card shadow-2xl">
        <div className="p-6">
          <h2 className="text-[17px] font-heading font-bold text-foreground mb-1">
            Track a permit at {parkName}
          </h2>
          <p className="text-[12px] text-muted-foreground mb-5">
            Select a permit to add to your tracker.
          </p>

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 size={20} className="animate-spin text-muted-foreground" />
            </div>
          ) : permitOptions.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-[13px] text-muted-foreground">You're already tracking all available permits at {parkName}!</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {permitOptions.map((permit) => {
                const selected = selectedPermit === permit.name;
                const Icon = getPermitIcon(permit.name);
                return (
                  <button
                    key={permit.name}
                    onClick={() => setSelectedPermit(permit.name)}
                    className={`w-full flex items-center gap-3 p-3.5 rounded-[18px] border transition-all text-left ${
                      selected ? "border-primary bg-primary/5" : "border-border/70 hover:border-primary/30"
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      selected ? "bg-primary/15" : "bg-muted"
                    }`}>
                      <Icon size={15} className={selected ? "text-primary" : "text-muted-foreground"} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-foreground">{permit.name}</p>
                      {permit.description && (
                        <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{permit.description}</p>
                      )}
                    </div>
                    {selected && (
                      <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center shrink-0">
                        <Check size={12} className="text-primary-foreground" strokeWidth={3} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {permitOptions.length > 0 && (
            <button
              onClick={handleSave}
              disabled={saving || !selectedPermit}
              className="w-full mt-5 py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-[14px] hover:opacity-90 transition-opacity flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
            >
              {saving ? (
                <><Loader2 size={15} className="animate-spin" /> Adding…</>
              ) : (
                <>Start Tracking <ArrowRight size={15} /></>
              )}
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AddPermitModal;
