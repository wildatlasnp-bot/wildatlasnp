import React from "react";
import { PawPrint, Bell, Telescope, SlidersHorizontal, type LucideProps } from "lucide-react";

type Tab = "mochi" | "sniper" | "discover" | "settings";

interface SideRailNavProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  hasUnreadAlerts?: boolean;
}

const ACTIVE_INK = "#1A2F1E";
const INACTIVE_INK = "#8A9E8A";
const ACCENT_DOT = "#2F6F4E";
const RAIL_BG = "#F0EDEA";
const RAIL_BORDER = "#E5E1DD";

type LucideIcon = React.ForwardRefExoticComponent<
  Omit<LucideProps, "ref"> & React.RefAttributes<SVGSVGElement>
>;

const tabs: { id: Tab; label: string; ariaLabel: string; Icon: LucideIcon }[] = [
  { id: "mochi", label: "Poko", ariaLabel: "Poko", Icon: PawPrint },
  { id: "sniper", label: "Alerts", ariaLabel: "Alerts", Icon: Bell },
  { id: "discover", label: "Discover", ariaLabel: "Discover", Icon: Telescope },
  { id: "settings", label: "Settings", ariaLabel: "Settings", Icon: SlidersHorizontal },
];

/**
 * SideRailNav — Desktop-only fixed left rail (≥1024px). Mirrors the
 * BottomNav information model: same 4 tabs, same active accent dot, same
 * unread indicator on Alerts. Cream chrome per the cream-chrome rule.
 *
 * Width is fixed at 88px so layout math is predictable; the content column
 * to its right occupies the remaining viewport.
 */
const SideRailNav = React.memo(function SideRailNav({
  activeTab,
  onTabChange,
  hasUnreadAlerts = false,
}: SideRailNavProps) {
  return (
    <nav
      aria-label="Primary"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        bottom: 0,
        width: 88,
        background: RAIL_BG,
        borderRight: `1px solid ${RAIL_BORDER}`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        paddingTop: 24,
        paddingBottom: 24,
        zIndex: 50,
      }}
    >
      {/* Wordmark — quiet, editorial */}
      <div
        aria-hidden="true"
        style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: 22,
          fontWeight: 500,
          color: ACTIVE_INK,
          letterSpacing: "0.02em",
          marginBottom: 32,
          lineHeight: 1,
        }}
      >
        W
      </div>

      <ul
        style={{
          listStyle: "none",
          margin: 0,
          padding: 0,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          width: "100%",
          alignItems: "center",
        }}
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const color = isActive ? ACTIVE_INK : INACTIVE_INK;
          return (
            <li key={tab.id} style={{ width: "100%", display: "flex", justifyContent: "center" }}>
              <button
                onClick={() => onTabChange(tab.id)}
                aria-label={tab.ariaLabel}
                aria-current={isActive ? "page" : undefined}
                style={{
                  position: "relative",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  width: 64,
                  minHeight: 64,
                  padding: "10px 0",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  WebkitTapHighlightColor: "transparent",
                }}
              >
                {/* Active indicator dot — left edge of the button */}
                <span
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    left: -14,
                    top: "50%",
                    transform: "translateY(-50%)",
                    width: 3,
                    height: 3,
                    borderRadius: "50%",
                    background: isActive ? ACCENT_DOT : "transparent",
                    transition: "background 200ms cubic-bezier(0.4, 0, 0.2, 1)",
                  }}
                />

                <span style={{ position: "relative", display: "inline-flex" }}>
                  <tab.Icon size={22} strokeWidth={isActive ? 1.5 : 1} color={color} fill="none" />
                  {tab.id === "sniper" && hasUnreadAlerts && (
                    <span
                      aria-hidden="true"
                      style={{
                        position: "absolute",
                        top: -2,
                        right: -4,
                        width: 7,
                        height: 7,
                        borderRadius: "50%",
                        background: ACCENT_DOT,
                        border: `1.5px solid ${RAIL_BG}`,
                      }}
                    />
                  )}
                </span>
                <span
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 12,
                    fontWeight: isActive ? 500 : 400,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color,
                    lineHeight: 1,
                    transition: "color 200ms cubic-bezier(0.4, 0, 0.2, 1)",
                  }}
                >
                  {tab.label}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
});

export default SideRailNav;
