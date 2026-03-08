# WildAtlas — Comprehensive Technical & Product Audit
**Audited:** 2026-03-08
**Auditor:** Senior Staff Engineer / Product Audit
**Codebase:** React + Vite + Supabase + Deno Edge Functions
**Stage:** Pre-launch (v1.0.0)

---

## Overall Health Score: **66 / 100**

This is a meaningfully-built MVP. The core product loop is real: scanner polls Recreation.gov, detects availability, enqueues notifications, fans them out. The edge function architecture is thought-through and the circuit breaker / rate limit logic is solid for a v1. But several structural decisions will hurt you at scale, and there are active security bugs that need to be fixed before launch.

---

## Category Scores

| Category | Score | Verdict |
|---|---|---|
| Architecture | 68 | Functional but useSniperData is a god hook |
| Performance | 58 | Client-side polling is a thundering herd at scale |
| UI/UX Quality | 72 | Clean mobile-first design; a few trust-breaking inconsistencies |
| Data Integrity | 70 | Minor race conditions, orphaned records, timestamp drift |
| Scanner & Polling | 76 | Good circuit breaker logic, some edge cases |
| Security | 55 | **Two auth bypass vulnerabilities in production edge functions** |
| Scalability | 52 | Client polling model collapses under real user load |
| Monetization Readiness | 72 | Webhook coverage good, payment failure handling incomplete |
| Code Quality | 68 | Large files, god hook, some dead code, minor duplication |

---

## Critical Issues

These can break the app, damage user trust, or expose a security vulnerability.

### CRIT-1: Auth Guard Bypass in `fan-out-notifications` and `retry-notifications`
**File:** `supabase/functions/fan-out-notifications/index.ts:19`, `retry-notifications/index.ts:17`

Both functions use this auth pattern:
```typescript
if (cronSecret) {
  // check auth
}
```
If `CRON_SECRET` is not set in the environment, the entire auth check is skipped and the function accepts **any unauthenticated HTTP request**. An attacker could call these endpoints directly, trigger mass SMS/email sends, exhaust Twilio credits, or flood the notification queue.

Compare to `check-permits/index.ts:24` which correctly fails-closed:
```typescript
if (!cronSecret) {
  return new Response({ error: "Server misconfigured" }, { status: 500 });
}
```
Fix the other two functions to use the same fail-closed pattern immediately.

---

### CRIT-2: `.env` File Is Committed to the Repository
**File:** `.env`

The `.env` file containing `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, and `VITE_SUPABASE_PROJECT_ID` is committed to the repo. While the Supabase anon key is designed to be public, committing `.env` is a bad habit that will eventually result in a secret key being committed. Add `.env` to `.gitignore` immediately and audit git history for any prior secrets.

---

### CRIT-3: Stripe Price ID Hardcoded in Production Edge Function
**File:** `supabase/functions/create-checkout/index.ts:99`

```typescript
price: "price_1T77GcQ8Asus9r1r1z1HAEwf",
```

A production Stripe price ID is hardcoded. If you ever update pricing, run a sale, or migrate to a new price, you must redeploy the edge function. This should be an env var (`STRIPE_PRICE_ID`). More importantly, if this is accidentally exposed in a diff or public repo, it reveals your Stripe pricing structure.

---

### CRIT-4: "Priority Scanning" Is Advertised But Not Implemented
**Files:** `src/components/ProModal.tsx:30`, `src/pages/LandingPage.tsx:528`, `supabase/functions/check-single-permit/index.ts`

Pro plan explicitly advertises "Priority scanning" and "Fastest notification speed." The scanner code treats all watches identically — no prioritization by subscription tier. Free and Pro users are notified at the same time. This is a false advertising claim that exposes you to refund demands and potential FTC issues.

Either implement actual priority (e.g., Pro watches in a separate queue processed first) or remove the "priority scanning" claim from all marketing copy.

---

### CRIT-5: Billing Failure Does Not Revoke Pro Access
**File:** `supabase/functions/stripe-webhook/index.ts:212`

```typescript
case "invoice.payment_failed": {
  logStep("Payment failed — will wait for subscription status change", ...);
  break;
}
```

When a payment fails, nothing happens. Stripe will retry but if the subscription enters `past_due` and eventually `canceled`, the webhook handler for `customer.subscription.updated` will fire — but **only when Stripe explicitly marks it canceled**. Between payment failure and cancellation, users can have non-paying Pro access for days to weeks. The `subscription.updated` event should handle `past_due` status by flagging the profile or showing a payment warning in the UI.

---

## Medium Issues

These should be fixed before launch but won't cause immediate data loss or security incidents.

### MED-1: Client-Side Polling Will Collapse Under Real User Load
**File:** `src/hooks/useSniperData.ts:156,302`

Every user on the Sniper tab runs two polling intervals:
- `setInterval(fetchAvailability, 120_000)` — hits `get_permit_availability` RPC every 2 min
- `setInterval(checkHeartbeat, 60_000)` — queries `permit_cache` every 1 min

At 50,000 users with 10% concurrently active = 5,000 active sessions:
- `get_permit_availability`: 5,000 / 120s = **42 RPC calls/second**
- `checkHeartbeat`: 5,000 / 60s = **83 SELECT queries/second**

This is ~125 Supabase queries/second just from client polling, on top of backend scanner traffic. Supabase free/pro tiers will throttle this. The heartbeat check should be handled via realtime subscription to `permit_cache` row changes instead of polling. The availability data should use Supabase Realtime instead of interval polling.

---

### MED-2: `useSniperData` Is a 318-Line God Hook
**File:** `src/hooks/useSniperData.ts`

This hook owns: authentication, Pro gating, park state, permit defs caching, availability fetching, watch CRUD operations, phone state, success/failure modals, Pro modal state, scanner heartbeat, retry logic, and PostHog events. It returns 32 values. This will become impossible to test, debug, or modify without breaking adjacent functionality.

Split into: `useWatches`, `usePermitAvailability`, `useScannerStatus`, and keep business logic separate from UI state.

---

### MED-3: `prevAvailCountRef` Is Initialized via `useState` Hack
**File:** `src/hooks/useSniperData.ts:58`

```typescript
const prevAvailCountRef = useState(() => ({ current: -1 }))[0];
```

This borrows `useState` to get a stable mutable object, explicitly naming it `Ref` to signal intent. Use `useRef(-1)` directly. This is a code smell that suggests the author knew it was a workaround.

---

### MED-4: `fan-out-notifications` Uses N+1 Pattern for Email Auth Lookups
**File:** `supabase/functions/fan-out-notifications/index.ts:91`

```typescript
const lookups = await Promise.all(
  chunk.map((uid) => supabase.auth.admin.getUserById(uid))
);
```

Even batched in chunks of 50, this is making up to 100 individual `auth.admin.getUserById` calls per batch of 100 notifications. Consider storing email in the `profiles` table directly (with appropriate security) or using a Postgres function to join auth.users with profiles to avoid the admin API overhead.

---

### MED-5: Delete Account Does Not Clean Up notification_queue / notification_log
**File:** `supabase/functions/delete-account/index.ts:48`

```typescript
await adminClient.from("active_watches").delete().eq("user_id", user.id);
await adminClient.from("pro_waitlist").delete().eq("user_id", user.id);
await adminClient.from("profiles").delete().eq("user_id", user.id);
await adminClient.from("user_roles").delete().eq("user_id", user.id);
```

`notification_queue` and `notification_log` rows referencing the deleted user's `user_id` are orphaned. If these tables have FK constraints to `profiles`, this will fail. If they don't, you're leaving PII (email/phone/permit data) in the DB after account deletion, which is a GDPR/privacy compliance violation.

---

### MED-6: `getTimeAgo` Timestamps Are Static After Render
**File:** `src/hooks/useSniperData.ts:68`

`getTimeAgo` computes elapsed time on each call, but the component doesn't re-render on a timer. "Last scanned 0s ago" will read "0s ago" indefinitely until the next data fetch triggers a re-render. Consider a 30-second tick via `useEffect` + `useState` in `ScannerStatusCard`, or accept the limitation and show only the absolute timestamp.

---

### MED-7: Scanner Heartbeat Does Not Reflect Worker Health
**File:** `supabase/functions/check-permits/index.ts:207`

The heartbeat is written by the orchestrator after dispatching workers, but before workers complete. A heartbeat write succeeds even if all 5 concurrent workers fail. The `error_count` field captures errors, but the heartbeat timestamp will still be fresh even when no permits were actually checked. The admin dashboard's "Scanner Health" widget could show "healthy" when the scanner is effectively broken.

---

### MED-8: Wildcard CORS on Internal Edge Functions
**File:** `supabase/functions/check-permits/index.ts:4`, `fan-out-notifications/index.ts:4`, `retry-notifications/index.ts:4`, `check-single-permit/index.ts:4`

Internal functions (cron-triggered, never called by browser) use:
```typescript
"Access-Control-Allow-Origin": "*"
```
While auth guards protect these, wildcard CORS is unnecessary for functions that are never called by a browser. Origin-restricted functions (`create-checkout`, `mochi-chat`, `delete-account`) are already correctly using `ALLOWED_ORIGINS`. Apply the same pattern to all functions.

---

### MED-9: `mochi-chat` Rate Limiter Uses `api_health_log` as a Rate Limit Store
**File:** `supabase/functions/mochi-chat/index.ts:733`

The Mochi rate limiter stores per-user request counts in `api_health_log` — a table meant for API health monitoring. These are different concerns. Rate limit data mixed with health metrics distorts the admin health dashboard. At scale, Mochi rate limit rows will dominate the table and skew success rate calculations. The index added in migration `20260306230000` helps, but the coupling is still wrong.

---

## Minor Improvements

These are polish and quality issues that matter for professional launch.

### MIN-1: Footer Link Points to Wrong Domain
**File:** `src/pages/Index.tsx:125`

```typescript
<a href="https://wildatlasnp.lovable.app">WildAtlas.com</a>
```
The label says "WildAtlas.com" but the URL is the Lovable dev domain. Pick one and make it consistent. The official production domain should be used here.

---

### MIN-2: Landing Page Stats Section Shows No Live Data
**File:** `src/pages/LandingPage.tsx:185`

`get_landing_stats` RPC is called and `stats.found`/`stats.scans` are stored in state, but the `CountUpStats` component only displays a hardcoded count-up to `6` (parks monitored) and "Scans every 2 min." The permit find count and scan count fetched from the DB are ignored. Either use them or remove the RPC call.

---

### MIN-3: Duplicate Privacy Policy Routes
**File:** `src/App.tsx:57,58`

Two routes both serve privacy policy content:
- `/privacy` → `PrivacyPolicy.tsx`
- `/privacy-policy` → `TermlyPrivacyPolicy.tsx`

The footer links in `LandingPage` point to the Termly external URL, while `Index.tsx` footer uses `/privacy`. Consolidate to one canonical privacy page.

---

### MIN-4: `useProStatus` Hook Is a Pointless Re-Export
**File:** `src/hooks/useProStatus.ts`

```typescript
// Re-export from context for backward compatibility
export { useProStatus } from "@/contexts/ProStatusContext";
```

There's nothing to be backward-compatible with in a pre-launch app. Delete this file and update the two imports that use it directly.

---

### MIN-5: `DevGate.tsx` May Be Dead Code
**File:** `src/components/DevGate.tsx`

`DevGate.tsx` exists but searching the codebase shows no component using it. Confirm and delete if unused.

---

### MIN-6: `cacheLocally` / `getCachedData` Exported from a UI Component
**File:** `src/components/OfflineBanner.tsx:8`

These utility functions are exported from a display component. Any file that imports them imports the entire OfflineBanner component tree. Move to `src/lib/cache.ts`.

---

### MIN-7: SettingsPage.tsx Is 808 Lines
**File:** `src/pages/SettingsPage.tsx`

This is a giant file that includes: OTP flow, phone masking/reveal logic, notification preferences, subscription management, refund policy modal, and account deletion. Split into sub-components (`PhoneSection`, `NotificationPrefs`, `SubscriptionSection`) to make this maintainable.

---

### MIN-8: `console.log` in useSniperData Retry Path
**File:** `src/hooks/useSniperData.ts:91`

```typescript
console.log(`🔄 Retrying availability fetch...`);
```

Debug logs in client-side production code expose internal retry behavior to anyone opening DevTools. Remove or gate behind `import.meta.env.DEV`.

---

### MIN-9: `PARK_META` in `mochi-chat` Is 380+ Lines of Hardcoded Knowledge
**File:** `supabase/functions/mochi-chat/index.ts:28`

All park knowledge is hardcoded in the edge function. Adding a 7th park requires redeploying the function. Consider moving this to a `park_knowledge` table in Supabase so it can be updated without code changes.

---

### MIN-10: Auto-Send Effect in MochiChat Has Fragile Dependency
**File:** `src/components/MochiChat.tsx:151`

```typescript
useEffect(() => {
  if (pendingSendRef.current && input === pendingSendRef.current && !isLoading) {
    pendingSendRef.current = null;
    handleSend();
  }
}, [input]);
```

`handleSend` is not in the dependency array. The ESLint hooks plugin should flag this. If `handleSend` captures stale closures (e.g., stale `messages`), the auto-send from quick prompt chips will send an outdated history.

---

## Hidden Risks

Things that won't break today but will become serious problems.

### RISK-1: `api_health_log` and `recent_finds` Grow Without Bound
Neither table has a pruning job, TTL, or partition. `api_health_log` is written on every permit check (up to `N_permits × 2_months` per scan cycle) plus every Mochi message. With 50 permit types scanning every 2 minutes: ~50 rows/2min = 36,000 rows/day. After one year: 13M+ rows. Query performance will degrade. Add a cron job to prune rows older than 30 days.

---

### RISK-2: `notification_queue` Items in "exhausted" State Are Never Cleared
**File:** `supabase/functions/fan-out-notifications/index.ts:145`

Items that exhaust all retries get status `"exhausted"` but are never deleted. They accumulate forever. The fan-out worker's `SELECT WHERE status = "pending"` will remain fast, but the table will bloat. Add a cleanup job or DELETE after N days.

---

### RISK-3: Module-Level `permitDefsCache` Map Survives Hot Module Reload But Nothing Else
**File:** `src/hooks/useSniperData.ts:14`

```typescript
const permitDefsCache = new Map<string, { data: PermitDef[]; fetchedAt: number }>();
```

This is a module-level singleton — fine for browser cache-through, but if the module is remounted (HMR, future code splitting), the cache is lost. More importantly, cache entries are never evicted even when a park's permit definitions change in the DB. A stale cache can serve outdated permit names for up to 30 minutes. This is acceptable now but should be replaced with React Query's built-in caching once the useSniperData refactor happens.

---

### RISK-4: The Realtime Subscription for Watch Updates Doesn't Filter by `park_id`
**File:** `src/hooks/useSniperData.ts:192`

```typescript
filter: `user_id=eq.${user.id}`
```

The realtime channel listens for any watch update for the user, across all parks. The handler then checks `updated.park_id === parkId` to filter. This is fine for small user watch counts but generates unnecessary realtime traffic as a user's watch count grows. Ideally filter at the subscription level.

---

### RISK-5: `checkItineraryPermit` Can Make 20+ HTTP Requests Per Invocation
**File:** `supabase/functions/check-single-permit/index.ts:152`

For `permititinerary` API type: up to 10 divisions × 2 months × 1 request each = up to 20 HTTP requests with 500ms sleep between some. At 5 concurrent workers per `check-permits` run, a park with multiple itinerary permits could take 10+ seconds per invocation and risk Supabase Edge Function timeouts (default 2 minutes is fine, but resource usage is high). Also: the function returns early if any division has availability (`if (availableDates.length > 0) break`), but only after finishing that division's month loop. The logic could exit earlier.

---

### RISK-6: Free Tier Limit Is Enforced Client-Side First
**File:** `src/hooks/useSniperData.ts:219`

```typescript
if (!isPro && !existing && activeCount >= FREE_WATCH_LIMIT) { setProModalOpen(true); return; }
```

The client-side check is the first line of defense. The DB constraint exists (a Postgres trigger or RLS presumably enforces it), but the client-side check uses the locally-cached `isPro` value. If the realtime subscription for `is_pro` updates fires with a race condition (Pro cancelled while user is mid-action), the client might allow an action the DB will reject. The error handling does catch DB rejections and show the Pro modal, so this is not a security issue — just a minor UX rough edge.

---

### RISK-7: Mochi AI Costs Are Fully Unbounded
**File:** `supabase/functions/mochi-chat/index.ts:731`

Rate limiting is 10 requests per 60 seconds per user. A free user sending 10 messages a minute, 24 hours a day would cost: 10 × 60 × 24 = 14,400 AI API calls/day per abusive user. With 1,000 users at even 10% of that rate, costs escalate quickly. There's no daily cap, no monthly budget alert, no distinction between free and Pro users for Mochi access. Consider a daily message cap (e.g., 20/day for free, unlimited for Pro).

---

## Refactor Recommendations

1. **Split `useSniperData` immediately.** Create `useWatches(parkId, userId)`, `usePermitAvailability(parkId)`, and `useScannerStatus()` as separate focused hooks. The god hook is your single biggest maintenance liability.

2. **Replace client availability polling with Supabase Realtime.** Subscribe to `permit_availability` table changes filtered by `park_code`. This eliminates the thundering herd and delivers updates with lower latency.

3. **Move `cacheLocally` / `getCachedData` to `src/lib/offline-cache.ts`.** No utility function should live inside a UI component file.

4. **Harden `fan-out-notifications` and `retry-notifications` auth guards.** Change `if (cronSecret)` to `if (!cronSecret) return 500`. This is a one-line fix for a real vulnerability.

5. **Move Stripe price ID to env var.** `STRIPE_PRICE_ID` → access via `Deno.env.get("STRIPE_PRICE_ID")`.

6. **Add pruning cron jobs for `api_health_log`, `recent_finds`, `notification_queue`.** Target: delete records older than 30 days. Without this, query performance degrades continuously.

7. **Store email on `profiles` table.** Eliminates the N+1 `auth.admin.getUserById` loop in `fan-out-notifications`. Use a Postgres trigger to sync it from `auth.users`.

8. **Add `subscription.past_due` handling to the Stripe webhook.** Set a `billing_status` flag on the profile so the UI can show a payment warning without revoking Pro access immediately.

9. **Either implement priority scanning or remove the claim.** Create a separate `pro_watches` view or priority flag that the scanner processes first. Until then, remove "priority scanning" from all marketing copy.

10. **Delete `src/hooks/useProStatus.ts`.** Update the 2 import sites to import directly from the context.

---

## Launch Readiness Estimate

**The core product works.** Scanner → detection → notification → watch deactivation — this loop is functional, well-instrumented, and has retry logic. The UI is clean. The Stripe integration handles the main billing events.

**What must be fixed before launch:**
- CRIT-1: Auth guard bypass in `fan-out-notifications` and `retry-notifications` (30-minute fix)
- CRIT-4: Remove "priority scanning" false advertising claim (20-minute fix)
- MED-5: Fix delete-account to also purge `notification_queue` / `notification_log` PII (1-hour fix)
- MIN-1: Fix the WildAtlas.com footer link (5-minute fix)

**What should be fixed within the first 2 weeks:**
- MED-1: Replace client polling with Supabase Realtime (major refactor, 1-2 days)
- MED-9: Extract Mochi rate limiter from `api_health_log` (4-hour refactor)
- RISK-1: Add pruning jobs (1 day)
- RISK-7: Add Mochi daily cap for free users (2-hour fix)

**Estimated launch readiness after critical fixes:** 72/100 — shippable to a limited beta with active monitoring. Not ready for a viral launch without addressing the scalability issues.

---

## Summary Table of All Issues

| ID | Severity | File | Description |
|---|---|---|---|
| CRIT-1 | Critical | fan-out-notifications, retry-notifications | Auth bypass if CRON_SECRET unset |
| CRIT-2 | Critical | .env | Secrets file committed to repo |
| CRIT-3 | Critical | create-checkout | Stripe price ID hardcoded |
| CRIT-4 | Critical | Multiple | "Priority scanning" not implemented |
| CRIT-5 | Critical | stripe-webhook | Failed payment does nothing |
| MED-1 | Medium | useSniperData | Client polling thundering herd |
| MED-2 | Medium | useSniperData | 318-line god hook |
| MED-3 | Medium | useSniperData | prevAvailCountRef via useState hack |
| MED-4 | Medium | fan-out-notifications | N+1 getUserById loop |
| MED-5 | Medium | delete-account | PII left in notification tables |
| MED-6 | Medium | useSniperData | getTimeAgo doesn't re-render |
| MED-7 | Medium | check-permits | Heartbeat doesn't reflect worker health |
| MED-8 | Medium | Multiple edge functions | Wildcard CORS on internal functions |
| MED-9 | Medium | mochi-chat | Rate limiter pollutes api_health_log |
| MIN-1 | Minor | Index.tsx | Wrong domain in footer link |
| MIN-2 | Minor | LandingPage.tsx | DB stats fetched but not displayed |
| MIN-3 | Minor | App.tsx | Duplicate privacy policy routes |
| MIN-4 | Minor | useProStatus.ts | Pointless re-export file |
| MIN-5 | Minor | DevGate.tsx | Possibly dead component |
| MIN-6 | Minor | OfflineBanner.tsx | Utility functions in UI component |
| MIN-7 | Minor | SettingsPage.tsx | 808-line monolith page |
| MIN-8 | Minor | useSniperData.ts | console.log in production client code |
| MIN-9 | Minor | mochi-chat | 380+ lines hardcoded park knowledge |
| MIN-10 | Minor | MochiChat.tsx | stale closure risk in auto-send effect |
| RISK-1 | Risk | DB | api_health_log / recent_finds unbounded growth |
| RISK-2 | Risk | DB | notification_queue exhausted items never pruned |
| RISK-3 | Risk | useSniperData | Module cache never invalidated |
| RISK-4 | Risk | useSniperData | Realtime filter too broad |
| RISK-5 | Risk | check-single-permit | checkItineraryPermit can make 20+ HTTP requests |
| RISK-6 | Risk | useSniperData | Free limit client-side first |
| RISK-7 | Risk | mochi-chat | AI costs unbounded |
