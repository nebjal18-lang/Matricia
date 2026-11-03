begin;
-- Provider revalidation is a separate current-identity decision. Changing a
-- legal identity must never retain the previous company's active eligibility.
do $$declare definition text;begin
 select pg_get_functiondef('private.execute_admin_organization_mutation_v1(uuid,uuid)'::regprocedure)into definition;
 if strpos(definition,'when changed and c.id is not null then''PENDING''')=0 then raise exception'IDENTITY_RESTRICTION_PATCH_TARGET_MISSING';end if;
 definition:=replace(definition,'when changed and c.id is not null then''PENDING''','when changed then''PENDING''');
 definition:=replace(definition,'new_status text;','new_status text; provider_identity_verified boolean:=false;');
 definition:=replace(definition,'update public.organizations set legal_name=',
 'if new_status=''ACTIVE''and exists(select 1 from public.provider_profiles where provider_organization_id=o.id)and exists(select 1 from public.admin_organization_identity_revisions_v1 where organization_id=o.id)then
   if to_regprocedure(''private.provider_current_identity_is_verified_v1(uuid)'')is not null then execute ''select private.provider_current_identity_is_verified_v1($1)''into provider_identity_verified using o.id;end if;
   if provider_identity_verified is not true then raise exception''PROVIDER_CURRENT_IDENTITY_REVERIFICATION_REQUIRED''using errcode=''55000'';end if;
  end if;
  update public.organizations set legal_name=');execute definition;
end$$;
commit;
