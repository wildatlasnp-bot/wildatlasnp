

## Root Cause Analysis

The jitter comes from two sources in `src/pages/Index.tsx`:

1. **`AnimatePresence mode="wait"` with `key={activeTab}`** — This fully unmounts the old tab, waits for its exit animation (`y: -8`), then mounts the new tab with an enter animation (`y: 8 → 0`). This causes:
   - Complete remount of heavy components (SniperDashboard, MochiChat, DiscoverTips) on every switch
   - Layout shift during the exit → enter gap (content height momentarily drops to 0)
   - Loss of scroll position and component state
   - Data re-fetching and skeleton/loading flash on revisited tabs

2. **The `y` offset animations** — Even a small 8px vertical shift creates visible jitter on mobile, especially combined with the mount/unmount cycle.

## Plan

### 1. Replace unmount/remount with CSS visibility toggling

Render all three tab panels simultaneously but only show the active one. This keeps each tab's DOM, state, scroll position, and fetched data alive.

**In `src/pages/Index.tsx`:**
- Remove `AnimatePresence` and `motion.div` wrapper around tab content
- Render all three tabs inside divs that use `display: none` / `display: flex` based on `activeTab`
- Use a simple opacity CSS transition (150ms) on the active panel for a subtle fade without layout shift

```text
Before:
  <AnimatePresence mode="wait">
    <motion.div key={activeTab}>
      {activeTab === "mochi" && <MochiChat />}
      {activeTab === "sniper" && <SniperDashboard />}
      ...
    </motion.div>
  </AnimatePresence>

After:
  <div className={activeTab === "mochi" ? "flex-1 flex flex-col overflow-hidden" : "hidden"}>
    <MochiChat />
  </div>
  <div className={activeTab === "sniper" ? "flex-1 flex flex-col overflow-hidden" : "hidden"}>
    <SniperDashboard />
  </div>
  <div className={activeTab === "discover" ? "flex-1 flex flex-col overflow-hidden" : "hidden"}>
    <DiscoverTips />
  </div>
```

### 2. Remove framer-motion import for tab transitions

Remove the `AnimatePresence` and `motion` imports from Index.tsx since they're no longer needed for tab switching (they may still be used elsewhere in the app).

### 3. Keep BottomNav unchanged

The `layoutId="nav-pill"` spring animation on the active tab indicator is smooth and unrelated to the content jitter. No changes needed.

### Summary of changes

- **One file edited**: `src/pages/Index.tsx`
- Remove ~6 lines (AnimatePresence/motion wrapper), replace with ~9 lines (three always-mounted divs)
- Zero new dependencies
- Preserves scroll position, component state, and fetched data across tab switches
- Eliminates all mount/unmount layout shifts

