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
  const quietEndMin = toMinutes(data.quietEnd);
  const buildMin = toMinutes(data.buildingTime);
  const peakMin = toMinutes(data.peakStart);

  if (nowMin < quietEndMin) {
    return { status: "go", label: "GO NOW", sub: "Crowds are low", window: `${data.quietStart} – ${data.quietEnd}`, location: data.location };
  }
  if (nowMin < peakMin) {
    return { status: "wait", label: "WAIT", sub: "Crowds building", window: `Busy by ${data.peakStart}`, location: data.location };
  }
  return { status: "avoid", label: "AVOID", sub: "Peak congestion", window: `Until evening`, location: data.location };
}

const statusStyles: Record<Status, { bg: string; border: string; text: string; dot: string; pulse: string }> = {
  go: { bg: "bg-status-quiet/8", border: "border-status-quiet/20", text: "text-status-quiet", dot: "bg-status-quiet", pulse: "bg-status-quiet/40" },
  wait: { bg: "bg-status-building/8", border: "border-status-building/20", text: "text-status-building", dot: "bg-status-building", pulse: "bg-status-building/40" },
  avoid: { bg: "bg-status-peak/8", border: "border-status-peak/20", text: "text-status-peak", dot: "bg-status-peak", pulse: "bg-status-peak/40" },
};

const GoNowIndicator = ({ headlineData }: { headlineData: GoNowData | null }) => {
  const { status, label, sub, window: timeWindow, location } = deriveStatus(headlineData);
  const s = statusStyles[status];

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={`${s.bg} border ${s.border} rounded-lg px-4 py-3.5 flex items-center gap-4`}
    >
      {/* Status badge */}
      <div className="flex flex-col items-center gap-1 shrink-0">
        <div className="relative flex items-center justify-center">
          <span className={`absolute w-8 h-8 rounded-full ${s.pulse} animate-ping opacity-30`} />
          <span className={`relative w-3 h-3 rounded-full ${s.dot}`} />
        </div>
        <span className={`text-[11px] font-extrabold ${s.text} tracking-wider`}>{label}</span>
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-foreground leading-tight truncate">{location}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>
        <p className={`text-[11px] font-semibold ${s.text} mt-1`}>Best window: {timeWindow}</p>
      </div>
    </motion.div>
  );
};

export default GoNowIndicator;
