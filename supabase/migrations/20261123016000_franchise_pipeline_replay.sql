begin;
create or replace function public.advance_franchise_pipeline(p_prospect_id uuid,p_to_stage text,p_reason_code text,p_evidence_refs jsonb,p_expected_row_version integer,p_idempotency_key text,p_correlation_id uuid default extensions.gen_random_uuid())
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private,extensions as $$
declare
 a uuid:=auth.uid();p public.franchise_crm_prospects%rowtype;saved public.idempotency_keys%rowtype;
 stages text[]:=array['SENT','OPENED','REGISTERED','PROFILE_STARTED','VERIFIED','DIAGNOSTIC_STARTED','OPPORTUNITY_CREATED','RFQ_STARTED','CONTRACT_SIGNED'];
 h text;r jsonb;org uuid;scope text;
begin
 select * into p from public.franchise_crm_prospects where id=p_prospect_id for update;
 if a is null or not found or not private.franchise_crm_write_access(p.franchise_id,a)then raise exception 'FRANCHISE_PIPELINE_DENIED' using errcode='42501';end if;
 if p_to_stage is null or not(p_to_stage=any(stages)) or length(btrim(coalesce(p_reason_code,'')))not between 3 and 80 or jsonb_typeof(p_evidence_refs)is distinct from 'array' or p_expected_row_version is null or p_expected_row_version<1 or p_correlation_id is null then raise exception 'INVALID_PIPELINE_TRANSITION' using errcode='23514';end if;
 select operator_organization_id into org from public.franchises where id=p.franchise_id;
 scope:='franchise.crm.pipeline.advance.'||p.id::text;
 h:=private.canonical_request_hash(jsonb_build_object('operation','franchise.crm.pipeline.advance.v2','prospect',p.id,'to',p_to_stage,'reason',p_reason_code,'evidence',p_evidence_refs,'expected',p_expected_row_version));
 perform pg_advisory_xact_lock(hashtextextended(org::text||':'||scope||':'||p_idempotency_key,0));
 select * into saved from public.idempotency_keys where organization_id=org and operation_scope=scope and key=p_idempotency_key;
 -- Completed receipts from the previous implementation include their original
 -- source stage. Validate that stored stage, never the mutable current stage.
 if found and saved.status='COMPLETED' and saved.response_body->>'prospect_id'=p.id::text
  and saved.request_hash=private.canonical_request_hash(jsonb_build_object('prospect',p.id,'from',saved.response_body->>'from_stage','to',p_to_stage,'reason',p_reason_code,'evidence',p_evidence_refs,'expected',p_expected_row_version))then
  h:=saved.request_hash;
 end if;
 r:=private.begin_contract_command(org,scope,p_idempotency_key,h,a);
 if r is not null then return r;end if;
 if array_position(stages,p_to_stage)<>array_position(stages,p.pipeline_stage)+1 then raise exception 'INVALID_PIPELINE_TRANSITION' using errcode='23514';end if;
 if p.row_version<>p_expected_row_version then raise exception 'STALE_FRANCHISE_PROSPECT' using errcode='PT409';end if;
 update public.franchise_crm_prospects set pipeline_stage=p_to_stage,updated_at=clock_timestamp(),row_version=row_version+1 where id=p.id;
 insert into public.franchise_pipeline_events(franchise_id,prospect_id,from_stage,to_stage,reason_code,evidence_refs,idempotency_key,actor_user_id,correlation_id)
 values(p.franchise_id,p.id,p.pipeline_stage,p_to_stage,p_reason_code,p_evidence_refs,p_idempotency_key,a,p_correlation_id);
 r:=jsonb_build_object('outcome','FRANCHISE_PIPELINE_ADVANCED','prospect_id',p.id,'from_stage',p.pipeline_stage,'to_stage',p_to_stage,'row_version',p.row_version+1);
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)
 values(org,a,'USER','franchise.crm.pipeline_advanced','franchise_prospect',p.id::text,p_correlation_id,r,repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)
 values(org,'franchise_prospect',p.id::text,'FranchisePipelineAdvancedV1',p_correlation_id,r,p_idempotency_key);
 perform private.finish_contract_command(org,scope,p_idempotency_key,r);
 return r;
end$$;
notify pgrst,'reload schema';
commit;
