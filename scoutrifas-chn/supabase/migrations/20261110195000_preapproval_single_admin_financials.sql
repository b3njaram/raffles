
-- ScoutRifas CHN 2026-11-10. Independent, pre-approved membership and private raffle calculator.
-- Does not affect Study Compass data. No charges or ticket sales enabled by this migration.
create table if not exists private.chn_admin_owner(
 singleton boolean primary key default true check(singleton),
 user_id uuid not null unique references public.chn_profiles(id)
);
insert into private.chn_admin_owner(singleton,user_id)
select true,p.id from public.chn_profiles p
where p.role='admin' and p.verified order by p.created_at asc limit 1
on conflict(singleton) do nothing;

create or replace function private.chn_is_admin() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(
  select 1 from private.chn_admin_owner o
  join public.chn_profiles p on p.id=o.user_id
  where o.singleton=true and o.user_id=(select auth.uid())
   and p.role='admin' and p.verified
 );
$$;

create function private.chn_guard_only_admin() returns trigger
language plpgsql security definer set search_path='' as $$
declare sole uuid;
begin
 select user_id into sole from private.chn_admin_owner where singleton=true;
 if new.role='admin' and (sole is null or new.id<>sole) then
  raise exception 'El rol administrador está reservado.';
 end if;
 if new.id=sole and new.role<>'admin' then
  raise exception 'No se puede desactivar al único administrador desde esta operación.';
 end if;
 return new;
end $$;
create trigger chn_only_one_admin before insert or update on public.chn_profiles
 for each row execute function private.chn_guard_only_admin();

-- Access requests contain PII, visible only to the one administrator.
create table public.chn_access_requests(
 id uuid primary key default gen_random_uuid(),
 email text not null unique check(length(email) between 5 and 254 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
 display_name text not null check(length(trim(display_name)) between 2 and 65),
 member_type text not null check(member_type in ('scout','supporter')),
 scout_id text,
 group_name text not null default '' check(length(group_name)<=70),
 referral_note text not null default '' check(length(referral_note)<=120),
 adult_attested boolean not null default false,
 status text not null default 'pending' check(status in ('pending','approved','rejected','consumed')),
 created_at timestamptz not null default now(),
 reviewed_at timestamptz,
 reviewed_by uuid references public.chn_profiles(id),
 constraint chn_access_identity check (
  (member_type='scout' and scout_id ~ '^CHN-?[A-Z0-9]{4,12}$') or
  (member_type='supporter' and scout_id is null and adult_attested)
 )
);
create index chn_access_requests_status on public.chn_access_requests(status,created_at);
alter table public.chn_access_requests enable row level security;
revoke all on public.chn_access_requests from public,anon,authenticated;
grant select on public.chn_access_requests to authenticated;
create policy "CHN only single admin reads applications"
 on public.chn_access_requests for select to authenticated
 using ((select private.chn_is_admin()));

create function private.chn_request_access_impl(
 p_email text,p_name text,p_kind text,p_scout_id text,
 p_group text,p_referral text,p_adult boolean,p_website text default ''
) returns void language plpgsql security definer set search_path='' as $$
declare mail text:=lower(trim(coalesce(p_email,'')));
 sid text:=upper(trim(coalesce(p_scout_id,'')));
begin
 if trim(coalesce(p_website,''))<>'' then return; end if; -- honeypot
 if mail !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(mail) not between 5 and 254 then
  raise exception 'Correo electrónico inválido.';
 end if;
 if length(trim(coalesce(p_name,''))) not between 2 and 65 then raise exception 'Nombre inválido.'; end if;
 if p_kind not in ('scout','supporter') then raise exception 'Tipo de solicitud inválido.'; end if;
 if p_kind='scout' and sid !~ '^CHN-?[A-Z0-9]{4,12}$' then raise exception 'ID scout inválido.'; end if;
 if p_kind='supporter' and p_adult is distinct from true then raise exception 'Debes ser mayor de edad.'; end if;
 insert into public.chn_access_requests(email,display_name,member_type,scout_id,group_name,referral_note,adult_attested)
 values(mail,trim(p_name),p_kind,case when p_kind='scout' then sid else null end,
  left(trim(coalesce(p_group,'')),70),left(trim(coalesce(p_referral,'')),120),coalesce(p_adult,false))
 on conflict (email) do nothing;  -- generic non-enumerating response
end $$;
create function public.chn_request_access(
 p_email text,p_name text,p_kind text,p_scout_id text,
 p_group text,p_referral text,p_adult boolean,p_website text default ''
) returns void language sql security invoker set search_path='' as $$
 select private.chn_request_access_impl(p_email,p_name,p_kind,p_scout_id,p_group,p_referral,p_adult,p_website);
$$;
revoke all on function public.chn_request_access(text,text,text,text,text,text,boolean,text),
 private.chn_request_access_impl(text,text,text,text,text,text,boolean,text) from public,anon,authenticated;
grant execute on function public.chn_request_access(text,text,text,text,text,text,boolean,text),
 private.chn_request_access_impl(text,text,text,text,text,text,boolean,text) to anon,authenticated;

create function private.chn_review_access_impl(p_id uuid,p_approved boolean)
 returns void language plpgsql security definer set search_path='' as $$
declare rec public.chn_access_requests%rowtype;
begin
 if (select auth.uid()) is null or not private.chn_is_admin() then raise exception 'Solo administración.'; end if;
 select * into rec from public.chn_access_requests where id=p_id for update;
 if not found or rec.status<>'pending' then raise exception 'Solicitud no disponible.'; end if;
 if p_approved and rec.member_type='scout' and exists(
  select 1 from public.chn_profiles where scout_id=rec.scout_id
 ) then raise exception 'ID scout ya registrado.'; end if;
 update public.chn_access_requests set status=case when p_approved then 'approved' else 'rejected' end,
 reviewed_at=now(),reviewed_by=(select auth.uid()) where id=p_id;
end $$;
create function public.chn_review_access(p_id uuid,p_approved boolean)
 returns void language sql security invoker set search_path='' as $$
 select private.chn_review_access_impl(p_id,p_approved);
$$;
revoke all on function private.chn_review_access_impl(uuid,boolean),
 public.chn_review_access(uuid,boolean) from public,anon,authenticated;
grant execute on function private.chn_review_access_impl(uuid,boolean),
 public.chn_review_access(uuid,boolean) to authenticated;

-- Newly-created Supabase Auth users become ScoutRifas users ONLY after approved
-- request matching their verified email and requested membership data.
-- Users created by Study Compass without CHN metadata are left unchanged.
create or replace function private.chn_handle_new_user() returns trigger
 language plpgsql security definer set search_path='' as $$
declare rec public.chn_access_requests%rowtype;
 kind text:=coalesce(new.raw_user_meta_data->>'chn_member_type','');
begin
 if kind not in ('scout','supporter') then return new; end if;
 select * into rec from public.chn_access_requests
  where email=lower(trim(new.email)) and status='approved'
  and member_type=kind for update;
 if not found then raise exception 'Primero necesitas una solicitud aprobada para este correo.'; end if;
 if kind='scout' and upper(trim(coalesce(new.raw_user_meta_data->>'scout_id','')))<>rec.scout_id then
  raise exception 'El ID scout no coincide con la solicitud aprobada.';
 end if;
 insert into public.chn_profiles(id,scout_id,display_name,group_name,member_type,adult_attested,referral_note,verified)
 values(new.id,rec.scout_id,rec.display_name,
  case when kind='scout' then rec.group_name else 'Simpatizante' end,
  rec.member_type,rec.adult_attested,rec.referral_note,true);
 update public.chn_access_requests set status='consumed'
  where id=rec.id;
 return new;
end $$;

-- Claim approved access for people who already have a Supabase account
-- (notably Study Compass). No free-form registration parameters are trusted.
create function private.chn_claim_approved_access_impl() returns void
 language plpgsql security definer set search_path='' as $$
declare rec public.chn_access_requests%rowtype;
 mail text;
begin
 if (select auth.uid()) is null then raise exception 'Inicia sesión.'; end if;
 if exists(select 1 from public.chn_profiles where id=(select auth.uid())) then return; end if;
 select lower(email) into mail from auth.users where id=(select auth.uid()) and email_confirmed_at is not null;
 if mail is null then raise exception 'Confirma tu correo para continuar.'; end if;
 select * into rec from public.chn_access_requests
  where email=mail and status='approved' for update;
 if not found then raise exception 'Tu solicitud todavía no está aprobada.'; end if;
 insert into public.chn_profiles(id,scout_id,display_name,group_name,member_type,adult_attested,referral_note,verified)
 values((select auth.uid()),rec.scout_id,rec.display_name,
 case when rec.member_type='scout' then rec.group_name else 'Simpatizante' end,
 rec.member_type,rec.adult_attested,rec.referral_note,true);
 update public.chn_access_requests set status='consumed' where id=rec.id;
end $$;
create function public.chn_claim_approved_access() returns void
 language sql security invoker set search_path='' as $$
 select private.chn_claim_approved_access_impl();
$$;
revoke all on function private.chn_claim_approved_access_impl(),
 public.chn_claim_approved_access() from public,anon,authenticated;
grant execute on function private.chn_claim_approved_access_impl(),
 public.chn_claim_approved_access() to authenticated;

-- Revoke obsolete direct membership entry points; preapproval is now mandatory.
revoke insert on public.chn_profiles from authenticated;
drop policy if exists "CHN owner may create own pending profile" on public.chn_profiles;
revoke execute on function public.chn_register_supporter(text,text,boolean),
 private.chn_register_supporter_impl(text,text,boolean),
 public.chn_register_member(text,text,text),
 private.chn_register_member_impl(text,text,text) from authenticated;

-- Max ten prize photos; no images from a different account may be attached.
create or replace function private.chn_validate_listing_images() returns trigger
 language plpgsql set search_path='' as $$
begin
 if cardinality(new.image_paths)>10 or exists(
  select 1 from unnest(new.image_paths) p
   where p not like new.owner_id::text || '/listings/%'
 ) then raise exception 'Hasta 10 fotografías propias por publicación.'; end if;
 return new;
end $$;

-- Calculator plan is private. Not part of the public raffle record.
create table public.chn_raffle_financials(
 listing_id uuid primary key references public.chn_listings(id) on delete cascade,
 prize_cost integer not null default 0 check(prize_cost between 0 and 100000000),
 other_costs integer not null default 0 check(other_costs between 0 and 100000000),
 profit_goal integer not null default 0 check(profit_goal between 0 and 100000000),
 simulated_platform_pct numeric(5,2) not null default 0 check(simulated_platform_pct between 0 and 20),
 created_at timestamptz not null default now()
);
alter table public.chn_raffle_financials enable row level security;
revoke all on public.chn_raffle_financials from public,anon,authenticated;
grant select on public.chn_raffle_financials to authenticated;
create policy "CHN raffle financials owner or admin"
 on public.chn_raffle_financials for select to authenticated
 using ((select private.chn_is_admin()) or exists(
  select 1 from public.chn_listings l
  where l.id=listing_id and l.owner_id=(select auth.uid())
 ));

create function private.chn_create_raffle_with_plan_impl(
 p_title text,p_description text,p_category text,p_end_at timestamptz,
 p_price integer,p_count integer,p_limit integer,p_images text[],
 p_prize_cost integer,p_other_costs integer,p_profit_goal integer,p_fee_pct numeric
) returns uuid language plpgsql security definer set search_path='' as $$
declare listing_id uuid;
begin
 if (select auth.uid()) is null or not private.chn_can_publish() then
  raise exception 'La cuenta no puede organizar rifas.';
 end if;
 if p_images is null or cardinality(p_images) not between 1 and 10 then
  raise exception 'Agrega entre 1 y 10 fotografías.';
 end if;
 if p_prize_cost is null or p_other_costs is null or p_profit_goal is null
  or p_prize_cost<0 or p_other_costs<0 or p_profit_goal<0
  or p_fee_pct is null or p_fee_pct<0 or p_fee_pct>20 then
  raise exception 'Revisa los valores de la calculadora.';
 end if;
 insert into public.chn_listings(
  owner_id,title,description,category,type,end_at,ticket_price,max_entries,
  max_per_user,image_paths,min_bid,bid_step,status,sales_authorized)
 values((select auth.uid()),trim(p_title),trim(p_description),p_category,'raffle',
  p_end_at,p_price,p_count,p_limit,p_images,0,10,'pending',false)
 returning id into listing_id;
 insert into public.chn_raffle_financials(
  listing_id,prize_cost,other_costs,profit_goal,simulated_platform_pct)
 values(listing_id,p_prize_cost,p_other_costs,p_profit_goal,p_fee_pct);
 return listing_id;
end $$;
create function public.chn_create_raffle_with_plan(
 p_title text,p_description text,p_category text,p_end_at timestamptz,
 p_price integer,p_count integer,p_limit integer,p_images text[],
 p_prize_cost integer,p_other_costs integer,p_profit_goal integer,p_fee_pct numeric
) returns uuid language sql security invoker set search_path='' as $$
 select private.chn_create_raffle_with_plan_impl(p_title,p_description,p_category,
  p_end_at,p_price,p_count,p_limit,p_images,p_prize_cost,p_other_costs,p_profit_goal,p_fee_pct);
$$;
revoke all on function private.chn_create_raffle_with_plan_impl(text,text,text,timestamptz,integer,integer,integer,text[],integer,integer,integer,numeric),
 public.chn_create_raffle_with_plan(text,text,text,timestamptz,integer,integer,integer,text[],integer,integer,integer,numeric)
 from public,anon,authenticated;
grant execute on function private.chn_create_raffle_with_plan_impl(text,text,text,timestamptz,integer,integer,integer,text[],integer,integer,integer,numeric),
 public.chn_create_raffle_with_plan(text,text,text,timestamptz,integer,integer,integer,text[],integer,integer,integer,numeric)
 to authenticated;
