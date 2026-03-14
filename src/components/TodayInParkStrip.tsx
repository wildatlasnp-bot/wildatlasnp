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

  return (
    <div className="rounded-xl bg-muted/30 border border-border/40 px-3.5 py-2.5">
      <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground/60 mb-2 font-body">
        Today in {parkConfig.shortName}
      </p>
      <div className="flex items-center gap-1 overflow-x-auto">
        {signals.map((signal, i) => {
          const Icon = signal.icon;
          return (
            <div
              key={signal.label}
              className="flex-1 min-w-0 flex items-center gap-1.5 px-2 py-1"
            >
              <Icon size={12} className="text-muted-foreground/60 shrink-0" />
              <div className="min-w-0">
                <p className="text-[9px] text-muted-foreground/50 font-medium leading-tight font-body truncate">
                  {signal.label}
                </p>
                <p className="text-[11px] font-semibold text-foreground/70 leading-tight font-body truncate">
                  {signal.value}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TodayInParkStrip;
