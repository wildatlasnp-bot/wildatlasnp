# WildAtlas — Complete App Audit Summary
**Audit Date:** March 9, 2026  
**Overall Status:** Pre-Beta (66/100)  
**Verdict:** Functional MVP with critical security fixes needed before launch

---

## Executive Summary

WildAtlas is a **permit availability tracker for U.S. National Parks** that monitors Recreation.gov and sends email/SMS alerts when permits become available. The app is built on a modern stack (React + Vite + Supabase + Deno Edge Functions) with solid architectural foundations for the core scanning system.

**Current State:**
- ✅ **Core functionality works**: Scanner detects availability, fans out notifications, enforces rate limits
- ✅ **Shared scanning architecture**: Efficient permit pooling across users (v1 scheduling operational)
- ✅ **Stripe integration**: Subscription flow, webhook handling, customer portal
- ✅ **Mobile-first UI**: Clean design with semantic color tokens, proper accessibility
- ⚠️ **Security vulnerabilities**: 2 critical auth bypass bugs in notification functions
- ⚠️ **Scalability concerns**: Client-side polling model will collapse under real load
- ⚠️ **Technical debt**: God hook (318 lines), legacy table migration incomplete

---

## What's Working ✅

### 1. **Shared Scanning Architecture** (VERIFIED)
- **Smart scheduling**: Targets scan only when due (`next_check_at <= now()`)
- **Priority tiers**: High (2min), Medium (5min), Low (10min) intervals
- **Dynamic adjustments**: Recent finds boost to 1min, inactive slowdown to 15min
- **Orphaned target handling**: Graceful rescheduling when no active watchers
- **No duplicate scans**: `uq_scan_target` constraint prevents duplicate targets
- **Efficient fan-out**: Single scan serves all subscribed users via `user_watchers` table

**Scanner Heartbeat:** `__scanner_heartbeat__` last beat 14 minutes ago (healthy)  
**Active Targets:** 3 total (1 orphaned, awaiting cleanup)  
**Recent Finds:** 6 permits found in last 7 days (Half Dome × 2, Wilderness, Narrows, Muir)

### 2. **Notification System**
- **Multi-channel**: Email (Resend) + SMS (Twilio)
- **Retry logic**: 3-attempt exponential backoff with `notification_log` tracking
- **30-minute cooldown**: Prevents notification spam
- **Dead-letter handling**: Admin dashboard for reviewing permanently failed alerts

### 3. **Authentication & Authorization**
- **Email verification required**: Users with unconfirmed emails blocked from protected features
- **RBAC via `user_roles`**: Security-definer `has_role()` function prevents RLS recursion
- **Pro status realtime sync**: Subscription changes propagate via Supabase Realtime
- **Protected profile fields**: `phone_verified`, `stripe_customer_id`, `onboarded_at` use security-definer getter

### 4. **Stripe Monetization**
- **Subscription flow**: Pro plan checkout, webhook handling, customer portal
- **Payment failure tracking**: Logs captured (though access revocation incomplete)
- **Refund policy**: 7-day full refund, prorated thereafter
- **Frontend gating**: Free tier limited to 1 active watch, Pro unlimited (enforced at DB + UI)

### 5. **User Experience**
- **Onboarding flow**: 3-step wizard (park selection, permit choice, phone/notifications)
- **Mochi AI assistant**: Context-aware park advice using Lovable AI
- **Phone verification**: 6-digit OTP via Twilio SMS
- **Responsive design**: Mobile-first with warm earthy design tokens (Lora + Inter fonts)
- **PostHog analytics**: User tracking + event capture

### 6. **Data Insights**
- **Pattern analytics**: Weekly permit/crowd patterns computed via edge functions
- **Admin health dashboard**: Scanner status, dead-letter notifications, email delivery metrics
- **Recent finds feed**: Real-time permit availability events

---

## Critical Issues 🔴

### **SECURITY-1: Auth Bypass in Notification Functions**
**Severity:** CRITICAL  
**Files:** `fan-out-notifications/index.ts:19`, `retry-notifications/index.ts:17`

**Issue:**  
Both functions use:
```typescript
if (cronSecret) { /* check auth */ }
```
If `CRON_SECRET` is undefined, the entire auth check is **skipped** and the functions accept unauthenticated HTTP requests. An attacker could:
- Trigger mass SMS sends → exhaust Twilio credits
- Flood notification queue → DoS the system
- Spam users with fake alerts

**Fix:** Implement fail-closed pattern (like `check-permits` does):
```typescript
if (!cronSecret) {
  return new Response(JSON.stringify({ error: "Server misconfigured" }), { status: 500 });
}
```

---

### **SECURITY-2: Hardcoded Stripe Price ID**
**Severity:** HIGH  
**File:** `create-checkout/index.ts:99`

```typescript
price: "price_1T77GcQ8Asus9r1r1z1HAEwf",  // PRODUCTION PRICE ID
```

**Issue:**  
- Cannot change pricing without redeploying edge function
- Exposes pricing structure if code is public
- No environment-based differentiation (dev vs prod)

**Fix:** Move to environment variable `STRIPE_PRICE_ID`

---

### **PRODUCT-1: False Advertising — "Priority Scanning"**
**Severity:** HIGH (Legal/Trust)  
**Files:** `ProModal.tsx:30`, `LandingPage.tsx:528`

**Issue:**  
Pro plan advertises "Priority scanning" and "Fastest notification speed" but the scanner treats all watches identically. Free and Pro users get notified at the same time. This is **false advertising** that could trigger:
- Refund demands
- FTC complaints
- Loss of user trust

**Fix:**  
Either:
1. Implement actual priority (Pro watches in high-priority queue processed first)
2. Remove "priority scanning" from all marketing copy

---

### **SCALABILITY-1: Client Polling Thundering Herd**
**Severity:** MEDIUM (Blocks scale)  
**File:** `useSniperData.ts:156,302`

**Issue:**  
Every user on Sniper tab polls:
- `get_permit_availability` RPC every 2 minutes
- `permit_cache` heartbeat every 1 minute

**At 5,000 concurrent users:**
- 42 RPC calls/second
- 83 SELECT queries/second
- = 125 queries/second from client polling alone

**Fix:**  
Replace with Supabase Realtime subscriptions to `permit_availability` + `permit_cache` tables

---

### **DATA-1: Legacy Table Migration Incomplete**
**Severity:** MEDIUM  
**Table:** `active_watches`

**Status:**  
- 4 total rows (2 active)
- New architecture uses `scan_targets` + `user_watchers`
- Frontend still queries `active_watches` in some components

**Fix:**  
1. Migrate remaining data to new schema
2. Update all frontend queries to use `user_watchers`
3. Deprecate `active_watches` table

---

## Medium Issues ⚠️

1. **God Hook:** `useSniperData` is 318 lines, returns 32 values, owns 8 concerns. Split into `useWatches`, `usePermitAvailability`, `useScannerStatus`
2. **N+1 Pattern:** `fan-out-notifications` makes 100+ `auth.admin.getUserById` calls per batch
3. **Delete Account:** Orphans `notification_queue` + `notification_log` rows (GDPR violation)
4. **Static Timestamps:** "Last scanned Xs ago" doesn't update after render
5. **Wildcard CORS:** Internal edge functions use `Access-Control-Allow-Origin: *` unnecessarily
6. **Mochi Rate Limit Storage:** Uses `api_health_log` table instead of dedicated rate_limit table
7. **Billing Failure:** Payment failures don't revoke Pro access until Stripe explicitly cancels subscription

---

## Minor Polish Items 🔧

1. Footer link domain mismatch (`wildatlasnp.lovable.app` vs "WildAtlas.com")
2. Landing page stats fetch live data but don't display it
3. Duplicate privacy policy routes (`/privacy` vs `/privacy-policy`)
4. `useProStatus.ts` is a pointless re-export file
5. `DevGate.tsx` may be dead code
6. `SettingsPage.tsx` is 808 lines (split into sub-components)
7. Debug `console.log` in production retry path
8. `PARK_META` hardcoded in edge function (380+ lines) — move to DB table
9. `.env` file committed to repo (should be gitignored)
10. Auto-send effect in `MochiChat.tsx` missing `handleSend` in dependency array

---

## Hidden Risks ⏰

1. **Unbounded Table Growth:**  
   - `api_health_log`: No pruning (will hit 13M+ rows/year)
   - `recent_finds`: No TTL or partition
   - `notification_queue`: "exhausted" items never deleted

2. **Mochi AI Costs:**  
   - No daily cap, monthly budget alert, or free/Pro distinction
   - 10 msgs/min × 60 × 24 = 14,400 AI calls/day per abusive user

3. **Module-Level Cache:**  
   - `permitDefsCache` survives HMR but entries never evicted (30min stale data possible)

4. **Realtime Subscription Filter:**  
   - Watches realtime doesn't filter by `park_id` at subscription level (unnecessary traffic)

5. **Itinerary Permit Checks:**  
   - Can make 20+ HTTP requests per invocation (high edge function resource usage)

---

## Database Health 📊

### User Adoption
- **Total users:** 3
- **Pro users:** 0
- **Phone verified:** 0
- **Onboarded:** 3

### Scanner Performance
- **Active targets:** 3 (1 orphaned)
- **Recent finds:** 6 in last 7 days
- **Notification success:** 100% (5 sent via email, avg 0.6 retries)
- **No database errors:** Postgres logs clean (0 ERROR/FATAL events)

### Data Integrity
- ✅ No duplicate `scan_targets`
- ✅ No duplicate `user_watchers`
- ✅ Unique constraints working
- ⚠️ 1 orphaned target (will be cleaned by `cleanup-orphaned-targets` cron)

---

## Architecture Quality 🏗️

### Strengths
- **Shared scanning:** Efficient resource pooling across users
- **Circuit breaker:** Global rate limit backoff prevents Recreation.gov bans
- **Retry logic:** Exponential backoff with dead-letter handling
- **Realtime sync:** Pro status, watch updates propagate instantly
- **RLS security:** Proper policies with security-definer helpers
- **Design system:** Semantic tokens, HSL colors, clean mobile-first UI

### Weaknesses
- **God hook:** `useSniperData` owns too many concerns
- **Client polling:** Will not scale beyond 1,000 concurrent users
- **Large files:** `SettingsPage` (808 lines), `mochi-chat` edge function (1,100+ lines)
- **Hardcoded data:** Park knowledge, Stripe price ID should be configurable
- **No tests:** `src/test/example.test.ts` is a placeholder

---

## Beta Launch Readiness

### Must-Fix Before Launch (1-2 days)
1. ✅ Fix auth bypass in `fan-out-notifications` + `retry-notifications` (SECURITY)
2. ✅ Move Stripe price ID to env var (SECURITY)
3. ✅ Remove "priority scanning" claims OR implement actual priority (LEGAL)
4. ⚠️ Migrate remaining `active_watches` data to new schema (DATA INTEGRITY)
5. ⚠️ Fix account deletion to clean up notification tables (GDPR)

### Should-Fix Before Launch (3-5 days)
1. Replace client polling with Realtime subscriptions (SCALABILITY)
2. Split `useSniperData` god hook into focused hooks (MAINTAINABILITY)
3. Add table pruning jobs for `api_health_log`, `recent_finds`, `notification_queue` (PERFORMANCE)
4. Implement billing failure → Pro revocation (MONETIZATION)
5. Add Mochi AI daily message cap (COST CONTROL)

### Can Defer to v1.1
- N+1 pattern optimization in notification fan-out
- Move park knowledge to DB table
- Add comprehensive test coverage
- Refactor large files (SettingsPage, mochi-chat)
- Polish UX inconsistencies (footer links, privacy routes, static timestamps)

---

## Can This Support 1,000+ Users?

**Current State:** **No** — client polling will collapse Supabase free tier limits

**After Realtime Migration:** **Yes** — shared scanning architecture is designed for this scale:
- 1,000 users watching 50 unique permits = 50 scans (not 1,000)
- Notification fan-out is batch-optimized
- Scanner heartbeat + circuit breaker prevent Recreation.gov rate limits
- Database indexes are properly configured

**Recommended Next Steps:**
1. Fix critical security bugs (1 day)
2. Migrate to Realtime subscriptions (2 days)
3. Add table pruning cron jobs (1 day)
4. Beta launch with 100 users to validate load
5. Monitor PostHog analytics + Supabase metrics
6. Gradually scale to 1,000+ as monitoring confirms stability

---

## Final Verdict

**Score:** 66/100  
**Launch Readiness:** 🟡 Pre-Beta (needs critical fixes)  
**Architecture:** ✅ Solid for v1  
**Security:** 🔴 2 critical bugs  
**Scalability:** 🟡 Good backend, poor client polling  
**User Experience:** ✅ Clean, functional  
**Code Quality:** 🟡 God hook + large files need refactoring  

**Recommendation:**  
Fix the 2 critical security bugs and false advertising claim, then proceed to **closed beta with 50-100 users**. Monitor closely, migrate to Realtime subscriptions within 2 weeks, then scale to full public launch.

This is a **real product** with genuine value. The core permit scanning loop is well-designed. Fix the critical issues and you have a solid v1.
