-- ScoutRifas CHN: modalidad exclusiva de rifas por boletos; acceso para simpatizantes aprobados.
-- Migración aislada: no altera tablas study_* ni auth.users excepto trigger CHN existente.
-- Los boletos de pago NO se pueden reservar sin habilitación jurídica manual del titular de BD.
alter table public.chn_profiles
  alter column scout_id drop not null,
  add column member_type text not null default 'scout'
    check (member_type in ('scout','supporter')),
  add column adult_attested boolean not null default false,
  add column referral_note text not null default ''
    check (char_length(referral_note)<=120);
alter table public.chn_profiles add constraint chn_profile_identity_check
  check ((member_type='scout' and scout_id ~ '^CHN-?[A-Z0-9]{4,12}$')
    or (member_type='supporter' and scout_id is null and adult_attested));

create or replace function private.chn_is_verified() returns boolean
 language sql stable security definer set search_path = '' as $$
 select coalesce((
  select p.verified and (
     (p.member_type='scout' and p.scout_id ~ '^CHN-?[A-Z0-9]{4,12}$')
     or (p.member_type='supporter' and p.scout_id is null and p.adult_attested)
  )
  from public.chn_profiles p where p.id=(select auth.uid())
 ),false);
$$;

-- El trigger solo inscribe usuarios creados para ScoutRifas; no interfiere con Study Compass.
create or replace function private.chn_handle_new_user() returns trigger
 language plpgsql security definer set search_path = '' as $$
declare
 sid text := upper(trim(coalesce(new.raw_user_meta_data->>'scout_id','')));
 nick text := trim(coalesce(new.raw_user_meta_data->>'display_name',''));
 kind text := coalesce(new.raw_user_meta_data->>'chn_member_type','');
 adult boolean := (coalesce(new.raw_user_meta_data->>'chn_adult','false')='true');
 ref text := left(trim(coalesce(new.raw_user_meta_data->>'chn_referral','')),120);
begin
 if kind not in ('scout','supporter') then
   if sid !~ '^CHN-?[A-Z0-9]{4,12}$' then return new; end if;
   kind := 'scout';
 end if;
 if char_length(nick) not between 2 and 65 then raise exception 'Nombre inválido.'; end if;
 if kind='scout' then
   if sid !~ '^CHN-?[A-Z0-9]{4,12}$' then raise exception 'ID scout inválido.'; end if;
 else
   if not adult then raise exception 'Se requiere mayoría de edad para participar.'; end if;
   sid := null;
 end if;
 insert into public.chn_profiles(id,scout_id,display_name,group_name,member_type,adult_attested,referral_note)
 values(new.id,sid,nick,left(trim(coalesce(new.raw_user_meta_data->>'group_name','')),70),
        kind,adult,ref);
 return new;
end $$;

-- Cuenta existente de Study Compass puede solicitar acceso como simpatizante externo.
create function private.chn_register_supporter_impl(p_name text,p_referral text,p_adult boolean)
 returns void language plpgsql security definer set search_path = '' as $$
begin
 if (select auth.uid()) is null then raise exception 'Inicia sesión.'; end if;
 if p_adult is distinct from true then raise exception 'Se requiere mayoría de edad.'; end if;
 if char_length(trim(coalesce(p_name,''))) not between 2 and 65 then raise exception 'Nombre inválido.'; end if;
 insert into public.chn_profiles(id,scout_id,display_name,group_name,member_type,adult_attested,referral_note)
 values((select auth.uid()),null,trim(p_name),'Simpatizante','supporter',true,
        left(trim(coalesce(p_referral,'')),120));
end $$;
create function public.chn_register_supporter(p_name text,p_referral text,p_adult boolean)
 returns void language sql security invoker set search_path = '' as $$
 select private.chn_register_supporter_impl(p_name,p_referral,p_adult);
$$;
revoke all on function public.chn_register_supporter(text,text,boolean),
 private.chn_register_supporter_impl(text,text,boolean) from public,anon;
grant execute on function public.chn_register_supporter(text,text,boolean),
 private.chn_register_supporter_impl(text,text,boolean) to authenticated;

-- Nuevas rifas usan boleto de precio fijo; se desactiva la publicación de subastas.
alter table public.chn_listings
 add column ticket_price integer not null default 50 check (ticket_price between 1 and 100000),
 add column sales_authorized boolean not null default false,
 add column permit_number text,
 add column permit_expires_at timestamptz,
 add column official_rules_url text,
 add column winning_ticket_no integer;
alter table public.chn_listings add constraint chn_only_raffles check(type='raffle');
alter table public.chn_listings add constraint chn_permit_gate check (
 not sales_authorized or (
   permit_number is not null and char_length(trim(permit_number))>=5
   and permit_expires_at is not null
   and official_rules_url ~ '^https://'
 ));
grant insert(ticket_price),update(ticket_price) on public.chn_listings to authenticated;
-- Los usuarios NO tienen privilegio para cambiar sales_authorized o información del permiso.

create table public.chn_ticket_orders(
 id uuid primary key default gen_random_uuid(),
 listing_id uuid not null references public.chn_listings(id) on delete restrict,
 user_id uuid not null references public.chn_profiles(id) on delete restrict,
 quantity integer not null check(quantity between 1 and 10),
 unit_price integer not null check(unit_price>0),
 total_price integer generated always as (quantity*unit_price) stored,
 status text not null default 'pending' check(status in ('pending','confirmed','cancelled','expired')),
 expires_at timestamptz not null default (now()+interval '24 hours'),
 created_at timestamptz not null default now(),
 reviewed_at timestamptz,
 reviewed_by uuid references public.chn_profiles(id)
);
create index chn_ticket_orders_listing on public.chn_ticket_orders(listing_id,created_at desc);
create index chn_ticket_orders_user on public.chn_ticket_orders(user_id,created_at desc);

create table public.chn_ticket_numbers(
 id uuid primary key default gen_random_uuid(),
 listing_id uuid not null references public.chn_listings(id) on delete restrict,
 order_id uuid not null references public.chn_ticket_orders(id) on delete restrict,
 user_id uuid not null references public.chn_profiles(id) on delete restrict,
 ticket_no integer not null check(ticket_no > 0),
 issued_at timestamptz not null default now(),
 unique(listing_id,ticket_no)
);
create index chn_ticket_numbers_owner on public.chn_ticket_numbers(user_id,issued_at desc);
create index chn_ticket_numbers_order on public.chn_ticket_numbers(order_id);

alter table public.chn_draw_audit
 add column winning_ticket_no integer,
 add column draw_reference text;

alter table public.chn_ticket_orders enable row level security;
alter table public.chn_ticket_numbers enable row level security;
revoke all on public.chn_ticket_orders,public.chn_ticket_numbers from anon,authenticated;
grant select on public.chn_ticket_orders,public.chn_ticket_numbers to authenticated;
create policy "CHN orders owner or admin" on public.chn_ticket_orders for select to authenticated
 using ((select private.chn_is_verified()) and
        (user_id=(select auth.uid()) or (select private.chn_is_admin())));
create policy "CHN issued tickets owner or admin" on public.chn_ticket_numbers for select to authenticated
 using ((select private.chn_is_verified()) and
        (user_id=(select auth.uid()) or (select private.chn_is_admin())));

-- El cliente no puede insertar órdenes, confirmar folios ni cambiar importes.
create function private.chn_request_tickets_impl(p_listing uuid,p_quantity integer)
 returns uuid language plpgsql security definer set search_path = '' as $$
declare l public.chn_listings%rowtype; reserved integer; mine integer; result uuid;
begin
 if (select auth.uid()) is null or not private.chn_is_verified() then
   raise exception 'Tu cuenta aún no está habilitada.';
 end if;
 if not coalesce((select p.adult_attested from public.chn_profiles p where p.id=(select auth.uid())),false) then
   raise exception 'La adquisición de boletos está limitada a personas mayores de edad.';
 end if;
 if p_quantity is null or p_quantity not between 1 and 10 then raise exception 'Cantidad inválida.'; end if;
 select * into l from public.chn_listings where id=p_listing for update;
 if not found or l.type<>'raffle' or l.status<>'active' or l.end_at<=now() then
    raise exception 'La rifa no recibe solicitudes.';
 end if;
 if l.owner_id=(select auth.uid()) then raise exception 'No puedes solicitar boletos propios.'; end if;
 if not l.sales_authorized or l.permit_number is null or l.permit_expires_at<=now() then
    raise exception 'Los boletos todavía no están disponibles.';
 end if;
 select coalesce(sum(quantity),0) into reserved from public.chn_ticket_orders
   where listing_id=p_listing and status='pending' and expires_at>now();
 if reserved+l.entry_count+p_quantity>l.max_entries then raise exception 'No hay suficientes boletos disponibles.'; end if;
 select coalesce(sum(o.quantity),0) into mine from public.chn_ticket_orders o
   where o.listing_id=p_listing and o.user_id=(select auth.uid()) and
     (o.status='confirmed' or (o.status='pending' and o.expires_at>now()));
 if mine+p_quantity>l.max_per_user then raise exception 'Límite de boletos por persona alcanzado.'; end if;
 insert into public.chn_ticket_orders(listing_id,user_id,quantity,unit_price)
 values(p_listing,(select auth.uid()),p_quantity,l.ticket_price) returning id into result;
 return result;
end $$;
create function public.chn_request_tickets(p_listing uuid,p_quantity integer)
 returns uuid language sql security invoker set search_path = '' as $$
 select private.chn_request_tickets_impl(p_listing,p_quantity);
$$;

-- La confirmación solo la realiza admin después de comprobar manualmente su soporte documental.
create function private.chn_review_ticket_order_impl(p_order uuid,p_action text)
 returns void language plpgsql security definer set search_path = '' as $$
declare o public.chn_ticket_orders%rowtype; l public.chn_listings%rowtype;
 n integer; reserved integer;
begin
 if (select auth.uid()) is null or not private.chn_is_admin() then raise exception 'Solo administración.'; end if;
 select * into o from public.chn_ticket_orders where id=p_order;
 if not found then raise exception 'Solicitud no encontrada.'; end if;
 select * into l from public.chn_listings where id=o.listing_id for update;
 select * into o from public.chn_ticket_orders where id=p_order for update;
 if o.status<>'pending' then raise exception 'La solicitud ya fue procesada.'; end if;
 if p_action='cancelled' then
   update public.chn_ticket_orders set status='cancelled',reviewed_by=(select auth.uid()),reviewed_at=now() where id=p_order;
 elsif p_action='confirmed' then
   if o.expires_at<=now() then raise exception 'La solicitud expiró.'; end if;
   if not l.sales_authorized or l.permit_number is null or l.permit_expires_at<=now() then raise exception 'Sin autorización vigente.'; end if;
   if l.status<>'active' or l.end_at<=now() then raise exception 'Rifa no disponible.'; end if;
   if l.entry_count+o.quantity>l.max_entries then raise exception 'Cupo agotado.'; end if;
   select coalesce(max(ticket_no),0) into n from public.chn_ticket_numbers where listing_id=o.listing_id;
   update public.chn_ticket_orders set status='confirmed',reviewed_at=now(),reviewed_by=(select auth.uid()) where id=p_order;
   insert into public.chn_ticket_numbers(listing_id,order_id,user_id,ticket_no)
     select o.listing_id,o.id,o.user_id,n+v from generate_series(1,o.quantity) v;
   update public.chn_listings set entry_count=entry_count+o.quantity where id=o.listing_id;
 else
   raise exception 'Acción desconocida.';
 end if;
end $$;
create function public.chn_review_ticket_order(p_order uuid,p_action text)
 returns void language sql security invoker set search_path = '' as $$
 select private.chn_review_ticket_order_impl(p_order,p_action);
$$;

-- Nunca se selecciona al ganador mediante un algoritmo oculto.
-- Se registra el folio resultado de un sorteo realizado bajo supervisión conforme a su permiso.
create function private.chn_record_ticket_draw_impl(p_listing uuid,p_ticket_no integer,p_draw_reference text)
 returns uuid language plpgsql security definer set search_path = '' as $$
declare l public.chn_listings%rowtype; winner uuid;
begin
 if (select auth.uid()) is null or not private.chn_is_admin() then raise exception 'Solo administración.'; end if;
 select * into l from public.chn_listings where id=p_listing for update;
 if not found or l.type<>'raffle' or l.status<>'active' or l.end_at>now()
    or not l.sales_authorized then raise exception 'No es posible registrar el resultado.'; end if;
 if length(trim(coalesce(p_draw_reference,'')))<8 then raise exception 'Se necesita la referencia del acta del sorteo.'; end if;
 select user_id into winner from public.chn_ticket_numbers
  where listing_id=p_listing and ticket_no=p_ticket_no;
 if winner is null then raise exception 'Folio no confirmado.'; end if;
 update public.chn_listings set status='finished',winner_id=winner,winning_ticket_no=p_ticket_no where id=p_listing;
 insert into public.chn_draw_audit(listing_id,winner_id,entries_at_draw,drawn_by,winning_ticket_no,draw_reference)
 values(p_listing,winner,l.entry_count,(select auth.uid()),p_ticket_no,trim(p_draw_reference));
 return winner;
end $$;
create function public.chn_record_ticket_draw(p_listing uuid,p_ticket_no integer,p_draw_reference text)
 returns uuid language sql security invoker set search_path = '' as $$
 select private.chn_record_ticket_draw_impl(p_listing,p_ticket_no,p_draw_reference);
$$;

revoke all on function public.chn_request_tickets(uuid,integer),
 public.chn_review_ticket_order(uuid,text),
 public.chn_record_ticket_draw(uuid,integer,text),
 private.chn_request_tickets_impl(uuid,integer),
 private.chn_review_ticket_order_impl(uuid,text),
 private.chn_record_ticket_draw_impl(uuid,integer,text) from public,anon;
grant execute on function public.chn_request_tickets(uuid,integer),
 public.chn_review_ticket_order(uuid,text),
 public.chn_record_ticket_draw(uuid,integer,text),
 private.chn_request_tickets_impl(uuid,integer),
 private.chn_review_ticket_order_impl(uuid,text),
 private.chn_record_ticket_draw_impl(uuid,integer,text) to authenticated;

-- Eliminar las rutas anteriores para pujas y sorteos gratuitos desde la API.
revoke execute on function public.chn_place_bid(uuid,integer),public.chn_join_raffle(uuid),
 public.chn_finish_listing(uuid),private.chn_place_bid_impl(uuid,integer),
 private.chn_join_raffle_impl(uuid),private.chn_finish_listing_impl(uuid)
 from authenticated;
