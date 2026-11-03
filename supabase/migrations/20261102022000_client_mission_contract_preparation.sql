begin;
-- The Client configures execution dates and responsibility; signed content and
-- governed checklist keys remain authoritative and are re-read at mutation time.
create function public.get_client_mission_preparation_v1(p_contract_id uuid,p_contract_version_id uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,private as $$
declare c public.contracts%rowtype;cv public.contract_versions%rowtype;t public.service_checklist_templates%rowtype;ds jsonb;
begin
 select*into c from public.contracts where id=p_contract_id;
 if auth.uid()is null or c.id is null or not private.has_org_role(c.client_organization_id,array['CLIENT_OWNER','CLIENT_ADMIN'])then raise exception'MISSION_CREATE_DENIED'using errcode='42501';end if;
 select*into cv from public.contract_versions where id=p_contract_version_id and contract_id=c.id and version=c.current_version;
 if cv.id is null or c.status not in('ACTIVE','AMENDED')then raise exception'STALE_CONTRACT_VERSION'using errcode='40001';end if;
 select*into t from public.service_checklist_templates where id=private.contract_mission_checklist_template_v1(cv.id);
 select jsonb_agg(jsonb_build_object('key',i.item_key,'label_fr',i.label_fr,'label_ar',i.label_ar,'source_description',case when jsonb_typeof(i.details->'source_deliverable')='string'then i.details->>'source_deliverable'else null end)order by i.sort_order,i.id)into ds from public.contract_items i where i.contract_version_id=cv.id and i.item_type='DELIVERABLE';
 if ds is null then raise exception'CONTRACT_DELIVERABLES_REQUIRED'using errcode='55000';end if;
 return jsonb_build_object('contract_id',c.id,'contract_version_id',cv.id,'template_hash',t.content_hash,'client_organization_id',c.client_organization_id,'provider_organization_id',c.provider_organization_id,'deliverables',ds,'criteria',(select jsonb_agg(jsonb_build_object('key',x->>'key','label_fr',x->>'label_fr','label_ar',x->>'label_ar','proof_required',(x->>'proof_required')::boolean))from jsonb_array_elements(t.items)x));
end$$;
create function public.create_client_prepared_mission_v1(p_contract_id uuid,p_contract_version_id uuid,p_template_hash text,p_assignments jsonb,p_idempotency_key text,p_correlation_id uuid default extensions.gen_random_uuid())
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare plan jsonb;x jsonb;d jsonb;k text;ms jsonb:='[]';ds jsonb:='[]';cs jsonb:='[]';i integer:=0;
begin
 -- Lock the contractual parent while resolving all authoritative execution data.
 perform 1 from public.contracts where id=p_contract_id for update;
 plan:=public.get_client_mission_preparation_v1(p_contract_id,p_contract_version_id);
 if p_template_hash is distinct from plan->>'template_hash'then raise exception'MISSION_CHECKLIST_CHANGED'using errcode='40001';end if;
 if jsonb_typeof(p_assignments)is distinct from'array'or jsonb_array_length(p_assignments)<>jsonb_array_length(plan->'deliverables')or(select count(*)<>count(distinct y->>'deliverable_key')from jsonb_array_elements(p_assignments)y)then raise exception'INVALID_MISSION_ASSIGNMENTS'using errcode='22023';end if;
 for x in select*from jsonb_array_elements(p_assignments)loop
  select value into d from jsonb_array_elements(plan->'deliverables')where value->>'key'=x->>'deliverable_key';
  if d is null or x->>'owner_organization_id'not in(plan->>'client_organization_id',plan->>'provider_organization_id')or jsonb_typeof(x->'criterion_keys')is distinct from'array'or jsonb_array_length(x->'criterion_keys')not between 1 and 100 or(select count(*)<>count(distinct y)from jsonb_array_elements_text(x->'criterion_keys')y)then raise exception'INVALID_MISSION_ASSIGNMENT_SCOPE'using errcode='22023';end if;
  if nullif(x->>'due_at','')is not null then perform(x->>'due_at')::timestamptz;end if;
  i:=i+1;
  ms:=ms||jsonb_build_array(jsonb_build_object('key','STAGE_'||i,'title_fr',d->>'label_fr','title_ar',d->>'label_ar','sort_order',i,'due_at',x->>'due_at','owner_organization_id',x->>'owner_organization_id','validation_required',true));
  ds:=ds||jsonb_build_array(jsonb_build_object('key',d->>'key','milestone_key','STAGE_'||i,'label_fr',d->>'label_fr','label_ar',d->>'label_ar','proof_required',true));
  for k in select*from jsonb_array_elements_text(x->'criterion_keys')loop
   if not exists(select 1 from jsonb_array_elements(plan->'criteria')y where y->>'key'=k)then raise exception'MISSION_CRITERION_OUTSIDE_CHECKLIST'using errcode='22023';end if;
   cs:=cs||jsonb_build_array(jsonb_build_object('deliverable_key',d->>'key','criterion_key',k));
  end loop;
 end loop;
 return public.create_mission(p_contract_id,p_contract_version_id,ms,ds,cs,p_idempotency_key,p_correlation_id);
end$$;
revoke all on function public.get_client_mission_preparation_v1(uuid,uuid),public.create_client_prepared_mission_v1(uuid,uuid,text,jsonb,text,uuid)from public,anon,authenticated,service_role;
grant execute on function public.get_client_mission_preparation_v1(uuid,uuid),public.create_client_prepared_mission_v1(uuid,uuid,text,jsonb,text,uuid)to authenticated;
notify pgrst,'reload schema';
commit;
