import React, { useState, useEffect, useRef, useCallback } from "react";
import { PawPrint, Bell, Telescope, SlidersHorizontal, type LucideProps } from "lucide-react";

type Tab = "mochi" | "sniper" | "discover" | "settings";

interface BottomNavProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  hasUnreadAlerts?: boolean;
}

const INACTIVE = "rgba(26, 47, 30, 0.55)";
const INACTIVE_LABEL = "rgba(26, 47, 30, 0.55)";
const ACTIVE = "#1A2F1E";

const ACTIVE_COLOR: Record<Tab, string> = {
  mochi: ACTIVE,
  discover: ACTIVE,
  sniper: ACTIVE,
  settings: ACTIVE,
};

type LucideIcon = React.ForwardRefExoticComponent<Omit<LucideProps, "ref"> & React.RefAttributes<SVGSVGElement>>;

const tabs: {
  id: Tab;
  label: string;
  ariaLabel: string;
  Icon: LucideIcon;
}[] = [
  { id: "mochi", label: "Poko", ariaLabel: "Poko", Icon: PawPrint },
  { id: "sniper", label: "Alerts", ariaLabel: "Alerts", Icon: Bell },
  { id: "discover", label: "Discover", ariaLabel: "Discover", Icon: Telescope },
  { id: "settings", label: "Settings", ariaLabel: "Settings", Icon: SlidersHorizontal },
];

const BottomNav = React.memo(({ activeTab, onTabChange, hasUnreadAlerts = false }: BottomNavProps) => {
  const [popTab, setPopTab] = useState<Tab | null>(null);
  const [pressedTab, setPressedTab] = useState<Tab | null>(null);
  // Ripple keys per tab — incrementing key forces a fresh element per tap
  const [ripples, setRipples] = useState<Record<Tab, number>>({
    mochi: 0, sniper: 0, discover: 0, settings: 0,
  });
  const popTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => { if (popTimer.current) clearTimeout(popTimer.current); };
  }, []);

  const handleTabClick = (tab: Tab) => {
    // Fire ripple on every tap (even on the active tab) for feedback
    setRipples((r) => ({ ...r, [tab]: r[tab] + 1 }));
    if (tab === activeTab) return;
    setPopTab(tab);
    if (popTimer.current) clearTimeout(popTimer.current);
    popTimer.current = window.setTimeout(() => setPopTab(null), 150);
    onTabChange(tab);
  };

  const handlePressStart = useCallback((tab: Tab) => setPressedTab(tab), []);
  const handlePressEnd = useCallback(() => setPressedTab(null), []);

  return (
    <nav
      className="wa-bottom-nav"
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "space-around",
        alignItems: "center",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        background: "linear-gradient(180deg, #1F3624 0%, #1A2F1E 60%, #15281A 100%)",
        borderTop: "0.5px solid rgba(255, 255, 255, 0.08)",
        boxShadow: "0 -1px 0 rgba(255,255,255,0.04) inset, 0 -8px 24px -8px rgba(5, 20, 12, 0.45), 0 -2px 8px -2px rgba(5, 20, 12, 0.35)",
        zIndex: 50,
      }}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const isPop = popTab === tab.id;
        const isPressed = pressedTab === tab.id;
        const color = isActive ? ACTIVE_COLOR[tab.id] : INACTIVE;
        const rippleKey = ripples[tab.id];

        return (
          <button
            key={tab.id}
            onClick={() => handleTabClick(tab.id)}
            onPointerDown={() => handlePressStart(tab.id)}
            onPointerUp={handlePressEnd}
            onPointerLeave={handlePressEnd}
            onPointerCancel={handlePressEnd}
            aria-label={tab.ariaLabel}
            aria-current={isActive ? "page" : undefined}
            className="wa-bottom-nav-btn"
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              background: "none",
              border: "none",
              padding: 0,
              WebkitTapHighlightColor: "transparent",
              width: 60,
              transform: isPressed ? "scale(0.94)" : "scale(1)",
              transition: "transform 120ms cubic-bezier(0.4, 0, 0.2, 1)",
            }}
          >
            <div
              className="wa-bottom-nav-icon"
              style={{
                position: "relative",
                width: 44,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "visible",
              }}
            >
              {/* Ripple — re-mounts on each tap via changing key */}
              {rippleKey > 0 && (
                <span
                  key={rippleKey}
                  className="wa-nav-ripple"
                  aria-hidden="true"
                />
              )}
              <div
                style={{
                  transform: isPop ? "scale(1.1)" : "scale(1)",
                  transition: "transform 150ms cubic-bezier(0.4, 0, 0.2, 1)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: isActive ? 1 : 0.85,
                  position: "relative",
                  zIndex: 1,
                }}
              >
                <tab.Icon size={22} strokeWidth={isActive ? 1.75 : 1.4} color={color} />
              </div>
              {tab.id === "sniper" && hasUnreadAlerts && (
                <span
                  style={{
                    position: "absolute",
                    top: 0,
                    right: 6,
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: "rgba(245,245,240,0.85)",
                    border: "1.5px solid rgba(5,26,16,0.75)",
                    pointerEvents: "none",
                    zIndex: 2,
                  }}
                />
              )}
            </div>
            <span
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 12,
                fontWeight: isActive ? 600 : 500,
                letterSpacing: "0.10em",
                textTransform: "uppercase",
                color: isActive ? ACTIVE : INACTIVE_LABEL,
                lineHeight: 1,
                transition: "color 200ms cubic-bezier(0.4, 0, 0.2, 1)",
              }}
            >
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
});

BottomNav.displayName = "BottomNav";

export default BottomNav;
