-- ScoutRifas CHN en Supabase compartido: tablas chn_ aisladas; no modifica Study Compass.
-- No hay transacciones de pago ni integración con servicios financieros.
create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;
grant usage on schema private to authenticated;

create table public.chn_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  scout_id text not null unique check (scout_id ~ '^CHN-?[A-Z0-9]{4,12}$'),
  display_name text not null check (char_length(trim(display_name)) between 2 and 65),
  group_name text not null default '' check (char_length(group_name) <= 70),
  bio text not null default '' check (char_length(bio) <= 320),
  avatar_path text,
  constraint own_avatar_path check (avatar_path is null or avatar_path like id::text || '/avatars/%'),
  role text not null default 'member' check (role in ('member','admin')),
  verified boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.chn_listings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.chn_profiles(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 5 and 110),
  description text not null check (char_length(trim(description)) between 20 and 2500),
  type text not null check (type in ('raffle','auction')),
  category text not null default 'Otros' check (category in ('Aventura','Equipo','Coleccionables','Experiencias','Arte','Otros')),
  image_paths text[] not null default '{}',
  status text not null default 'pending' check (status in ('pending','active','paused','finished','cancelled')),
  end_at timestamptz not null,
  min_bid integer not null default 0 check (min_bid between 0 and 10000000),
  bid_step integer not null default 10 check (bid_step between 1 and 1000000),
  current_bid integer not null default 0 check (current_bid >= 0),
  entry_count integer not null default 0 check (entry_count >= 0),
  bid_count integer not null default 0 check (bid_count >= 0),
  max_entries integer not null default 100 check (max_entries between 1 and 100000),
  max_per_user integer not null default 1 check (max_per_user between 1 and 10),
  winner_id uuid references public.chn_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint valid_listing_limits check (
    (type = 'raffle' and min_bid = 0) or (type = 'auction' and min_bid >= 1)
  )
);
create function private.chn_validate_listing_images() returns trigger
language plpgsql set search_path = '' as $$
begin
  if cardinality(new.image_paths) > 4 or exists (
    select 1 from unnest(new.image_paths) p where p not like new.owner_id::text || '/listings/%'
  ) then raise exception 'Solo 4 fotografías propias por publicación.'; end if;
  return new;
end $$;
create trigger guard_chn_listing_images before insert or update of image_paths,owner_id
on public.chn_listings for each row execute function private.chn_validate_listing_images();
create index chn_listings_feed on public.chn_listings(status,end_at);
create index chn_listings_owner on public.chn_listings(owner_id,created_at desc);

create table public.chn_raffle_entries (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.chn_listings(id) on delete cascade,
  user_id uuid not null references public.chn_profiles(id) on delete cascade,
  joined_at timestamptz not null default now()
);
create index chn_entries_listing on public.chn_raffle_entries(listing_id);
create index chn_entries_user on public.chn_raffle_entries(user_id,joined_at desc);

create table public.chn_bids (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.chn_listings(id) on delete cascade,
  user_id uuid not null references public.chn_profiles(id) on delete cascade,
  amount integer not null check (amount > 0),
  created_at timestamptz not null default now()
);
create index chn_bids_listing on public.chn_bids(listing_id,amount desc);
create index chn_bids_user on public.chn_bids(user_id,created_at desc);

create table public.chn_draw_audit (
  listing_id uuid primary key references public.chn_listings(id) on delete cascade,
  winner_id uuid references public.chn_profiles(id) on delete set null,
  entries_at_draw integer not null,
  drawn_by uuid not null references public.chn_profiles(id),
  drawn_at timestamptz not null default now()
);

-- Las funciones de seguridad son internas, fuera del esquema expuesto por Data API.
create or replace function private.chn_is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select p.role = 'admin' from public.chn_profiles p where p.id = (select auth.uid())),false)
$$;
create or replace function private.chn_is_verified() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select p.verified and p.scout_id ~ '^CHN-?[A-Z0-9]{4,12}$' from public.chn_profiles p where p.id = (select auth.uid())),false)
$$;
revoke all on function private.chn_is_admin() from public, anon;
revoke all on function private.chn_is_verified() from public, anon;
grant execute on function private.chn_is_admin(),private.chn_is_verified() to authenticated;

create function private.chn_handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
declare sid text; nick text;
begin
  sid := upper(trim(coalesce(new.raw_user_meta_data->>'scout_id','')));
  if sid not like 'CHN%' then return new; end if;
  nick := trim(coalesce(new.raw_user_meta_data->>'display_name',''));
  if char_length(nick)<2 then nick:='Miembro Scout'; end if;
  insert into public.chn_profiles(id,scout_id,display_name,group_name)
  values(new.id,sid,nick,left(trim(coalesce(new.raw_user_meta_data->>'group_name','')),70));
  return new;
end $$;
revoke all on function private.chn_handle_new_user() from public,anon,authenticated;
create trigger on_auth_user_created_chn after insert on auth.users
for each row execute function private.chn_handle_new_user();

alter table public.chn_profiles enable row level security;
alter table public.chn_listings enable row level security;
alter table public.chn_raffle_entries enable row level security;
alter table public.chn_bids enable row level security;
alter table public.chn_draw_audit enable row level security;

revoke all on public.chn_profiles,public.chn_listings,public.chn_raffle_entries,public.chn_bids,public.chn_draw_audit from anon,authenticated;
grant select on public.chn_profiles,public.chn_listings to authenticated;
grant select on public.chn_raffle_entries,public.chn_bids,public.chn_draw_audit to authenticated;
grant update (display_name,group_name,bio,avatar_path) on public.chn_profiles to authenticated;
grant insert (owner_id,title,description,type,category,image_paths,end_at,min_bid,bid_step,max_entries,max_per_user)
  on public.chn_listings to authenticated;
grant update (title,description,category,image_paths,end_at,min_bid,bid_step,max_entries,max_per_user)
  on public.chn_listings to authenticated;

create policy "CHN member profiles only" on public.chn_profiles for select to authenticated
using (id = (select auth.uid()) or (select private.chn_is_admin())
  or ((select private.chn_is_verified()) and verified));
create policy "CHN edit own profile" on public.chn_profiles for update to authenticated
using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy "CHN member only listings" on public.chn_listings for select to authenticated
using (((select private.chn_is_verified()) or (select private.chn_is_admin())) and
  (status in ('active','finished') or (select auth.uid()) = owner_id or (select private.chn_is_admin())));
create policy "CHN verified member submits for review" on public.chn_listings for insert to authenticated
with check (owner_id = (select auth.uid()) and status = 'pending' and (select private.chn_is_verified()) and end_at > now());
create policy "CHN owner edits pending only" on public.chn_listings for update to authenticated
using (owner_id = (select auth.uid()) and status = 'pending')
with check (owner_id = (select auth.uid()) and status = 'pending' and end_at > now());
create policy "CHN own entries or managed" on public.chn_raffle_entries for select to authenticated
using (((select private.chn_is_verified()) or (select private.chn_is_admin())) and (user_id = (select auth.uid()) or (select private.chn_is_admin()) or exists (select 1 from public.chn_listings l where l.id=listing_id and l.owner_id=(select auth.uid()))));
create policy "CHN own bids or managed" on public.chn_bids for select to authenticated
using (((select private.chn_is_verified()) or (select private.chn_is_admin())) and (user_id = (select auth.uid()) or (select private.chn_is_admin()) or exists (select 1 from public.chn_listings l where l.id=listing_id and l.owner_id=(select auth.uid()))));
create policy "CHN audit only members" on public.chn_draw_audit for select to authenticated
using ((select private.chn_is_verified()) or (select private.chn_is_admin()));

-- Las únicas rutas de creación de participaciones/pujas usan locks y validación en BD.
-- Wrappers públicos SECURITY INVOKER; el código privilegiado permanece en private.
create function private.chn_place_bid_impl(p_listing uuid,p_amount integer) returns void
language plpgsql security definer set search_path = '' as $$
declare l public.chn_listings%rowtype; next_bid integer;
begin
  if (select auth.uid()) is null or not private.chn_is_verified() then
    raise exception 'Tu cuenta necesita verificación CHN.';
  end if;
  select * into l from public.chn_listings where id=p_listing for update;
  if not found or l.type <> 'auction' or l.status <> 'active' or l.end_at <= now() then
    raise exception 'Esta subasta no acepta pujas.';
  end if;
  if l.owner_id = (select auth.uid()) then raise exception 'No puedes pujar en tu publicación.'; end if;
  next_bid := case when l.bid_count = 0 then l.min_bid else l.current_bid + l.bid_step end;
  if p_amount is null or p_amount < next_bid or p_amount > 10000000 then
    raise exception 'La puja mínima es %.',next_bid;
  end if;
  insert into public.chn_bids(listing_id,user_id,amount) values(p_listing,(select auth.uid()),p_amount);
  update public.chn_listings set current_bid=p_amount,bid_count=l.bid_count+1 where id=p_listing;
end $$;
create function public.chn_place_bid(p_listing uuid,p_amount integer) returns void
language sql security invoker set search_path = '' as $$ select private.chn_place_bid_impl(p_listing,p_amount) $$;

create function private.chn_join_raffle_impl(p_listing uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare l public.chn_listings%rowtype; my_count integer;
begin
  if (select auth.uid()) is null or not private.chn_is_verified() then
    raise exception 'Tu cuenta necesita verificación CHN.';
  end if;
  select * into l from public.chn_listings where id=p_listing for update;
  if not found or l.type <> 'raffle' or l.status <> 'active' or l.end_at <= now() then
    raise exception 'Esta rifa ya no acepta participantes.';
  end if;
  if l.owner_id = (select auth.uid()) then raise exception 'No puedes entrar a tu propia rifa.'; end if;
  if l.entry_count >= l.max_entries then raise exception 'Ya se agotaron las participaciones.'; end if;
  select count(*) into my_count from public.chn_raffle_entries where listing_id=p_listing and user_id=(select auth.uid());
  if my_count >= l.max_per_user then raise exception 'Ya alcanzaste tu límite de participaciones.'; end if;
  insert into public.chn_raffle_entries(listing_id,user_id) values(p_listing,(select auth.uid()));
  update public.chn_listings set entry_count=l.entry_count+1 where id=p_listing;
end $$;
create function public.chn_join_raffle(p_listing uuid) returns void
language sql security invoker set search_path = '' as $$ select private.chn_join_raffle_impl(p_listing) $$;

create function private.chn_review_user_impl(p_user uuid,p_verified boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null or not private.chn_is_admin() then raise exception 'Solo administradores.'; end if;
  if p_user = (select auth.uid()) then raise exception 'No puedes revisar tu propia cuenta.'; end if;
  update public.chn_profiles set verified=p_verified where id=p_user;
  if not found then raise exception 'Usuario no encontrado.'; end if;
end $$;
create function public.chn_review_user(p_user uuid,p_verified boolean) returns void
language sql security invoker set search_path = '' as $$ select private.chn_review_user_impl(p_user,p_verified) $$;

create function private.chn_review_listing_impl(p_listing uuid,p_action text) returns void
language plpgsql security definer set search_path = '' as $$
declare l public.chn_listings%rowtype;
begin
  if (select auth.uid()) is null or not private.chn_is_admin() then raise exception 'Solo administradores.'; end if;
  select * into l from public.chn_listings where id=p_listing for update;
  if not found then raise exception 'Publicación no encontrada.'; end if;
  if p_action = 'active' and l.status in ('pending','paused') and l.end_at > now() then
    update public.chn_listings set status='active' where id=p_listing;
  elsif p_action = 'paused' and l.status='active' then
    update public.chn_listings set status='paused' where id=p_listing;
  elsif p_action = 'cancelled' and l.status in ('pending','active','paused') then
    update public.chn_listings set status='cancelled' where id=p_listing;
  else raise exception 'Transición de estado no permitida.';
  end if;
end $$;
create function public.chn_review_listing(p_listing uuid,p_action text) returns void
language sql security invoker set search_path = '' as $$ select private.chn_review_listing_impl(p_listing,p_action) $$;

create function private.chn_finish_listing_impl(p_listing uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare l public.chn_listings%rowtype; winner uuid; n integer;
begin
  if (select auth.uid()) is null or not private.chn_is_admin() then raise exception 'Solo administradores.'; end if;
  select * into l from public.chn_listings where id=p_listing for update;
  if not found or l.status <> 'active' or l.end_at > now() then
    raise exception 'La publicación debe estar activa y haber terminado.';
  end if;
  if l.type = 'auction' then
    select b.user_id into winner from public.chn_bids b where b.listing_id=p_listing order by b.amount desc,b.created_at asc limit 1;
    n := l.bid_count;
  else
    select e.user_id into winner from public.chn_raffle_entries e where e.listing_id=p_listing
    order by gen_random_uuid() limit 1;
    n := l.entry_count;
  end if;
  update public.chn_listings set status='finished',winner_id=winner where id=p_listing;
  insert into public.chn_draw_audit(listing_id,winner_id,entries_at_draw,drawn_by) values(p_listing,winner,n,(select auth.uid()));
  return winner;
end $$;
create function public.chn_finish_listing(p_listing uuid) returns uuid
language sql security invoker set search_path = '' as $$ select private.chn_finish_listing_impl(p_listing) $$;

revoke all on function private.chn_place_bid_impl(uuid,integer),private.chn_join_raffle_impl(uuid),private.chn_review_user_impl(uuid,boolean),private.chn_review_listing_impl(uuid,text),private.chn_finish_listing_impl(uuid) from public,anon;
grant execute on function private.chn_place_bid_impl(uuid,integer),private.chn_join_raffle_impl(uuid),private.chn_review_user_impl(uuid,boolean),private.chn_review_listing_impl(uuid,text),private.chn_finish_listing_impl(uuid) to authenticated;
revoke all on function public.chn_place_bid(uuid,integer),public.chn_join_raffle(uuid),public.chn_review_user(uuid,boolean),public.chn_review_listing(uuid,text),public.chn_finish_listing(uuid) from public,anon;
grant execute on function public.chn_place_bid(uuid,integer),public.chn_join_raffle(uuid),public.chn_review_user(uuid,boolean),public.chn_review_listing(uuid,text),public.chn_finish_listing(uuid) to authenticated;

-- Avatares públicos, pero las fotos de rifas/subastas permanecen en un bucket PRIVADO.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('chn-avatars','chn-avatars',true,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=true,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('chn-listings','chn-listings',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create policy "CHN upload own avatar" on storage.objects for insert to authenticated
with check (bucket_id='chn-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text
  and (storage.foldername(name))[2] = 'avatars'
  and lower(storage.extension(name)) in ('jpg','jpeg','png','webp'));
create policy "CHN delete own avatar" on storage.objects for delete to authenticated
using (bucket_id='chn-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "CHN upload own private listing photos" on storage.objects for insert to authenticated
with check (bucket_id='chn-listings' and (select private.chn_is_verified())
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and (storage.foldername(name))[2] = 'listings'
  and lower(storage.extension(name)) in ('jpg','jpeg','png','webp'));
create policy "CHN only verified members access listing photos" on storage.objects for select to authenticated
using (bucket_id='chn-listings'
  and ((select private.chn_is_verified()) or (select private.chn_is_admin()))
  and exists (select 1 from public.chn_listings l where name = any(l.image_paths)
    and (l.status in ('active','finished') or l.owner_id = (select auth.uid()) or (select private.chn_is_admin()))));
create policy "CHN owner can delete listing photos" on storage.objects for delete to authenticated
using (bucket_id='chn-listings' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Para designar al PRIMER admin, desde SQL Editor con acceso de propietario:
-- update public.chn_profiles set role='admin',verified=true where scout_id='CHN-0001';
-- Nunca ejecutar esta promoción desde el frontend, ni permitirla en la API pública.

-- Una cuenta previamente registrada en otra app Supabase puede crear su perfil CHN.
create function private.chn_register_member_impl(p_scout_id text,p_display_name text,p_group_name text)
returns void language plpgsql security definer set search_path = '' as $$
declare sid text := upper(trim(coalesce(p_scout_id,'')));
begin
  if (select auth.uid()) is null then raise exception 'Inicia sesión primero.'; end if;
  if sid !~ '^CHN-?[A-Z0-9]{4,12}$' then raise exception 'ID inválido.'; end if;
  if char_length(trim(coalesce(p_display_name,''))) not between 2 and 65 then raise exception 'Nombre inválido.'; end if;
  insert into public.chn_profiles(id,scout_id,display_name,group_name)
    values((select auth.uid()),sid,trim(p_display_name),left(trim(coalesce(p_group_name,'')),70));
end $$;
create function public.chn_register_member(p_scout_id text,p_display_name text,p_group_name text)
returns void language sql security invoker set search_path = '' as
$$ select private.chn_register_member_impl(p_scout_id,p_display_name,p_group_name) $$;
revoke all on function private.chn_register_member_impl(text,text,text),public.chn_register_member(text,text,text) from public,anon;
grant execute on function private.chn_register_member_impl(text,text,text),public.chn_register_member(text,text,text) to authenticated;
