CREATE OR REPLACE FUNCTION public.claim_notification_queue_batch(p_batch_size integer DEFAULT 100)
RETURNS SETOF notification_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH claimable AS (
    SELECT id
    FROM public.notification_queue
    WHERE status = 'pending'
       OR (status = 'processing' AND created_at < now() - interval '5 minutes')
    ORDER BY created_at ASC
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.notification_queue q
  SET status = 'processing'
  FROM claimable c
  WHERE q.id = c.id
  RETURNING q.*;
END;
$$;