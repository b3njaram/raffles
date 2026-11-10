-- Permitir completar un perfil CHN con RLS y permisos explícitos, sin usar RPC
-- que depende de un wrapper y provocaba 401 en ciertos clientes.
-- No se pueden establecer role, verified, avatar_path, bio o created_at al registrarse.
grant insert (id, scout_id, display_name, group_name, member_type, adult_attested, referral_note)
 on public.chn_profiles to authenticated;

create policy "CHN owner may create own pending profile"
 on public.chn_profiles for insert to authenticated
 with check (
   id = (select auth.uid())
   and role = 'member'
   and verified = false
   and (
     (member_type = 'scout' and scout_id ~ '^CHN-?[A-Z0-9]{4,12}$')
     or (member_type = 'supporter' and scout_id is null and adult_attested)
   )
 );

-- Admins can query their dashboard as before; no changes to study_* tables.
