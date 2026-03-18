/**
 * Shared notification send-slot claim helper.
 *
 * Both fan-out-notifications and retry-notifications MUST gate every send
 * through claimSendSlot so that the partial unique index
 *
 *   idx_notification_log_claim_dedup
 *   ON notification_log (user_id, event_fingerprint, channel)
 *   WHERE status IN ('claimed', 'sent') AND event_fingerprint IS NOT NULL
 *
 * closes the race between the two code paths.
 *
 * fan-out path  — claimSendSlot with fields from the notification_queue row.
 * retry path    — claimSendSlot with fields from the notification_log row,
 *                 passing entry.event_fingerprint directly so no recomputation
 *                 occurs and fingerprint identity is preserved.
 *
 * Both paths INSERT a new notification_log row with status='claimed' and a
 * fresh created_at.  The fresh timestamp keeps the new row outside the
 * fan-out stale-claimed-row sweep window (5 min based on created_at), which
 * would otherwise force-fail a retry-owned claim that was made against an
 * older original row.
 */

export interface ClaimFields {
  queueId: string | null;   // nullable: pre-20260312000007 rows have no queue_id
  watchId: string;
  userId: string;
  parkId: string;
  permitName: string;
  availableDates: string[];
}

export interface ClaimResult {
  /** 23505: another worker already claimed or sent — caller must skip the send. */
  alreadySent: boolean;
  /** Transient DB error: state unknown — caller must leave the row untouched
   *  for the next retry cycle.  Does NOT mean the notification was sent. */
  claimError: boolean;
  /** Present only when alreadySent=false and claimError=false.
   *  The id of the newly inserted 'claimed' row; caller must update it to
   *  'sent' or 'failed' after the send attempt completes. */
  logId?: string;
}

/**
 * Atomically claims a send slot for (user_id, event_fingerprint, channel).
 *
 * Inserts a notification_log row with status='claimed'.  The partial unique
 * index fires on this INSERT if another worker already holds the slot,
 * returning 23505 → { alreadySent: true }.
 *
 * eventFingerprint may be null for notification_log rows created before
 * migration 20260312000008.  When null, the unique index does not apply
 * (index predicate requires event_fingerprint IS NOT NULL), so no dedup
 * protection is provided — acceptable for pre-migration rows that predate
 * the dedup system.
 */
export async function claimSendSlot(
  supabase: any,
  fields: ClaimFields,
  eventFingerprint: string | null,
  channel: string,
  latencySeconds: number,
): Promise<ClaimResult> {
  const { data, error } = await supabase
    .from("notification_log")
    .insert({
      queue_id: fields.queueId,
      event_fingerprint: eventFingerprint,
      watch_id: fields.watchId,
      user_id: fields.userId,
      channel,
      status: "claimed",
      permit_name: fields.permitName,
      park_id: fields.parkId,
      available_dates: fields.availableDates,
      location_name: fields.parkId,
      latency_seconds: latencySeconds,
    })
    .select("id")
    .single();

  if (error?.code === "23505") {
    return { alreadySent: true, claimError: false };
  }
  if (error) {
    // Transient failure — state is unknown.  Do NOT map this to alreadySent.
    // The caller must leave the source row untouched so the next retry cycle
    // can attempt the claim again.
    console.error(
      `claimSendSlot: DB error claiming ${channel} slot` +
      ` fingerprint=${eventFingerprint} user=${fields.userId}: ${error.message}`,
    );
    return { alreadySent: false, claimError: true };
  }

  return { alreadySent: false, claimError: false, logId: data.id };
}
