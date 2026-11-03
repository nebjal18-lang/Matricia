begin;
alter function public.get_admin_organization_fiche(uuid)rename to get_admin_organization_fiche_before_client_facts_v1;
revoke all on function public.get_admin_organization_fiche_before_client_facts_v1(uuid)from public,anon,authenticated,service_role;
create function public.get_admin_organization_fiche(p_organization_id uuid)returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,private as $$
declare result jsonb;c public.client_compliance_cases%rowtype;p public.client_profile_versions%rowtype;profile jsonb;snapshot jsonb;actions jsonb;
begin
 result:=public.get_admin_organization_fiche_before_client_facts_v1(p_organization_id);
 select*into c from public.client_compliance_cases where organization_id=p_organization_id;
 if c.id is not null then
  select*into p from public.client_profile_versions where compliance_case_id=c.id and version=c.current_profile_version;
  profile:=case when p.id is null then null else jsonb_build_object('version',p.version,'legal_form',p.profile_data->>'legal_form','activity',p.profile_data->>'activity','registered_city',p.profile_data->>'registered_city','registered_address',p.profile_data->'registered_address','if_number',p.profile_data->>'if_number','rc_number',p.profile_data->>'rc_number')end;
  select coalesce(jsonb_agg(item order by item->>'kind',item->>'id'),'[]')into actions from(
   select jsonb_build_object('id',id,'kind','ANOMALY','code',anomaly_code,'label_fr',client_message_fr,'label_ar',client_message_ar) item from public.client_administrative_anomalies where compliance_case_id=c.id and blocking and status in('OPEN','QUESTIONED')
   union all select jsonb_build_object('id',id,'kind','QUESTION','code',status,'label_fr',question_text_fr,'label_ar',question_text_ar)from public.client_compliance_questions where compliance_case_id=c.id and status in('OPEN','ANSWERED'))a;
  snapshot:=jsonb_build_object('case_id',c.id,'status',c.status,'profile_version',c.current_profile_version,'document_count',(select count(*)from public.client_compliance_documents where compliance_case_id=c.id and status<>'SUPERSEDED'),'verified_document_count',(select count(*)from public.client_compliance_documents where compliance_case_id=c.id and status='VERIFIED'and scan_status='CLEAN'and(expires_on is null or expires_on>=current_date)),'currently_verified',c.status='VERIFIED'and private.client_identity_allows_new_operations(p_organization_id),'required_actions',actions);
 end if;
 return jsonb_set(result,'{organization}',result->'organization'||jsonb_build_object('client_compliance_status',c.status,'client_legal_profile',profile,'client_compliance_snapshot',snapshot))||jsonb_build_object('client_request_count',(select count(*)from public.service_requests where client_organization_id=p_organization_id));
end$$;
revoke all on function public.get_admin_organization_fiche(uuid)from public,anon,authenticated,service_role;
grant execute on function public.get_admin_organization_fiche(uuid)to authenticated;
notify pgrst,'reload schema';
commit;
