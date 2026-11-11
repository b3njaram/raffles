-- Real charitable causes, independent of promotional draws.
-- Intention references are NOT payment receipts, invoices, or tax CFDIs.
create table public.chn_causes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.chn_profiles(id),
  title text not null check (length(trim(title)) between 5 and 110),
  description text not null check (length(trim(description)) between 20 and 2500),
  category text not null default 'Otros',
  image_paths text[] not null default '{}',
  fixed_support_amount integer not null check (fixed_support_amount between 20 and 100000),
  target_amount integer not null default 0 check(target_amount between 0 and 100000000),
  end_at timestamptz not null,
  status text not null default 'pending' check(status in ('pending','active','paused','finished','cancelled')),
  intention_count integer not null default 0 check(intention_count>=0),
  intention_total bigint not null default 0 check(intention_total>=0),
  created_at timestamptz not null default now(),
  constraint chn_cause_10_owner_photos check(
    cardinality(image_paths) between 1 and 10
    and array_position(image_paths,null) is null
  )
);
create index chn_causes_owner_idx on public.chn_causes(owner_id,created_at desc);
create index chn_causes_active_idx on public.chn_causes(status,created_at desc);
alter table public.chn_causes enable row level security;
revoke all on public.chn_causes from public,anon,authenticated;
grant select on public.chn_causes to authenticated;
create policy "CHN approved members see approved causes and own drafts"
 on public.chn_causes for select to authenticated using (
 (select private.chn_is_verified()) and
 (status in ('active','finished') or owner_id=(select auth.uid()) or (select private.chn_is_admin()))
);

-- Reusable existing "intention" ledger, with a unique reference, no payment status.
create sequence public.chn_intent_ack_seq as bigint start with 10001;
alter table public.chn_support_pledges
 add column cause_id uuid references public.chn_causes(id) on delete restrict,
 add column acknowledgment_no bigint not null default nextval('public.chn_intent_ack_seq');
alter sequence public.chn_intent_ack_seq owned by public.chn_support_pledges.acknowledgment_no;
create unique index chn_support_ack_unique on public.chn_support_pledges(acknowledgment_no);
create index chn_support_cause_idx on public.chn_support_pledges(cause_id,created_at desc);
revoke all on sequence public.chn_intent_ack_seq from public,anon,authenticated;

-- Cause approval remains with the existing single, verified administrator.
create function private.chn_create_cause_impl(
 p_title text,p_description text,p_category text,p_end_at timestamptz,
 p_amount integer,p_target integer,p_images text[]
) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid; prefix text := (select auth.uid())::text || '/listings/';
begin
 if (select auth.uid()) is null or not private.chn_can_publish() then
  raise exception 'Únicamente los organizadores aprobados pueden proponer causas.';
 end if;
 if p_end_at is null or p_end_at<=now()+interval '1 hour' then
  raise exception 'La fecha de cierre debe estar en el futuro.';
 end if;
 if p_images is null or cardinality(p_images) not between 1 and 10 or exists (
  select 1 from unnest(p_images) path where path is null
  or left(path,length(prefix))<>prefix or path !~* '\.(jpg|jpeg|png|webp)$'
 ) then
  raise exception 'Agrega de 1 a 10 fotos propias.';
 end if;
 if p_amount is null or p_amount not between 20 and 100000 then
  raise exception 'El monto por apoyo debe estar entre $20 y $100,000 MXN.';
 end if;
 if p_target is null or p_target not between 0 and 100000000 then
  raise exception 'Revisa la meta de la causa.';
 end if;
 insert into public.chn_causes(owner_id,title,description,category,image_paths,
  fixed_support_amount,target_amount,end_at)
 values((select auth.uid()),trim(p_title),trim(p_description),p_category,
  p_images,p_amount,p_target,p_end_at)
 returning id into result;
 return result;
end $$;
create function public.chn_create_cause(
 p_title text,p_description text,p_category text,p_end_at timestamptz,
 p_amount integer,p_target integer,p_images text[]
) returns uuid language sql security definer set search_path='' as $$
 select private.chn_create_cause_impl(p_title,p_description,p_category,p_end_at,p_amount,p_target,p_images);
$$;

create function private.chn_review_cause_impl(p_cause uuid,p_action text)
 returns void language plpgsql security definer set search_path='' as $$
declare old_state text;
begin
 if (select auth.uid()) is null or not private.chn_is_admin() then
  raise exception 'Solo administración puede revisar causas.';
 end if;
 select status into old_state from public.chn_causes where id=p_cause for update;
 if old_state is null then raise exception 'Causa inexistente.'; end if;
 if (p_action='active' and old_state not in ('pending','paused'))
 or (p_action='paused' and old_state<>'active')
 or (p_action='cancelled' and old_state not in ('pending','paused','active'))
 or p_action not in ('active','paused','cancelled') then
  raise exception 'Cambio de estado no permitido.';
 end if;
 update public.chn_causes set status=p_action where id=p_cause;
end $$;
create function public.chn_review_cause(p_cause uuid,p_action text)
 returns void language sql security definer set search_path='' as $$
 select private.chn_review_cause_impl(p_cause,p_action);
$$;

-- Unlimited independent support intentions per user/cause, with a different
-- immutable unique numeric reference for every one. No paid event, no draw entry.
create function private.chn_register_cause_intent_impl(p_cause uuid,p_note text default '')
 returns table(intent_id uuid,ack_no bigint,amount_mxn integer,cause_title text,issued_at timestamptz)
 language plpgsql security definer set search_path='' as $$
declare item public.chn_causes%rowtype; entry public.chn_support_pledges%rowtype;
begin
 if (select auth.uid()) is null or not private.chn_is_verified() then
  raise exception 'Necesitas una cuenta aprobada.';
 end if;
 select * into item from public.chn_causes where id=p_cause and status='active' and end_at>now() for update;
 if not found then raise exception 'Esta causa todavía no acepta intenciones de apoyo.'; end if;
 if length(coalesce(p_note,''))>240 then raise exception 'El mensaje es demasiado largo.'; end if;
 insert into public.chn_support_pledges(user_id,amount,purpose,note,cause_id,status)
 values((select auth.uid()),item.fixed_support_amount,'General',
  trim(coalesce(p_note,'')),item.id,'intent')
 returning * into entry;
 update public.chn_causes set intention_count=intention_count+1,
  intention_total=intention_total+item.fixed_support_amount
 where id=item.id;
 return query select entry.id,entry.acknowledgment_no,entry.amount,item.title,entry.created_at;
end $$;
create function public.chn_register_cause_intent(p_cause uuid,p_note text default '')
 returns table(intent_id uuid,ack_no bigint,amount_mxn integer,cause_title text,issued_at timestamptz)
 language sql security definer set search_path='' as $$
 select * from private.chn_register_cause_intent_impl(p_cause,p_note);
$$;

-- Keep cause photos in the existing private bucket.
create policy "CHN verified access approved cause photos" on storage.objects
 for select to authenticated using (
  bucket_id='chn-listings' and (select private.chn_is_verified()) and exists(
   select 1 from public.chn_causes c where name=any(c.image_paths)
   and (c.status in ('active','finished') or c.owner_id=(select auth.uid())
    or (select private.chn_is_admin()))
  )
 );
revoke all on function private.chn_create_cause_impl(text,text,text,timestamptz,integer,integer,text[]),
 public.chn_create_cause(text,text,text,timestamptz,integer,integer,text[]),
 private.chn_review_cause_impl(uuid,text),public.chn_review_cause(uuid,text),
 private.chn_register_cause_intent_impl(uuid,text),public.chn_register_cause_intent(uuid,text)
 from public,anon,authenticated;
grant execute on function public.chn_create_cause(text,text,text,timestamptz,integer,integer,text[]),
 public.chn_review_cause(uuid,text),public.chn_register_cause_intent(uuid,text)
 to authenticated;
