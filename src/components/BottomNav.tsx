import React, { useState, useEffect, useRef, useCallback } from "react";
import { PawPrint, Bell, Telescope, SlidersHorizontal, type LucideProps } from "lucide-react";

type Tab = "mochi" | "sniper" | "discover" | "settings";

interface BottomNavProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  hasUnreadAlerts?: boolean;
}

const CREAM = "#F0EDEA";
const CREAM_DEEP = "#E8E3DC";
const ACTIVE_INK = "#1C1C1A";
const INACTIVE_INK = "#9A968E";
const GOLD = "#B58A3F";
const GOLD_SOFT = "rgba(181,138,63,0.18)";
const RULE = "rgba(28,28,26,0.10)";
const CG = "'Cormorant Garamond', serif";
const DM = "'DM Sans', sans-serif";

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
        alignItems: "flex-start",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        background: `linear-gradient(180deg, ${CREAM} 0%, ${CREAM_DEEP} 100%)`,
        borderTop: `1px solid ${RULE}`,
        boxShadow: "0 -1px 0 rgba(255,255,255,0.6) inset, 0 -8px 24px -16px rgba(28,28,26,0.18)",
        zIndex: 50,
      }}
    >
      {/* Top hairline accent — gold thread under the active tab */}
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          top: -1,
          left: `${(activeIndex + 0.5) * (100 / N)}%`,
          transform: "translateX(-50%)",
          width: 28,
          height: 1,
          background: GOLD,
          transition: "left 320ms cubic-bezier(0.4, 0, 0.2, 1), width 200ms cubic-bezier(0.4, 0, 0.2, 1)",
          pointerEvents: "none",
          zIndex: 3,
          boxShadow: `0 0 8px ${GOLD_SOFT}`,
        }}
      />

      {tabs.map((tab, i) => {
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
              width: 64,
              position: "relative",
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
              {/* Active glyph plate — soft cream cameo with gold hairline */}
              {isActive && (
                <span
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    background: "linear-gradient(180deg, #FBF8F3 0%, #F0EBE2 100%)",
                    border: `1px solid ${GOLD_SOFT}`,
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9), 0 1px 2px rgba(28,28,26,0.06)",
                    zIndex: 0,
                  }}
                />
              )}
              {rippleKey > 0 && (
                <span key={rippleKey} className="wa-nav-ripple" aria-hidden="true" />
              )}
              <div
                style={{
                  transform: isPressed ? "scale(0.9)" : "scale(1)",
                  transition: isPressed
                    ? "transform 60ms cubic-bezier(0.4, 0, 0.2, 1)"
                    : "transform 140ms cubic-bezier(0.34, 1.56, 0.64, 1)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  position: "relative",
                  zIndex: 1,
                }}
              >
                <tab.Icon
                  size={20}
                  strokeWidth={isActive ? 1.6 : 1.25}
                  color={color}
                  fill="none"
                />
              </div>
              {tab.id === "sniper" && hasUnreadAlerts && (
                <span
                  style={{
                    position: "absolute",
                    top: 2,
                    right: 4,
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: GOLD,
                    border: `1.5px solid ${CREAM}`,
                    boxShadow: `0 0 6px ${GOLD_SOFT}`,
                    pointerEvents: "none",
                    zIndex: 2,
                  }}
                />
              )}
            </div>
            {/* Editorial label — small caps, mono numeral underneath */}
            <span
              style={{
                fontFamily: DM,
                fontSize: 10,
                fontWeight: isActive ? 600 : 500,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: isActive ? ACTIVE_INK : INACTIVE_INK,
                lineHeight: 1,
                transition: "color 200ms cubic-bezier(0.4, 0, 0.2, 1)",
              }}
            >
              {tab.label}
            </span>
            {/* Tiny serif numeral — quiet field-log signature */}
            <span
              aria-hidden="true"
              style={{
                fontFamily: CG,
                fontStyle: "italic",
                fontSize: 9,
                lineHeight: 1,
                marginTop: 2,
                color: isActive ? GOLD : "transparent",
                transition: "color 200ms cubic-bezier(0.4, 0, 0.2, 1)",
              }}
            >
              {String(i + 1).padStart(2, "0")}
            </span>
          </button>
        );
      })}
    </nav>
  );
});

BottomNav.displayName = "BottomNav";

export default BottomNav;
