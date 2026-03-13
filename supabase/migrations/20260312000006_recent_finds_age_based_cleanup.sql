-- Switch recent_finds cleanup from a count-based cap (100 rows globally) to an
-- age-based policy (delete rows older than 2 days).
--
-- Motivation: the 100-row count cap can prune same-day fingerprints under
-- moderate activity. Once pruned, the UNIQUE constraint on event_fingerprint no
-- longer blocks re-insertion of the same parkId:permitName:today key, allowing
-- duplicate notifications to be sent within the same calendar day.
--
-- The fingerprint format is ${parkId}:${permitName}:${YYYY-MM-DD} (UTC).
-- Keeping rows for 2 days guarantees that any fingerprint inserted on day D
-- survives past UTC midnight and cannot be re-used on day D+1 (which would
-- carry a different date component anyway). The 2-day buffer also covers
-- edge cases near UTC midnight where a single scan spans day boundaries.

CREATE OR REPLACE FUNCTION public.cleanup_recent_finds()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $function$
BEGIN
  DELETE FROM public.recent_finds
  WHERE found_at < now() - interval '2 days';
  RETURN NEW;
END;
$function$;
