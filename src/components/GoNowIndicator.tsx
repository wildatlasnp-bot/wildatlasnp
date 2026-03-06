import { motion } from "framer-motion";

interface GoNowData {
  location: string;
  quietStart: string;
  quietEnd: string;
  buildingTime: string;
  peakStart: string;
}

type Status = "go" | "wait" | "avoid";

function deriveStatus(data: GoNowData | null): { status: Status; label: string; sub: string; window: string; location: string } {
  if (!data) {
    return { status: "go", label: "GO NOW", sub: "Crowds are low", window: "Early morning", location: "Check forecast" };
  }

  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes();
  const current = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;

  const toMinutes = (t: string) => {
    const match = t.match(/(\d+):(\d+)\s*(AM|PM)?/i);
    if (!match) return 0;
    let hr = parseInt(match[1]);
    const min = parseInt(match[2]);
    const ampm = match[3]?.toUpperCase();
    if (ampm === "PM" && hr !== 12) hr += 12;
    if (ampm === "AM" && hr === 12) hr = 0;
    return hr * 60 + min;
  };

  const nowMin = h * 60 + m;
  const quietStartMin = toMinutes(data.quietStart);
  const quietEndMin = toMinutes(data.quietEnd);
  const buildMin = toMinutes(data.buildingTime);
  const peakMin = toMinutes(data.peakStart);

  // Before quiet window starts (very early)
  if (nowMin < quietStartMin) {
    return { status: "go", label: "GO NOW", sub: "Crowds are low", window: `${data.quietStart} – ${data.quietEnd}`, location: data.location };
  }
  if (nowMin < quietEndMin) {
    return { status: "go", label: "GO NOW", sub: "Crowds are low", window: `${data.quietStart} – ${data.quietEnd}`, location: data.location };
  }
  if (nowMin < peakMin) {
    return { status: "wait", label: "WAIT", sub: "Crowds building", window: `Busy by ${data.peakStart}`, location: data.location };
  }
  // Check if we're past evening quiet — crowds drop again
  const eveningQuietMin = toMinutes(data.quietEnd); // fallback
  // We don't have eveningQuiet in GoNowData, so check if past 8 PM as heuristic
  // Actually, the data doesn't include eveningQuiet. Let's just keep the avoid.
  return { status: "avoid", label: "AVOID", sub: "Peak congestion", window: `Until evening`, location: data.location };
}

const statusStyles: Record<Status, { bg: string; border: string; text: string; dot: string; shadow: string }> = {
  go: { bg: "bg-status-quiet/12", border: "border-status-quiet/25", text: "text-status-quiet", dot: "bg-status-quiet", shadow: "shadow-[0_2px_12px_-2px_hsl(var(--status-quiet)/0.25)]" },
  wait: { bg: "bg-status-building/12", border: "border-status-building/25", text: "text-status-building", dot: "bg-status-building", shadow: "shadow-[0_2px_12px_-2px_hsl(var(--status-building)/0.25)]" },
  avoid: { bg: "bg-status-peak/12", border: "border-status-peak/25", text: "text-status-peak", dot: "bg-status-peak", shadow: "shadow-[0_2px_12px_-2px_hsl(var(--status-peak)/0.25)]" },
};

const GoNowIndicator = ({ headlineData }: { headlineData: GoNowData | null }) => {
  const { status, label, sub, window: timeWindow, location } = deriveStatus(headlineData);
  const s = statusStyles[status];

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={`${s.bg} border ${s.border} ${s.shadow} rounded-xl px-4 py-4 flex items-center gap-4`}
    >
      {/* Status badge — larger, more prominent */}
      <div className="flex flex-col items-center gap-1.5 shrink-0 w-14">
        <div className="relative flex items-center justify-center w-10 h-10">
          <span className={`absolute inset-0 rounded-full ${s.dot} opacity-[0.12] animate-ping`} style={{ animationDuration: "2.5s" }} />
          <span className={`absolute inset-1 rounded-full ${s.dot} opacity-[0.08]`} />
          <span className={`relative w-4 h-4 rounded-full ${s.dot} ring-2 ring-background`} />
        </div>
        <span className={`text-[11px] font-extrabold ${s.text} tracking-wider leading-none`}>{label}</span>
      </div>

      {/* Details — tighter hierarchy */}
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-bold text-foreground leading-tight truncate">{location}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>
        <p className={`text-[12px] font-bold ${s.text} mt-1.5 tracking-tight`}>
          Best window: {timeWindow}
        </p>
      </div>
    </motion.div>
  );
};

export default GoNowIndicator;
