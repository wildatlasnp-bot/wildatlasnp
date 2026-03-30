import { useState, useMemo } from "react";
import { ChevronDown, ChevronRight, AlertTriangle, Info, ShieldAlert } from "lucide-react";

const INTER = "'Inter', sans-serif";
const PLAYFAIR = "'Playfair Display', serif";

/* ── Demo alert data ── */
interface ParkAlertItem {
  id: string;
  title: string;
  description: string;
  category: "closure" | "info";
  park: string;
  date: string;
  status: string;
}

const DEMO_ALERTS: ParkAlertItem[] = [
  { id: "a1", title: "Tioga Road closed for season", description: "Tioga Road (Highway 120 through the park) is closed due to snow. No estimated opening date at this time.", category: "closure", park: "Yosemite", date: "Mar 28", status: "Active" },
  { id: "a2", title: "Angels Landing chains removed", description: "The chain section on Angels Landing has been temporarily removed for maintenance. Expect 2–3 week closure of the upper trail.", category: "closure", park: "Zion", date: "Mar 25", status: "Ongoing" },
  { id: "a3", title: "Spring bear activity advisory", description: "Bears are increasingly active as they emerge from hibernation. Store all food in bear-proof containers and maintain safe distances.", category: "info", park: "Yosemite", date: "Mar 27", status: "Active" },
  { id: "a4", title: "North Rim seasonal opening delayed", description: "The North Rim will open later than usual this year due to heavy snowpack on the access road. Revised target date is May 25.", category: "info", park: "Grand Canyon", date: "Mar 26", status: "Active" },
  { id: "a5", title: "Wildflower bloom update", description: "Early wildflower bloom spotted in lower elevations. Peak bloom at Lupine Meadows expected mid-June this year.", category: "info", park: "Grand Teton", date: "Mar 24", status: "Active" },
  { id: "a6", title: "Going-to-the-Sun Road plowing", description: "Spring plowing operations have begun on Going-to-the-Sun Road. Road expected to fully open by late June, weather permitting.", category: "info", park: "Glacier", date: "Mar 22", status: "Ongoing" },
  { id: "a7", title: "Trail Ridge Road opening estimate", description: "Trail Ridge Road is expected to open for the season on May 23. Crews are actively clearing snow from the alpine sections.", category: "info", park: "Rocky Mountain", date: "Mar 20", status: "Active" },
  { id: "a8", title: "Camp Muir snow bridge advisory", description: "Snow bridges on the Muir Snowfield are becoming unstable. Climbers should carry proper glacier travel equipment.", category: "info", park: "Mt Rainier", date: "Mar 18", status: "Active" },
  { id: "a9", title: "Fiery Furnace permit changes", description: "Self-guided permits for Fiery Furnace will now be available 7 days in advance instead of 14. Ranger-guided tours remain unchanged.", category: "info", park: "Arches", date: "Mar 15", status: "Active" },
  { id: "a10", title: "Merced River high water warning", description: "Spring snowmelt has caused the Merced River to rise significantly. Swimming and wading are strongly discouraged.", category: "closure", park: "Yosemite", date: "Mar 14", status: "Active" },
  { id: "a11", title: "Riverside Walk flood damage", description: "Recent flash flooding has damaged portions of the Riverside Walk. Trail is passable but use caution near damaged railings.", category: "info", park: "Zion", date: "Mar 12", status: "Ongoing" },
  { id: "a12", title: "Phantom Ranch reservation update", description: "Limited Phantom Ranch lottery results for fall season have been posted. Check Recreation.gov for your application status.", category: "info", park: "Grand Canyon", date: "Mar 10", status: "Active" },
  { id: "a13", title: "Glacier bear management closure", description: "Bear management closure in effect for the Avalanche Lake area. Trails in vicinity are closed until further notice.", category: "closure", park: "Glacier", date: "Mar 8", status: "Active" },
  { id: "a14", title: "Paradise area winter conditions", description: "Winter conditions persist at Paradise. Snow depth remains over 10 feet. Snowshoes or traction devices recommended for all trails.", category: "info", park: "Mt Rainier", date: "Mar 5", status: "Active" },
];

const USER_PARKS = ["Yosemite", "Zion", "Grand Canyon", "Grand Teton", "Glacier", "Rocky Mountain", "Mt Rainier", "Arches"];

type FilterType = "all" | "closures" | "info" | string;

const AlertsSection = () => {
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");

  const closureCount = useMemo(() => DEMO_ALERTS.filter((a) => a.category === "closure").length, []);

  const filtered = useMemo(() => {
    if (activeFilter === "all") return DEMO_ALERTS;
    if (activeFilter === "closures") return DEMO_ALERTS.filter((a) => a.category === "closure");
    if (activeFilter === "info") return DEMO_ALERTS.filter((a) => a.category === "info");
    return DEMO_ALERTS.filter((a) => a.park === activeFilter);
  }, [activeFilter]);

  return (
    <div data-park-alerts style={{ paddingBottom: 24 }}>
      {/* AMBER BANNER */}
      <button
        className="flex items-center w-full text-left"
        style={{
          margin: "0 24px 12px",
          width: "calc(100% - 48px)",
          padding: "9px 13px",
          borderRadius: 10,
          background: "var(--amber-bg)",
          border: "1px solid var(--amber-bd)",
          gap: 9,
          cursor: "pointer",
        }}
        onClick={() => setActiveFilter("closures")}
      >
        <AlertTriangle size={14} style={{ color: "var(--ds-amber)", flexShrink: 0 }} />
        <div className="flex-1 min-w-0">
          <p style={{ fontFamily: INTER, fontSize: 12.5, fontWeight: 600, color: "var(--ds-amber)", lineHeight: 1.3 }}>
            {closureCount} active closure{closureCount !== 1 ? "s" : ""} in your parks
          </p>
          <p style={{ fontFamily: INTER, fontSize: 10.5, fontWeight: 300, color: "var(--ds-amber)", opacity: 0.65, lineHeight: 1.3, marginTop: 1 }}>
            Tap to view closure details
          </p>
        </div>
        <ChevronRight size={13} style={{ color: "rgba(138,74,16,0.45)", flexShrink: 0 }} />
      </button>

      {/* SECTION HEADER */}
      <div style={{ padding: "20px 24px 12px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <span style={{ fontFamily: INTER, fontSize: 9, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--dim)", display: "block" }}>
            Park dispatches
          </span>
          <h2 style={{ fontFamily: PLAYFAIR, fontSize: 24, fontWeight: 500, color: "var(--ink)", marginTop: 2, lineHeight: 1.15 }}>
            Alerts
          </h2>
          <p style={{ fontFamily: INTER, fontSize: 11, fontWeight: 300, color: "var(--dim)", marginTop: 3 }}>
            {USER_PARKS.length} parks monitored · refreshed today
          </p>
        </div>
        <div className="flex flex-col items-center" style={{ marginTop: 4 }}>
          <span style={{ fontFamily: PLAYFAIR, fontSize: 32, fontWeight: 400, fontStyle: "italic", color: "var(--charcoal)", lineHeight: 1 }}>
            {DEMO_ALERTS.length}
          </span>
          <span style={{ fontFamily: INTER, fontSize: 9, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--dim)", marginTop: 2 }}>
            TOTAL
          </span>
        </div>
      </div>

      {/* FILTER CHIPS */}
      <div
        className="flex gap-1.5 overflow-x-auto scrollbar-hide"
        style={{
          padding: "0 24px 12px",
          borderBottom: "1px solid var(--rule)",
          WebkitOverflowScrolling: "touch",
        }}
      >
        <FilterChip label="All" active={activeFilter === "all"} onClick={() => setActiveFilter("all")} variant="default" />
        <FilterChip label={`Closures ${closureCount}`} active={activeFilter === "closures"} onClick={() => setActiveFilter("closures")} variant="red" />
        <FilterChip label="Info" active={activeFilter === "info"} onClick={() => setActiveFilter("info")} variant="neutral" />
        {USER_PARKS.map((park) => (
          <FilterChip key={park} label={park} active={activeFilter === park} onClick={() => setActiveFilter(park)} variant="green" />
        ))}
      </div>

      {/* ALERT CARDS */}
      <div style={{ padding: "12px 24px 0" }}>
        {filtered.map((alert) => (
          <AlertCard key={alert.id} alert={alert} />
        ))}

        {filtered.length === 0 && (
          <p style={{ fontFamily: INTER, fontSize: 13, color: "var(--dim)", textAlign: "center", padding: "20px 0" }}>
            No alerts match this filter
          </p>
        )}
      </div>

      {/* ALL MONITORED PARKS ROW */}
      <div
        className="flex items-center justify-between cursor-pointer"
        style={{
          background: "white",
          borderRadius: 12,
          border: "1px solid var(--rule)",
          padding: "13px 16px",
          margin: "4px 24px 0",
        }}
      >
        <div>
          <span style={{ fontFamily: INTER, fontSize: 13, fontWeight: 500, color: "var(--forest-m)", display: "block" }}>
            All monitored parks
          </span>
          <span style={{ fontFamily: INTER, fontSize: 11, fontWeight: 300, color: "var(--dim)", marginTop: 1, display: "block" }}>
            {USER_PARKS.length} parks · {DEMO_ALERTS.length} total alerts
          </span>
        </div>
        <ChevronRight size={16} style={{ color: "var(--forest-m)" }} />
      </div>
    </div>
  );
};

/* ── Alert Card ── */
const AlertCard = ({ alert }: { alert: ParkAlertItem }) => {
  const isClosure = alert.category === "closure";

  return (
    <div
      style={{
        background: isClosure ? "var(--red-bg)" : "white",
        borderRadius: 12,
        border: "1px solid var(--rule)",
        borderLeft: isClosure ? "3px solid var(--ds-red)" : "1px solid var(--rule)",
        marginBottom: 8,
        padding: "13px 14px",
      }}
    >
      <div className="flex items-start gap-3">
        {/* Icon square */}
        <div
          className="shrink-0 flex items-center justify-center rounded-lg"
          style={{
            width: 32,
            height: 32,
            background: isClosure ? "rgba(198,40,40,0.1)" : "rgba(46,93,70,0.1)",
          }}
        >
          {isClosure ? (
            <ShieldAlert size={15} style={{ color: "var(--ds-red)" }} />
          ) : (
            <Info size={15} style={{ color: "var(--forest-m)" }} />
          )}
        </div>

        <div className="flex-1 min-w-0">
          {/* Tag pill + date */}
          <div className="flex items-center gap-2 mb-1">
            <span
              style={{
                fontFamily: INTER,
                fontSize: 9,
                fontWeight: 600,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                padding: "2px 7px",
                borderRadius: 99,
                background: isClosure ? "rgba(198,40,40,0.1)" : "rgba(46,93,70,0.08)",
                color: isClosure ? "var(--ds-red)" : "var(--forest-m)",
              }}
            >
              {isClosure ? "CLOSURE" : "INFO"}
            </span>
            <span style={{ fontFamily: INTER, fontSize: 10, color: "var(--dim)" }}>
              {alert.date}
            </span>
          </div>

          {/* Title */}
          <h3
            style={{
              fontFamily: PLAYFAIR,
              fontSize: 14.5,
              fontWeight: 500,
              color: "var(--ink)",
              lineHeight: 1.35,
              marginBottom: 3,
            }}
          >
            {alert.title}
          </h3>

          {/* Description */}
          <p
            className="line-clamp-2"
            style={{
              fontFamily: INTER,
              fontSize: 11,
              fontWeight: 300,
              color: "var(--ds-muted)",
              lineHeight: 1.55,
              marginBottom: 8,
            }}
          >
            {alert.description}
          </p>

          {/* Footer */}
          <div className="flex items-center justify-between">
            <span style={{ fontFamily: INTER, fontSize: 10, color: "var(--dim)" }}>
              {alert.park} · {alert.date}
            </span>
            {/* Ghost status badge — NOT red, always neutral */}
            <span
              style={{
                fontFamily: INTER,
                fontSize: 10,
                fontWeight: 500,
                color: "var(--dim)",
                background: "transparent",
                border: "1px solid rgba(28,56,40,0.15)",
                borderRadius: 99,
                padding: "2px 8px",
              }}
            >
              {alert.status}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ── Filter Chip ── */
const FilterChip = ({
  label,
  active,
  onClick,
  variant,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  variant: "default" | "red" | "neutral" | "green";
}) => {
  const baseStyle: React.CSSProperties = {
    height: 32,
    padding: "0 13px",
    borderRadius: 99,
    fontFamily: INTER,
    fontSize: 11,
    fontWeight: 500,
    whiteSpace: "nowrap",
    cursor: "pointer",
    border: "1px solid transparent",
    transition: "all 0.15s ease",
    flexShrink: 0,
  };

  if (active) {
    const activeStyles: Record<string, React.CSSProperties> = {
      default: { background: "var(--forest)", color: "white", boxShadow: "0 0 0 2px var(--forest-m)" },
      red: { background: "rgba(198,40,40,0.1)", color: "var(--ds-red)", border: "1px solid var(--red-bd)", boxShadow: "0 0 0 2px var(--forest-m)" },
      neutral: { background: "rgba(28,56,40,0.08)", color: "var(--ink2)", border: "1px solid var(--rule2)", boxShadow: "0 0 0 2px var(--forest-m)" },
      green: { background: "rgba(46,93,70,0.12)", color: "var(--forest-m)", border: "1px solid rgba(46,93,70,0.25)", boxShadow: "0 0 0 2px var(--forest-m)" },
    };
    return <button onClick={onClick} style={{ ...baseStyle, ...activeStyles[variant] }}>{label}</button>;
  }

  const inactiveStyles: Record<string, React.CSSProperties> = {
    default: { background: "white", color: "var(--ds-muted)", border: "1px solid var(--rule)" },
    red: { background: "white", color: "var(--ds-muted)", border: "1px solid var(--rule)" },
    neutral: { background: "white", color: "var(--ds-muted)", border: "1px solid var(--rule)" },
    green: { background: "white", color: "var(--forest-m)", border: "1px solid rgba(46,93,70,0.25)", fontWeight: 600 },
  };

  return <button onClick={onClick} style={{ ...baseStyle, ...inactiveStyles[variant] }}>{label}</button>;
};

export default AlertsSection;
