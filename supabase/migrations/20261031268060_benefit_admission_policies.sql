begin;
-- A policy interprets only this explicit ABI. Historical configurations are not
-- silently assigned a quota scope or treated as executable expressions.
create function private.benefit_admission_staff_v1()returns boolean language sql stable security definer set search_path=pg_catalog,private as $$select auth.uid()is not null and auth.jwt()->>'aal'='aal2'and private.has_platform_role(array['FINANCE_MANAGER','SUPER_ADMIN'])$$;
create function private.benefit_admission_source_v1(p_version uuid)returns jsonb language sql stable security definer set search_path=pg_catalog,public as $$select jsonb_build_object('benefit_version_id',b.id,'benefit_id',b.benefit_id,'version',b.version,'source_content_hash',b.content_hash,'benefit_type',b.benefit_type,'credit_cost',b.credit_cost::text,'cancellation_rule_version',b.cancellation_rule_version,'name_fr',b.name_fr,'name_ar',b.name_ar,'quota',b.quota::text,'capacity_rule',b.capacity_rule,'eligibility_rule',b.eligibility_rule,'fulfillment_mode',b.fulfillment_mode,'library_id',b.library_id,'service_id',b.service_id,'currency',b.currency,'effective_from',b.effective_from,'effective_to',b.effective_to)from public.benefit_versions b where b.id=p_version$$;
create table public.benefit_admission_policy_versions_v1(
 id uuid primary key default extensions.gen_random_uuid(),benefit_version_id uuid not null references public.benefit_versions(id),version integer not null check(version>0),
 source_snapshot jsonb not null,source_hash text not null check(source_hash~'^[a-f0-9]{64}$'),expected_head_id uuid references public.benefit_admission_policy_versions_v1(id),
 quota_scope text not null check(quota_scope in('NONE','GLOBAL_VERSION','ORGANIZATION_VERSION','ORGANIZATION_SUBSCRIPTION_PERIOD')),
 quota_units bigint check(quota_units>0),capacity_units bigint check(capacity_units>0),allowed_country_codes text[]not null,required_box_version_ids uuid[]not null,
 box_source_snapshot jsonb not null,fulfillment_evidence_kind text not null check(fulfillment_evidence_kind='HUMAN_OPERATOR_REPORT_AND_INDEPENDENT_CLIENT_RECEIPT_V1'),quota_counting_rule text not null default'NON_CANCELLED_UNITS_V1'check(quota_counting_rule='NON_CANCELLED_UNITS_V1'),
 effective_from timestamptz not null,effective_until timestamptz,reason text not null check(length(btrim(reason))between 10 and 2000),reference text not null check(length(btrim(reference))between 8 and 1000),
 content_hash text not null check(content_hash~'^[a-f0-9]{64}$'),created_by uuid not null references auth.users(id),created_at timestamptz not null default clock_timestamp(),
 idempotency_key uuid not null,unique(created_by,idempotency_key),unique(benefit_version_id,version),check((quota_scope='NONE')=(quota_units is null)),check(effective_until is null or effective_until>effective_from)
);
create table public.benefit_admission_policy_decisions_v1(
 policy_id uuid primary key references public.benefit_admission_policy_versions_v1(id),content_hash text not null,decision text not null check(decision in('APPROVE','REJECT')),
 reference text not null check(length(btrim(reference))between 8 and 1000),reason text not null check(length(btrim(reason))between 10 and 2000),decided_by uuid not null references auth.users(id),decided_at timestamptz not null default clock_timestamp()
);
create table public.benefit_redemption_admissions_v1(
 redemption_id uuid primary key references public.benefit_redemptions(id),organization_id uuid not null references public.organizations(id),policy_id uuid not null references public.benefit_admission_policy_versions_v1(id),policy_hash text not null,
 source_hash text not null,quota_scope text not null,period_start timestamptz,period_end timestamptz,subscription_cycle_id uuid references public.subscription_cycles(id),
 admitted_units bigint not null check(admitted_units>0),admission_snapshot jsonb not null,admission_hash text not null,admission_source text not null default'NEW_RESERVATION'check(admission_source in('NEW_RESERVATION','LEGACY_REVIEW')),source_review_hash text,admitted_at timestamptz not null default clock_timestamp(),admitted_by uuid not null references auth.users(id)
);
create index benefit_admission_policy_history_idx on public.benefit_admission_policy_versions_v1(benefit_version_id,version desc);
create index benefit_admission_redemption_usage_idx on public.benefit_redemptions(benefit_version_id,organization_id,created_at)include(units,status);
do $$declare t text;begin foreach t in array array['benefit_admission_policy_versions_v1','benefit_admission_policy_decisions_v1','benefit_redemption_admissions_v1']loop
 execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
 execute format('create trigger %I before update or delete on public.%I for each row execute function private.prevent_update_delete()',left(t,42)||'_immutable',t);
end loop;end$$;
create function private.benefit_admission_head_v1(p_version uuid)returns uuid language sql stable security definer set search_path=pg_catalog,public as $$select p.id from public.benefit_admission_policy_versions_v1 p join public.benefit_admission_policy_decisions_v1 d on d.policy_id=p.id and d.decision='APPROVE'and d.content_hash=p.content_hash and d.decided_by<>p.created_by where p.benefit_version_id=p_version order by p.version desc limit 1$$;
create function private.benefit_admission_effective_v1(p_version uuid,p_at timestamptz)returns public.benefit_admission_policy_versions_v1 language sql stable security definer set search_path=pg_catalog,public as $$select p from public.benefit_admission_policy_versions_v1 p join public.benefit_admission_policy_decisions_v1 d on d.policy_id=p.id and d.decision='APPROVE'and d.content_hash=p.content_hash and d.decided_by<>p.created_by where p.benefit_version_id=p_version and p.effective_from<=p_at order by p.version desc limit 1$$;
-- Exact canonical legacy forms are supported. Unknown JSON keys and expressions
-- require a new benefit version and a documented policy; they are never ignored.
create function private.benefit_admission_legacy_supported_v1(p public.benefit_admission_policy_versions_v1)returns boolean language plpgsql stable security definer set search_path=pg_catalog,public as $$declare b public.benefit_versions%rowtype;c jsonb;e jsonb;begin
 select*into b from public.benefit_versions where id=p.benefit_version_id;if b.id is null then return false;end if;
 if b.quota is not null and(b.quota is distinct from p.quota_units or p.quota_scope='NONE')then return false;end if;
 c:=case when p.capacity_units is null then jsonb_build_object('schema_version',1,'mode','UNLIMITED')else jsonb_build_object('schema_version',1,'mode','GLOBAL_CONCURRENT_UNITS','maximum_units',p.capacity_units::text)end;
 e:=jsonb_build_object('schema_version',1,'mode','ALL_CONDITIONS','allowed_country_codes',to_jsonb(p.allowed_country_codes),'required_any_box_version_ids',to_jsonb(p.required_box_version_ids));
 return(b.capacity_rule='{}'or b.capacity_rule=c)and(b.eligibility_rule='{}'or b.eligibility_rule=e);
end$$;
create function public.propose_benefit_admission_policy_v1(p_benefit_version_id uuid,p_expected_source_hash text,p_expected_head_id uuid,p_quota_scope text,p_quota_units bigint,p_capacity_units bigint,p_allowed_country_codes text[],p_required_box_version_ids uuid[],p_effective_from timestamptz,p_effective_until timestamptz,p_reason text,p_reference text,p_fulfillment_evidence_kind text,p_idempotency_key uuid)returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private set timezone='UTC' as $$
declare p public.benefit_admission_policy_versions_v1%rowtype;prior public.benefit_admission_policy_versions_v1%rowtype;source jsonb;boxes jsonb;h text;countries text[];box_ids uuid[];begin
 if not coalesce(private.benefit_admission_staff_v1(),false)then raise exception'BENEFIT_POLICY_FINANCE_AAL2_REQUIRED'using errcode='42501';end if;
 if p_fulfillment_evidence_kind is distinct from'HUMAN_OPERATOR_REPORT_AND_INDEPENDENT_CLIENT_RECEIPT_V1'or p_benefit_version_id is null or p_idempotency_key is null or coalesce(p_expected_source_hash,'')!~'^[a-f0-9]{64}$'or p_quota_scope is null or p_quota_scope not in('NONE','GLOBAL_VERSION','ORGANIZATION_VERSION','ORGANIZATION_SUBSCRIPTION_PERIOD')or(p_quota_scope='NONE')is distinct from(p_quota_units is null)or p_quota_units<=0 or p_capacity_units<=0 or p_allowed_country_codes is null or p_required_box_version_ids is null or cardinality(p_allowed_country_codes)>50 or cardinality(p_required_box_version_ids)>100 or exists(select 1 from unnest(p_allowed_country_codes)c where c is null or c!~'^[A-Z]{2}$')or exists(select 1 from unnest(p_required_box_version_ids)b where b is null)or p_effective_from is null or(p_effective_until is not null and p_effective_until<=p_effective_from)or length(btrim(coalesce(p_reason,'')))not between 10 and 2000 or length(btrim(coalesce(p_reference,'')))not between 8 and 1000 then raise exception'INVALID_BENEFIT_ADMISSION_POLICY'using errcode='22023';end if;
 select coalesce(array_agg(c order by c),'{}')into countries from(select distinct unnest(p_allowed_country_codes)c)s;select coalesce(array_agg(b order by b),'{}')into box_ids from(select distinct unnest(p_required_box_version_ids)b)s;
 h:=private.canonical_request_hash(jsonb_build_object('version',p_benefit_version_id,'source',p_expected_source_hash,'head',p_expected_head_id,'scope',p_quota_scope,'quota',p_quota_units::text,'capacity',p_capacity_units::text,'countries',countries,'boxes',box_ids,'from',p_effective_from,'until',p_effective_until,'reason',btrim(p_reason),'reference',btrim(p_reference),'fulfillment_evidence_kind',p_fulfillment_evidence_kind));
 perform pg_advisory_xact_lock(hashtextextended('benefit-policy-command:'||auth.uid()::text||':'||p_idempotency_key::text,0));
 select*into prior from public.benefit_admission_policy_versions_v1 where created_by=auth.uid()and idempotency_key=p_idempotency_key;
 if found then if prior.content_hash is distinct from h then raise exception'IDEMPOTENCY_PAYLOAD_MISMATCH'using errcode='22000';end if;return jsonb_build_object('outcome','BENEFIT_ADMISSION_POLICY_PROPOSED','policy_id',prior.id,'content_hash',prior.content_hash);end if;
 perform pg_advisory_xact_lock(hashtextextended('benefit-admission:'||p_benefit_version_id::text,0));source:=private.benefit_admission_source_v1(p_benefit_version_id);
 if not coalesce(private.benefit_admission_staff_v1(),false)then raise exception'BENEFIT_POLICY_FINANCE_AAL2_REQUIRED'using errcode='42501';end if;

 if source is null or private.canonical_request_hash(source)is distinct from p_expected_source_hash or private.benefit_admission_head_v1(p_benefit_version_id)is distinct from p_expected_head_id then raise exception'STALE_BENEFIT_ADMISSION_POLICY'using errcode='40001';end if;
 if source->>'fulfillment_mode'not in('MATRICIA_INTERNAL','DIRECT_PROVIDER','SUBCONTRACTOR_POOL','VOLUME_POOL','RFQ')then raise exception'BENEFIT_AUTOMATION_NOT_CONFIGURED'using errcode='55000';end if;
 select coalesce(jsonb_agg(jsonb_build_object('box_version_id',b.id,'content_hash',b.content_hash)order by b.id),'[]')into boxes from public.box_versions b where b.id=any(box_ids)and b.status='ACTIVE';
 if jsonb_array_length(boxes)<>cardinality(box_ids)then raise exception'BENEFIT_POLICY_ACTIVE_BOX_REQUIRED'using errcode='23514';end if;
 p.id:=extensions.gen_random_uuid();p.benefit_version_id:=p_benefit_version_id;p.quota_scope:=p_quota_scope;p.quota_units:=p_quota_units;p.capacity_units:=p_capacity_units;p.allowed_country_codes:=countries;p.required_box_version_ids:=box_ids;
 if not private.benefit_admission_legacy_supported_v1(p)then raise exception'BENEFIT_LEGACY_RULE_UNSUPPORTED'using errcode='55000';end if;
 select coalesce(max(version),0)+1 into p.version from public.benefit_admission_policy_versions_v1 where benefit_version_id=p_benefit_version_id;
 insert into public.benefit_admission_policy_versions_v1(id,benefit_version_id,version,source_snapshot,source_hash,expected_head_id,quota_scope,quota_units,capacity_units,allowed_country_codes,required_box_version_ids,box_source_snapshot,fulfillment_evidence_kind,effective_from,effective_until,reason,reference,content_hash,created_by,idempotency_key)
 values(p.id,p_benefit_version_id,p.version,source,p_expected_source_hash,p_expected_head_id,p_quota_scope,p_quota_units,p_capacity_units,countries,box_ids,boxes,p_fulfillment_evidence_kind,p_effective_from,p_effective_until,btrim(p_reason),btrim(p_reference),h,auth.uid(),p_idempotency_key);
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(null,auth.uid(),'USER','benefit.admission_policy.proposed','benefit_policy',p.id::text,p_idempotency_key,jsonb_build_object('content_hash',h),repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload)values(null,'benefit_policy',p.id::text,'BenefitAdmissionPolicyProposedV1',p_idempotency_key,jsonb_build_object('policy_id',p.id,'benefit_version_id',p_benefit_version_id,'content_hash',h));
 return jsonb_build_object('outcome','BENEFIT_ADMISSION_POLICY_PROPOSED','policy_id',p.id,'content_hash',h);
end$$;
create function public.decide_benefit_admission_policy_v1(p_policy_id uuid,p_expected_content_hash text,p_approve boolean,p_reference text,p_reason text)returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private set timezone='UTC' as $$declare p public.benefit_admission_policy_versions_v1%rowtype;d public.benefit_admission_policy_decisions_v1%rowtype;result text;begin
 if not coalesce(private.benefit_admission_staff_v1(),false)then raise exception'BENEFIT_POLICY_FINANCE_AAL2_REQUIRED'using errcode='42501';end if;
 select*into p from public.benefit_admission_policy_versions_v1 where id=p_policy_id;
 if p.id is null or p.created_by=auth.uid()then raise exception'BENEFIT_POLICY_INDEPENDENT_REVIEW_REQUIRED'using errcode='42501';end if;
 if p_approve is null or length(btrim(coalesce(p_reference,'')))not between 8 and 1000 or length(btrim(coalesce(p_reason,'')))not between 10 and 2000 then raise exception'INVALID_BENEFIT_POLICY_REVIEW'using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('benefit-admission:'||p.benefit_version_id::text,0)); if not coalesce(private.benefit_admission_staff_v1(),false)then raise exception'BENEFIT_POLICY_FINANCE_AAL2_REQUIRED'using errcode='42501';end if;
select*into d from public.benefit_admission_policy_decisions_v1 where policy_id=p.id;result:=case when p_approve then'APPROVE'else'REJECT'end;
 if p_expected_content_hash is distinct from p.content_hash then raise exception'STALE_BENEFIT_ADMISSION_POLICY'using errcode='40001';end if;
 if d.policy_id is not null then if d.decided_by=auth.uid()and d.decision=result and d.reference=btrim(p_reference)and d.reason=btrim(p_reason)then return jsonb_build_object('outcome','BENEFIT_ADMISSION_POLICY_REVIEWED','decision',d.decision);end if;raise exception'BENEFIT_POLICY_ALREADY_REVIEWED'using errcode='55000';end if;
 if p_approve and(private.benefit_admission_head_v1(p.benefit_version_id)is distinct from p.expected_head_id or private.canonical_request_hash(private.benefit_admission_source_v1(p.benefit_version_id))is distinct from p.source_hash or not private.benefit_admission_legacy_supported_v1(p))then raise exception'STALE_BENEFIT_ADMISSION_POLICY'using errcode='40001';end if;
 if p_approve and exists(select 1 from jsonb_array_elements(p.box_source_snapshot)b where not exists(select 1 from public.box_versions v where v.id=(b->>'box_version_id')::uuid and v.content_hash=b->>'content_hash'and v.status='ACTIVE'))then raise exception'BENEFIT_POLICY_ACTIVE_BOX_REQUIRED'using errcode='23514';end if;
 insert into public.benefit_admission_policy_decisions_v1(policy_id,content_hash,decision,reference,reason,decided_by)values(p.id,p.content_hash,result,btrim(p_reference),btrim(p_reason),auth.uid());
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(null,auth.uid(),'USER','benefit.admission_policy.reviewed','benefit_policy',p.id::text,extensions.gen_random_uuid(),jsonb_build_object('content_hash',p.content_hash,'decision',result),repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload)values(null,'benefit_policy',p.id::text,'BenefitAdmissionPolicyReviewedV1',extensions.gen_random_uuid(),jsonb_build_object('policy_id',p.id,'content_hash',p.content_hash,'decision',result));
 return jsonb_build_object('outcome','BENEFIT_ADMISSION_POLICY_REVIEWED','decision',result);
end$$;
create function private.benefit_admission_status_v1(p_org uuid,p_version uuid,p_units bigint,p_at timestamptz,p_exclude_redemption uuid default null)returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,private set timezone='UTC' as $$declare p public.benefit_admission_policy_versions_v1%rowtype;b public.benefit_versions%rowtype;period jsonb;used numeric:=0;concurrent_units numeric:=0;remaining numeric;capacity numeric;reason text;country text;begin
 select*into b from public.benefit_versions where id=p_version;p:=private.benefit_admission_effective_v1(p_version,p_at);
 if p_units is null or p_units<1 or p_at is null then reason:='INVALID_BENEFIT_ADMISSION_UNITS';
 elsif b.id is null or b.status<>'ACTIVE'or b.effective_from>p_at or b.effective_to<=p_at then reason:='ACTIVE_BENEFIT_VERSION_REQUIRED';
 elsif b.fulfillment_mode='AUTOMATED_PLATFORM'then reason:='BENEFIT_AUTOMATION_NOT_CONFIGURED';
 elsif p.id is null or p.effective_until<=p_at then reason:='BENEFIT_ADMISSION_POLICY_REQUIRED';
 elsif private.canonical_request_hash(private.benefit_admission_source_v1(b.id))is distinct from p.source_hash then reason:='BENEFIT_ADMISSION_POLICY_STALE';
 elsif not private.benefit_admission_legacy_supported_v1(p)then reason:='BENEFIT_LEGACY_RULE_UNSUPPORTED';
 end if;
 if reason is not null then return jsonb_build_object('admissible',false,'blocked_reason',reason);end if;
 if p.quota_scope='ORGANIZATION_SUBSCRIPTION_PERIOD'or cardinality(p.required_box_version_ids)>0 then
  period:=private.current_subscription_funding_v1(p_org,p_at);
  if period is null then reason:='BENEFIT_SUBSCRIPTION_PERIOD_REQUIRED';end if;
 end if;
 select country_code into country from public.organizations where id=p_org;
 if cardinality(p.allowed_country_codes)>0 and not coalesce(country=any(p.allowed_country_codes),false)then reason:='BENEFIT_ELIGIBILITY_NOT_MET';end if;
 if cardinality(p.required_box_version_ids)>0 and not exists(select 1 from public.customer_boxes cb join public.subscriptions s on s.id=cb.subscription_id and s.organization_id=cb.organization_id where cb.organization_id=p_org and cb.box_version_id=any(p.required_box_version_ids)and cb.period_start=(period->>'period_start')::timestamptz and cb.period_end=(period->>'period_end')::timestamptz and cb.period_start<=p_at and cb.period_end>p_at and s.status='ACTIVE')then reason:='BENEFIT_ELIGIBILITY_NOT_MET';end if;
 select coalesce(sum(r.units),0)into used from public.benefit_redemptions r left join public.benefit_redemption_admissions_v1 admission on admission.redemption_id=r.id where r.benefit_version_id=p_version and r.id is distinct from p_exclude_redemption and r.status in('RESERVED','SCHEDULED','IN_PROGRESS','DELIVERED','CONSUMED')and(p.quota_scope='GLOBAL_VERSION'or r.organization_id=p_org)and(p.quota_scope<>'ORGANIZATION_SUBSCRIPTION_PERIOD'or(case when admission.redemption_id is not null then admission.subscription_cycle_id=(period->>'cycle_id')::uuid else r.created_at>=(period->>'period_start')::timestamptz and r.created_at<(period->>'period_end')::timestamptz end));
 select coalesce(sum(units),0)into concurrent_units from public.benefit_redemptions r where r.benefit_version_id=p_version and r.id is distinct from p_exclude_redemption and r.status in('RESERVED','SCHEDULED','IN_PROGRESS');
 remaining:=case when p.quota_units is not null then greatest(0,p.quota_units::numeric-used)end;capacity:=case when p.capacity_units is not null then greatest(0,p.capacity_units::numeric-concurrent_units)end;
 if remaining is not null and p_units>remaining then reason:='BENEFIT_QUOTA_EXCEEDED';end if;
 if capacity is not null and p_units>capacity then reason:='BENEFIT_CAPACITY_UNAVAILABLE';end if;
 return jsonb_build_object('admissible',reason is null,'blocked_reason',reason,'policy_id',p.id,'policy_hash',p.content_hash,'source_hash',p.source_hash,'quota_scope',p.quota_scope,'quota_remaining_units',remaining::text,'capacity_remaining_units',capacity::text,'period_start',period->>'period_start','period_end',period->>'period_end','subscription_cycle_id',period->>'cycle_id','counting_rule',p.quota_counting_rule);
end$$;
create function private.record_benefit_admission_v1(p_redemption public.benefit_redemptions,p_actor uuid,status jsonb,p_review_hash text)returns void language plpgsql security definer set search_path=pg_catalog,public,private set timezone='UTC' as $$declare h text;begin
 h:=private.canonical_request_hash(status||jsonb_build_object('redemption_id',p_redemption.id,'units',p_redemption.units::text));
 insert into public.benefit_redemption_admissions_v1(redemption_id,organization_id,policy_id,policy_hash,source_hash,quota_scope,period_start,period_end,subscription_cycle_id,admitted_units,admission_snapshot,admission_hash,admission_source,source_review_hash,admitted_by)
 values(p_redemption.id,p_redemption.organization_id,(status->>'policy_id')::uuid,status->>'policy_hash',status->>'source_hash',status->>'quota_scope',(status->>'period_start')::timestamptz,(status->>'period_end')::timestamptz,(status->>'subscription_cycle_id')::uuid,p_redemption.units,status,h,case when p_review_hash is null then'NEW_RESERVATION'else'LEGACY_REVIEW'end,p_review_hash,p_actor);
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(p_redemption.organization_id,p_actor,'USER','benefit.admission.accepted','benefit_redemption',p_redemption.id::text,p_redemption.correlation_id,jsonb_build_object('policy_id',status->>'policy_id','admission_hash',h),repeat('0',64));
end$$;
create function private.enforce_benefit_admission_v1()returns trigger language plpgsql security definer set search_path=pg_catalog,public,private set timezone='UTC' as $$declare status jsonb;h text;begin
 -- All mature reservation/FEFO wrappers use finance -> wallet before insertion.
 -- Keeping this order here also protects privileged direct INSERT callers.
 perform pg_advisory_xact_lock(hashtextextended('subscription-financial:'||new.organization_id::text,0));
 perform 1 from public.credit_wallets where id=new.wallet_id and organization_id=new.organization_id and wallet_type='CLIENT'for update;
 if not found then raise exception'CLIENT_WALLET_NOT_FOUND'using errcode='P0002';end if;
 perform pg_advisory_xact_lock(hashtextextended('benefit-admission:'||new.benefit_version_id::text,0));
 if auth.uid()is null or auth.jwt()->>'aal'is distinct from'aal2'or not private.credits_client_access(new.organization_id)then raise exception'BENEFIT_ADMISSION_AAL2_REQUIRED'using errcode='42501';end if;
 if not exists(select 1 from public.organizations o where o.id=new.organization_id and o.status='ACTIVE')then raise exception'BENEFIT_ORGANIZATION_NOT_ACTIVE'using errcode='55000';end if;
 if not private.subscription_financially_clear(new.organization_id)then raise exception'SUBSCRIPTION_FINANCIAL_HOLD'using errcode='55000';end if;
 if not private.client_identity_allows_new_operations(new.organization_id)then raise exception'CLIENT_IDENTITY_REVIEW_REQUIRED'using errcode='55000';end if;
 if new.status<>'RESERVED'or new.created_by is distinct from auth.uid()or new.created_at<statement_timestamp()or new.created_at>clock_timestamp() or new.reservation_expires_at<=clock_timestamp()then raise exception'INVALID_BENEFIT_ADMISSION_RESERVATION'using errcode='22023';end if;
 if not exists(select 1 from public.benefit_versions b where b.id=new.benefit_version_id and b.credit_cost>0 and new.credit_cost_snapshot=b.credit_cost and new.reserved_credits::numeric=new.units::numeric*b.credit_cost::numeric)then raise exception'BENEFIT_ADMISSION_PRICE_MISMATCH'using errcode='23514';end if;
 status:=private.benefit_admission_status_v1(new.organization_id,new.benefit_version_id,new.units,clock_timestamp(),new.id);
 if(status->>'admissible')::boolean is distinct from true then raise exception'%',status->>'blocked_reason'using errcode='55000';end if;
 perform private.record_benefit_admission_v1(new,auth.uid(),status,null);
 return new;
end$$;
create function private.benefit_admitted_fulfillment_evidence_v1(p_redemption_id uuid)returns text language sql stable security definer set search_path=pg_catalog,public as $$select p.fulfillment_evidence_kind from public.benefit_redemption_admissions_v1 a join public.benefit_admission_policy_versions_v1 p on p.id=a.policy_id and p.content_hash=a.policy_hash where a.redemption_id=p_redemption_id and p.source_snapshot->>'fulfillment_mode'in('MATRICIA_INTERNAL','DIRECT_PROVIDER','SUBCONTRACTOR_POOL','VOLUME_POOL','RFQ')$$;
create trigger benefit_redemption_admission after insert on public.benefit_redemptions for each row execute function private.enforce_benefit_admission_v1();
create function public.get_benefit_admission_availability_v1(p_organization_id uuid,p_benefit_version_id uuid)returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,private set timezone='UTC' as $$begin
 if auth.uid()is null or not private.credits_client_access(p_organization_id)then raise exception'BENEFIT_ADMISSION_READ_DENIED'using errcode='42501';end if;
 if auth.jwt()->>'aal'is distinct from'aal2'then return jsonb_build_object('admissible',false,'blocked_reason','BENEFIT_ADMISSION_AAL2_REQUIRED');end if;
 if not exists(select 1 from public.organizations where id=p_organization_id and status='ACTIVE')then return jsonb_build_object('admissible',false,'blocked_reason','BENEFIT_ORGANIZATION_NOT_ACTIVE');end if;
 return private.benefit_admission_status_v1(p_organization_id,p_benefit_version_id,1,statement_timestamp());
end$$;
create function public.get_admin_benefit_admission_context_v1(p_benefit_version_id uuid,p_page integer default 1)returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,private set timezone='UTC' as $$declare b public.benefit_versions%rowtype;history jsonb;total bigint;source jsonb;boxes jsonb;begin
 if not coalesce(private.benefit_admission_staff_v1(),false)then raise exception'BENEFIT_POLICY_FINANCE_AAL2_REQUIRED'using errcode='42501';end if;
 if p_page is null or p_page not between 1 and 1000000 then raise exception'INVALID_BENEFIT_POLICY_PAGE'using errcode='22023';end if;
 select*into b from public.benefit_versions where id=p_benefit_version_id;if b.id is null then raise exception'BENEFIT_VERSION_REQUIRED'using errcode='P0002';end if;
 source:=private.benefit_admission_source_v1(b.id);
 select coalesce(jsonb_agg(to_jsonb(p)||jsonb_build_object('quota_units',p.quota_units::text,'capacity_units',p.capacity_units::text,'decision',d.decision,'decided_by',d.decided_by,'review_reference',d.reference,'review_reason',d.reason,'can_review',d.policy_id is null and p.created_by<>auth.uid())order by p.version desc),'[]')into history from(select*from public.benefit_admission_policy_versions_v1 where benefit_version_id=b.id order by version desc limit 25 offset(p_page-1)*25)p left join public.benefit_admission_policy_decisions_v1 d on d.policy_id=p.id;
 select count(*)into total from public.benefit_admission_policy_versions_v1 where benefit_version_id=b.id;
 select coalesce(jsonb_agg(jsonb_build_object('id',v.id,'name_fr',v.name_fr,'name_ar',v.name_ar,'version',v.version,'content_hash',v.content_hash)order by v.name_fr,v.version),'[]')into boxes from(select*from public.box_versions where status='ACTIVE'order by name_fr,id limit 25)v;
 return jsonb_build_object('benefit_version_id',b.id,'name_fr',b.name_fr,'name_ar',b.name_ar,'source',source,'source_hash',private.canonical_request_hash(source),'head_id',private.benefit_admission_head_v1(b.id),'policies',history,'page',p_page,'total',total,'has_next',total>p_page::bigint*25,'boxes',boxes);
end$$;
create function public.list_admin_benefit_admission_versions_v1(p_search text default'',p_page integer default 1)returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,private set timezone='UTC' as $$declare rows jsonb;total bigint;begin
 if not coalesce(private.benefit_admission_staff_v1(),false)then raise exception'BENEFIT_POLICY_FINANCE_AAL2_REQUIRED'using errcode='42501';end if;
 if p_page is null or p_page not between 1 and 1000000 or p_search is null or length(p_search)>100 then raise exception'INVALID_BENEFIT_POLICY_SEARCH'using errcode='22023';end if;
 select count(*)into total from public.benefit_versions where name_fr ilike'%'||p_search||'%'or name_ar ilike'%'||p_search||'%';
 select coalesce(jsonb_agg(to_jsonb(b)order by created_at desc,id),'[]')into rows from(select id,name_fr,name_ar,version,status,created_at,fulfillment_mode,quota::text from public.benefit_versions where name_fr ilike'%'||p_search||'%'or name_ar ilike'%'||p_search||'%'order by created_at desc,id limit 25 offset(p_page-1)*25)b;
 return jsonb_build_object('items',rows,'page',p_page,'total',total,'has_next',total>p_page::bigint*25);
end$$;
-- Existing redemptions are counted by the quota/capacity queries already. An
-- independent, targeted review may bind one to the current explicit policy;
-- this neither reserves more credits nor rewrites its original terms/events.
create table public.benefit_legacy_admission_proposals_v1(
 id uuid primary key default extensions.gen_random_uuid(),redemption_id uuid not null references public.benefit_redemptions(id),redemption_hash text not null,policy_id uuid not null references public.benefit_admission_policy_versions_v1(id),context_snapshot jsonb not null,content_hash text not null,
 reason text not null check(length(btrim(reason))between 10 and 2000),reference text not null check(length(btrim(reference))between 8 and 1000),created_by uuid not null references auth.users(id),created_at timestamptz not null default clock_timestamp(),idempotency_key uuid not null,unique(created_by,idempotency_key)
);
create table public.benefit_legacy_admission_decisions_v1(proposal_id uuid primary key references public.benefit_legacy_admission_proposals_v1(id),content_hash text not null,decision text not null check(decision in('APPROVE','REJECT')),reference text not null,reason text not null,decided_by uuid not null references auth.users(id),decided_at timestamptz not null default clock_timestamp());
do $$declare t text;begin foreach t in array array['benefit_legacy_admission_proposals_v1','benefit_legacy_admission_decisions_v1']loop execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);execute format('create trigger %I before update or delete on public.%I for each row execute function private.prevent_update_delete()',left(t,42)||'_immutable',t);end loop;end$$;
create function private.benefit_legacy_admission_context_v1(p_redemption uuid)returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,private set timezone='UTC' as $$declare r public.benefit_redemptions%rowtype;status jsonb;begin
 select*into r from public.benefit_redemptions where id=p_redemption;if r.id is null or r.status not in('RESERVED','SCHEDULED','IN_PROGRESS','DELIVERED')or exists(select 1 from public.benefit_redemption_admissions_v1 where redemption_id=r.id)then raise exception'BENEFIT_LEGACY_ADMISSION_NOT_REVIEWABLE'using errcode='55000';end if;
 status:=private.benefit_admission_status_v1(r.organization_id,r.benefit_version_id,r.units,statement_timestamp(),r.id);
 return jsonb_build_object('redemption',to_jsonb(r),'redemption_hash',private.canonical_request_hash(to_jsonb(r)),'admission',status);
end$$;
create function public.propose_legacy_benefit_admission_v1(p_redemption_id uuid,p_expected_redemption_hash text,p_expected_policy_id uuid,p_reference text,p_reason text,p_idempotency_key uuid)returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private set timezone='UTC' as $$declare context jsonb;r public.benefit_redemptions%rowtype;p public.benefit_legacy_admission_proposals_v1%rowtype;h text;begin
 if not coalesce(private.benefit_admission_staff_v1(),false)then raise exception'BENEFIT_POLICY_FINANCE_AAL2_REQUIRED'using errcode='42501';end if;
 if p_idempotency_key is null or length(btrim(coalesce(p_reference,'')))not between 8 and 1000 or length(btrim(coalesce(p_reason,'')))not between 10 and 2000 then raise exception'INVALID_BENEFIT_LEGACY_REVIEW'using errcode='22023';end if;
 h:=private.canonical_request_hash(jsonb_build_object('redemption',p_redemption_id,'hash',p_expected_redemption_hash,'policy',p_expected_policy_id,'reference',btrim(p_reference),'reason',btrim(p_reason)));
 perform pg_advisory_xact_lock(hashtextextended('benefit-legacy-command:'||auth.uid()::text||':'||p_idempotency_key::text,0));select*into p from public.benefit_legacy_admission_proposals_v1 where created_by=auth.uid()and idempotency_key=p_idempotency_key;
 if found then if p.content_hash is distinct from h then raise exception'IDEMPOTENCY_PAYLOAD_MISMATCH'using errcode='22000';end if;return jsonb_build_object('outcome','BENEFIT_LEGACY_ADMISSION_PROPOSED','proposal_id',p.id,'content_hash',p.content_hash);end if;
 select*into r from public.benefit_redemptions where id=p_redemption_id;
 perform pg_advisory_xact_lock(hashtextextended('subscription-financial:'||r.organization_id::text,0));perform 1 from public.credit_wallets where id=r.wallet_id for update;perform pg_advisory_xact_lock(hashtextextended('benefit-admission:'||r.benefit_version_id::text,0));
 if not coalesce(private.benefit_admission_staff_v1(),false)then raise exception'BENEFIT_POLICY_FINANCE_AAL2_REQUIRED'using errcode='42501';end if;
 context:=private.benefit_legacy_admission_context_v1(r.id);
 if context->>'redemption_hash'is distinct from p_expected_redemption_hash or context#>>'{admission,policy_id}'is distinct from p_expected_policy_id::text then raise exception'STALE_BENEFIT_LEGACY_ADMISSION'using errcode='40001';end if;
 if(context#>>'{admission,admissible}')::boolean is distinct from true then raise exception'%',context#>>'{admission,blocked_reason}'using errcode='55000';end if;
 insert into public.benefit_legacy_admission_proposals_v1(redemption_id,redemption_hash,policy_id,context_snapshot,content_hash,reason,reference,created_by,idempotency_key)values(r.id,p_expected_redemption_hash,p_expected_policy_id,context,h,btrim(p_reason),btrim(p_reference),auth.uid(),p_idempotency_key)returning*into p;
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(r.organization_id,auth.uid(),'USER','benefit.legacy_admission.proposed','benefit_redemption',r.id::text,p_idempotency_key,jsonb_build_object('proposal_id',p.id,'content_hash',h),repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload)values(r.organization_id,'benefit_redemption',r.id::text,'BenefitLegacyAdmissionProposedV1',p_idempotency_key,jsonb_build_object('proposal_id',p.id,'content_hash',h));
 return jsonb_build_object('outcome','BENEFIT_LEGACY_ADMISSION_PROPOSED','proposal_id',p.id,'content_hash',h);
end$$;
create function public.decide_legacy_benefit_admission_v1(p_proposal_id uuid,p_expected_content_hash text,p_approve boolean,p_reference text,p_reason text)returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private set timezone='UTC' as $$declare p public.benefit_legacy_admission_proposals_v1%rowtype;r public.benefit_redemptions%rowtype;d public.benefit_legacy_admission_decisions_v1%rowtype;context jsonb;outcome text;begin
 if not coalesce(private.benefit_admission_staff_v1(),false)then raise exception'BENEFIT_POLICY_FINANCE_AAL2_REQUIRED'using errcode='42501';end if;
 select*into p from public.benefit_legacy_admission_proposals_v1 where id=p_proposal_id;if p.id is null or p.created_by=auth.uid()then raise exception'BENEFIT_POLICY_INDEPENDENT_REVIEW_REQUIRED'using errcode='42501';end if;
 if p_approve is null or p.content_hash is distinct from p_expected_content_hash or length(btrim(coalesce(p_reference,'')))not between 8 and 1000 or length(btrim(coalesce(p_reason,'')))not between 10 and 2000 then raise exception'INVALID_BENEFIT_LEGACY_REVIEW'using errcode='22023';end if;
 select*into r from public.benefit_redemptions where id=p.redemption_id;
 perform pg_advisory_xact_lock(hashtextextended('subscription-financial:'||r.organization_id::text,0));perform 1 from public.credit_wallets where id=r.wallet_id for update;perform pg_advisory_xact_lock(hashtextextended('benefit-admission:'||r.benefit_version_id::text,0));select*into r from public.benefit_redemptions where id=p.redemption_id for update;
 if not coalesce(private.benefit_admission_staff_v1(),false)then raise exception'BENEFIT_POLICY_FINANCE_AAL2_REQUIRED'using errcode='42501';end if;
 select*into d from public.benefit_legacy_admission_decisions_v1 where proposal_id=p.id;outcome:=case when p_approve then'APPROVE'else'REJECT'end;
 if d.proposal_id is not null then if d.decided_by=auth.uid()and d.decision=outcome and d.reference=btrim(p_reference)and d.reason=btrim(p_reason)then return jsonb_build_object('outcome','BENEFIT_LEGACY_ADMISSION_REVIEWED','decision',d.decision);end if;raise exception'BENEFIT_POLICY_ALREADY_REVIEWED'using errcode='55000';end if;
 if p_approve then
  if not exists(select 1 from public.organizations where id=r.organization_id and status='ACTIVE')or not private.subscription_financially_clear(r.organization_id)or not private.client_identity_allows_new_operations(r.organization_id)then raise exception'BENEFIT_LEGACY_ADMISSION_NOT_REVIEWABLE'using errcode='55000';end if;
  context:=private.benefit_legacy_admission_context_v1(r.id);
  if context->>'redemption_hash'is distinct from p.redemption_hash or context#>>'{admission,policy_id}'is distinct from p.policy_id::text or context#>>'{admission,source_hash}'is distinct from p.context_snapshot#>>'{admission,source_hash}'or context#>>'{admission,subscription_cycle_id}'is distinct from p.context_snapshot#>>'{admission,subscription_cycle_id}'then raise exception'STALE_BENEFIT_LEGACY_ADMISSION'using errcode='40001';end if;
  if(context#>>'{admission,admissible}')::boolean is distinct from true then raise exception'%',context#>>'{admission,blocked_reason}'using errcode='55000';end if;
  perform private.record_benefit_admission_v1(r,auth.uid(),context->'admission',p.content_hash);
 end if;
 insert into public.benefit_legacy_admission_decisions_v1(proposal_id,content_hash,decision,reference,reason,decided_by)values(p.id,p.content_hash,outcome,btrim(p_reference),btrim(p_reason),auth.uid());
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(r.organization_id,auth.uid(),'USER','benefit.legacy_admission.reviewed','benefit_redemption',r.id::text,extensions.gen_random_uuid(),jsonb_build_object('proposal_id',p.id,'content_hash',p.content_hash,'decision',outcome),repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload)values(r.organization_id,'benefit_redemption',r.id::text,'BenefitLegacyAdmissionReviewedV1',extensions.gen_random_uuid(),jsonb_build_object('proposal_id',p.id,'content_hash',p.content_hash,'decision',outcome));
 return jsonb_build_object('outcome','BENEFIT_LEGACY_ADMISSION_REVIEWED','decision',outcome);
end$$;
create function public.get_admin_benefit_legacy_admissions_v1(p_benefit_version_id uuid,p_page integer default 1)returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,private set timezone='UTC' as $$declare items jsonb;total bigint;begin
 if not coalesce(private.benefit_admission_staff_v1(),false)then raise exception'BENEFIT_POLICY_FINANCE_AAL2_REQUIRED'using errcode='42501';end if;
 if p_page is null or p_page not between 1 and 1000000 then raise exception'INVALID_BENEFIT_POLICY_PAGE'using errcode='22023';end if;
 select count(*)into total from public.benefit_redemptions r left join public.benefit_redemption_admissions_v1 a on a.redemption_id=r.id where r.benefit_version_id=p_benefit_version_id and(a.admission_source='LEGACY_REVIEW'or(a.redemption_id is null and r.status in('RESERVED','SCHEDULED','IN_PROGRESS','DELIVERED')));
 select coalesce(jsonb_agg(jsonb_build_object('redemption_id',r.id,'organization_name',o.display_name,'row_version',r.row_version::text,'units',r.units::text,'status',r.status,'created_at',r.created_at,'reservation_expires_at',r.reservation_expires_at,'already_admitted',a.redemption_id is not null,'context',case when a.redemption_id is not null then jsonb_build_object('redemption_hash',private.canonical_request_hash(to_jsonb(r)),'admission',a.admission_snapshot||jsonb_build_object('admissible',false,'blocked_reason','BENEFIT_LEGACY_ALREADY_ADMITTED'))else private.benefit_legacy_admission_context_v1(r.id)end)order by r.created_at,r.id),'[]')into items from(select red.*from public.benefit_redemptions red left join public.benefit_redemption_admissions_v1 adm on adm.redemption_id=red.id where red.benefit_version_id=p_benefit_version_id and(adm.admission_source='LEGACY_REVIEW'or(adm.redemption_id is null and red.status in('RESERVED','SCHEDULED','IN_PROGRESS','DELIVERED')))order by red.created_at,red.id limit 25 offset(p_page-1)*25)r join public.organizations o on o.id=r.organization_id left join public.benefit_redemption_admissions_v1 a on a.redemption_id=r.id;
 return jsonb_build_object('items',items,'page',p_page,'total',total,'has_next',total>p_page::bigint*25);
end$$;
create function public.get_admin_benefit_legacy_history_v1(p_redemption_id uuid,p_page integer default 1)returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,private set timezone='UTC' as $$declare items jsonb;total bigint;begin
 if not coalesce(private.benefit_admission_staff_v1(),false)then raise exception'BENEFIT_POLICY_FINANCE_AAL2_REQUIRED'using errcode='42501';end if;
 if p_page is null or p_page not between 1 and 1000000 then raise exception'INVALID_BENEFIT_POLICY_PAGE'using errcode='22023';end if;
 select count(*)into total from public.benefit_legacy_admission_proposals_v1 where redemption_id=p_redemption_id;
 select coalesce(jsonb_agg(to_jsonb(p)||jsonb_build_object('decision',d.decision,'review_reference',d.reference,'review_reason',d.reason,'decided_at',d.decided_at,'can_review',d.proposal_id is null and p.created_by<>auth.uid())order by p.created_at desc,p.id),'[]')into items from(select*from public.benefit_legacy_admission_proposals_v1 where redemption_id=p_redemption_id order by created_at desc,id limit 25 offset(p_page-1)*25)p left join public.benefit_legacy_admission_decisions_v1 d on d.proposal_id=p.id;
 return jsonb_build_object('items',items,'page',p_page,'total',total,'has_next',total>p_page::bigint*25);
end$$;
create function public.list_admin_benefit_policy_boxes_v1(p_search text default'',p_page integer default 1)returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,private set timezone='UTC' as $$declare items jsonb;total bigint;begin
 if not coalesce(private.benefit_admission_staff_v1(),false)then raise exception'BENEFIT_POLICY_FINANCE_AAL2_REQUIRED'using errcode='42501';end if;
 if p_page is null or p_page not between 1 and 1000000 or p_search is null or length(p_search)>100 then raise exception'INVALID_BENEFIT_POLICY_SEARCH'using errcode='22023';end if;
 select count(*)into total from public.box_versions where status='ACTIVE'and(name_fr ilike'%'||p_search||'%'or name_ar ilike'%'||p_search||'%');
 select coalesce(jsonb_agg(to_jsonb(b)order by created_at desc,id),'[]')into items from(select id,name_fr,name_ar,version,created_at,content_hash from public.box_versions where status='ACTIVE'and(name_fr ilike'%'||p_search||'%'or name_ar ilike'%'||p_search||'%')order by created_at desc,id limit 25 offset(p_page-1)*25)b;
 return jsonb_build_object('items',items,'page',p_page,'total',total,'has_next',total>p_page::bigint*25);
end$$;
do $$declare f record;begin for f in select p.oid::regprocedure signature,n.nspname schema_name,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where(n.nspname||'.'||p.proname)=any(array['private.benefit_legacy_admission_context_v1','public.propose_legacy_benefit_admission_v1','public.decide_legacy_benefit_admission_v1','public.get_admin_benefit_legacy_admissions_v1','public.get_admin_benefit_legacy_history_v1','public.list_admin_benefit_policy_boxes_v1','private.benefit_admission_staff_v1','private.benefit_admission_source_v1','private.benefit_admission_head_v1','private.benefit_admission_effective_v1','private.benefit_admission_legacy_supported_v1','private.benefit_admission_status_v1','private.enforce_benefit_admission_v1','private.record_benefit_admission_v1','private.benefit_admitted_fulfillment_evidence_v1','public.propose_benefit_admission_policy_v1','public.decide_benefit_admission_policy_v1','public.get_benefit_admission_availability_v1','public.get_admin_benefit_admission_context_v1','public.list_admin_benefit_admission_versions_v1'])loop execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);if f.schema_name='public'then execute format('grant execute on function %s to authenticated',f.signature);end if;end loop;end$$;
notify pgrst,'reload schema';
commit;
