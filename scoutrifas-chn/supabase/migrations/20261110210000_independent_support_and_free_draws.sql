-- ScoutApoya: independent voluntary support and permit-gated FREE sweepstakes.
-- No cash processing, no donation -> drawing linkage, no "donate to enter" logic.
-- Disable all legacy paid ticket issuance endpoints.
revoke execute on function public.chn_request_tickets(uuid,integer),
 public.chn_review_ticket_order(uuid,text),
 public.chn_record_ticket_draw(uuid,integer,text)
 from authenticated;
revoke execute on function private.chn_request_tickets_impl(uuid,integer),
 private.chn_review_ticket_order_impl(uuid,text),
 private.chn_record_ticket_draw_impl(uuid,integer,text)
 from authenticated;
update public.chn_listings set sales_authorized=false where sales_authorized=true;
alter table public.chn_listings
 add constraint chn_paid_ticket_sales_disabled check(sales_authorized=false),
 add column free_entry_authorized boolean not null default false,
 add column free_entry_count integer not null default 0 check(free_entry_count>=0);
alter table public.chn_listings drop constraint chn_listings_ticket_price_check;
alter table public.chn_listings
 add constraint chn_free_draw_no_ticket_price check(ticket_price=0);
alter table public.chn_listings alter column ticket_price set default 0;
-- Other fields inherited from legacy schema are not used to sell/allocate tickets.

create table public.chn_support_pledges(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.chn_profiles(id) on delete restrict,
 amount integer not null check(amount between 20 and 100000),
 purpose text not null check(purpose in ('Actividades','Transporte','Materiales','Formación','General')),
 note text not null default '' check(char_length(note)<=240),
 status text not null default 'intent' check(status='intent'),
 created_at timestamptz not null default now()
);
create index chn_support_pledges_owner_created on public.chn_support_pledges(user_id,created_at desc);
alter table public.chn_support_pledges enable row level security;
revoke all on public.chn_support_pledges from anon,authenticated;
grant select on public.chn_support_pledges to authenticated;
create policy "CHN support intentions owner or admin"
 on public.chn_support_pledges for select to authenticated
 using ((select private.chn_is_verified()) and
 (user_id=(select auth.uid()) or (select private.chn_is_admin())));

create function private.chn_submit_support_intent_impl(p_amount integer,p_purpose text,p_note text)
 returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 if (select auth.uid()) is null or not private.chn_is_verified() then
  raise exception 'Tu cuenta todavía no tiene acceso.';
 end if;
 if p_amount is null or p_amount not between 20 and 100000 or
 p_purpose not in ('Actividades','Transporte','Materiales','Formación','General') or
 length(coalesce(p_note,''))>240 then raise exception 'Revisa los datos del apoyo.'; end if;
 insert into public.chn_support_pledges(user_id,amount,purpose,note)
 values((select auth.uid()),p_amount,p_purpose,trim(coalesce(p_note,'')))
 returning id into result;
 return result;
end $$;
create function public.chn_submit_support_intent(p_amount integer,p_purpose text,p_note text)
 returns uuid language sql security definer set search_path='' as $$
 select private.chn_submit_support_intent_impl(p_amount,p_purpose,p_note);
$$;
revoke all on function public.chn_submit_support_intent(integer,text,text),
 private.chn_submit_support_intent_impl(integer,text,text) from public,anon,authenticated;
grant execute on function public.chn_submit_support_intent(integer,text,text) to authenticated;

create table public.chn_free_draw_entries(
 id uuid primary key default gen_random_uuid(),
 listing_id uuid not null references public.chn_listings(id) on delete restrict,
 user_id uuid not null references public.chn_profiles(id) on delete restrict,
 entry_no integer not null check(entry_no>0),
 created_at timestamptz not null default now(),
 unique(listing_id,user_id),
 unique(listing_id,entry_no)
);
create index chn_free_draw_entries_owner on public.chn_free_draw_entries(user_id,created_at desc);
alter table public.chn_free_draw_entries enable row level security;
revoke all on public.chn_free_draw_entries from anon,authenticated;
grant select on public.chn_free_draw_entries to authenticated;
create policy "CHN free draw entries member or admin" on public.chn_free_draw_entries
 for select to authenticated
 using ((select private.chn_is_verified()) and
 (user_id=(select auth.uid()) or (select private.chn_is_admin())));

create table public.chn_free_draw_results(
 listing_id uuid primary key references public.chn_listings(id) on delete restrict,
 winner_id uuid not null references public.chn_profiles(id) on delete restrict,
 winning_entry_no integer not null,
 official_reference text not null check(length(trim(official_reference)) between 8 and 300),
 recorded_by uuid not null references public.chn_profiles(id),
 recorded_at timestamptz not null default now()
);
alter table public.chn_free_draw_results enable row level security;
revoke all on public.chn_free_draw_results from anon,authenticated;
grant select on public.chn_free_draw_results to authenticated;
create policy "CHN draw result visible to verified community"
 on public.chn_free_draw_results for select to authenticated
 using ((select private.chn_is_verified()));

create function private.chn_join_free_draw_impl(p_listing uuid)
 returns integer language plpgsql security definer set search_path='' as $$
declare listing public.chn_listings%rowtype; ticket integer;
begin
 if (select auth.uid()) is null or not private.chn_is_verified() then
  raise exception 'Necesitas una cuenta aprobada.';
 end if;
 select * into listing from public.chn_listings where id=p_listing for update;
 if not found or listing.status<>'active' or listing.end_at<=now() then
  raise exception 'El sorteo no está disponible.';
 end if;
 if not listing.free_entry_authorized or listing.permit_number is null
  or listing.permit_expires_at<=now() or listing.official_rules_url is null then
  raise exception 'La participación gratuita aún no está habilitada.';
 end if;
 if listing.owner_id=(select auth.uid()) then raise exception 'El organizador no puede participar.'; end if;
 if exists(select 1 from public.chn_free_draw_entries where listing_id=p_listing and user_id=(select auth.uid())) then
  raise exception 'Ya tienes una participación en este sorteo.';
 end if;
 if listing.free_entry_count>=listing.max_entries then raise exception 'El cupo está lleno.'; end if;
 ticket:=listing.free_entry_count+1;
 insert into public.chn_free_draw_entries(listing_id,user_id,entry_no)
 values(p_listing,(select auth.uid()),ticket);
 update public.chn_listings set free_entry_count=ticket where id=p_listing;
 return ticket;
end $$;
create function public.chn_join_free_draw(p_listing uuid) returns integer
 language sql security definer set search_path='' as $$
 select private.chn_join_free_draw_impl(p_listing);
$$;
revoke all on function public.chn_join_free_draw(uuid),
 private.chn_join_free_draw_impl(uuid) from public,anon,authenticated;
grant execute on function public.chn_join_free_draw(uuid) to authenticated;

create function private.chn_create_free_draw_impl(p_title text,p_description text,
 p_category text,p_end_at timestamptz,p_capacity integer,p_images text[])
 returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 if (select auth.uid()) is null or not private.chn_can_publish() then
  raise exception 'Solo organizadores aprobados pueden proponer sorteos.';
 end if;
 if p_images is null or cardinality(p_images) not between 1 and 10 then
  raise exception 'Agrega entre 1 y 10 fotografías.';
 end if;
 insert into public.chn_listings(
 owner_id,title,description,category,type,end_at,ticket_price,
 max_entries,max_per_user,image_paths,min_bid,bid_step,status,
 sales_authorized,free_entry_authorized)
 values((select auth.uid()),trim(p_title),trim(p_description),p_category,'raffle',p_end_at,
 0,p_capacity,1,p_images,0,10,'pending',false,false)
 returning id into result;
 return result;
end $$;
create function public.chn_create_free_draw(p_title text,p_description text,
 p_category text,p_end_at timestamptz,p_capacity integer,p_images text[]) returns uuid
 language sql security definer set search_path='' as $$
 select private.chn_create_free_draw_impl(p_title,p_description,p_category,p_end_at,p_capacity,p_images);
$$;
revoke all on function public.chn_create_free_draw(text,text,text,timestamptz,integer,text[]),
 private.chn_create_free_draw_impl(text,text,text,timestamptz,integer,text[])
 from public,anon,authenticated;
grant execute on function public.chn_create_free_draw(text,text,text,timestamptz,integer,text[])
 to authenticated;

create function private.chn_record_free_draw_impl(p_listing uuid,p_entry_no integer,
 p_reference text) returns uuid language plpgsql security definer set search_path='' as $$
declare item public.chn_listings%rowtype; winner uuid;
begin
 if (select auth.uid()) is null or not private.chn_is_admin() then
  raise exception 'Solo administración puede registrar resultados.';
 end if;
 select * into item from public.chn_listings where id=p_listing for update;
 if not found or item.status<>'active' or item.end_at>now()
  or not item.free_entry_authorized then
  raise exception 'El sorteo no está listo para cerrar.';
 end if;
 if length(trim(coalesce(p_reference,''))) not between 8 and 300 then
  raise exception 'Agrega la referencia del acta oficial.';
 end if;
 select user_id into winner from public.chn_free_draw_entries
 where listing_id=p_listing and entry_no=p_entry_no;
 if winner is null then raise exception 'No existe esa participación.'; end if;
 insert into public.chn_free_draw_results(listing_id,winner_id,winning_entry_no,official_reference,recorded_by)
 values(p_listing,winner,p_entry_no,trim(p_reference),(select auth.uid()));
 update public.chn_listings set winner_id=winner,winning_ticket_no=p_entry_no,status='finished'
 where id=p_listing;
 return winner;
end $$;
create function public.chn_record_free_draw(p_listing uuid,p_entry_no integer,p_reference text)
 returns uuid language sql security definer set search_path='' as $$
 select private.chn_record_free_draw_impl(p_listing,p_entry_no,p_reference);
$$;
revoke all on function public.chn_record_free_draw(uuid,integer,text),
 private.chn_record_free_draw_impl(uuid,integer,text) from public,anon,authenticated;
grant execute on function public.chn_record_free_draw(uuid,integer,text) to authenticated;

-- Stop old raffle creation path from writing a paid-price record after mode switch.
revoke execute on function public.chn_create_raffle_with_plan(text,text,text,timestamptz,integer,integer,integer,text[],integer,integer,integer,numeric)
 from authenticated;
revoke execute on function private.chn_create_raffle_with_plan_impl(text,text,text,timestamptz,integer,integer,integer,text[],integer,integer,integer,numeric)
 from authenticated;
-- New entrants are FREE and independent of support pledges: no FK or cross-table trigger joins them.
