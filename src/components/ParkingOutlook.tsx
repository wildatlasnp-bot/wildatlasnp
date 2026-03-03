import { AlertTriangle, Car } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useState, useEffect } from "react";

const getCapacity = () => {
  const hour = new Date().getHours();
  if (hour < 6) return 12;
  if (hour < 7) return 35;
  if (hour < 8) return 68;
  if (hour < 9) return 91;
  return 97;
};

const ParkingOutlook = () => {
  const [capacity, setCapacity] = useState(getCapacity);

  useEffect(() => {
    const interval = setInterval(() => setCapacity(getCapacity()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const isCritical = capacity >= 85;

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <Car size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-heading font-semibold text-[14px] text-foreground leading-tight">
            Parking Outlook
          </h3>
          <p className="text-[10px] text-muted-foreground mt-0.5">Valley lot capacity (live estimate)</p>
        </div>
        {isCritical && (
          <span className="flex items-center gap-1 text-[9px] font-bold text-secondary bg-secondary/10 px-2 py-0.5 rounded-full uppercase tracking-wider">
            <AlertTriangle size={10} />
            Full
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div className="mb-2">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] font-medium text-muted-foreground">Current capacity</span>
          <span className={`text-[12px] font-bold ${isCritical ? "text-secondary" : "text-primary"}`}>
            {capacity}%
          </span>
        </div>
        <Progress
          value={capacity}
          className={`h-2.5 rounded-full ${isCritical ? "[&>div]:bg-secondary" : "[&>div]:bg-primary"}`}
        />
      </div>

      {/* Warning */}
      <div className="bg-secondary/10 border border-secondary/20 rounded-lg p-3 mt-3">
        <p className="text-[12px] font-semibold text-foreground leading-snug">
          <span className="text-secondary font-bold">8:30 AM cutoff approaching.</span>{" "}
          Aim for El Portal entrance by 7:30 AM.
        </p>
        <p className="text-[10px] text-muted-foreground mt-1">
          🐻 YARTS from Merced is your backup if lots are full.
        </p>
      </div>
    </div>
  );
};

export default ParkingOutlook;
