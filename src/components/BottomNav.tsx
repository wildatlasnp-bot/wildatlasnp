import React from "react";

type Tab = "mochi" | "sniper" | "discover" | "settings";

interface BottomNavProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

const tabs: {
  id: Tab;
  label: string;
  subtitle: string | null;
  ariaLabel: string;
  icon: (active: boolean) => React.ReactNode;
}[] = [
  {
    id: "mochi",
    label: "Mochi",
    subtitle: null,
    ariaLabel: "Mochi chat",
    icon: (active) => (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="7" r="2.5" stroke={active ? "#2F6F4E" : "rgba(28,24,18,.22)"} strokeWidth="1.3" />
        <path d="M4.5 18c0-3 2.5-5.5 5.5-5.5s5.5 2.5 5.5 5.5" stroke={active ? "#2F6F4E" : "rgba(28,24,18,.22)"} strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "sniper",
    label: "Alerts",
    subtitle: "Permit tracker",
    ariaLabel: "Alerts — Permit tracker",
    icon: (active) => (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M10 2.5a3.5 3.5 0 00-3.5 3.5c0 .7.1 1.3.4 1.8L5 16h10l-1.9-8.2c.3-.5.4-1.1.4-1.8A3.5 3.5 0 0010 2.5z" stroke={active ? "#2F6F4E" : "rgba(28,24,18,.22)"} strokeWidth="1.3" fill="none" strokeLinejoin="round" />
        <path d="M8.2 16a1.8 1.8 0 003.6 0" stroke={active ? "#2F6F4E" : "rgba(28,24,18,.22)"} strokeWidth="1.3" fill="none" />
      </svg>
    ),
  },
  {
    id: "discover",
    label: "Discover",
    subtitle: null,
    ariaLabel: "Discover",
    icon: (active) => (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M10 3L4 17h12L10 3z" stroke={active ? "#2F6F4E" : "rgba(28,24,18,.22)"} strokeWidth="1.3" fill="none" strokeLinejoin="round" />
        <path d="M10 3L6.5 17M10 3L13.5 17" stroke={active ? "#2F6F4E" : "rgba(28,24,18,.22)"} strokeWidth=".8" fill="none" opacity=".5" />
      </svg>
    ),
  },
  {
    id: "settings",
    label: "Settings",
    subtitle: null,
    ariaLabel: "Settings",
    icon: (active) => (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="10" r="2.2" stroke={active ? "#2F6F4E" : "rgba(28,24,18,.22)"} strokeWidth="1.3" fill="none" />
        <path d="M10 3.5v1.5M10 15v1.5M3.5 10H5M15 10h1.5M5.6 5.6l1.06 1.06M13.34 13.34l1.06 1.06M5.6 14.4l1.06-1.06M13.34 6.66l1.06-1.06" stroke={active ? "#2F6F4E" : "rgba(28,24,18,.22)"} strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    ),
  },
];

const BottomNav = React.memo(({ activeTab, onTabChange }: BottomNavProps) => {
  return (
    <nav
      style={{
        display: 'flex',
        justifyContent: 'space-around',
        padding: '10px 0 24px',
        background: '#E8E2D9',
        borderTop: '0.5px solid rgba(148,135,116,.25)',
        flexShrink: 0,
        position: 'relative',
        zIndex: 10,
      }}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            aria-label={tab.ariaLabel}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'flex-start',
              minWidth: 64,
              minHeight: 52,
              paddingTop: 0,
              gap: 4,
              cursor: 'pointer',
              background: 'none',
              border: 'none',
            }}
          >
            {/* Fixed 20×20 icon wrapper */}
            <div style={{ width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {tab.icon(isActive)}
            </div>
            <span
              style={{
                fontSize: 9,
                letterSpacing: '0.07em',
                textTransform: 'uppercase',
                fontWeight: isActive ? 500 : 400,
                color: isActive ? '#2F6F4E' : 'rgba(28,24,18,.22)',
                lineHeight: 1,
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              {tab.label}
            </span>
            {tab.subtitle && (
              <span
                style={{
                  fontSize: 8,
                  color: 'rgba(28,24,18,.18)',
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  lineHeight: 1,
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                {tab.subtitle}
              </span>
            )}
            {isActive && (
              <div style={{ width: 18, height: 2, borderRadius: 1, background: '#2F6F4E', marginTop: 2 }} />
            )}
          </button>
        );
      })}
    </nav>
  );
});

BottomNav.displayName = "BottomNav";

export default BottomNav;
