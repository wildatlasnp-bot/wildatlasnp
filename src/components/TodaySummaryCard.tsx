import { motion } from "framer-motion";
import { Clock, AlertTriangle, Sun, Moon } from "lucide-react";

interface HeadlineData {
  location: string;
  quietStart: string;
  quietEnd: string;
  buildingTime: string;
  peakStart: string;
  eveningQuiet: string;
}

type CrowdLevel = "LOW" | "MODERATE" | "HIGH";

function deriveCrowdLevel(data: HeadlineData | null): { level: CrowdLevel; color: string; bg: string; border: string } {
  if (!data) return { level: "LOW", color: "text-status-quiet", bg: "bg-status-quiet/10", border: "border-status-quiet/20" };

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

  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const quietEnd = toMinutes(data.quietEnd);
  const peakStart = toMinutes(data.peakStart);

  if (nowMin < quietEnd) return { level: "LOW", color: "text-status-quiet", bg: "bg-status-quiet/10", border: "border-status-quiet/20" };
  if (nowMin < peakStart) return { level: "MODERATE", color: "text-status-building", bg: "bg-status-building/10", border: "border-status-building/20" };
  return { level: "HIGH", color: "text-status-peak", bg: "bg-status-peak/10", border: "border-status-peak/20" };
}

const TodaySummaryCard = ({ parkShortName, headlineData }: { parkShortName: string; headlineData: HeadlineData | null }) => {
  const crowd = deriveCrowdLevel(headlineData);

  if (!headlineData) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={`rounded-xl border ${crowd.border} ${crowd.bg} px-4 py-3.5`}
    >
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground mb-3">
        Today at {parkShortName}
      </p>

      <div className="grid grid-cols-2 gap-x-5 gap-y-3.5">
        {/* Crowds */}
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${crowd.color.replace("text-", "bg-")}`} />
          <div>
            <p className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider">Crowds</p>
            <p className={`text-[16px] font-black ${crowd.color} leading-tight`}>{crowd.level}</p>
          </div>
        </div>

        {/* Best Arrival */}
        <div className="flex items-center gap-2">
          <Sun size={13} className="text-status-quiet shrink-0" />
          <div>
            <p className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider">Best Arrival</p>
            <p className="text-[16px] font-black text-foreground leading-tight">{headlineData.quietStart}–{headlineData.quietEnd}</p>
          </div>
        </div>

        {/* Avoid */}
        <div className="flex items-center gap-2">
          <AlertTriangle size={13} className="text-status-peak shrink-0" />
          <div>
            <p className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider">Avoid</p>
            <p className="text-[16px] font-black text-foreground leading-tight">{headlineData.peakStart}–{headlineData.eveningQuiet}</p>
          </div>
        </div>

        {/* Quiet Again */}
        <div className="flex items-center gap-2">
          <Moon size={12} className="text-muted-foreground shrink-0" />
          <div>
            <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Quiet Again</p>
            <p className="text-[14px] font-bold text-foreground leading-tight">{headlineData.eveningQuiet}</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default TodaySummaryCard;
