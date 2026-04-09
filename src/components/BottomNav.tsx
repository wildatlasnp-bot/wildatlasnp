import React, { useState, useEffect, useRef } from "react";

type Tab = "mochi" | "sniper" | "discover" | "settings";

interface BottomNavProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  hasUnreadAlerts?: boolean;
}

const INACTIVE = "#4A554A";
const ACTIVE = "#2F6F4E";
const SW = 3;
const CAP = "round" as const;
const JOIN = "round" as const;

/* ── Bear Head — solid silhouette ── */
const PokoIcon = ({ active }: { active: boolean }) => {
  const c = active ? ACTIVE : INACTIVE;
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {/* Single solid bear silhouette — ears + head as one filled shape */}
      <path
        d="M6.2 8.5C5 7.5 4.8 5.5 6 4.5C7.2 3.5 8.8 4 9.5 5.2C10.2 4.5 11 4 12 4C13 4 13.8 4.5 14.5 5.2C15.2 4 16.8 3.5 18 4.5C19.2 5.5 19 7.5 17.8 8.5C18.8 9.8 19.5 11.5 19.5 13.5C19.5 17.5 16.2 20 12 20C7.8 20 4.5 17.5 4.5 13.5C4.5 11.5 5.2 9.8 6.2 8.5Z"
        fill={c}
        stroke={c}
        strokeWidth={1}
        strokeLinejoin={JOIN}
      />
      {/* Eyes — cutout circles */}
      <circle cx="9.5" cy="12.5" r="1.3" fill="#F0EDEA"/>
      <circle cx="14.5" cy="12.5" r="1.3" fill="#F0EDEA"/>
      {/* Snout */}
      <ellipse cx="12" cy="15.5" rx="2" ry="1.4" fill="#F0EDEA"/>
      {/* Nose */}
      <ellipse cx="12" cy="14.8" rx="1" ry="0.65" fill={c}/>
    </svg>
  );
};

/* ── Radar Pulse — bold arcs + solid dot ── */
const AlertsIcon = ({ active }: { active: boolean }) => {
  const c = active ? ACTIVE : INACTIVE;
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {/* Solid center dot */}
      <circle cx="12" cy="18" r="2.5" fill={c}/>
      {/* Inner arc — bold */}
      <path d="M7.5 13C8.8 10.5 10.3 9 12 9C13.7 9 15.2 10.5 16.5 13" stroke={c} strokeWidth={SW} strokeLinecap={CAP} strokeLinejoin={JOIN} fill="none"/>
      {/* Outer arc — bold */}
      <path d="M4 8C6.5 4.5 9 3 12 3C15 3 17.5 4.5 20 8" stroke={c} strokeWidth={SW} strokeLinecap={CAP} strokeLinejoin={JOIN} fill="none"/>
    </svg>
  );
};

/* ── Compass — 20% larger, thick ring ── */
const DiscoverIcon = ({ active }: { active: boolean }) => {
  const c = active ? ACTIVE : INACTIVE;
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {/* Thick outer ring */}
      <circle cx="12" cy="12" r="9.5" stroke={c} strokeWidth={SW} fill="none" strokeLinecap={CAP}/>
      {/* Compass diamond */}
      <path d="M12 4.5L15 12L12 19.5L9 12Z" stroke={c} strokeWidth={2} strokeLinejoin={JOIN} fill="none"/>
      {/* North half filled */}
      <path d="M12 4.5L15 12H9Z" fill={c} stroke="none"/>
      {/* Center dot */}
      <circle cx="12" cy="12" r="1.5" fill={c}/>
    </svg>
  );
};

/* ── Technical Sliders — chunky ── */
const SettingsIcon = ({ active }: { active: boolean }) => {
  const c = active ? ACTIVE : INACTIVE;
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {/* Top line + toggle */}
      <line x1="3" y1="8" x2="21" y2="8" stroke={c} strokeWidth={SW} strokeLinecap={CAP}/>
      <circle cx="8" cy="8" r="2.5" fill={active ? c : "#F0EDEA"} stroke={c} strokeWidth={SW}/>
      {/* Bottom line + toggle */}
      <line x1="3" y1="16" x2="21" y2="16" stroke={c} strokeWidth={SW} strokeLinecap={CAP}/>
      <circle cx="16" cy="16" r="2.5" fill={active ? c : "#F0EDEA"} stroke={c} strokeWidth={SW}/>
    </svg>
  );
};

const tabs: {
  id: Tab;
  ariaLabel: string;
  icon: (active: boolean) => React.ReactNode;
}[] = [
  { id: "mochi", ariaLabel: "Poko", icon: (a) => <PokoIcon active={a} /> },
  { id: "sniper", ariaLabel: "Alerts", icon: (a) => <AlertsIcon active={a} /> },
  { id: "discover", ariaLabel: "Discover", icon: (a) => <DiscoverIcon active={a} /> },
  { id: "settings", ariaLabel: "Settings", icon: (a) => <SettingsIcon active={a} /> },
];

const ICON_BOX = 44;
const DOT_GAP = 8;

const BottomNav = React.memo(({ activeTab, onTabChange, hasUnreadAlerts = false }: BottomNavProps) => {
  const [popTab, setPopTab] = useState<Tab | null>(null);
  const popTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => { if (popTimer.current) clearTimeout(popTimer.current); };
  }, []);

  const handleTabClick = (tab: Tab) => {
    if (tab === activeTab) return;
    setPopTab(tab);
    if (popTimer.current) clearTimeout(popTimer.current);
    popTimer.current = window.setTimeout(() => setPopTab(null), 150);
    onTabChange(tab);
  };

  return (
    <nav
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "space-around",
        alignItems: "center",
        padding: "14px 0 22px",
        background: "#F0EDEA",
        borderTop: "0.5px solid rgba(0,0,0,0.06)",
        zIndex: 50,
      }}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const isPop = popTab === tab.id;

        return (
          <button
            key={tab.id}
            onClick={() => handleTabClick(tab.id)}
            aria-label={tab.ariaLabel}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              cursor: "pointer",
              background: "none",
              border: "none",
              padding: 0,
              WebkitTapHighlightColor: "transparent",
            }}
          >
            {/* Icon container — fixed box for perfect centering */}
            <div
              style={{
                width: ICON_BOX,
                height: ICON_BOX,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transform: isPop ? "scale(1.06)" : "scale(1)",
                transition: "transform 150ms cubic-bezier(0.4, 0, 0.2, 1)",
                position: "relative",
              }}
            >
              {tab.icon(isActive)}
              {/* Unread badge */}
              {tab.id === "sniper" && hasUnreadAlerts && (
                <span
                  style={{
                    position: "absolute",
                    top: 2,
                    right: 2,
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: ACTIVE,
                    border: "2px solid #F0EDEA",
                    pointerEvents: "none",
                  }}
                />
              )}
            </div>
            {/* Active dot indicator — 12px below icon box */}
            <span
              style={{
                width: 4,
                height: 4,
                borderRadius: "50%",
                background: isActive ? ACTIVE : "transparent",
                marginTop: DOT_GAP,
              }}
            />
          </button>
        );
      })}
    </nav>
  );
});

BottomNav.displayName = "BottomNav";

export default BottomNav;
