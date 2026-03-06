import { motion } from "framer-motion";
import { Sun, AlertTriangle } from "lucide-react";

interface HeadlineData {
  location: string;
  quietStart: string;
  quietEnd: string;
  buildingTime: string;
  peakStart: string;
  eveningQuiet: string;
}

type Status = "go" | "wait" | "avoid";

function toMinutes(t: string) {
  const match = t.match(/(\d+):(\d+)\s*(AM|PM)?/i);
  if (!match) return 0;
  let hr = parseInt(match[1]);
  const min = parseInt(match[2]);
  const ampm = match[3]?.toUpperCase();
  if (ampm === "PM" && hr !== 12) hr += 12;
  if (ampm === "AM" && hr === 12) hr = 0;
  return hr * 60 + min;
}

function deriveStatus(data: HeadlineData | null): {
  status: Status;
  label: string;
  crowdLevel: string;
  bestWindow: string;
  peakWindow: string;
  location: string;
} {
  if (!data) {
    return { status: "go", label: "GO NOW", crowdLevel: "LOW", bestWindow: "Early morning", peakWindow: "—", location: "Loading…" };
  }

  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const quietEnd = toMinutes(data.quietEnd);
  const peakStart = toMinutes(data.peakStart);
  const eveningQuiet = toMinutes(data.eveningQuiet);

  const bestWindow = `${data.quietStart} – ${data.quietEnd}`;
  const avoidWindow = `${data.peakStart} – ${data.eveningQuiet}`;

  if (nowMin < quietEnd) {
    return { status: "go", label: "GO NOW", crowdLevel: "LOW", bestWindow, avoidWindow, location: data.location };
  }
  if (nowMin < peakStart) {
    return { status: "wait", label: "WAIT", crowdLevel: "MODERATE", bestWindow, avoidWindow, location: data.location };
  }
  if (nowMin >= eveningQuiet) {
    return { status: "go", label: "GO NOW", crowdLevel: "LOW", bestWindow, avoidWindow, location: data.location };
  }
  return { status: "avoid", label: "PEAK HOURS", crowdLevel: "HIGH", bestWindow, avoidWindow, location: data.location };
}

const statusConfig: Record<Status, { bg: string; border: string; dot: string; labelColor: string; crowdColor: string; labelSize: string }> = {
  go: {
    bg: "bg-status-quiet/10",
    border: "border-status-quiet/25",
    dot: "bg-status-quiet",
    labelColor: "text-status-quiet",
    crowdColor: "text-status-quiet",
    labelSize: "text-[36px]",
  },
  wait: {
    bg: "bg-status-building/8",
    border: "border-status-building/20",
    dot: "bg-status-building",
    labelColor: "text-status-building",
    crowdColor: "text-status-building",
    labelSize: "text-[28px]",
  },
  avoid: {
    bg: "bg-status-peak/5",
    border: "border-status-peak/15",
    dot: "bg-status-peak",
    labelColor: "text-status-peak/80",
    crowdColor: "text-status-peak/80",
    labelSize: "text-[24px]",
  },
};

const DecisionHeroCard = ({ headlineData }: { headlineData: HeadlineData | null }) => {
  const { status, label, crowdLevel, bestWindow, avoidWindow, location } = deriveStatus(headlineData);
  const s = statusConfig[status];

  if (!headlineData) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`${s.bg} border ${s.border} rounded-2xl px-5 py-5`}
      style={{ boxShadow: "var(--card-shadow)" }}
    >
      {/* Location label */}
      <p className="text-[12px] font-black uppercase tracking-[0.18em] text-muted-foreground/80">
        {location}
      </p>

      {/* Decision — contextual prominence */}
      <div className="flex items-center gap-3 mt-2">
        {/* Pulsing dot — only pulse for "go" status */}
        <div className="relative flex items-center justify-center w-7 h-7 shrink-0">
          {status === "go" && (
            <span className={`absolute inset-0 rounded-full ${s.dot} opacity-[0.12] animate-ping`} style={{ animationDuration: "2.5s" }} />
          )}
          <span className={`relative w-3 h-3 rounded-full ${s.dot} ring-2 ring-background`} />
        </div>
        <h2 className={`font-heading font-black ${s.labelSize} leading-none tracking-tight ${s.labelColor}`}>
          {label}
        </h2>
      </div>

      {/* Divider */}
      <div className="border-t border-border/40 mt-4 mb-3.5" />

      {/* Details grid */}
      <div className="grid grid-cols-3 gap-4">
        {/* Crowds */}
        <div>
          <p className="text-[10px] font-extrabold text-muted-foreground/70 uppercase tracking-wider mb-1">Crowds</p>
          <div className="flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-full ${s.dot}`} />
            <span className={`text-[16px] font-black ${s.crowdColor} leading-tight`}>{crowdLevel}</span>
          </div>
        </div>

        {/* Best window */}
        <div>
          <p className="text-[10px] font-extrabold text-muted-foreground/70 uppercase tracking-wider mb-1">Best Window</p>
          <div className="flex items-center gap-1.5">
            <Sun size={13} className="text-status-quiet shrink-0" />
            <span className="text-[15px] font-bold text-foreground leading-tight">{bestWindow}</span>
          </div>
        </div>

        {/* Avoid */}
        <div>
          <p className="text-[10px] font-extrabold text-muted-foreground/70 uppercase tracking-wider mb-1">Peak Hours</p>
          <div className="flex items-center gap-1.5">
            <AlertTriangle size={13} className="text-status-peak shrink-0" />
            <span className="text-[15px] font-bold text-foreground leading-tight">{avoidWindow}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default DecisionHeroCard;