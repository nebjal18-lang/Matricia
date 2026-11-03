begin;
-- A published identity can have an independent draft revision. Submitting or
-- approving that revision cannot remove the previously published catalogue or
-- publish the new version before its approved/attested release executes.
do $$declare definition text;old_guard text:='if v_version.status is distinct from ''DRAFT'' or v_identity.status is distinct from ''DRAFT'' then';new_guard text;
 old_update text:='update public.catalog_services set status = ''IN_REVIEW'', row_version = row_version + 1 where id = p_service_id;';
begin
 select pg_get_functiondef('public.submit_franchise_catalog_service(uuid,uuid,integer,integer,text,uuid)'::regprocedure)into definition;
 if(length(definition)-length(replace(definition,old_guard,'')))/length(old_guard)<>1 or(length(definition)-length(replace(definition,old_update,'')))/length(old_update)<>1 then raise exception'SERVICE_REVISION_SUBMIT_SOURCE_MISMATCH';end if;
 new_guard:='if v_version.status is distinct from ''DRAFT'' or not(v_identity.status=''DRAFT''or(v_identity.status=''PUBLISHED''and v_identity.current_published_version_id is distinct from p_version_id and exists(select 1 from public.catalog_service_versions published where published.id=v_identity.current_published_version_id and published.service_id=p_service_id and published.status=''PUBLISHED'')))then';
 definition:=replace(definition,old_guard,new_guard);
 definition:=replace(definition,old_update,'update public.catalog_services set status=case when current_published_version_id is not null then ''PUBLISHED''else ''IN_REVIEW''end,row_version=row_version+1 where id=p_service_id;');
 execute definition;
end$$;
-- A fresh installation reaches this before the bundle/core split. An existing
-- installation already has its exact native body under the private core name.
-- In either case retain every newer public approval/MFA/four-eyes wrapper.
do $$declare definition text;target regprocedure;marker text:='update public.catalog_services set status = v_status, row_version = row_version + 1 where id = v_change.target_id;';begin
 target:=coalesce(to_regprocedure('private.decide_catalog_change_before_questionnaire_bundle(uuid,text,text,integer,text,uuid)'),to_regprocedure('public.decide_catalog_change(uuid,text,text,integer,text,uuid)'));
 select pg_get_functiondef(target)into definition;
 if(length(definition)-length(replace(definition,marker,'')))/length(marker)<>1 then raise exception'SERVICE_REVISION_DECISION_SOURCE_MISMATCH';end if;
 execute replace(definition,marker,'update public.catalog_services set status=case when current_published_version_id is not null then ''PUBLISHED''else v_status end,row_version=row_version+1 where id=v_change.target_id;');
end$$;
commit;
