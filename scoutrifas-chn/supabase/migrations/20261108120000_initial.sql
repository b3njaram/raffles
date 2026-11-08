-- ScoutRifas CHN. Ejecutar SOLO en un proyecto Supabase NUEVO.
-- No hay transacciones de pago ni integración con servicios financieros.
create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;
grant usage on schema private to authenticated;

create table public.profiles (
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

create table public.listings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
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
  winner_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint valid_listing_limits check (
    (type = 'raffle' and min_bid = 0) or (type = 'auction' and min_bid >= 1)
  )
);
create function private.validate_listing_images() returns trigger
language plpgsql set search_path = '' as $$
begin
  if cardinality(new.image_paths) > 4 or exists (
    select 1 from unnest(new.image_paths) p where p not like new.owner_id::text || '/listings/%'
  ) then raise exception 'Solo 4 fotografías propias por publicación.'; end if;
  return new;
end $$;
create trigger guard_listing_images before insert or update of image_paths,owner_id
on public.listings for each row execute function private.validate_listing_images();
create index listings_feed on public.listings(status,end_at);
create index listings_owner on public.listings(owner_id,created_at desc);

create table public.raffle_entries (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now()
);
create index entries_listing on public.raffle_entries(listing_id);
create index entries_user on public.raffle_entries(user_id,joined_at desc);

create table public.bids (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount integer not null check (amount > 0),
  created_at timestamptz not null default now()
);
create index bids_listing on public.bids(listing_id,amount desc);
create index bids_user on public.bids(user_id,created_at desc);

create table public.draw_audit (
  listing_id uuid primary key references public.listings(id) on delete cascade,
  winner_id uuid references public.profiles(id) on delete set null,
  entries_at_draw integer not null,
  drawn_by uuid not null references public.profiles(id),
  drawn_at timestamptz not null default now()
);

-- Las funciones de seguridad son internas, fuera del esquema expuesto por Data API.
create or replace function private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select p.role = 'admin' from public.profiles p where p.id = (select auth.uid())),false)
$$;
create or replace function private.is_verified() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select p.verified and p.scout_id ~ '^CHN-?[A-Z0-9]{4,12}$' from public.profiles p where p.id = (select auth.uid())),false)
$$;
revoke all on function private.is_admin() from public, anon;
revoke all on function private.is_verified() from public, anon;
grant execute on function private.is_admin(),private.is_verified() to authenticated;

create function private.handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
declare sid text; nick text;
begin
  sid := upper(trim(coalesce(new.raw_user_meta_data->>'scout_id','')));
  nick := trim(coalesce(new.raw_user_meta_data->>'display_name',''));
  insert into public.profiles(id,scout_id,display_name,group_name)
  values(new.id,sid,nick,left(trim(coalesce(new.raw_user_meta_data->>'group_name','')),70));
  return new;
end $$;
revoke all on function private.handle_new_user() from public,anon,authenticated;
create trigger on_auth_user_created after insert on auth.users
for each row execute function private.handle_new_user();

alter table public.profiles enable row level security;
alter table public.listings enable row level security;
alter table public.raffle_entries enable row level security;
alter table public.bids enable row level security;
alter table public.draw_audit enable row level security;

revoke all on public.profiles,public.listings,public.raffle_entries,public.bids,public.draw_audit from anon,authenticated;
grant select on public.profiles,public.listings to authenticated;
grant select on public.raffle_entries,public.bids,public.draw_audit to authenticated;
grant update (display_name,group_name,bio,avatar_path) on public.profiles to authenticated;
grant insert (owner_id,title,description,type,category,image_paths,end_at,min_bid,bid_step,max_entries,max_per_user)
  on public.listings to authenticated;
grant update (title,description,category,image_paths,end_at,min_bid,bid_step,max_entries,max_per_user)
  on public.listings to authenticated;

create policy "member profiles only" on public.profiles for select to authenticated
using (id = (select auth.uid()) or (select private.is_admin())
  or ((select private.is_verified()) and verified));
create policy "edit own profile" on public.profiles for update to authenticated
using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy "member only listings" on public.listings for select to authenticated
using (((select private.is_verified()) or (select private.is_admin())) and
  (status in ('active','finished') or (select auth.uid()) = owner_id or (select private.is_admin())));
create policy "verified member submits for review" on public.listings for insert to authenticated
with check (owner_id = (select auth.uid()) and status = 'pending' and (select private.is_verified()) and end_at > now());
create policy "owner edits pending only" on public.listings for update to authenticated
using (owner_id = (select auth.uid()) and status = 'pending')
with check (owner_id = (select auth.uid()) and status = 'pending' and end_at > now());
create policy "own entries or managed" on public.raffle_entries for select to authenticated
using (((select private.is_verified()) or (select private.is_admin())) and (user_id = (select auth.uid()) or (select private.is_admin()) or exists (select 1 from public.listings l where l.id=listing_id and l.owner_id=(select auth.uid()))));
create policy "own bids or managed" on public.bids for select to authenticated
using (((select private.is_verified()) or (select private.is_admin())) and (user_id = (select auth.uid()) or (select private.is_admin()) or exists (select 1 from public.listings l where l.id=listing_id and l.owner_id=(select auth.uid()))));
create policy "audit only members" on public.draw_audit for select to authenticated
using ((select private.is_verified()) or (select private.is_admin()));

-- Las únicas rutas de creación de participaciones/pujas usan locks y validación en BD.
-- Wrappers públicos SECURITY INVOKER; el código privilegiado permanece en private.
create function private.place_bid_impl(p_listing uuid,p_amount integer) returns void
language plpgsql security definer set search_path = '' as $$
declare l public.listings%rowtype; next_bid integer;
begin
  if (select auth.uid()) is null or not private.is_verified() then
    raise exception 'Tu cuenta necesita verificación CHN.';
  end if;
  select * into l from public.listings where id=p_listing for update;
  if not found or l.type <> 'auction' or l.status <> 'active' or l.end_at <= now() then
    raise exception 'Esta subasta no acepta pujas.';
  end if;
  if l.owner_id = (select auth.uid()) then raise exception 'No puedes pujar en tu publicación.'; end if;
  next_bid := case when l.bid_count = 0 then l.min_bid else l.current_bid + l.bid_step end;
  if p_amount is null or p_amount < next_bid or p_amount > 10000000 then
    raise exception 'La puja mínima es %.',next_bid;
  end if;
  insert into public.bids(listing_id,user_id,amount) values(p_listing,(select auth.uid()),p_amount);
  update public.listings set current_bid=p_amount,bid_count=l.bid_count+1 where id=p_listing;
end $$;
create function public.place_bid(p_listing uuid,p_amount integer) returns void
language sql security invoker set search_path = '' as $$ select private.place_bid_impl(p_listing,p_amount) $$;

create function private.join_raffle_impl(p_listing uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare l public.listings%rowtype; my_count integer;
begin
  if (select auth.uid()) is null or not private.is_verified() then
    raise exception 'Tu cuenta necesita verificación CHN.';
  end if;
  select * into l from public.listings where id=p_listing for update;
  if not found or l.type <> 'raffle' or l.status <> 'active' or l.end_at <= now() then
    raise exception 'Esta rifa ya no acepta participantes.';
  end if;
  if l.owner_id = (select auth.uid()) then raise exception 'No puedes entrar a tu propia rifa.'; end if;
  if l.entry_count >= l.max_entries then raise exception 'Ya se agotaron las participaciones.'; end if;
  select count(*) into my_count from public.raffle_entries where listing_id=p_listing and user_id=(select auth.uid());
  if my_count >= l.max_per_user then raise exception 'Ya alcanzaste tu límite de participaciones.'; end if;
  insert into public.raffle_entries(listing_id,user_id) values(p_listing,(select auth.uid()));
  update public.listings set entry_count=l.entry_count+1 where id=p_listing;
end $$;
create function public.join_raffle(p_listing uuid) returns void
language sql security invoker set search_path = '' as $$ select private.join_raffle_impl(p_listing) $$;

create function private.review_user_impl(p_user uuid,p_verified boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null or not private.is_admin() then raise exception 'Solo administradores.'; end if;
  if p_user = (select auth.uid()) then raise exception 'No puedes revisar tu propia cuenta.'; end if;
  update public.profiles set verified=p_verified where id=p_user;
  if not found then raise exception 'Usuario no encontrado.'; end if;
end $$;
create function public.review_user(p_user uuid,p_verified boolean) returns void
language sql security invoker set search_path = '' as $$ select private.review_user_impl(p_user,p_verified) $$;

create function private.review_listing_impl(p_listing uuid,p_action text) returns void
language plpgsql security definer set search_path = '' as $$
declare l public.listings%rowtype;
begin
  if (select auth.uid()) is null or not private.is_admin() then raise exception 'Solo administradores.'; end if;
  select * into l from public.listings where id=p_listing for update;
  if not found then raise exception 'Publicación no encontrada.'; end if;
  if p_action = 'active' and l.status in ('pending','paused') and l.end_at > now() then
    update public.listings set status='active' where id=p_listing;
  elsif p_action = 'paused' and l.status='active' then
    update public.listings set status='paused' where id=p_listing;
  elsif p_action = 'cancelled' and l.status in ('pending','active','paused') then
    update public.listings set status='cancelled' where id=p_listing;
  else raise exception 'Transición de estado no permitida.';
  end if;
end $$;
create function public.review_listing(p_listing uuid,p_action text) returns void
language sql security invoker set search_path = '' as $$ select private.review_listing_impl(p_listing,p_action) $$;

create function private.finish_listing_impl(p_listing uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare l public.listings%rowtype; winner uuid; n integer;
begin
  if (select auth.uid()) is null or not private.is_admin() then raise exception 'Solo administradores.'; end if;
  select * into l from public.listings where id=p_listing for update;
  if not found or l.status <> 'active' or l.end_at > now() then
    raise exception 'La publicación debe estar activa y haber terminado.';
  end if;
  if l.type = 'auction' then
    select b.user_id into winner from public.bids b where b.listing_id=p_listing order by b.amount desc,b.created_at asc limit 1;
    n := l.bid_count;
  else
    select e.user_id into winner from public.raffle_entries e where e.listing_id=p_listing
    order by gen_random_uuid() limit 1;
    n := l.entry_count;
  end if;
  update public.listings set status='finished',winner_id=winner where id=p_listing;
  insert into public.draw_audit(listing_id,winner_id,entries_at_draw,drawn_by) values(p_listing,winner,n,(select auth.uid()));
  return winner;
end $$;
create function public.finish_listing(p_listing uuid) returns uuid
language sql security invoker set search_path = '' as $$ select private.finish_listing_impl(p_listing) $$;

revoke all on function private.place_bid_impl(uuid,integer),private.join_raffle_impl(uuid),private.review_user_impl(uuid,boolean),private.review_listing_impl(uuid,text),private.finish_listing_impl(uuid) from public,anon;
grant execute on function private.place_bid_impl(uuid,integer),private.join_raffle_impl(uuid),private.review_user_impl(uuid,boolean),private.review_listing_impl(uuid,text),private.finish_listing_impl(uuid) to authenticated;
revoke all on function public.place_bid(uuid,integer),public.join_raffle(uuid),public.review_user(uuid,boolean),public.review_listing(uuid,text),public.finish_listing(uuid) from public,anon;
grant execute on function public.place_bid(uuid,integer),public.join_raffle(uuid),public.review_user(uuid,boolean),public.review_listing(uuid,text),public.finish_listing(uuid) to authenticated;

-- Avatares públicos, pero las fotos de rifas/subastas permanecen en un bucket PRIVADO.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('scout-photos','scout-photos',true,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=true,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('scout-listings','scout-listings',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create policy "upload own avatar" on storage.objects for insert to authenticated
with check (bucket_id='scout-photos' and (storage.foldername(name))[1] = (select auth.uid())::text
  and (storage.foldername(name))[2] = 'avatars'
  and lower(storage.extension(name)) in ('jpg','jpeg','png','webp'));
create policy "delete own avatar" on storage.objects for delete to authenticated
using (bucket_id='scout-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "upload own private listing photos" on storage.objects for insert to authenticated
with check (bucket_id='scout-listings' and (select private.is_verified())
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and (storage.foldername(name))[2] = 'listings'
  and lower(storage.extension(name)) in ('jpg','jpeg','png','webp'));
create policy "only verified members access listing photos" on storage.objects for select to authenticated
using (bucket_id='scout-listings'
  and ((select private.is_verified()) or (select private.is_admin()))
  and exists (select 1 from public.listings l where name = any(l.image_paths)
    and (l.status in ('active','finished') or l.owner_id = (select auth.uid()) or (select private.is_admin()))));
create policy "owner can delete listing photos" on storage.objects for delete to authenticated
using (bucket_id='scout-listings' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Para designar al PRIMER admin, desde SQL Editor con acceso de propietario:
-- update public.profiles set role='admin',verified=true where scout_id='CHN-0001';
-- Nunca ejecutar esta promoción desde el frontend, ni permitirla en la API pública.
