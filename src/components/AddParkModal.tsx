import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, Crown, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ALL_PARK_IDS, PARKS, getPermitIcon } from "@/lib/parks";
import { useProStatus } from "@/hooks/useProStatus";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface AddParkModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onParkAdded: (parkId: string) => void;
  onUpgrade: () => void;
}

interface PermitOption {
  name: string;
  description: string | null;
}

const AddParkModal = ({ open, onOpenChange, onParkAdded, onUpgrade }: AddParkModalProps) => {
  const { isPro } = useProStatus();
  const { user } = useAuth();
  const { toast } = useToast();

  const [step, setStep] = useState<"park" | "permit">("park");
  const [selectedPark, setSelectedPark] = useState<string | null>(null);
  const [permitOptions, setPermitOptions] = useState<PermitOption[]>([]);
  const [selectedPermits, setSelectedPermits] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setStep("park");
      setSelectedPark(null);
      setPermitOptions([]);
      setSelectedPermits([]);
    }
  }, [open]);

  // Load permits when park is selected and we move to permit step
  useEffect(() => {
    if (step !== "permit" || !selectedPark) return;
    supabase
      .from("park_permits")
      .select("name, description")
      .eq("park_id", selectedPark)
      .eq("is_active", true)
      .then(({ data }) => {
        if (data && data.length > 0) {
          setPermitOptions(data);
          setSelectedPermits([data[0].name]);
        } else {
          setPermitOptions([]);
          setSelectedPermits([]);
        }
      });
  }, [selectedPark, step]);

  const togglePermit = (name: string) => {
    if (!isPro) {
      // Free users can only pick 1
      setSelectedPermits([name]);
    } else {
      setSelectedPermits((prev) =>
        prev.includes(name) ? prev.filter((p) => p !== name) : [...prev, name]
      );
    }
  };

  const handleParkSelect = (parkId: string) => {
    setSelectedPark(parkId);
    setStep("permit");
  };

  const handleSave = async () => {
    if (!user || !selectedPark || selectedPermits.length === 0) return;
    setSaving(true);
    try {
      for (const permitName of selectedPermits) {
        // Check if watch already exists
        const { data: existing } = await supabase
          .from("active_watches")
          .select("id")
          .eq("user_id", user.id)
          .eq("park_id", selectedPark)
          .eq("permit_name", permitName)
          .maybeSingle();

        if (existing) {
          // Reactivate if paused
          await supabase
            .from("active_watches")
            .update({ is_active: true, status: "searching" })
            .eq("id", existing.id);
        } else {
          const { error } = await supabase
            .from("active_watches")
            .insert({
              user_id: user.id,
              permit_name: permitName,
              park_id: selectedPark,
              status: "searching",
              is_active: true,
              notify_sms: false,
            });
          if (error) throw error;
        }
      }

      toast({
        title: "🎯 Park added!",
        description: `Now tracking ${selectedPermits.length} permit${selectedPermits.length > 1 ? "s" : ""} at ${PARKS[selectedPark]?.shortName ?? selectedPark}.`,
      });
      onParkAdded(selectedPark);
      onOpenChange(false);
    } catch (e: any) {
      const msg = e?.message || "";
      if (msg.includes("Free plan limited")) {
        onOpenChange(false);
        onUpgrade();
      } else {
        toast({ title: "🐻 Trail hiccup", description: "Couldn't add the park. Please try again!" });
      }
    } finally {
      setSaving(false);
    }
  };

  // Free user gate — show upgrade prompt instead
  if (open && !isPro) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-sm p-0 gap-0 overflow-hidden border-0 rounded-2xl bg-card shadow-2xl">
          <div className="px-6 pt-8 pb-6 text-center">
            <div className="w-14 h-14 rounded-2xl bg-secondary/10 flex items-center justify-center mx-auto mb-4">
              <Crown size={26} className="text-secondary" />
            </div>
            <h2 className="text-[17px] font-heading font-bold text-foreground mb-2">
              Upgrade to Pro for unlimited permit tracking
            </h2>
            <p className="text-[13px] text-muted-foreground leading-relaxed">
              Free plan supports 1 active tracker. Upgrade to track permits across all 6 parks simultaneously.
            </p>
          </div>
          <div className="px-6 pb-6 space-y-3">
            <button
              onClick={() => {
                onOpenChange(false);
                onUpgrade();
              }}
              className="w-full py-3.5 rounded-xl bg-secondary text-secondary-foreground font-bold text-[14px] hover:opacity-90 transition-opacity flex items-center justify-center gap-2 shadow-lg"
            >
              <ArrowRight size={15} />
              Upgrade to Pro →
            </button>
            <button
              onClick={() => onOpenChange(false)}
              className="w-full text-center text-[12px] text-muted-foreground hover:text-foreground transition-colors py-1"
            >
              Maybe later
            </button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 gap-0 overflow-hidden border-0 rounded-2xl bg-card shadow-2xl max-h-[85vh] overflow-y-auto">
        <AnimatePresence mode="wait">
          {step === "park" ? (
            <motion.div
              key="park"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="p-6"
            >
              <h2 className="text-[17px] font-heading font-bold text-foreground mb-1">Add a park</h2>
              <p className="text-[12px] text-muted-foreground mb-5">Choose a park to start tracking permits.</p>

              <div className="grid grid-cols-2 gap-3">
                {ALL_PARK_IDS.map((id) => {
                  const park = PARKS[id];
                  return (
                    <button
                      key={id}
                      onClick={() => handleParkSelect(id)}
                      className="flex flex-col items-start p-4 rounded-xl border border-border/70 bg-card hover:border-primary/40 hover:bg-primary/5 transition-all text-left"
                    >
                      <p className="text-[13px] font-bold text-foreground">{park.shortName}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{park.region}</p>
                      <p className="text-[10px] text-muted-foreground/60 mt-1 leading-snug">{park.heroDescription}</p>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="permit"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
              className="p-6"
            >
              <button
                onClick={() => setStep("park")}
                className="flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground transition-colors mb-4"
              >
                <ArrowLeft size={14} />
                Back to parks
              </button>

              <h2 className="text-[17px] font-heading font-bold text-foreground mb-1">
                {PARKS[selectedPark!]?.shortName} permits
              </h2>
              <p className="text-[12px] text-muted-foreground mb-5">
                {isPro ? "Select permits to track." : "Select a permit to track."}
              </p>

              <div className="space-y-2.5">
                {permitOptions.map((permit) => {
                  const selected = selectedPermits.includes(permit.name);
                  const Icon = getPermitIcon(permit.name);
                  return (
                    <button
                      key={permit.name}
                      onClick={() => togglePermit(permit.name)}
                      className={`w-full flex items-center gap-3 p-3.5 rounded-xl border transition-all text-left ${
                        selected
                          ? "border-primary bg-primary/5"
                          : "border-border/70 hover:border-primary/30"
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

              <button
                onClick={handleSave}
                disabled={saving || selectedPermits.length === 0}
                className="w-full mt-5 py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-[14px] hover:opacity-90 transition-opacity flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    Adding…
                  </>
                ) : (
                  <>
                    Start Tracking
                    <ArrowRight size={15} />
                  </>
                )}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
};

export default AddParkModal;
