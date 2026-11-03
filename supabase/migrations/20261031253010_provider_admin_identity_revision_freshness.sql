begin;
-- Preserve fiscal identity hashes until the first authorized identity revision.
-- Thereafter the legal profile participates in the fingerprint, so an old
-- quote address cannot revive merely because the fiscal identifiers are equal.
create or replace function private.provider_current_identity_snapshot_v1(p_org uuid)returns jsonb language sql stable security definer set search_path=pg_catalog,public,private as $$
 select jsonb_build_object('legal_name',o.legal_name,'country_code',o.country_code,'identifiers',coalesce((select jsonb_object_agg(identifier_type,normalized_value::text order by identifier_type,normalized_value::text)from public.organization_identifiers where organization_id=o.id and is_active and identifier_type in('ICE','IF','RC')),'{}'::jsonb))||case when exists(select 1 from public.admin_organization_identity_revisions_v1 where organization_id=o.id)then jsonb_build_object('canonical_legal_profile_hash',private.canonical_request_hash(private.admin_organization_identity_edit_snapshot_v1(o.id)#>'{client_case,legal_profile}'))else'{}'::jsonb end from public.organizations o where o.id=p_org
$$;
create function private.provider_canonical_registered_address_v1(p_org uuid)returns text language sql stable security definer set search_path=pg_catalog,public,private as $$
 select case when exists(select 1 from public.admin_organization_identity_revisions_v1 where organization_id=p_org)and length(btrim(coalesce(profile#>>'{registered_address,line1}','')))>=3 then concat_ws(', ',nullif(profile#>>'{registered_address,line1}',''),nullif(profile#>>'{registered_address,line2}',''),nullif(profile#>>'{registered_address,postal_code}',''),nullif(profile->>'registered_city',''),nullif(profile#>>'{registered_address,country_code}',''))end from(select private.admin_organization_identity_edit_snapshot_v1(p_org)#>'{client_case,legal_profile}'profile)p
$$;
revoke all on function private.provider_canonical_registered_address_v1(uuid)from public,anon,authenticated,service_role;
-- Preserve the Provider helper OID used by its RLS/eligibility consumers. A
-- newly reviewed Client legal address cannot revive an old Provider decision.
do $$declare definition text;begin
 select pg_get_functiondef('private.provider_current_identity_is_verified_v1(uuid)'::regprocedure)into definition;
 if strpos(definition,'and h.id=')=0 then raise exception'PROVIDER_IDENTITY_FRESHNESS_PATCH_TARGET_MISSING';end if;
 definition:=replace(definition,'and h.id=','and not exists(select 1 from public.admin_organization_identity_revisions_v1 revision where revision.organization_id=p_org and revision.created_at>h.verified_at)and h.id=');execute definition;
 select pg_get_functiondef('public.get_provider_identity_review_context_v1(uuid)'::regprocedure)into definition;
 if strpos(definition,'''currently_verified'',')=0 then raise exception'PROVIDER_LEGAL_PROFILE_CONTEXT_PATCH_TARGET_MISSING';end if;
 definition:=replace(definition,'''currently_verified'',','''canonical_client_legal_profile'',private.admin_organization_identity_edit_snapshot_v1(o.id)#>''{client_case,legal_profile}'',''currently_verified'',');execute definition;
end$$;
notify pgrst,'reload schema';
commit;
