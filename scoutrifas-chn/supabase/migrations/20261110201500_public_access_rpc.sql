-- The anonymous request wrapper needs to execute the internal validated function
-- under its definer privileges; granting USAGE on the private schema to anon
-- would expose unrelated internal namespace names.
create or replace function public.chn_request_access(
 p_email text,p_name text,p_kind text,p_scout_id text,
 p_group text,p_referral text,p_adult boolean,p_website text default ''
) returns void language sql security definer set search_path='' as $$
 select private.chn_request_access_impl(p_email,p_name,p_kind,p_scout_id,p_group,p_referral,p_adult,p_website);
$$;
revoke execute on function private.chn_request_access_impl(text,text,text,text,text,text,boolean,text) from anon;
grant execute on function public.chn_request_access(text,text,text,text,text,text,boolean,text) to anon,authenticated;
