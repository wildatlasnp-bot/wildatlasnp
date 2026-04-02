

## Remove odds display from park photo card

### What changes
**File: `src/components/SniperDashboard.tsx`**

1. **Delete `oddsPercent` variable** (line 566) — remove `const oddsPercent = 34;`

2. **Simplify card container border logic** (lines 597-607) — replace the entire odds-based conditional styling with clean defaults:
   - `margin: "0 20px 14px"`
   - `borderRadius: 18`
   - No border, no boxShadow, no animation

3. **Remove `amber-pulse` keyframes from `src/index.css`** if still present (cleanup).

No other files or components are touched.

