begin;
-- Identity commands share the same outer lock as new commitments, company
-- revalidation and quote identity publication. It precedes organization rows.
do $$declare definition text;begin
 select pg_get_functiondef('private.execute_admin_organization_mutation_v1(uuid,uuid)'::regprocedure)into definition;
 if strpos(definition,'p:=x.redacted_summary;')=0 then raise exception'ADMIN_IDENTITY_FINANCIAL_LOCK_PATCH_TARGET_MISSING';end if;
 definition:=replace(definition,'p:=x.redacted_summary;','p:=x.redacted_summary; perform pg_advisory_xact_lock(hashtextextended(''subscription-financial:''||x.resource_id,0));');execute definition;
end$$;
commit;
