-- ScoutApoya: two denominations for INTENTIONS only. No payment settlement, FX, or banking details.
ALTER TABLE public.chn_causes
 ADD COLUMN fixed_support_amount_usd integer,
 ADD COLUMN target_amount_usd integer NOT NULL DEFAULT 0,
 ADD COLUMN intention_total_usd bigint NOT NULL DEFAULT 0;
ALTER TABLE public.chn_causes
 ADD CONSTRAINT chn_usd_cause_amount_valid CHECK (fixed_support_amount_usd IS NULL OR fixed_support_amount_usd BETWEEN 1 AND 100000),
 ADD CONSTRAINT chn_usd_cause_target_valid CHECK (target_amount_usd BETWEEN 0 AND 100000000),
 ADD CONSTRAINT chn_usd_cause_total_valid CHECK (intention_total_usd >= 0);
ALTER TABLE public.chn_support_pledges
 ADD COLUMN currency_code text NOT NULL DEFAULT 'MXN'
 CONSTRAINT chn_support_currency_valid CHECK (currency_code IN ('MXN','USD'));

-- Existing causes remain MXN-only until a new cause has its USD denomination configured.
CREATE FUNCTION private.chn_create_cause_v3_impl(
 p_title text,p_description text,p_category text,p_end_at timestamptz,
 p_amount_mxn integer,p_amount_usd integer,p_target_mxn integer,p_target_usd integer,
 p_limit integer,p_images text[]
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result uuid;
        prefix text := (SELECT auth.uid())::text || '/listings/';
BEGIN
 IF (SELECT auth.uid()) IS NULL OR NOT private.chn_can_publish() THEN
  RAISE EXCEPTION 'Solo organizadores aprobados pueden proponer causas.';
 END IF;
 IF p_title IS NULL OR length(trim(p_title)) NOT BETWEEN 5 AND 110
 OR p_description IS NULL OR length(trim(p_description)) NOT BETWEEN 20 AND 2500 THEN
  RAISE EXCEPTION 'Revisa el título y la descripción.';
 END IF;
 IF p_end_at IS NULL OR p_end_at<=now()+interval '1 hour' THEN
  RAISE EXCEPTION 'El cierre debe estar en el futuro.';
 END IF;
 IF p_images IS NULL OR cardinality(p_images) NOT BETWEEN 1 AND 10
  OR EXISTS (SELECT 1 FROM unnest(p_images) path WHERE path IS NULL
  OR left(path,length(prefix))<>prefix OR path !~* '\.(jpg|jpeg|png|webp)$') THEN
  RAISE EXCEPTION 'Agrega de 1 a 10 fotos propias.';
 END IF;
 IF p_amount_mxn IS NULL OR p_amount_mxn NOT BETWEEN 20 AND 100000
 OR p_amount_usd IS NULL OR p_amount_usd NOT BETWEEN 1 AND 100000 THEN
  RAISE EXCEPTION 'Revisa los importes en MXN y USD.';
 END IF;
 IF p_target_mxn IS NULL OR p_target_mxn NOT BETWEEN 0 AND 100000000
 OR p_target_usd IS NULL OR p_target_usd NOT BETWEEN 0 AND 100000000 THEN
  RAISE EXCEPTION 'Revisa las metas por moneda.';
 END IF;
 IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100000 THEN
  RAISE EXCEPTION 'Revisa el límite de intenciones.';
 END IF;
 INSERT INTO public.chn_causes(
  owner_id,title,description,category,end_at,fixed_support_amount,
  fixed_support_amount_usd,target_amount,target_amount_usd,max_intentions,image_paths
 ) VALUES((SELECT auth.uid()),trim(p_title),trim(p_description),p_category,p_end_at,
  p_amount_mxn,p_amount_usd,p_target_mxn,p_target_usd,p_limit,p_images)
 RETURNING id INTO result;
 RETURN result;
END $$;
CREATE FUNCTION public.chn_create_cause_v3(
 p_title text,p_description text,p_category text,p_end_at timestamptz,
 p_amount_mxn integer,p_amount_usd integer,p_target_mxn integer,p_target_usd integer,
 p_limit integer,p_images text[]
) RETURNS uuid LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 SELECT private.chn_create_cause_v3_impl(p_title,p_description,p_category,p_end_at,
  p_amount_mxn,p_amount_usd,p_target_mxn,p_target_usd,p_limit,p_images);
$$;

CREATE FUNCTION private.chn_submit_cause_intent_v3_impl(
 p_cause uuid,p_recipient uuid,p_currency text,p_note text DEFAULT ''
) RETURNS TABLE(
 intent_id uuid,ack_no bigint,amount_value integer,currency_code text,
 cause_title text,issued_at timestamptz,intent_status text,recipient_id uuid,recipient_name text
) LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE item public.chn_causes%rowtype;
        entry public.chn_support_pledges%rowtype;
        dest public.chn_profiles%rowtype;
        selected_amount integer;
BEGIN
 IF (SELECT auth.uid()) IS NULL OR NOT private.chn_is_verified() THEN
  RAISE EXCEPTION 'Necesitas una cuenta aprobada.';
 END IF;
 IF p_currency IS NULL OR p_currency NOT IN ('MXN','USD') THEN
  RAISE EXCEPTION 'Moneda no compatible.';
 END IF;
 SELECT * INTO item FROM public.chn_causes
 WHERE id=p_cause AND status='active' AND end_at>now() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Esta causa no está disponible.'; END IF;
 IF item.intention_count>=item.max_intentions THEN
  RAISE EXCEPTION 'La causa alcanzó el límite de intenciones.';
 END IF;
 selected_amount:=CASE WHEN p_currency='USD' THEN item.fixed_support_amount_usd ELSE item.fixed_support_amount END;
 IF selected_amount IS NULL OR selected_amount<=0 THEN
  RAISE EXCEPTION 'Esta causa aún no ofrece la moneda seleccionada.';
 END IF;
 IF p_recipient IS NULL THEN RAISE EXCEPTION 'Selecciona una cuenta destinataria.'; END IF;
 SELECT * INTO dest FROM public.chn_profiles p WHERE p.id=p_recipient AND p.verified
  AND ((p.member_type='scout' AND p.scout_id ~ '^CHN-?[A-Z0-9]{4,12}$')
    OR (p.member_type='supporter' AND p.scout_id IS NULL AND p.adult_attested));
 IF NOT FOUND THEN RAISE EXCEPTION 'La cuenta destinataria no está aprobada.'; END IF;
 IF length(coalesce(p_note,''))>240 THEN RAISE EXCEPTION 'Mensaje demasiado largo.'; END IF;
 INSERT INTO public.chn_support_pledges(
  user_id,amount,currency_code,purpose,note,cause_id,status,recipient_id,recipient_name)
 VALUES((SELECT auth.uid()),selected_amount,p_currency,'General',
  trim(coalesce(p_note,'')),item.id,'pending',dest.id,dest.display_name)
 RETURNING * INTO entry;
 UPDATE public.chn_causes SET intention_count=intention_count+1,
  intention_total=intention_total+(CASE WHEN p_currency='MXN' THEN selected_amount ELSE 0 END),
  intention_total_usd=intention_total_usd+(CASE WHEN p_currency='USD' THEN selected_amount ELSE 0 END)
 WHERE id=item.id;
 RETURN QUERY SELECT entry.id,entry.acknowledgment_no,entry.amount,entry.currency_code,
  item.title,entry.created_at,entry.status,dest.id,dest.display_name;
END $$;
CREATE FUNCTION public.chn_submit_cause_intent_v3(
 p_cause uuid,p_recipient uuid,p_currency text,p_note text DEFAULT ''
) RETURNS TABLE(
 intent_id uuid,ack_no bigint,amount_value integer,currency_code text,
 cause_title text,issued_at timestamptz,intent_status text,recipient_id uuid,recipient_name text
) LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 SELECT * FROM private.chn_submit_cause_intent_v3_impl(p_cause,p_recipient,p_currency,p_note);
$$;

-- Same admin-only review, now applies rejection to the matching denomination.
CREATE OR REPLACE FUNCTION private.chn_review_cause_intent_impl(p_intent uuid,p_approve boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE entry public.chn_support_pledges%rowtype;
BEGIN
 IF (SELECT auth.uid()) IS NULL OR NOT private.chn_is_admin() THEN
  RAISE EXCEPTION 'Solo el administrador puede aprobar intenciones.';
 END IF;
 IF p_approve IS NULL THEN RAISE EXCEPTION 'Selecciona aprobar o rechazar.'; END IF;
 SELECT * INTO entry FROM public.chn_support_pledges
 WHERE id=p_intent AND cause_id IS NOT NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Intención inexistente.'; END IF;
 IF entry.status<>'pending' THEN RAISE EXCEPTION 'Esta intención ya fue revisada.'; END IF;
 UPDATE public.chn_support_pledges
 SET status=CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
  reviewed_at=now(),reviewed_by=(SELECT auth.uid())
 WHERE id=p_intent;
 IF NOT p_approve THEN
  UPDATE public.chn_causes
   SET intention_count=intention_count-1,
       intention_total=intention_total-(CASE WHEN entry.currency_code='MXN' THEN entry.amount ELSE 0 END),
       intention_total_usd=intention_total_usd-(CASE WHEN entry.currency_code='USD' THEN entry.amount ELSE 0 END)
  WHERE id=entry.cause_id;
 END IF;
END $$;

REVOKE ALL ON FUNCTION
 private.chn_create_cause_v3_impl(text,text,text,timestamptz,integer,integer,integer,integer,integer,text[]),
 public.chn_create_cause_v3(text,text,text,timestamptz,integer,integer,integer,integer,integer,text[]),
 private.chn_submit_cause_intent_v3_impl(uuid,uuid,text,text),
 public.chn_submit_cause_intent_v3(uuid,uuid,text,text)
 FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION
 public.chn_create_cause_v3(text,text,text,timestamptz,integer,integer,integer,integer,integer,text[]),
 public.chn_submit_cause_intent_v3(uuid,uuid,text,text)
 TO authenticated;
COMMENT ON COLUMN public.chn_support_pledges.currency_code IS
 'User-chosen denomination of recorded support INTENT only. No funds transferred or verified.';
