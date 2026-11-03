begin;
lock table public.reward_award_approvals in share row exclusive mode;
-- A compliance approval is a decision, not credit-issuance authority. The
-- immutable request and immutable completion below separate those two facts.
create table public.client_referral_reward_execution_requests_v1(
 approval_id uuid primary key references public.reward_award_approvals(id),
 organization_id uuid not null references public.organizations(id),
 source_event_id uuid not null references public.reward_source_events(id),
 rule_version_id uuid not null references public.reward_rule_versions(id),
 requested_by uuid not null references auth.users(id),requested_at timestamptz not null,
 source_hash text not null check(source_hash~'^[a-f0-9]{64}$')
);
create table public.client_referral_reward_execution_facts_v1(
 approval_id uuid primary key references public.client_referral_reward_execution_requests_v1(approval_id),
 organization_id uuid not null references public.organizations(id),
 reward_grant_id uuid not null unique references public.reward_grants(id),
 recorded_by uuid not null references auth.users(id),recorded_at timestamptz not null default clock_timestamp(),
 result jsonb not null check(jsonb_typeof(result)='object'),correlation_id uuid not null
);
do $$declare t text;begin foreach t in array array['client_referral_reward_execution_requests_v1','client_referral_reward_execution_facts_v1']loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
 execute format('create trigger %I before update or delete on public.%I for each row execute function private.prevent_update_delete()',left(t,44)||'_immutable',t);
end loop;end$$;

create function private.assert_client_referral_reward_staff_v1(p_execute boolean)returns void
language plpgsql stable security definer set search_path=pg_catalog,private as $$
begin
 if auth.uid()is null or not private.current_auth_session_active_v1()then raise exception'REAUTHENTICATION_REQUIRED'using errcode='28000';end if;
 if auth.jwt()->>'aal'is distinct from'aal2'then raise exception'REFERRAL_REWARD_AAL2_REQUIRED'using errcode='42501';end if;
 if not coalesce(private.rewards_sensitive_aal2(auth.uid()),false)then raise exception'REFERRAL_REWARD_REVIEW_DENIED'using errcode='42501';end if;
 if p_execute and not coalesce(private.credits_admin_access(auth.uid()),false)then raise exception'REFERRAL_REWARD_EXECUTION_DENIED'using errcode='42501';end if;
end$$;
revoke all on function private.assert_client_referral_reward_staff_v1(boolean)from public,anon,authenticated,service_role;

-- Retain the existing after-decision trigger, but replace its financial side
-- effect with a durable, auditable request. No worker may impersonate Finance.
create or replace function private.execute_approved_client_referral_reward_v1()returns trigger
language plpgsql security definer set search_path=pg_catalog as $$
declare e public.reward_source_events%rowtype;payload jsonb;h text;
begin
 select *into e from public.reward_source_events where id=new.source_event_id and organization_id=new.organization_id
 and source_reference_type='REFERRAL_CONVERSION'and audience_type in('REFERRED_CLIENT','CLIENT_ORGANIZATION');
 if e.id is null then return new;end if;
 perform private.assert_client_referral_reward_staff_v1(false);
 if new.decision<>'APPROVED'then return new;end if;
 h:=private.canonical_request_hash(jsonb_build_object('approval_id',new.id,'organization_id',new.organization_id,'source_event_id',e.id,'rule_version_id',new.rule_version_id,'decided_by',new.decided_by,'evidence_hash',e.evidence_hash));
 insert into public.client_referral_reward_execution_requests_v1(approval_id,organization_id,source_event_id,rule_version_id,requested_by,requested_at,source_hash)
 values(new.id,new.organization_id,e.id,new.rule_version_id,new.decided_by,new.decided_at,h);
 payload:=jsonb_build_object('approval_id',new.id,'organization_id',new.organization_id,'source_event_id',e.id,'rule_version_id',new.rule_version_id,'state','APPROVED_PENDING_EXECUTION','source_hash',h);
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)
 values(new.organization_id,new.decided_by,'USER','reward.referral.execution_requested','reward_award_approval',new.id::text,new.correlation_id,payload,repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)
 values(new.organization_id,'client_referral_reward_execution',new.id::text,'ClientReferralRewardExecutionRequestedV1',new.correlation_id,payload,'referral-execution-request:'||new.id::text);
 return new;
end$$;
revoke all on function private.execute_approved_client_referral_reward_v1()from public,anon,authenticated,service_role;

-- Backfill only real prior decisions; no missing decision/grant is fabricated.
insert into public.client_referral_reward_execution_requests_v1(approval_id,organization_id,source_event_id,rule_version_id,requested_by,requested_at,source_hash)
select a.id,a.organization_id,e.id,a.rule_version_id,a.decided_by,a.decided_at,
 private.canonical_request_hash(jsonb_build_object('approval_id',a.id,'organization_id',a.organization_id,'source_event_id',e.id,'rule_version_id',a.rule_version_id,'decided_by',a.decided_by,'evidence_hash',e.evidence_hash))
from public.reward_award_approvals a join public.reward_source_events e on e.id=a.source_event_id and e.organization_id=a.organization_id
where a.decision='APPROVED'and e.source_reference_type='REFERRAL_CONVERSION'and e.audience_type in('REFERRED_CLIENT','CLIENT_ORGANIZATION');

create function public.execute_client_referral_reward_v1(p_approval_id uuid,p_idempotency_key text,p_correlation_id uuid default extensions.gen_random_uuid())returns jsonb
language plpgsql volatile security definer set search_path=pg_catalog,private as $$
declare q public.client_referral_reward_execution_requests_v1%rowtype;a public.reward_award_approvals%rowtype;
 e public.reward_source_events%rowtype;r public.reward_rule_versions%rowtype;c public.referral_conversions%rowtype;
 g public.reward_grants%rowtype;completed public.client_referral_reward_execution_facts_v1%rowtype;
 selected_wallet_id uuid;result jsonb;anti_abuse text;actor uuid:=auth.uid();reconciled boolean:=false;
begin
 perform private.assert_client_referral_reward_staff_v1(true);
 if p_approval_id is null or p_correlation_id is null or length(coalesce(p_idempotency_key,''))not between 8 and 160 then raise exception'INVALID_REFERRAL_REWARD_EXECUTION'using errcode='22023';end if;
 select *into q from public.client_referral_reward_execution_requests_v1 where approval_id=p_approval_id;
 if q.approval_id is null then raise exception'REFERRAL_REWARD_EXECUTION_NOT_FOUND'using errcode='P0002';end if;
 -- Financial -> request -> wallet -> native reward-rule advisory lock.
 perform pg_advisory_xact_lock(hashtextextended('subscription-financial:'||q.organization_id::text,0));
 select *into q from public.client_referral_reward_execution_requests_v1 where approval_id=p_approval_id for update;
 perform private.assert_client_referral_reward_staff_v1(true);
 select *into completed from public.client_referral_reward_execution_facts_v1 where approval_id=q.approval_id;
 if completed.approval_id is not null then return completed.result||jsonb_build_object('replayed',true);end if;
 select *into a from public.reward_award_approvals where id=q.approval_id and organization_id=q.organization_id and source_event_id=q.source_event_id and rule_version_id=q.rule_version_id and decision='APPROVED';
 select *into e from public.reward_source_events where id=q.source_event_id and organization_id=q.organization_id;
 if a.id is null or e.id is null or a.decided_by=e.recorded_by or e.source_reference_type<>'REFERRAL_CONVERSION'or e.audience_type not in('REFERRED_CLIENT','CLIENT_ORGANIZATION')then raise exception'REFERRAL_REWARD_APPROVAL_BINDING_REQUIRED'using errcode='23514';end if;
 select *into g from public.reward_grants where organization_id=q.organization_id and rule_version_id=q.rule_version_id and approval_reference=q.approval_id::text
 and trigger_reference_type=e.source_reference_type and trigger_reference_id=e.source_reference_id;
 if g.id is not null then
  reconciled:=true;
 else
  select *into c from public.referral_conversions where id=case when pg_input_is_valid(e.source_reference_id,'uuid')then e.source_reference_id::uuid end and conversion_stage='ACTIVE';
  select *into r from public.reward_rule_versions where id=q.rule_version_id and status='ACTIVE'and effective_from<=clock_timestamp()and(effective_until is null or effective_until>clock_timestamp());
  if c.id is null or not((e.audience_type='CLIENT_ORGANIZATION'and c.source_organization_id=q.organization_id)or(e.audience_type='REFERRED_CLIENT'and c.target_organization_id=q.organization_id))then raise exception'ACTIVE_REFERRAL_REWARD_SOURCE_REQUIRED'using errcode='23514';end if;
  if r.id is null or r.trigger_event<>e.event_type or r.audience_type<>e.audience_type or not(e.eligibility_snapshot@>r.eligibility_rule)then raise exception'ACTIVE_APPROVED_REFERRAL_REWARD_RULE_REQUIRED'using errcode='55000';end if;
  perform public.ensure_client_credit_wallet(q.organization_id,'referral-execution-wallet:'||q.organization_id::text,p_correlation_id);
  select w.id into selected_wallet_id from public.credit_wallets w where w.organization_id=q.organization_id and w.wallet_type='CLIENT'for update;
  if selected_wallet_id is null then raise exception'CLIENT_REWARD_WALLET_REQUIRED'using errcode='55000';end if;
  perform pg_advisory_xact_lock(hashtextextended('reward-award:'||r.rule_code,0));
  perform private.assert_client_referral_reward_staff_v1(true);
  anti_abuse:=private.canonical_request_hash(jsonb_build_object('source',e.source_reference_type,'id',e.source_reference_id,'recipient',q.organization_id));
  perform public.award_reward(q.organization_id,selected_wallet_id,q.rule_version_id,e.source_reference_type,e.source_reference_id,anti_abuse,jsonb_build_object('source_event_id',e.id),q.approval_id::text,'referral-execution-award:'||q.approval_id::text,p_correlation_id);
  select granted.*into g from public.reward_grants granted where granted.organization_id=q.organization_id and granted.rule_version_id=q.rule_version_id and granted.wallet_id=selected_wallet_id
  and granted.approval_reference=q.approval_id::text and granted.trigger_reference_type=e.source_reference_type and granted.trigger_reference_id=e.source_reference_id;
  if g.id is null then raise exception'REFERRAL_REWARD_GRANT_NOT_CONFIRMED'using errcode='23514';end if;
 end if;
 -- A real immutable grant is the authority, including historical reconciliation.
 result:=jsonb_build_object('outcome','CLIENT_REFERRAL_REWARD_EXECUTED','approval_id',q.approval_id,'organization_id',q.organization_id,'reward_grant_id',g.id,'quantity',g.quantity::text,'wallet_id',g.wallet_id,'granted_at',g.granted_at,'replayed',reconciled);
 insert into public.client_referral_reward_execution_facts_v1(approval_id,organization_id,reward_grant_id,recorded_by,result,correlation_id)values(q.approval_id,q.organization_id,g.id,actor,result,p_correlation_id);
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)
 values(q.organization_id,actor,'USER',case when reconciled then'reward.referral.execution_reconciled'else'reward.referral.executed'end,'reward_award_approval',q.approval_id::text,p_correlation_id,result,repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)
 values(q.organization_id,'client_referral_reward_execution',q.approval_id::text,'ClientReferralRewardExecutedV1',p_correlation_id,result,'referral-execution-completed:'||q.approval_id::text);
 return result;
end$$;
revoke all on function public.execute_client_referral_reward_v1(uuid,text,uuid)from public,anon,authenticated,service_role;
grant execute on function public.execute_client_referral_reward_v1(uuid,text,uuid)to authenticated;

create function public.list_client_referral_reward_statuses_v1(p_organization_id uuid)
returns table(approval_id uuid,source_event_id uuid,rule_version_id uuid,rule_code text,state text,quantity text,decided_at timestamptz,granted_at timestamptz)
language plpgsql stable security definer set search_path=pg_catalog,private as $$
begin
 if auth.uid()is null or not private.current_auth_session_active_v1()or not(private.has_org_role(p_organization_id,array['CLIENT_OWNER','CLIENT_ADMIN','CLIENT_BUYER','CLIENT_ACCOUNTING','CLIENT_MEMBER','CLIENT_VIEWER'])or private.rewards_sensitive_aal2())then raise exception'REFERRAL_REWARD_STATUS_DENIED'using errcode='42501';end if;
 return query select a.id,e.id,r.id,r.rule_code,
 case when g.id is not null then'GRANTED'when a.decision='APPROVED'then'APPROVED_PENDING_EXECUTION'else'REJECTED'end,
 coalesce(g.quantity,r.bonus_credits)::text,a.decided_at,g.granted_at
 from public.reward_award_approvals a join public.reward_source_events e on e.id=a.source_event_id and e.organization_id=a.organization_id
 join public.reward_rule_versions r on r.id=a.rule_version_id
 left join public.reward_grants g on g.organization_id=a.organization_id and g.rule_version_id=a.rule_version_id and g.approval_reference=a.id::text
 where a.organization_id=p_organization_id and e.source_reference_type='REFERRAL_CONVERSION'and e.audience_type in('CLIENT_ORGANIZATION','REFERRED_CLIENT')
 order by a.decided_at desc,a.id;
end$$;
revoke all on function public.list_client_referral_reward_statuses_v1(uuid)from public,anon,authenticated,service_role;
grant execute on function public.list_client_referral_reward_statuses_v1(uuid)to authenticated;

create function public.list_admin_client_referral_reward_queue_v1(p_page integer default 1,p_limit integer default 25)returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,private as $$
declare rows jsonb;
begin
 perform private.assert_client_referral_reward_staff_v1(false);
 if p_page is null or p_page not between 1 and 100000 or p_limit is null or p_limit not between 1 and 50 then raise exception'INVALID_REFERRAL_REWARD_QUEUE_PAGE'using errcode='22023';end if;
 with candidates as(
 select e.id source_event_id,r.id rule_version_id,a.id approval_id,o.display_name organization_name,l.referral_code,e.audience_type,r.rule_code,r.version_number rule_version,r.bonus_credits::text bonus_credits,g.quantity::text granted_credits,e.occurred_at,
 case when g.id is not null then'GRANTED'when a.decision='APPROVED'then'APPROVED_PENDING_EXECUTION'when a.decision='REJECTED'then'REJECTED'else'AWAITING_REVIEW'end state,
 a.id is null and e.recorded_by<>auth.uid()and c.conversion_stage='ACTIVE'and r.status='ACTIVE'and r.effective_from<=clock_timestamp()and(r.effective_until is null or r.effective_until>clock_timestamp())can_decide,
 coalesce(a.decision='APPROVED'and g.id is null and q.approval_id is not null and private.credits_admin_access()and c.conversion_stage='ACTIVE'and r.status='ACTIVE'and r.effective_from<=clock_timestamp()and(r.effective_until is null or r.effective_until>clock_timestamp()),false)can_execute,
 case when c.conversion_stage<>'ACTIVE'then'SOURCE_NOT_ACTIVE'when r.status<>'ACTIVE'or r.effective_from>clock_timestamp()or(r.effective_until is not null and r.effective_until<=clock_timestamp())then'RULE_NOT_ACTIVE'else null end blocked_reason
 from public.reward_source_events e join public.organizations o on o.id=e.organization_id
 join public.referral_conversions c on c.id=case when pg_input_is_valid(e.source_reference_id,'uuid')then e.source_reference_id::uuid end
 join public.referral_links l on l.id=c.referral_link_id
 join public.reward_rule_versions r on r.trigger_event=e.event_type and r.audience_type=e.audience_type and e.eligibility_snapshot@>r.eligibility_rule
 and((r.status='ACTIVE'and r.effective_from<=clock_timestamp()and(r.effective_until is null or r.effective_until>clock_timestamp()))or exists(select 1 from public.reward_award_approvals x where x.source_event_id=e.id and x.rule_version_id=r.id))
 left join public.reward_award_approvals a on a.source_event_id=e.id and a.rule_version_id=r.id
 left join public.client_referral_reward_execution_requests_v1 q on q.approval_id=a.id
 left join public.reward_grants g on g.organization_id=e.organization_id and g.rule_version_id=r.id and g.approval_reference=a.id::text
 where e.source_reference_type='REFERRAL_CONVERSION'and e.audience_type in('CLIENT_ORGANIZATION','REFERRED_CLIENT')
 )select coalesce(jsonb_agg(to_jsonb(p)order by p.occurred_at desc,p.source_event_id,p.rule_version_id),'[]')into rows
 from(select *from candidates order by occurred_at desc,source_event_id,rule_version_id limit p_limit+1 offset(p_page-1)*p_limit)p;
 return jsonb_build_object('rows',rows-p_limit,'page',p_page,'has_next',jsonb_array_length(rows)>p_limit);
end$$;
revoke all on function public.list_admin_client_referral_reward_queue_v1(integer,integer)from public,anon,authenticated,service_role;
grant execute on function public.list_admin_client_referral_reward_queue_v1(integer,integer)to authenticated;
notify pgrst,'reload schema';
commit;
