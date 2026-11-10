-- Resumen confiable y eficiente de la operación; las cifras no dependen de un LIMIT del frontend.
create function private.chn_admin_metrics_impl()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
 orders_total bigint;
 orders_pending bigint;
 orders_confirmed bigint;
 tickets_total bigint;
 reference_total bigint;
 members_total bigint;
 members_pending bigint;
 supporters_total bigint;
begin
 if (select auth.uid()) is null or not private.chn_is_admin() then
  raise exception 'Solo administración.';
 end if;
 select count(*),
        count(*) filter(where status='pending' and expires_at>now()),
        count(*) filter(where status='confirmed'),
        coalesce(sum(total_price) filter(where status='confirmed'),0)
 into orders_total,orders_pending,orders_confirmed,reference_total
 from public.chn_ticket_orders;
 select count(*) into tickets_total from public.chn_ticket_numbers;
 select count(*),
        count(*) filter(where not verified),
        count(*) filter(where member_type='supporter' and verified)
 into members_total,members_pending,supporters_total
 from public.chn_profiles;
 return jsonb_build_object(
  'totalOrders',orders_total,'pending',orders_pending,
  'confirmed',orders_confirmed,'totalTickets',tickets_total,
  'totalReference',reference_total,
  'memberCount',members_total,'pendingMembers',members_pending,
  'supportersCount',supporters_total
 );
end $$;
create function public.chn_admin_metrics() returns jsonb
language sql security invoker set search_path='' as $$
 select private.chn_admin_metrics_impl();
$$;
revoke all on function private.chn_admin_metrics_impl(),public.chn_admin_metrics() from public,anon;
grant execute on function private.chn_admin_metrics_impl(),public.chn_admin_metrics() to authenticated;
