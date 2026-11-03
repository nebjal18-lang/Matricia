begin;
-- Reuse clean private evidence from the same organization in questionnaire answers.
-- Recursion and all existing Client evidence checks remain intact.
do $migration$
declare definition text;marker text;
begin
 definition:=pg_get_functiondef('private.is_valid_questionnaire_document_references(text,jsonb,jsonb,uuid)'::regprocedure);
 marker:='and (p_answer_type <> ''IMAGE'' or d.declared_mime_type like ''image/%'')
    );';
 if position(marker in definition)=0 then raise exception 'PROVIDER_QUESTIONNAIRE_EVIDENCE_PATCH_SOURCE_MISMATCH';end if;
 execute replace(definition,marker,'and (p_answer_type <> ''IMAGE'' or d.declared_mime_type like ''image/%'')
    )or exists(select 1 from public.provider_document_versions d where d.id=v_document_id and d.provider_organization_id=p_organization_id and d.status in(''SUBMITTED'',''VERIFIED'')and(d.expires_on is null or d.expires_on>current_date)and private.provider_document_is_clean(d.storage_object_path,d.content_hash)and(p_answer_type<>''IMAGE''or d.metadata->>''declared_mime_type''like''image/%''));');
end
$migration$;
create function public.list_provider_questionnaire_documents_v1(p_provider_organization_id uuid)returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,private as $$
begin
 if not private.has_org_role(p_provider_organization_id,array['PROVIDER_OWNER','PROVIDER_MANAGER','PROVIDER_SALES','PROVIDER_TECHNICIAN','PROVIDER_ACCOUNTING','PROVIDER_VIEWER'],auth.uid())then raise exception 'PROVIDER_SCOPE_DENIED'using errcode='42501';end if;
 return(select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'organization_id',d.provider_organization_id,'original_file_name',f.code||' · v'||d.version_number::text,'document_type',f.document_kind,'declared_mime_type',d.metadata->>'declared_mime_type','status',case when d.status='VERIFIED'then'VERIFIED'else'PENDING_REVIEW'end)order by f.code),'[]'::jsonb)from public.provider_document_families f join lateral(select v.*from public.provider_document_versions v where v.family_id=f.id order by v.version_number desc limit 1)d on true where f.provider_organization_id=p_provider_organization_id and d.status in('SUBMITTED','VERIFIED')and(d.expires_on is null or d.expires_on>current_date)and private.provider_document_is_clean(d.storage_object_path,d.content_hash));
end$$;
revoke all on function public.list_provider_questionnaire_documents_v1(uuid)from public,anon,authenticated,service_role;
grant execute on function public.list_provider_questionnaire_documents_v1(uuid)to authenticated;
notify pgrst,'reload schema';

commit;
