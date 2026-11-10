-- Los participantes pueden cancelar sus propias solicitudes aún pendientes.
create function private.chn_cancel_ticket_order_impl(p_order uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 if (select auth.uid()) is null then raise exception 'Inicia sesión.'; end if;
 update public.chn_ticket_orders
  set status='cancelled'
  where id=p_order and user_id=(select auth.uid()) and status='pending';
 if not found then raise exception 'No puedes cancelar una solicitud ya confirmada o ajena.'; end if;
end $$;
create function public.chn_cancel_ticket_order(p_order uuid) returns void
language sql security invoker set search_path='' as $$
 select private.chn_cancel_ticket_order_impl(p_order);
$$;
-- Administración puede cerrar solicitudes vencidas sin emisión de folios.
create function private.chn_expire_ticket_orders_impl() returns integer
language plpgsql security definer set search_path='' as $$
declare affected integer;
begin
 if (select auth.uid()) is null or not private.chn_is_admin() then
  raise exception 'Solo administración.';
 end if;
 update public.chn_ticket_orders set status='expired'
 where status='pending' and expires_at<=now();
 get diagnostics affected=row_count;
 return affected;
end $$;
create function public.chn_expire_ticket_orders() returns integer
language sql security invoker set search_path='' as $$
 select private.chn_expire_ticket_orders_impl();
$$;
revoke all on function private.chn_cancel_ticket_order_impl(uuid),
 public.chn_cancel_ticket_order(uuid),
 private.chn_expire_ticket_orders_impl(),
 public.chn_expire_ticket_orders() from public,anon;
grant execute on function private.chn_cancel_ticket_order_impl(uuid),
 public.chn_cancel_ticket_order(uuid),
 private.chn_expire_ticket_orders_impl(),
 public.chn_expire_ticket_orders() to authenticated;
