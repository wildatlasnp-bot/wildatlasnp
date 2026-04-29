import React, { useState, useEffect, useRef, useCallback } from "react";
import { PawPrint, Bell, Telescope, SlidersHorizontal, type LucideProps } from "lucide-react";

type Tab = "mochi" | "sniper" | "discover" | "settings";

interface BottomNavProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  hasUnreadAlerts?: boolean;
}

const ACTIVE_INK = "#1A2F1E";
const INACTIVE_INK = "#8A9E8A";
const ACCENT_DOT = "#2F6F4E";

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
  const [pressedTab, setPressedTab] = useState<Tab | null>(null);
  // Ripple keys per tab — incrementing key forces a fresh element per tap
  const [ripples, setRipples] = useState<Record<Tab, number>>({
    mochi: 0, sniper: 0, discover: 0, settings: 0,
  });
  const releaseTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => { if (releaseTimer.current) clearTimeout(releaseTimer.current); };
  }, []);

  const handleTabClick = (tab: Tab) => {
    setRipples((r) => ({ ...r, [tab]: r[tab] + 1 }));
    if (tab === activeTab) return;
    onTabChange(tab);
  };

  const handlePressStart = useCallback((tab: Tab) => {
    setPressedTab(tab);
    if (releaseTimer.current) clearTimeout(releaseTimer.current);
  }, []);
  const handlePressEnd = useCallback(() => {
    // Brief delay so the spring-back is perceptible even on quick taps
    if (releaseTimer.current) clearTimeout(releaseTimer.current);
    releaseTimer.current = window.setTimeout(() => setPressedTab(null), 60);
  }, []);

  const activeIndex = Math.max(0, tabs.findIndex((t) => t.id === activeTab));
  const N = tabs.length;

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
        background: "#F0EDEA",
        borderTop: "1px solid #E5E1DD",
        boxShadow: "none",
        zIndex: 50,
      }}
    >
      {/* Sliding active indicator dot */}
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          bottom: `calc(env(safe-area-inset-bottom, 0px) + 6px)`,
          left: `${(activeIndex + 0.5) * (100 / N)}%`,
          transform: "translateX(-50%)",
          width: 3,
          height: 3,
          borderRadius: "50%",
          background: ACCENT_DOT,
          transition: "left 200ms cubic-bezier(0.4, 0, 0.2, 1)",
          pointerEvents: "none",
          zIndex: 2,
        }}
      />

      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const isPressed = pressedTab === tab.id;
        const color = isActive ? ACTIVE_INK : INACTIVE_INK;
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
            }}
          >
            <div
              className="wa-bottom-nav-icon"
              data-nav-target={tab.id}
              style={{
                position: "relative",
                width: 44,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "visible",
              }}
            >
              {rippleKey > 0 && (
                <span
                  key={rippleKey}
                  className="wa-nav-ripple"
                  aria-hidden="true"
                />
              )}
              <div
                style={{
                  transform: isPressed ? "scale(0.88)" : "scale(1)",
                  transition: isPressed
                    ? "transform 60ms cubic-bezier(0.4, 0, 0.2, 1)"
                    : "transform 100ms cubic-bezier(0.34, 1.56, 0.64, 1)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  position: "relative",
                  zIndex: 1,
                }}
              >
                <tab.Icon
                  size={22}
                  strokeWidth={isActive ? 1.5 : 1}
                  color={color}
                  fill="none"
                />
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
                    background: ACCENT_DOT,
                    border: "1.5px solid #F0EDEA",
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
                fontWeight: isActive ? 500 : 400,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: isActive ? ACTIVE_INK : INACTIVE_INK,
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
