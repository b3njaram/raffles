-- Los usuarios deben poder leer sus propios archivos recién cargados,
-- incluso antes de insertar una rifa. Las imágenes de otros siguen privadas.
drop policy if exists "CHN only verified members access listing photos" on storage.objects;
create policy "CHN only verified members access listing photos"
on storage.objects for select to authenticated
using (
 bucket_id='chn-listings'
 and ((select private.chn_is_verified()) or (select private.chn_is_admin()))
 and (
   (storage.foldername(name))[1] = (select auth.uid())::text
   or exists (
     select 1 from public.chn_listings l
     where name=any(l.image_paths)
     and (l.status in ('active','finished') or l.owner_id=(select auth.uid()) or (select private.chn_is_admin()))
   )
 )
);
drop policy if exists "CHN read own avatar objects" on storage.objects;
create policy "CHN read own avatar objects"
on storage.objects for select to authenticated
using (
 bucket_id='chn-avatars'
 and (storage.foldername(name))[1]=(select auth.uid())::text
);
