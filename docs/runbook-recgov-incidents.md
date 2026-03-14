# WildAtlas — Recreation.gov Incident Runbook

> **3am reference.** Keep commands copy-pasteable. Do not improvise.

---

## 1. Quick Triage

**Step 1 — check health endpoint (requires service role key or CRON_SECRET):**

```bash
curl -s -X GET \
  "https://<SUPABASE_URL>/functions/v1/scanner-health-check" \
  -H "Authorization: Bearer <CRON_SECRET>" | jq .
```

**Step 2 — check flag state and circuit breakers:**

```sql
-- Kill switches + sentinel state
SELECT cache_key, available, fetched_at, error_count, last_error
FROM permit_cache
WHERE cache_key LIKE '__flag_%'
   OR cache_key IN ('__scanner_heartbeat__', '__global_rate_limit__')
ORDER BY cache_key;

-- Endpoint circuit breakers
SELECT endpoint_key, state, consecutive_429s, cooldown_until, updated_at
FROM endpoint_circuit_breakers;

-- Tripped per-permit circuit breakers
SELECT cache_key, error_count, last_error, last_status_code, fetched_at
FROM permit_cache
WHERE error_count >= 3
  AND cache_key NOT LIKE '__%__'
ORDER BY error_count DESC;
```

**Healthy baseline values:**

| Field | Healthy value |
|---|---|
| `status` | `"healthy"` |
| `heartbeat.error_count` | `0` |
| `heartbeat.all_workers_failed` | `false` |
| `circuit_breakers_tripped` | `0` |
| `schema_drift_tripped` | `0` |
| `slowed_endpoints` | `[]` |
| `zero_finds_warning` | `false` |
| `kill_switches.scanner_enabled` | `true` |
| `kill_switches.alert_sending_enabled` | `true` |
| `kill_switches.degraded_mode_force` | `false` |
| `endpoint_circuit_breakers.state` | `"closed"` (all rows) |
| heartbeat `fetched_at` age | < 10 minutes |

---

## 2. How to Check Scanner Status

### Health endpoint response fields

```jsonc
{
  "status": "healthy",          // healthy | slowed | degraded | warning | offline
  "message": "...",             // human-readable detail
  "heartbeat": {
    "last_beat": "<iso>",       // when check-permits last completed a cycle
    "error_count": 0,           // workers that failed in the last cycle
    "all_workers_failed": false // true = every worker errored last cycle
  },
  "circuit_breakers_tripped": 0,  // per-permit rows with error_count >= 3
  "schema_drift_tripped": 0,      // subset of above with REC_GOV_SCHEMA_DRIFT
  "slowed_endpoints": [],         // open endpoint circuits or global backoff
  "zero_finds_warning": false,    // no recent_finds in 24h despite active watches
  "kill_switches": {
    "scanner_enabled": true,
    "alert_sending_enabled": true,
    "degraded_mode_force": false
  }
}
```

**Status priority:** `offline > degraded > slowed > warning > healthy`

| Status | Meaning |
|---|---|
| `healthy` | All systems normal |
| `slowed` | Rate-limit backoff active; scanning paused temporarily, will self-recover |
| `degraded` | Scanner running but permit checks failing, or circuit breakers tripped |
| `warning` | Scanner healthy but zero finds in 24h — may be normal or may signal silent failure |
| `offline` | No heartbeat, or heartbeat > 10 min old — scanner has stopped |

### SQL to inspect kill switches

```sql
SELECT cache_key,
       available,
       fetched_at AS last_changed
FROM permit_cache
WHERE cache_key LIKE '__flag_%'
ORDER BY cache_key;
```

Absent row = flag is at its default (scanner_enabled defaults true, alert_sending_enabled defaults true, degraded_mode_force defaults false).

---

## 3. Symptom Guide

### Rate limiting / 429s

**Symptoms:**
- `status: "slowed"` with `slowed_endpoints` listing affected endpoint(s)
- OR `status: "degraded"` if slowed + zero finds together
- `endpoint_circuit_breakers.state = 'open'` for `permits`, `permitinyo`, or `permititinerary`
- OR `permit_cache.__global_rate_limit__` row has `error_count > 0`
- Admin alert email: "Circuit Breaker(s) Tripped" with `HTTP 429`

**Likely cause:** Recreation.gov is rate-limiting WildAtlas. Endpoint circuit self-recovers after cooldown (default 10 min). Global rate-limit backoff also 10 min.

**First action:**
1. Check if `slowed_endpoints` shows a cooldown timestamp — if it's in the next few minutes, **wait it out**. Do not manually reset circuits.
2. If 429s are persistent across multiple cooldown cycles, suppress alerts and pause scanner to reduce load:
   ```sql
   -- Suppress alerts first
   INSERT INTO permit_cache (cache_key, recgov_id, api_type, available, available_dates, fetched_at, stale_at, expires_at)
   VALUES ('__flag_alert_sending_enabled__', 'config', 'config', false, '{}', now(), now() + interval '1 year', now() + interval '1 year')
   ON CONFLICT (cache_key) DO UPDATE SET available = false, fetched_at = now();
   -- Then pause scanner
   INSERT INTO permit_cache (cache_key, recgov_id, api_type, available, available_dates, fetched_at, stale_at, expires_at)
   VALUES ('__flag_scanner_enabled__', 'config', 'config', false, '{}', now(), now() + interval '1 year', now() + interval '1 year')
   ON CONFLICT (cache_key) DO UPDATE SET available = false, fetched_at = now();
   ```

---

### Schema drift (REC_GOV_SCHEMA_DRIFT)

**Symptoms:**
- `schema_drift_tripped > 0` in health response
- `status: "degraded"`
- Admin alert email: "Schema Drift: N Permit Parser(s) Broken"
- `permit_cache.last_error` contains `REC_GOV_SCHEMA_DRIFT [permits/...]: <field issues>`
- Specific permits circuit-broken with `error_count >= 3`

**Likely cause:** Recreation.gov changed their API response structure for one or more endpoint families (`permits`, `permitinyo`, or `permititinerary`). The validation added to `check-single-permit` detected the change before silent false-negatives occurred. **This will NOT self-recover** — it requires a parser code fix.

**First action:**
1. Identify affected permits:
   ```sql
   SELECT cache_key, last_error, fetched_at
   FROM permit_cache
   WHERE last_error LIKE '%REC_GOV_SCHEMA_DRIFT%'
   ORDER BY fetched_at DESC;
   ```
2. Suppress alerts immediately — affected users will not get stale alerts while parser is broken:
   ```sql
   INSERT INTO permit_cache (cache_key, recgov_id, api_type, available, available_dates, fetched_at, stale_at, expires_at)
   VALUES ('__flag_alert_sending_enabled__', 'config', 'config', false, '{}', now(), now() + interval '1 year', now() + interval '1 year')
   ON CONFLICT (cache_key) DO UPDATE SET available = false, fetched_at = now();
   ```
3. Fix the affected parser(s) in `check-single-permit/index.ts` — look at the `validateStandardResponse` / `validateInyoResponse` / `validateItineraryContentResponse` / `validateItineraryAvailabilityResponse` functions.
4. Deploy the fix, reset the tripped circuit breakers:
   ```sql
   UPDATE permit_cache SET error_count = 0, last_error = null WHERE cache_key = '<park_id>:<permit_name>';
   ```
5. Re-enable alerts and verify finds are detected.

---

### Scanner heartbeat stale / offline

**Symptoms:**
- `status: "offline"`
- `heartbeat.last_beat` is null, or age > 10 minutes
- Admin alert email: "Scanner Offline"

**Likely cause:** The `check-permits` cron job stopped running. Could be Supabase cron misconfiguration, edge function deployment failure, or an unhandled exception in the orchestrator.

**First action:**
1. Check last heartbeat age:
   ```sql
   SELECT fetched_at, error_count, last_error, available,
          now() - fetched_at AS age
   FROM permit_cache
   WHERE cache_key = '__scanner_heartbeat__';
   ```
2. Check if the `scanner_enabled` kill switch was accidentally left off:
   ```sql
   SELECT available, fetched_at FROM permit_cache WHERE cache_key = '__flag_scanner_enabled__';
   ```
   If `available = false`, re-enable it (see Section 4).
3. If kill switch is fine, check Supabase cron schedule — confirm `check-permits` is firing.
4. If cron is running but heartbeat is still stale, check Supabase edge function logs for the orchestrator crash.
5. Do **not** mark watchers as alerted or clear the notification queue manually.

---

### CAPTCHA / anti-bot suspected

**Symptoms:**
- `status: "degraded"` with `HTTP 403` or `HTTP 503` in `last_error`
- Circuit breakers trip on `permits` or `permititinerary` with non-429 status codes
- Per-permit `error_count >= 3` with status codes 403/503/redirects

**Likely cause:** Recreation.gov is actively blocking automated requests. Not a code bug.

**First action:**
1. Suppress alerts and pause scanner immediately to avoid worsening the block:
   ```sql
   INSERT INTO permit_cache (cache_key, recgov_id, api_type, available, available_dates, fetched_at, stale_at, expires_at)
   VALUES ('__flag_alert_sending_enabled__', 'config', 'config', false, '{}', now(), now() + interval '1 year', now() + interval '1 year')
   ON CONFLICT (cache_key) DO UPDATE SET available = false, fetched_at = now();
   INSERT INTO permit_cache (cache_key, recgov_id, api_type, available, available_dates, fetched_at, stale_at, expires_at)
   VALUES ('__flag_scanner_enabled__', 'config', 'config', false, '{}', now(), now() + interval '1 year', now() + interval '1 year')
   ON CONFLICT (cache_key) DO UPDATE SET available = false, fetched_at = now();
   ```
2. Wait several hours before attempting to resume.
3. Consider requesting Recreation.gov API access or reviewing request rate and User-Agent headers.

---

### Zero finds anomaly

**Symptoms:**
- `zero_finds_warning: true` in health response
- `status: "warning"` (or `"degraded"` if also slowed)
- Admin alert email: "Zero Permit Finds in 24h"
- Scanner heartbeat is fresh, circuit breakers not tripped

**Likely cause:** Three possibilities — (a) all permits genuinely unavailable (normal during off-season), (b) silent parser regression not caught by schema drift validators, (c) `recent_finds` cleanup running too aggressively.

**First action:**
1. Check recent_finds directly:
   ```sql
   SELECT COUNT(*), MAX(found_at) FROM recent_finds
   WHERE found_at > now() - interval '48 hours';
   ```
2. Check active watcher count:
   ```sql
   SELECT COUNT(*) FROM user_watchers WHERE is_active = true;
   ```
3. Manually verify one permit is reachable by reviewing `permit_cache` for a known permit:
   ```sql
   SELECT cache_key, available, available_dates, fetched_at, error_count, last_error
   FROM permit_cache
   WHERE cache_key NOT LIKE '__%__'
   ORDER BY fetched_at DESC LIMIT 10;
   ```
4. If permits show `available = false` with no errors and no drift, the zero-finds is likely genuine — no action needed.

---

## 4. Kill Switch Reference

All flags stored in `permit_cache`. Absent row = default behavior. The `recgov_id`, `api_type`, `stale_at`, and `expires_at` values in the INSERT are required by schema but semantically irrelevant for flag rows.

### Pause scanning

```sql
INSERT INTO permit_cache (cache_key, recgov_id, api_type, available, available_dates, fetched_at, stale_at, expires_at)
VALUES ('__flag_scanner_enabled__', 'config', 'config', false, '{}', now(), now() + interval '1 year', now() + interval '1 year')
ON CONFLICT (cache_key) DO UPDATE SET available = false, fetched_at = now();
```

### Resume scanning

```sql
UPDATE permit_cache SET available = true, fetched_at = now()
WHERE cache_key = '__flag_scanner_enabled__';
```

### Suppress alerts (fan-out + retry both blocked)

```sql
INSERT INTO permit_cache (cache_key, recgov_id, api_type, available, available_dates, fetched_at, stale_at, expires_at)
VALUES ('__flag_alert_sending_enabled__', 'config', 'config', false, '{}', now(), now() + interval '1 year', now() + interval '1 year')
ON CONFLICT (cache_key) DO UPDATE SET available = false, fetched_at = now();
```

### Resume alerts

```sql
UPDATE permit_cache SET available = true, fetched_at = now()
WHERE cache_key = '__flag_alert_sending_enabled__';
```

### Force degraded status (health reporting only — does not affect scanning or alerts)

```sql
INSERT INTO permit_cache (cache_key, recgov_id, api_type, available, available_dates, fetched_at, stale_at, expires_at)
VALUES ('__flag_degraded_mode_force__', 'config', 'config', true, '{}', now(), now() + interval '1 year', now() + interval '1 year')
ON CONFLICT (cache_key) DO UPDATE SET available = true, fetched_at = now();
```

### Clear forced degraded status

```sql
UPDATE permit_cache SET available = false, fetched_at = now()
WHERE cache_key = '__flag_degraded_mode_force__';
```

### Read all flag state at once

```sql
SELECT cache_key, available, fetched_at AS last_changed
FROM permit_cache
WHERE cache_key LIKE '__flag_%'
ORDER BY cache_key;
```

---

## 5. Log Inspection

All logs are in Supabase Dashboard → Edge Functions → select function → Logs tab. Use these search strings.

### Schema drift detected

```
REC_GOV_SCHEMA_DRIFT
```
Look for: `🚨 REC_GOV_SCHEMA_DRIFT [permits/...]: missing field ...`
Function: `check-single-permit`

### Rate limit / 429 events

```
429
```
Look for: `🛑 Worker reported 429` or `record_endpoint_429`
Function: `check-permits` (orchestrator) and `check-single-permit`

### Circuit breaker tripped (endpoint level)

```
circuit open
```
Look for: `endpoint circuit open` or `cooldownUntil`
Function: `check-single-permit`

### Circuit breaker tripped (global)

```
Global rate-limit circuit breaker OPEN
```
Function: `check-permits`

### Kill switch activated

```
[KILL SWITCH]
```
Look for: `🛑 [KILL SWITCH] scanner_enabled=false` or `alert_sending_enabled=false`
Functions: `check-permits`, `fan-out-notifications`, `retry-notifications`

### Operator degraded override active

```
[KILL SWITCH] degraded_mode_force
```
Function: `scanner-health-check`

### All-workers-failed cycle

```
all workers failed
```
Look for heartbeat payload with `available: false` and `last_status_code: 500`
Function: `check-permits`

---

## 6. Operator Safety Rules

### Do NOT:
- ❌ Manually delete `notification_queue` rows during an incident — this loses the send backlog permanently
- ❌ Manually reset `error_count` on many `permit_cache` rows at once without knowing why they tripped
- ❌ Pause the scanner without suppressing alerts first (alerts could fire from queued items while scanner is off)
- ❌ Mark queue items as `"sent"` manually — this breaks dedup state and may prevent legitimate future alerts
- ❌ Delete `notification_log` rows with `status = 'claimed'` — use the stale-recovery sweep instead (runs automatically in fan-out)
- ❌ Redeploy edge functions mid-incident to change scanner behavior — use kill switches instead

### Correct flag sequence during an incident

```
1. SUPPRESS ALERTS first    → __flag_alert_sending_enabled__ = false
   (prevents bad data reaching users while you investigate)

2. INVESTIGATE               → read health endpoint, query permit_cache, check logs

3. PAUSE SCANNER if needed  → __flag_scanner_enabled__ = false
   (only if upstream load is harmful, e.g. CAPTCHA block or persistent 429s)

4. FIX the root cause       → parser fix, wait out rate limit, etc.

5. RESUME SCANNER           → __flag_scanner_enabled__ = true

6. RE-ENABLE ALERTS         → __flag_alert_sending_enabled__ = true
   (backlog drains automatically — see below)

7. VERIFY recovery          → check health endpoint, confirm status = "healthy"
```

### Alert backlog on re-enable

When `alert_sending_enabled` is re-enabled, the `notification_queue` backlog drains on the next fan-out cron tick (up to 100 items per run). Items that had genuine permit availability remain valid and will send. Items where availability has since closed will still send — users may receive an alert for a slot that is no longer available. This is by design; no manual cleanup is needed.

Retry backlog (`notification_log` rows with `status = 'failed'`) also resumes on the next `retry-notifications` cron tick (up to 20 per run, exponential backoff: 2m / 8m / 32m).

---

## 7. User-Facing Messaging

Use these templates if you need to communicate an incident via email, status page, or in-app notice.

### Degraded monitoring

> We're currently experiencing degraded permit monitoring for some national parks due to changes on Recreation.gov's end. Your watches are active, and we'll notify you as soon as we restore full scanning. No action needed on your part.

### Scanner offline

> Permit scanning is temporarily paused while we investigate an issue with Recreation.gov's API. Your watch settings are saved. We'll resume monitoring and send alerts as soon as the system is back online.

---

## 8. Recovery Checklist

Run through these in order after the incident resolves.

- [ ] **Re-enable scanner** if it was paused: `UPDATE permit_cache SET available = true, fetched_at = now() WHERE cache_key = '__flag_scanner_enabled__'`
- [ ] **Re-enable alerts** if suppressed: `UPDATE permit_cache SET available = true, fetched_at = now() WHERE cache_key = '__flag_alert_sending_enabled__'`
- [ ] **Clear degraded_mode_force** if it was set: `UPDATE permit_cache SET available = false, fetched_at = now() WHERE cache_key = '__flag_degraded_mode_force__'`
- [ ] **Health endpoint returns `status: "healthy"`** — wait one full scan cycle (up to 5 min for Pro users) then re-check
- [ ] **Heartbeat is fresh** — `heartbeat.last_beat` age < 5 minutes, `error_count = 0`
- [ ] **No open endpoint circuits** — `SELECT * FROM endpoint_circuit_breakers WHERE state = 'open'` returns 0 rows
- [ ] **No tripped per-permit circuits** — `SELECT COUNT(*) FROM permit_cache WHERE error_count >= 3 AND cache_key NOT LIKE '__%__'` returns 0
- [ ] **Zero-finds warning cleared** — `zero_finds_warning: false` in health response, OR confirmed that zero-finds is genuine (off-season)
- [ ] **Notification backlog draining** — `SELECT COUNT(*) FROM notification_queue WHERE status = 'pending'` decreasing over successive cron ticks
- [ ] **No dead-letter alerts** — no admin emails "Dead Letter: Notification Failed" arriving after recovery
- [ ] **Schema drift circuits reset** if a parser was fixed — manually reset `error_count = 0` for affected `permit_cache` rows
