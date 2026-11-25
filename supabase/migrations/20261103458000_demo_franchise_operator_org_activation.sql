begin;
-- A NON_CONTRACTUAL_DEMO franchise that is ACTIVE cannot leave its operator
-- organization PENDING: catalog ACL and financial books require ACTIVE.
-- CONTRACTUAL activation already refused PENDING orgs (FRANCHISE_ACTIVATION_ORGANIZATION_NOT_ACTIVE).
do $$
declare definition text;
anchor text := $anchor$update public.franchises set status='ACTIVE',activation_mode=p_activation_mode,current_mandate_version_id=active_m,updated_at=clock_timestamp(),row_version=row_version+1 where id=franchise.id;$anchor$;
patch text := $patch$update public.franchises set status='ACTIVE',activation_mode=p_activation_mode,current_mandate_version_id=active_m,updated_at=clock_timestamp(),row_version=row_version+1 where id=franchise.id;
 if p_activation_mode='NON_CONTRACTUAL_DEMO' and org_status='PENDING' then
  update public.organizations set status='ACTIVE',updated_at=clock_timestamp(),row_version=row_version+1 where id=org and status='PENDING';
 end if;$patch$;
begin
 select pg_get_functiondef('private.accept_franchise_activation_v1(uuid,text,integer,uuid,text,text,boolean,text,uuid)'::regprocedure) into definition;
 if (length(definition) - length(replace(definition, anchor, ''))) / length(anchor) <> 1 then
  raise exception 'FRANCHISE_OPERATOR_ORG_ACTIVATION_PATCH_TARGET_MISMATCH';
 end if;
 execute replace(definition, anchor, patch);
end$$;

update public.organizations o
set status = 'ACTIVE', updated_at = clock_timestamp(), row_version = o.row_version + 1
where o.status = 'PENDING'
  and exists (
    select 1
    from public.franchises f
    join public.franchise_activation_evidence e on e.franchise_id = f.id
    where f.operator_organization_id = o.id
      and f.status = 'ACTIVE'
      and e.activation_mode = 'NON_CONTRACTUAL_DEMO'
  );
commit;
