-- ScoutApoya: permanent transition to genuine causes only.
-- Preserve historical tables and records for retention/audit purposes.
-- All former prize/draw entry points are disabled for anonymous and authenticated clients.
DO $$
DECLARE fn record;
BEGIN
 FOR fn IN
  SELECT n.nspname AS schema_name,p.proname AS function_name,
         pg_get_function_identity_arguments(p.oid) AS arguments
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname IN ('public','private')
    AND (
      p.proname LIKE 'chn_%draw%'
      OR p.proname LIKE 'chn_%ticket%'
      OR p.proname LIKE 'chn_%raffle%'
      OR p.proname LIKE 'chn_%bid%'
      OR p.proname IN ('chn_review_listing','chn_review_listing_impl','chn_finish_listing',
        'chn_finish_listing_impl','chn_join_raffle','chn_join_raffle_impl',
        'chn_place_bid','chn_place_bid_impl',
        'chn_create_raffle_with_plan','chn_create_raffle_with_plan_impl')
    )
 LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %I.%I(%s) FROM PUBLIC,anon,authenticated',
   fn.schema_name,fn.function_name,fn.arguments);
 END LOOP;
END $$;

DO $$
DECLARE table_name text;
BEGIN
 FOREACH table_name IN ARRAY ARRAY[
  'chn_listings','chn_bids','chn_draw_audit','chn_raffle_entries',
  'chn_raffle_financials','chn_free_draw_entries','chn_free_draw_results',
  'chn_ticket_numbers','chn_ticket_orders'
 ] LOOP
  IF to_regclass('public.'||table_name) IS NOT NULL THEN
   EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC,anon,authenticated',table_name);
  END IF;
 END LOOP;
END $$;

DROP POLICY IF EXISTS "CHN only verified members access listing photos" ON storage.objects;
DROP POLICY IF EXISTS "CHN verified access approved cause photos" ON storage.objects;
DROP POLICY IF EXISTS "CHN cause photos for approved members or owner" ON storage.objects;
CREATE POLICY "CHN cause photos for approved members or owner"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id='chn-listings'
  AND (SELECT private.chn_is_verified())
  AND (
    ((storage.foldername(name))[1]=(SELECT auth.uid())::text)
    OR EXISTS(
      SELECT 1 FROM public.chn_causes c
      WHERE name=ANY(c.image_paths)
        AND (c.status IN ('active','finished') OR c.owner_id=(SELECT auth.uid())
          OR (SELECT private.chn_is_admin()))
    )
  )
);

COMMENT ON TABLE public.chn_causes IS
'Active community causes. Fixed amount per support intention; no prize, draw, award or chance-based entry.';
COMMENT ON TABLE public.chn_support_pledges IS
'Support intentions only: unique acknowledgment number does not prove payment or grant benefit.';
