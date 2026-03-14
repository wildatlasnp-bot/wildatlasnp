import { useMemo } from "react";
import { Droplets, Footprints, Sunset } from "lucide-react";
import { PARKS } from "@/lib/parks";

interface TodayInParkStripProps {
  parkId: string;
}

interface Signal {
  icon: typeof Droplets;
  label: string;
  value: string;
}

const parkSignals: Record<string, Signal[]> = {
  yosemite: [
    { icon: Droplets, label: "Waterfalls", value: "High Flow" },
    { icon: Footprints, label: "Crowds", value: "Moderate" },
    { icon: Sunset, label: "Sunset", value: "7:14 PM" },
  ],
  rainier: [
    { icon: Droplets, label: "Snow Melt", value: "Active" },
    { icon: Footprints, label: "Crowds", value: "Light" },
    { icon: Sunset, label: "Sunset", value: "7:42 PM" },
  ],
  zion: [
    { icon: Droplets, label: "River Level", value: "Normal" },
    { icon: Footprints, label: "Crowds", value: "Heavy" },
    { icon: Sunset, label: "Sunset", value: "7:28 PM" },
  ],
  glacier: [
    { icon: Droplets, label: "Snow Pack", value: "Moderate" },
    { icon: Footprints, label: "Crowds", value: "Light" },
    { icon: Sunset, label: "Sunset", value: "8:01 PM" },
  ],
  rocky_mountain: [
    { icon: Droplets, label: "Streams", value: "High Flow" },
    { icon: Footprints, label: "Crowds", value: "Moderate" },
    { icon: Sunset, label: "Sunset", value: "7:22 PM" },
  ],
  arches: [
    { icon: Droplets, label: "Hydration", value: "Critical" },
    { icon: Footprints, label: "Crowds", value: "Moderate" },
    { icon: Sunset, label: "Sunset", value: "7:35 PM" },
  ],
};

const TodayInParkStrip = ({ parkId }: TodayInParkStripProps) => {
  const parkConfig = PARKS[parkId];
  const signals = useMemo(() => parkSignals[parkId] ?? parkSignals.yosemite, [parkId]);

  if (!parkConfig) return null;

  const now = new Date();
  const timeStr = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  return (
    <div className="rounded-xl bg-muted/30 border border-border/40 p-4">
      <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground/60 mb-3 font-body">
        Today in {parkConfig.shortName}
      </p>
      <div className="grid grid-cols-3">
        {signals.map((signal, i) => {
          const Icon = signal.icon;
          return (
            <div
              key={signal.label}
              className={cn(
                "flex flex-col items-center text-center gap-1.5 px-2 py-1",
                i < signals.length - 1 && "border-r border-border/30"
              )}
            >
              <Icon size={16} className="text-muted-foreground/60 shrink-0" />
              <p className="text-[12px] font-bold uppercase text-muted-foreground leading-tight font-body">
                {signal.label}
              </p>
              <p className="text-[14px] font-semibold text-foreground leading-tight font-body">
                {signal.value}
              </p>
            </div>
          );
        })}
      </div>
      <p className="text-[11px] text-muted-foreground/50 text-right mt-3 font-body">
        Last updated {timeStr}
      </p>
    </div>
  );
};

export default TodayInParkStrip;
