begin;
create table public.notification_template_review_fulfilments_v1(action_request_id uuid primary key references public.admin_operational_action_requests(id),proposal_id uuid not null references public.notification_template_pair_activations_v1(proposal_id),proof_hash text not null check(proof_hash~'^[a-f0-9]{64}$'),resolved_by uuid not null references auth.users(id),reason text not null check(length(btrim(reason))between 10 and 2000),resolved_at timestamptz not null default clock_timestamp());
alter table public.notification_template_review_fulfilments_v1 enable row level security;
revoke all on public.notification_template_review_fulfilments_v1 from public,anon,authenticated,service_role;
create trigger notification_template_review_fulfilments_immutable before update or delete on public.notification_template_review_fulfilments_v1 for each row execute function private.prevent_update_delete();
create function public.get_notification_template_review_requests_v1(p_page integer default 1)returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,private as $$
begin
 if not private.notification_template_editor_access_v1()then raise exception'NOTIFICATION_TEMPLATE_EDITOR_DENIED'using errcode='42501';end if;
 if p_page is null or p_page not between 1 and 100000 then raise exception'INVALID_PAGE'using errcode='22023';end if;
 return jsonb_build_object('requests',coalesce((select jsonb_agg(jsonb_build_object('actionId',x.id,'templateCode',t.template_code,'sourceVersion',t.version,'reason',x.reason,'requestedAt',x.requested_at,'latestActivatedProposal',(select jsonb_build_object('id',p.id,'version',p.version,'createdAt',p.created_at)from public.notification_template_pair_proposals_v1 p join public.notification_template_pair_activations_v1 a on a.proposal_id=p.id where p.template_code=t.template_code and p.created_at>=x.requested_at order by a.activated_at desc,p.id desc limit 1))order by x.requested_at desc,x.id desc)from(select*from public.admin_operational_action_requests where status='REQUEST_TRACKED'and resource_type='NOTIFICATION_TEMPLATE'and redacted_summary->>'view'='preferences'order by requested_at desc,id desc limit 25 offset((p_page-1)*25))x join public.notification_template_versions t on t.id::text=x.redacted_summary->>'note'),'[]'),'has_next',(select count(*)from public.admin_operational_action_requests where status='REQUEST_TRACKED'and resource_type='NOTIFICATION_TEMPLATE'and redacted_summary->>'view'='preferences')>p_page::bigint*25);
end$$;
create function public.fulfil_notification_template_review_v1(p_action_request_id uuid,p_proposal_id uuid,p_reason text)returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare x public.admin_operational_action_requests%rowtype;p public.notification_template_pair_proposals_v1%rowtype;proof public.notification_template_review_fulfilments_v1%rowtype;w public.admin_work_items%rowtype;environment text;hash text;correlation uuid:=extensions.gen_random_uuid();result jsonb;
begin
 if not private.notification_template_editor_access_v1()then raise exception'NOTIFICATION_TEMPLATE_EDITOR_DENIED'using errcode='42501';end if;
 if length(btrim(coalesce(p_reason,'')))not between 10 and 2000 then raise exception'NOTIFICATION_TEMPLATE_REASON_REQUIRED'using errcode='22023';end if;
 select*into x from public.admin_operational_action_requests where id=p_action_request_id for update;
 select*into p from public.notification_template_pair_proposals_v1 where id=p_proposal_id;
 select e.environment into environment from private.admin_execution_environment_v1 e where e.singleton;
 if x.id is null or p.id is null or x.resource_type<>'NOTIFICATION_TEMPLATE'or x.redacted_summary->>'view'is distinct from'preferences'or x.target_environment is distinct from environment or p.target_environment is distinct from environment or p.created_at<x.requested_at or not exists(select 1 from public.notification_template_versions t where t.id::text=x.redacted_summary->>'note'and t.template_code=p.template_code)then raise exception'NOTIFICATION_TEMPLATE_REVIEW_SCOPE_MISMATCH'using errcode='42501';end if;
 select*into proof from public.notification_template_review_fulfilments_v1 where action_request_id=x.id;
 if proof.action_request_id is not null then if proof.proposal_id<>p.id then raise exception'NOTIFICATION_TEMPLATE_REVIEW_ALREADY_FULFILLED'using errcode='55000';end if;return jsonb_build_object('outcome','NOTIFICATION_TEMPLATE_REVIEW_FULFILLED','action_request_id',x.id,'proposal_id',p.id,'proof_hash',proof.proof_hash);end if;
 if x.status<>'REQUEST_TRACKED'or not exists(select 1 from public.notification_template_pair_activations_v1 where proposal_id=p.id and content_hash=p.content_hash)then raise exception'NOTIFICATION_TEMPLATE_ACTIVATION_PROOF_REQUIRED'using errcode='55000';end if;
 hash:=private.canonical_request_hash(jsonb_build_object('action_request_id',x.id,'request_hash',x.request_payload_hash,'proposal_id',p.id,'content_hash',p.content_hash,'reason',btrim(p_reason)));
 insert into public.notification_template_review_fulfilments_v1(action_request_id,proposal_id,proof_hash,resolved_by,reason)values(x.id,p.id,hash,auth.uid(),btrim(p_reason));
 update public.admin_operational_action_requests set status='EXECUTED',execution_result_hash=hash,row_version=row_version+1 where id=x.id;
 for w in select*from public.admin_work_items where resource_type='notification_template_review'and resource_id=x.id::text and status not in('RESOLVED','DISMISSED')for update loop
  update public.admin_work_items set status='RESOLVED',resolution_code='COMPLETED',resolution_reason=p_reason,resolution_evidence=jsonb_build_object('proposal_id',p.id,'proof_hash',hash,'template_changed',true),updated_at=clock_timestamp(),row_version=row_version+1 where id=w.id;
  insert into public.admin_work_item_events(work_item_id,event_type,from_status,to_status,actor_user_id,reason,evidence_snapshot,correlation_id)values(w.id,'HUMAN_RESOLUTION',w.status,'RESOLVED',auth.uid(),p_reason,jsonb_build_object('proposal_id',p.id,'proof_hash',hash),correlation);
 end loop;
 result:=jsonb_build_object('outcome','NOTIFICATION_TEMPLATE_REVIEW_FULFILLED','action_request_id',x.id,'proposal_id',p.id,'proof_hash',hash);
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(x.organization_id,auth.uid(),'USER','notification.template.review_fulfilled','admin_action_request',x.id::text,correlation,result,repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload)values(x.organization_id,'admin_action_request',x.id::text,'AdminActionExecutedV1',correlation,result||jsonb_build_object('actual_effect','BILINGUAL_TEMPLATE_PAIR_ACTIVATED'));
 return result;
end$$;
revoke all on function public.get_notification_template_review_requests_v1(integer),public.fulfil_notification_template_review_v1(uuid,uuid,text)from public,anon,authenticated,service_role;
grant execute on function public.get_notification_template_review_requests_v1(integer),public.fulfil_notification_template_review_v1(uuid,uuid,text)to authenticated;
notify pgrst,'reload schema';
commit;
