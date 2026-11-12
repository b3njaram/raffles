-- Validate the denomination using its own minimum, not the old MXN-only floor.
ALTER TABLE public.chn_support_pledges
 DROP CONSTRAINT chn_support_pledges_amount_check,
 ADD CONSTRAINT chn_support_pledges_amount_check
 CHECK (
  (currency_code='MXN' AND amount BETWEEN 20 AND 100000)
  OR (currency_code='USD' AND amount BETWEEN 1 AND 100000)
 );
