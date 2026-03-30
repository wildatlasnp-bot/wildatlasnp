import React from "react";

type Tab = "mochi" | "sniper" | "discover" | "settings";

interface BottomNavProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

const INTER = "'Inter', sans-serif";

const tabs: {
  id: Tab;
  label: string;
  ariaLabel: string;
  icon: (active: boolean) => React.ReactNode;
}[] = [
  {
    id: "mochi",
    label: "Mochi",
    ariaLabel: "Mochi chat",
    icon: (active) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? "var(--forest)" : "var(--dim)"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="3" />
        <path d="M6 21v-1a6 6 0 0112 0v1" />
      </svg>
    ),
  },
  {
    id: "sniper",
    label: "My Parks",
    ariaLabel: "My Parks",
    icon: (active) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? "var(--forest)" : "var(--dim)"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 01-3.46 0" />
      </svg>
    ),
  },
  {
    id: "discover",
    label: "Discover",
    ariaLabel: "Discover",
    icon: (active) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? "var(--forest)" : "var(--dim)"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
      </svg>
    ),
  },
  {
    id: "settings",
    label: "Settings",
    ariaLabel: "Settings",
    icon: (active) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? "var(--forest)" : "var(--dim)"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
      </svg>
    ),
  },
];

const BottomNav = React.memo(({ activeTab, onTabChange }: BottomNavProps) => {
  return (
    <nav
      style={{
        position: "absolute" as const,
        bottom: 0,
        left: 0,
        right: 0,
        height: 88,
        display: "flex",
        justifyContent: "space-around",
        alignItems: "flex-start",
        paddingTop: 12,
        background: "rgba(245,245,240,0.96)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        borderTop: "1px solid var(--rule)",
        zIndex: 50,
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
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 4,
              cursor: "pointer",
              background: "none",
              border: "none",
              minWidth: 56,
              padding: 0,
            }}
          >
            <div style={{ width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {tab.icon(isActive)}
            </div>
            <span
              style={{
                fontFamily: INTER,
                fontSize: 10,
                fontWeight: isActive ? 600 : 400,
                color: isActive ? "var(--forest)" : "var(--dim)",
                lineHeight: 1,
              }}
            >
              {tab.label}
            </span>
            {isActive && (
              <span
                style={{
                  width: 4,
                  height: 4,
                  borderRadius: "50%",
                  background: "var(--forest)",
                  marginTop: 1,
                }}
              />
            )}
          </button>
        );
      })}
    </nav>
  );
});

BottomNav.displayName = "BottomNav";

export default BottomNav;
