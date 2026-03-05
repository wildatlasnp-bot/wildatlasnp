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
  avoidWindow: string;
  location: string;
} {
  if (!data) {
    return { status: "go", label: "GO NOW", crowdLevel: "LOW", bestWindow: "Early morning", avoidWindow: "—", location: "Loading…" };
  }

  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const quietEnd = toMinutes(data.quietEnd);
  const peakStart = toMinutes(data.peakStart);

  const bestWindow = `${data.quietStart} – ${data.quietEnd}`;
  const avoidWindow = `${data.peakStart} – ${data.eveningQuiet}`;

  if (nowMin < quietEnd) {
    return { status: "go", label: "GO NOW", crowdLevel: "LOW", bestWindow, avoidWindow, location: data.location };
  }
  if (nowMin < peakStart) {
    return { status: "wait", label: "WAIT", crowdLevel: "MODERATE", bestWindow, avoidWindow, location: data.location };
  }
  return { status: "avoid", label: "AVOID", crowdLevel: "HIGH", bestWindow, avoidWindow, location: data.location };
}

const statusConfig: Record<Status, { bg: string; border: string; dot: string; labelColor: string; crowdColor: string }> = {
  go: {
    bg: "bg-status-quiet/10",
    border: "border-status-quiet/25",
    dot: "bg-status-quiet",
    labelColor: "text-status-quiet",
    crowdColor: "text-status-quiet",
  },
  wait: {
    bg: "bg-status-building/10",
    border: "border-status-building/25",
    dot: "bg-status-building",
    labelColor: "text-status-building",
    crowdColor: "text-status-building",
  },
  avoid: {
    bg: "bg-status-peak/10",
    border: "border-status-peak/25",
    dot: "bg-status-peak",
    labelColor: "text-status-peak",
    crowdColor: "text-status-peak",
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
      className={`${s.bg} border ${s.border} rounded-2xl px-5 py-5 shadow-[0_2px_16px_-4px_hsl(var(--foreground)/0.08)]`}
    >
      {/* Location label */}
      <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-muted-foreground/85">
        {location}
      </p>

      {/* Decision — hero prominence */}
      <div className="flex items-center gap-3 mt-2">
        {/* Pulsing dot */}
        <div className="relative flex items-center justify-center w-8 h-8 shrink-0">
          <span className={`absolute inset-0 rounded-full ${s.dot} opacity-[0.12] animate-ping`} style={{ animationDuration: "2.5s" }} />
          <span className={`relative w-3.5 h-3.5 rounded-full ${s.dot} ring-2 ring-background`} />
        </div>
        <h2 className={`font-heading font-black text-[36px] leading-none tracking-tight ${s.labelColor}`}>
          {label}
        </h2>
      </div>

      {/* Divider */}
      <div className="border-t border-border/60 mt-4 mb-3" />

      {/* Details grid */}
      <div className="grid grid-cols-3 gap-3">
        {/* Crowds */}
        <div>
          <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider mb-0.5">Crowds</p>
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${s.dot}`} />
            <span className={`text-[15px] font-bold ${s.crowdColor} leading-tight`}>{crowdLevel}</span>
          </div>
        </div>

        {/* Best window */}
        <div>
          <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider mb-0.5">Best Window</p>
          <div className="flex items-center gap-1.5">
            <Sun size={12} className="text-status-quiet shrink-0" />
            <span className="text-[14px] font-bold text-foreground leading-tight">{bestWindow}</span>
          </div>
        </div>

        {/* Avoid */}
        <div>
          <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider mb-0.5">Avoid</p>
          <div className="flex items-center gap-1.5">
            <AlertTriangle size={12} className="text-status-peak shrink-0" />
            <span className="text-[14px] font-bold text-foreground leading-tight">{avoidWindow}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default DecisionHeroCard;
