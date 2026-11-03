begin;
-- Repair the structural cause through the existing authorized save command.
-- Published service/link versions, independent review and release guards remain
-- intact. Saving a legacy service never approves or publishes the repaired link.
do $$declare definition text;anchor text;replacement text;signature text:='public.save_catalog_service_draft(uuid,uuid,uuid,text,text,text,text,text,text,text,text,text,text,text,boolean,boolean,boolean,boolean,boolean,boolean,text,integer,jsonb,jsonb,boolean,text,integer,integer,text,uuid)';begin
 definition:=pg_get_functiondef(signature::regprocedure);
 anchor:='v_link_hash text;v_response jsonb;';
 if(length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 then raise exception'CATALOG_PRIMARY_LINK_REPAIR_DECLARATION_SOURCE_MISMATCH';end if;
 definition:=replace(definition,anchor,'v_link_hash text;v_primary_link_repaired boolean:=false;v_response jsonb;');
 anchor:=' if v_identity.primary_subcategory_id is distinct from p_primary_subcategory_id then';
 if(length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 then raise exception'CATALOG_PRIMARY_LINK_REPAIR_BRANCH_SOURCE_MISMATCH';end if;
 replacement:=$source$
 -- The service lock above serializes every native save/link mutation. A current
 -- identity alone is insufficient if its exact version is missing/inconsistent.
 select link.id,version.id into v_link,v_link_version from public.catalog_service_subcategory_links link
  join public.catalog_service_subcategory_link_versions version on version.id=link.current_version_id and version.link_id=link.id
  where link.service_id=p_service_id and link.subcategory_id=p_primary_subcategory_id and link.library_id=v_identity.library_id
   and link.link_type='PRIMARY'and link.status not in('RETIRED','ARCHIVED')
   and version.library_id=v_identity.library_id and version.service_id=p_service_id and version.subcategory_id=p_primary_subcategory_id
   and version.link_type='PRIMARY'and version.status not in('RETIRED','ARCHIVED');
 v_primary_link_repaired:=not found;
 if v_identity.primary_subcategory_id is distinct from p_primary_subcategory_id or v_primary_link_repaired then
$source$;
 definition:=replace(definition,anchor,replacement);
 -- This exact pair occurs only in receipt + immutable audit metadata. Preserve
 -- every other field, command hash, replay path and the native link writer.
 anchor:='''parent_changed'',v_identity.primary_subcategory_id is distinct from p_primary_subcategory_id,''command_id'',v_command';
 if(length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>2 then raise exception'CATALOG_PRIMARY_LINK_REPAIR_AUDIT_SOURCE_MISMATCH';end if;
 definition:=replace(definition,anchor,'''parent_changed'',v_identity.primary_subcategory_id is distinct from p_primary_subcategory_id,''primary_link_repaired'',v_primary_link_repaired,''primary_link_id'',v_link,''primary_link_version_id'',v_link_version,''command_id'',v_command');
 anchor:='''primary_subcategory_id'',p_primary_subcategory_id,''new_version'',not(v_old.status=''DRAFT'' and v_old.translation_review_status<>''APPROVED''))';
 if(length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 then raise exception'CATALOG_PRIMARY_LINK_REPAIR_OUTBOX_SOURCE_MISMATCH';end if;
 definition:=replace(definition,anchor,'''primary_subcategory_id'',p_primary_subcategory_id,''primary_link_repaired'',v_primary_link_repaired,''primary_link_id'',v_link,''primary_link_version_id'',v_link_version,''new_version'',not(v_old.status=''DRAFT'' and v_old.translation_review_status<>''APPROVED''))');
 execute definition;
end$$;
commit;
