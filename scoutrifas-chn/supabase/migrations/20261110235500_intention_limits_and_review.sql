-- ScoutApoya Grupo 4 · limited non-payment support intentions with unique acknowledgments.
-- All recipient references are member accounts in this application; never bank accounts.
-- Administrative approval denotes approval of the intention RECORD, not proof of funds.
alter table public.chn_causes
 add column max_intentions integer not null default 100;
alter table public.chn_causes
 add constraint chn_causes_intention_limit_valid
 check (max_intentions between 1 and 100000 and intention_count <= max_intentions);

alter table public.chn_support_pledges
 drop constraint chn_support_pledges_status_check;
alter table public.chn_support_pledges
 add constraint chn_support_pledges_status_check
 check (status in ('intent','pending','approved','rejected'));
alter table public.chn_support_pledges
 add column recipient_id uuid references public.chn_profiles(id) on delete restrict,
 add column recipient_name text,
 add column reviewed_at timestamptz,
 add column reviewed_by uuid references public.chn_profiles(id) on delete restrict;

create index chn_support_pending_review_idx
 on public.chn_support_pledges(status,created_at)
 where status='pending';
create index chn_support_recipient_idx
 on public.chn_support_pledges(recipient_id,created_at desc);

-- The existing app's old entrypoints are retired after the frontend switches to v2.
revoke all on function public.chn_create_cause(text,text,text,timestamptz,integer,integer,text[]),
 private.chn_create_cause_impl(text,text,text,timestamptz,integer,integer,text[]),
 public.chn_register_cause_intent(uuid,text),
 private.chn_register_cause_intent_impl(uuid,text),
 public.chn_submit_support_intent(integer,text,text),
 private.chn_submit_support_intent_impl(integer,text,text)
 from public,anon,authenticated;

create function private.chn_create_cause_v2_impl(
 p_title text,p_description text,p_category text,p_end_at timestamptz,
 p_amount integer,p_target integer,p_limit integer,p_images text[]
) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid; prefix text := (select auth.uid())::text || '/listings/';
begin
 if (select auth.uid()) is null or not private.chn_can_publish() then
  raise exception 'Únicamente organizadores aprobados pueden proponer causas.';
 end if;
 if p_end_at is null or p_end_at<=now()+interval '1 hour' then
  raise exception 'La fecha de cierre debe estar en el futuro.';
 end if;
 if p_images is null or cardinality(p_images) not between 1 and 10
   or exists (select 1 from unnest(p_images) path where path is null
   or left(path,length(prefix))<>prefix or path !~* '\.(jpg|jpeg|png|webp)$')
 then raise exception 'Agrega entre 1 y 10 fotografías propias.'; end if;
 if p_amount is null or p_amount not between 20 and 100000 then
  raise exception 'Monto por intención fuera de rango.';
 end if;
 if p_target is null or p_target not between 0 and 100000000 then
  raise exception 'Meta económica fuera de rango.';
 end if;
 if p_limit is null or p_limit not between 1 and 100000 then
  raise exception 'El límite de intenciones debe estar entre 1 y 100,000.';
 end if;
 insert into public.chn_causes(
  owner_id,title,description,category,end_at,fixed_support_amount,
  target_amount,max_intentions,image_paths)
 values((select auth.uid()),trim(p_title),trim(p_description),p_category,
  p_end_at,p_amount,p_target,p_limit,p_images)
 returning id into result;
 return result;
end $$;
create function public.chn_create_cause_v2(
 p_title text,p_description text,p_category text,p_end_at timestamptz,
 p_amount integer,p_target integer,p_limit integer,p_images text[]
) returns uuid language sql security definer set search_path='' as $$
 select private.chn_create_cause_v2_impl(
  p_title,p_description,p_category,p_end_at,p_amount,p_target,p_limit,p_images);
$$;

create function private.chn_cause_recipients_impl()
returns table(id uuid,display_name text,role text)
language plpgsql stable security definer set search_path='' as $$
begin
 if (select auth.uid()) is null or not private.chn_is_verified() then
  raise exception 'Solo miembros aprobados pueden consultar destinatarios.';
 end if;
 return query select p.id,p.display_name,p.role from public.chn_profiles p
 where p.verified
  and ((p.member_type='scout' and p.scout_id ~ '^CHN-?[A-Z0-9]{4,12}$')
   or (p.member_type='supporter' and p.scout_id is null and p.adult_attested))
 order by case when p.role='admin' then 0 else 1 end,p.display_name,p.id
 limit 500;
end $$;
create function public.chn_cause_recipients()
returns table(id uuid,display_name text,role text)
language sql security definer set search_path='' as $$
 select * from private.chn_cause_recipients_impl();
$$;

create function private.chn_submit_cause_intent_v2_impl(
 p_cause uuid,p_recipient uuid,p_note text default ''
)
returns table(
 intent_id uuid,ack_no bigint,amount_mxn integer,cause_title text,
 issued_at timestamptz,intent_status text,recipient_id uuid,recipient_name text
)
language plpgsql security definer set search_path='' as $$
declare item public.chn_causes%rowtype;
        entry public.chn_support_pledges%rowtype;
        dest public.chn_profiles%rowtype;
begin
 if (select auth.uid()) is null or not private.chn_is_verified() then
  raise exception 'Necesitas una cuenta aprobada.';
 end if;
 select * into item from public.chn_causes
 where id=p_cause and status='active' and end_at>now() for update;
 if not found then raise exception 'Esta causa no acepta nuevas intenciones.'; end if;
 if item.intention_count>=item.max_intentions then
  raise exception 'La causa alcanzó el límite de intenciones.';
 end if;
 if p_recipient is null then raise exception 'Selecciona la cuenta destinataria.'; end if;
 select * into dest from public.chn_profiles p where p.id=p_recipient
   and p.verified and
   ((p.member_type='scout' and p.scout_id ~ '^CHN-?[A-Z0-9]{4,12}$')
    or (p.member_type='supporter' and p.scout_id is null and p.adult_attested));
 if not found then raise exception 'La cuenta destinataria no está aprobada.'; end if;
 if length(coalesce(p_note,''))>240 then
  raise exception 'El mensaje supera los 240 caracteres.';
 end if;
 insert into public.chn_support_pledges(
  user_id,amount,purpose,note,cause_id,status,recipient_id,recipient_name)
 values((select auth.uid()),item.fixed_support_amount,'General',
  trim(coalesce(p_note,'')),item.id,'pending',dest.id,dest.display_name)
 returning * into entry;
 update public.chn_causes set
  intention_count=intention_count+1,
  intention_total=intention_total+item.fixed_support_amount
 where id=item.id;
 return query select entry.id,entry.acknowledgment_no,entry.amount,item.title,
  entry.created_at,entry.status,dest.id,dest.display_name;
end $$;
create function public.chn_submit_cause_intent_v2(
 p_cause uuid,p_recipient uuid,p_note text default ''
)
returns table(
 intent_id uuid,ack_no bigint,amount_mxn integer,cause_title text,
 issued_at timestamptz,intent_status text,recipient_id uuid,recipient_name text
)
language sql security definer set search_path='' as $$
 select * from private.chn_submit_cause_intent_v2_impl(p_cause,p_recipient,p_note);
$$;

create function private.chn_review_cause_intent_impl(p_intent uuid,p_approve boolean)
returns void language plpgsql security definer set search_path='' as $$
declare entry public.chn_support_pledges%rowtype;
begin
 if (select auth.uid()) is null or not private.chn_is_admin() then
  raise exception 'Solo el administrador puede aprobar intenciones.';
 end if;
 if p_approve is null then raise exception 'Selecciona aprobar o rechazar.'; end if;
 select * into entry from public.chn_support_pledges
 where id=p_intent and cause_id is not null for update;
 if not found then raise exception 'Intención inexistente.'; end if;
 if entry.status<>'pending' then raise exception 'Esta intención ya fue revisada.'; end if;
 update public.chn_support_pledges
 set status=case when p_approve then 'approved' else 'rejected' end,
  reviewed_at=now(),reviewed_by=(select auth.uid())
 where id=p_intent;
 if not p_approve then
  update public.chn_causes
   set intention_count=intention_count-1,
       intention_total=intention_total-entry.amount
  where id=entry.cause_id;
 end if;
end $$;
create function public.chn_review_cause_intent(p_intent uuid,p_approve boolean)
returns void language sql security definer set search_path='' as $$
 select private.chn_review_cause_intent_impl(p_intent,p_approve);
$$;

-- All privileged entrypoints are narrow and explicitly granted.
revoke all on function
 private.chn_create_cause_v2_impl(text,text,text,timestamptz,integer,integer,integer,text[]),
 public.chn_create_cause_v2(text,text,text,timestamptz,integer,integer,integer,text[]),
 private.chn_cause_recipients_impl(),
 public.chn_cause_recipients(),
 private.chn_submit_cause_intent_v2_impl(uuid,uuid,text),
 public.chn_submit_cause_intent_v2(uuid,uuid,text),
 private.chn_review_cause_intent_impl(uuid,boolean),
 public.chn_review_cause_intent(uuid,boolean)
 from public,anon,authenticated;
grant execute on function
 public.chn_create_cause_v2(text,text,text,timestamptz,integer,integer,integer,text[]),
 public.chn_cause_recipients(),
 public.chn_submit_cause_intent_v2(uuid,uuid,text),
 public.chn_review_cause_intent(uuid,boolean)
 to authenticated;

comment on column public.chn_causes.max_intentions is
 'Owner-specified maximum of pending and approved support intentions; rejected intentions release capacity.';
comment on column public.chn_support_pledges.recipient_id is
 'Intended app-member recipient, not bank information or a record of transferred funds.';
comment on column public.chn_support_pledges.acknowledgment_no is
 'Unique acknowledgment of intent; not a payment receipt, invoice or CFDI.';
