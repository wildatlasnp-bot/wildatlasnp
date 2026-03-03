import { useState } from "react";
import { Phone } from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface InlinePhoneInputProps {
  userId: string;
  watchId: string;
  onPhoneSaved: (watchId: string) => void;
}

const InlinePhoneInput = ({ userId, watchId, onPhoneSaved }: InlinePhoneInputProps) => {
  const [phoneInput, setPhoneInput] = useState("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const handleSave = async () => {
    setSaving(true);
    try {
      await supabase
        .from("profiles")
        .update({ phone_number: phoneInput })
        .eq("user_id", userId);
      await supabase
        .from("active_watches")
        .update({ notify_sms: true })
        .eq("id", watchId);
      onPhoneSaved(watchId);
      toast({ title: "📱 SMS alerts activated", description: "You'll get a text when this permit opens." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="overflow-hidden"
    >
      <div className="pt-3 flex items-center gap-2">
        <div className="relative flex-1">
          <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="tel"
            placeholder="(555) 123-4567"
            value={phoneInput}
            onChange={(e) => setPhoneInput(e.target.value.replace(/[^\d+\-() ]/g, ""))}
            className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-border bg-background text-foreground text-[13px] placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-secondary/40 focus:border-secondary/40 transition-all"
            maxLength={20}
          />
        </div>
        <button
          disabled={phoneInput.replace(/\D/g, "").length < 10 || saving}
          onClick={handleSave}
          className="shrink-0 px-4 py-2.5 rounded-lg bg-secondary text-secondary-foreground text-[12px] font-semibold disabled:opacity-40 hover:opacity-90 transition-opacity"
        >
          {saving ? "…" : "Save"}
        </button>
      </div>
      <p className="text-[10px] text-muted-foreground/60 mt-1.5">US numbers only. We'll auto-enable SMS for this watch.</p>
    </motion.div>
  );
};

export default InlinePhoneInput;
