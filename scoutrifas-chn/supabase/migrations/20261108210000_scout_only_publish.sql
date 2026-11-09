-- Ajuste de acceso y autopresentación responsable de mayoría de edad.
create function private.chn_can_publish() returns boolean
language sql stable security definer set search_path = '' as $$
 select coalesce((select p.verified and (p.member_type='scout' or p.role='admin')
  from public.chn_profiles p where p.id=(select auth.uid())),false)
$$;
revoke all on function private.chn_can_publish() from public,anon;
grant execute on function private.chn_can_publish() to authenticated;
drop policy if exists "CHN verified member submits for review" on public.chn_listings;
create policy "CHN verified scout submits for review" on public.chn_listings
 for insert to authenticated with check (owner_id=(select auth.uid()) and status='pending'
 and (select private.chn_can_publish()) and end_at>now());
drop policy if exists "CHN upload own private listing photos" on storage.objects;
create policy "CHN upload own private listing photos" on storage.objects
 for insert to authenticated with check (bucket_id='chn-listings' and (select private.chn_can_publish())
 and (storage.foldername(name))[1]=(select auth.uid())::text
 and (storage.foldername(name))[2]='listings'
 and lower(storage.extension(name)) in ('jpg','jpeg','png','webp'));
create function private.chn_attest_adult_impl() returns void
 language plpgsql security definer set search_path = '' as $$
begin
 if (select auth.uid()) is null then raise exception 'Inicia sesión.'; end if;
 update public.chn_profiles set adult_attested=true
  where id=(select auth.uid());
 if not found then raise exception 'Completa tu perfil primero.'; end if;
end $$;
create function public.chn_attest_adult() returns void
 language sql security invoker set search_path = '' as $$
 select private.chn_attest_adult_impl();
$$;
revoke all on function private.chn_attest_adult_impl(),public.chn_attest_adult() from public,anon;
grant execute on function private.chn_attest_adult_impl(),public.chn_attest_adult() to authenticated;
