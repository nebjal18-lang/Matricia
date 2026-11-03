begin;
-- A signed cookie is a touch, never proof of a conversion. Sources and their effects stay authoritative.
create table private.marketing_verified_touches_v2(
 id uuid primary key default extensions.gen_random_uuid(),actor_user_id uuid not null references auth.users(id),organization_id uuid not null references public.organizations(id),
 campaign_id uuid not null references public.marketing_campaigns(id),content_id uuid not null references public.marketing_content(id),
 source text not null,medium text not null,visitor_hash text not null check(visitor_hash~'^[0-9a-f]{64}$'),issued_at timestamptz not null,expires_at timestamptz not null,
 request_hash text not null check(request_hash~'^[0-9a-f]{64}$'),registered_at timestamptz not null default clock_timestamp(),unique(actor_user_id,request_hash),check(expires_at>issued_at)
);
create index marketing_verified_touches_actor_time_v2 on private.marketing_verified_touches_v2(actor_user_id,issued_at desc,expires_at);
create table private.marketing_business_facts_v2(
 id uuid primary key default extensions.gen_random_uuid(),event_type text not null check(event_type in('REGISTRATION_STARTED','DIAGNOSTIC_STARTED','OPPORTUNITY_CREATED','RFQ_STARTED','CONTRACT_SIGNED')),
 source_id uuid not null,source_organization_id uuid not null references public.organizations(id),actor_user_id uuid references auth.users(id),occurred_at timestamptz not null,
 identity_hash text not null check(identity_hash~'^[0-9a-f]{64}$'),created_at timestamptz not null default clock_timestamp(),unique(event_type,source_id)
);
create table private.marketing_business_bindings_v2(
 fact_id uuid primary key references private.marketing_business_facts_v2(id),touch_id uuid not null references private.marketing_verified_touches_v2(id),
 source_hash text not null check(source_hash~'^[0-9a-f]{64}$'),attribution_event_id bigint not null unique references public.marketing_attribution_events(id),bound_at timestamptz not null default clock_timestamp()
);
create table private.marketing_business_dispositions_v2(fact_id uuid not null references private.marketing_business_facts_v2(id),outcome text not null,observed_at timestamptz not null default clock_timestamp(),primary key(fact_id,outcome));
revoke all on private.marketing_verified_touches_v2,private.marketing_business_facts_v2,private.marketing_business_bindings_v2,private.marketing_business_dispositions_v2 from public,anon,authenticated,service_role;
create trigger marketing_verified_touch_immutable before update or delete on private.marketing_verified_touches_v2 for each row execute function private.prevent_contract_immutable_change();
create trigger marketing_business_fact_immutable before update or delete on private.marketing_business_facts_v2 for each row execute function private.prevent_contract_immutable_change();
create trigger marketing_business_binding_immutable before update or delete on private.marketing_business_bindings_v2 for each row execute function private.prevent_contract_immutable_change();
create trigger marketing_business_disposition_immutable before update or delete on private.marketing_business_dispositions_v2 for each row execute function private.prevent_contract_immutable_change();
create function public.register_verified_marketing_touch_v2(p_actor_user_id uuid,p_organization_id uuid,p_campaign_id uuid,p_content_id uuid,p_source text,p_medium text,p_visitor_hash text,p_expires_at timestamptz)returns jsonb language plpgsql security definer set search_path=pg_catalog,private set timezone='UTC' as $$
declare h text;id uuid;begin
 if auth.role()is distinct from'service_role'then raise exception'MARKETING_ATTRIBUTION_WORKER_DENIED'using errcode='42501';end if;
 if not exists(select 1 from auth.users where auth.users.id=p_actor_user_id and email_confirmed_at is not null)or p_visitor_hash is null or p_visitor_hash!~'^[0-9a-f]{64}$'or coalesce(p_source,'')!~'^[a-z0-9_.-]{2,80}$'or coalesce(p_medium,'')!~'^[a-z0-9_.-]{2,80}$'or p_expires_at is null or p_expires_at<=clock_timestamp()or p_expires_at>clock_timestamp()+interval'30 days 5 minutes'or not exists(select 1 from public.marketing_campaigns c join public.marketing_content t on t.campaign_id=c.id where c.id=p_campaign_id and c.organization_id=p_organization_id and t.id=p_content_id)then raise exception'INVALID_VERIFIED_MARKETING_TOUCH'using errcode='22023';end if;
 if not private.marketing_consent_active(p_organization_id,'MARKETING_ANALYTICS')then return jsonb_build_object('outcome','MARKETING_BUSINESS_SKIPPED_CONSENT');end if;
 h:=private.canonical_request_hash(jsonb_build_object('actor',p_actor_user_id,'organization',p_organization_id,'campaign',p_campaign_id,'content',p_content_id,'source',p_source,'medium',p_medium,'visitor_hash',p_visitor_hash,'expires_at',p_expires_at));
 insert into private.marketing_verified_touches_v2(actor_user_id,organization_id,campaign_id,content_id,source,medium,visitor_hash,issued_at,expires_at,request_hash)values(p_actor_user_id,p_organization_id,p_campaign_id,p_content_id,p_source,p_medium,p_visitor_hash,p_expires_at-interval'30 days',p_expires_at,h)on conflict do nothing;
 select t.id into id from private.marketing_verified_touches_v2 t where actor_user_id=p_actor_user_id and request_hash=h;
 return jsonb_build_object('outcome','MARKETING_TOUCH_CAPTURED','touch_id',id);
end$$;
create function private.resolve_marketing_business_source_v2(p_event_type text,p_source_id uuid)returns jsonb language plpgsql stable security definer set search_path=pg_catalog,private set timezone='UTC' as $$
declare actor uuid;org uuid;h text;occurred timestamptz;eligible boolean:=true;reason text;identity text;rowhash text;v public.contract_versions%rowtype;e public.signature_envelopes%rowtype;ep public.signature_evidence_packages%rowtype;request_id uuid;amount bigint;currency char(3);begin
 case p_event_type
 when'REGISTRATION_STARTED'then select created_by,id,created_at into actor,org,occurred from public.organizations where id=p_source_id;h:=private.canonical_request_hash(jsonb_build_object('id',p_source_id,'created_by',actor,'created_at',occurred));
 when'DIAGNOSTIC_STARTED'then select created_by,organization_id,created_at,content_hash into actor,org,occurred,h from public.public_diagnostic_intakes where id=p_source_id;
 when'OPPORTUNITY_CREATED'then select completed_by,organization_id,completed_at,private.canonical_request_hash(jsonb_build_object('input_manifest_hash',input_manifest_hash,'scoring_policy_snapshot',scoring_policy_snapshot,'run_id',id))into actor,org,occurred,h from public.diagnostic_runs where id=p_source_id;
  eligible:=exists(select 1 from public.diagnostic_opportunities where diagnostic_run_id=p_source_id);reason:=case when not eligible then'MARKETING_BUSINESS_SKIPPED_NO_OPPORTUNITY'end;
 when'RFQ_STARTED'then select created_by,client_organization_id,created_at into actor,org,occurred from public.service_requests where id=p_source_id;select content_hash into rowhash from public.service_request_versions where service_request_versions.request_id=p_source_id order by version_number limit 1;
  if rowhash is null then raise exception'MARKETING_REQUEST_SOURCE_VERSION_REQUIRED'using errcode='55000';end if;h:=private.canonical_request_hash(jsonb_build_object('request_id',p_source_id,'initial_version_hash',rowhash));
 when'CONTRACT_SIGNED'then
  select*into e from public.signature_envelopes where contract_id=p_source_id and amendment_id is null and status='SIGNED'order by completed_at,envelope_version limit 1;
  if e.id is null then raise exception'MARKETING_VERIFIED_CONTRACT_SIGNATURE_REQUIRED'using errcode='55000';end if;
  ep:=private.require_completed_contract_signature_v1(e.id);select*into v from public.contract_versions where id=e.contract_version_id;org:=e.client_organization_id;occurred:=e.completed_at;
  select rfq.request_id into request_id from public.quote_versions quote join public.rfqs rfq on rfq.id=quote.rfq_id where quote.id=v.selected_quote_version_id;
  select created_by into actor from public.service_requests where id=request_id and client_organization_id=org;
  h:=private.canonical_request_hash(jsonb_build_object('contract_version_id',v.id,'contract_hash',v.content_hash,'envelope_id',e.id,'evidence_hash',ep.final_hash));
  eligible:=e.provider_code<>'MATRICIA_DEV_MOCK';reason:=case when not eligible then'MARKETING_BUSINESS_SKIPPED_SIMULATION'end;amount:=v.price_minor;currency:=v.currency;
 else raise exception'INVALID_MARKETING_BUSINESS_EVENT'using errcode='22023';end case;
 if org is null or occurred is null or h is null then raise exception'MARKETING_BUSINESS_SOURCE_NOT_FOUND'using errcode='P0002';end if;
 identity:=private.canonical_request_hash(jsonb_build_object('event',p_event_type,'id',p_source_id,'organization',org,'actor',actor,'occurred_at',occurred));
 return jsonb_build_object('actor_user_id',actor,'organization_id',org,'occurred_at',occurred,'source_hash',h,'identity_hash',identity,'eligible',eligible,'reason',reason,'request_id',request_id,'amount_minor',amount,'currency',currency);
end$$;
create function private.ensure_marketing_business_fact_v2(p_type text,p_source uuid)returns uuid language plpgsql security definer set search_path=pg_catalog,private set timezone='UTC' as $$
declare r jsonb;id uuid;begin
 r:=private.resolve_marketing_business_source_v2(p_type,p_source);
 insert into private.marketing_business_facts_v2(event_type,source_id,source_organization_id,actor_user_id,occurred_at,identity_hash)values(p_type,p_source,(r->>'organization_id')::uuid,(r->>'actor_user_id')::uuid,(r->>'occurred_at')::timestamptz,r->>'identity_hash')on conflict do nothing;
 select f.id into id from private.marketing_business_facts_v2 f where event_type=p_type and source_id=p_source;return id;
end$$;
create function private.capture_marketing_business_fact_v2()returns trigger language plpgsql security definer set search_path=pg_catalog,private set timezone='UTC' as $$
declare typ text;org uuid;actor uuid;at_time timestamptz;h text;fid uuid;begin
 case tg_table_name when'organizations'then typ:='REGISTRATION_STARTED';org:=new.id;actor:=new.created_by;at_time:=new.created_at;
 when'public_diagnostic_intakes'then typ:='DIAGNOSTIC_STARTED';org:=new.organization_id;actor:=new.created_by;at_time:=new.created_at;
 when'diagnostic_runs'then typ:='OPPORTUNITY_CREATED';org:=new.organization_id;actor:=new.completed_by;at_time:=new.completed_at;
 when'service_requests'then typ:='RFQ_STARTED';org:=new.client_organization_id;actor:=new.created_by;at_time:=new.created_at;
 else raise exception'INVALID_MARKETING_SOURCE_TRIGGER'using errcode='55000';end case;
 if not exists(select 1 from private.marketing_verified_touches_v2 where actor_user_id=actor and issued_at<=at_time and expires_at>=at_time)then return new;end if;
 h:=private.canonical_request_hash(jsonb_build_object('event',typ,'id',new.id,'organization',org,'actor',actor,'occurred_at',at_time));
 insert into private.marketing_business_facts_v2(event_type,source_id,source_organization_id,actor_user_id,occurred_at,identity_hash)values(typ,new.id,org,actor,at_time,h)on conflict do nothing returning id into fid;
 if fid is not null then insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values(org,'marketing_business_fact',fid::text,'MarketingBusinessFactReadyV2',fid,jsonb_build_object('fact_id',fid),'marketing-business-fact:'||fid::text)on conflict do nothing;end if;return new;
end$$;
create trigger organization_marketing_fact after insert on public.organizations for each row execute function private.capture_marketing_business_fact_v2();
create trigger diagnostic_intake_marketing_fact after insert on public.public_diagnostic_intakes for each row execute function private.capture_marketing_business_fact_v2();
create trigger diagnostic_run_marketing_fact after insert on public.diagnostic_runs for each row execute function private.capture_marketing_business_fact_v2();
create trigger service_request_marketing_fact after insert on public.service_requests for each row execute function private.capture_marketing_business_fact_v2();
create function private.ingest_marketing_attribution_core_v2(
 p_organization_id uuid,p_campaign_id uuid,p_content_id uuid,p_event_type text,p_source text,p_medium text,p_visitor_hash text,
 p_economic_value_minor bigint,p_occurred_at timestamptz,p_metadata jsonb,p_idempotency_key text,p_economic_currency char(3),p_correlation_id uuid default extensions.gen_random_uuid()
)returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private,extensions as $$
declare e bigint;l uuid;h text;cached jsonb;r jsonb;metric text;touches jsonb;attributed uuid;
begin
 if auth.role()is distinct from'service_role'then raise exception'MARKETING_ATTRIBUTION_WORKER_DENIED'using errcode='42501';end if;
 if not private.marketing_consent_active(p_organization_id,'MARKETING_ANALYTICS') or not exists(select 1 from public.marketing_campaigns where id=p_campaign_id and organization_id=p_organization_id)or(p_content_id is not null and not exists(select 1 from public.marketing_content where id=p_content_id and campaign_id=p_campaign_id))or p_event_type not in('CONTENT_VIEWED','CTA_CLICKED','LANDING_VIEWED','REGISTRATION_STARTED','DIAGNOSTIC_STARTED','OPPORTUNITY_CREATED','RFQ_STARTED','CONTRACT_SIGNED')or p_visitor_hash!~'^[0-9a-f]{64}$'or length(btrim(coalesce(p_source,'')))not between 2 and 80 or length(btrim(coalesce(p_medium,'')))not between 2 and 80 or p_occurred_at>clock_timestamp()+interval'5 minutes'or jsonb_typeof(p_metadata)<>'object' or octet_length(p_metadata::text)>4096 or exists(select 1 from jsonb_object_keys(p_metadata)k where k not in('utm_campaign','utm_source','utm_medium','utm_content','landing_path','referrer_host')) or p_metadata::text~*'[[:alnum:]._%+-]+@[[:alnum:].-]+[.][[:alpha:]]{2,}|(?:[+]?[0-9][ -]?){9,15}' or p_economic_value_minor<0 then raise exception'INVALID_MARKETING_ATTRIBUTION_EVENT'using errcode='22023';end if;
 h:=private.canonical_request_hash(jsonb_build_object('organization',p_organization_id,'campaign',p_campaign_id,'content',p_content_id,'event',p_event_type,'source',p_source,'medium',p_medium,'visitor',p_visitor_hash,'value',p_economic_value_minor,'occurred',p_occurred_at,'metadata',p_metadata));cached:=private.begin_marketing_worker_command('marketing.attribution.ingest',p_idempotency_key,h);if cached is not null then return cached;end if;
 insert into public.marketing_attribution_events(organization_id,campaign_id,content_id,event_type,source,medium,visitor_hash,economic_value_minor,occurred_at,metadata)values(p_organization_id,p_campaign_id,p_content_id,p_event_type,btrim(lower(p_source)),btrim(lower(p_medium)),p_visitor_hash,p_economic_value_minor,p_occurred_at,p_metadata)returning id into e;
 insert into public.marketing_leads(organization_id,campaign_id,visitor_hash,first_touch_at,last_touch_at,status)values(p_organization_id,p_campaign_id,p_visitor_hash,p_occurred_at,p_occurred_at,case when p_event_type='CONTRACT_SIGNED'then'CONVERTED'when p_event_type in('OPPORTUNITY_CREATED','RFQ_STARTED')then'QUALIFIED'when p_event_type='REGISTRATION_STARTED'then'REGISTERED'else'ANONYMOUS'end)
 on conflict(organization_id,campaign_id,visitor_hash)do update set first_touch_at=least(marketing_leads.first_touch_at,excluded.first_touch_at),last_touch_at=greatest(marketing_leads.last_touch_at,excluded.last_touch_at),status=case when excluded.status='CONVERTED'or marketing_leads.status='CONVERTED'then'CONVERTED'when excluded.status='QUALIFIED'or marketing_leads.status='QUALIFIED'then'QUALIFIED'when excluded.status='REGISTERED'or marketing_leads.status='REGISTERED'then'REGISTERED'else marketing_leads.status end returning id into l;
 select coalesce(jsonb_agg(jsonb_build_object('event_id',id,'campaign_id',campaign_id,'content_id',content_id,'event_type',event_type,'source',source,'medium',medium,'occurred_at',occurred_at)order by occurred_at,id),'[]'::jsonb)into touches from public.marketing_attribution_events where organization_id=p_organization_id and visitor_hash=p_visitor_hash;
 select campaign_id into attributed from public.marketing_attribution_events where organization_id=p_organization_id and visitor_hash=p_visitor_hash and source<>'direct'order by occurred_at desc,id desc limit 1;
 insert into public.marketing_conversion_paths(organization_id,lead_id,attribution_model,touchpoints,attributed_campaign_id,attributed_value_minor,currency)values(p_organization_id,l,'LAST_NON_DIRECT_CLICK',touches,coalesce(attributed,p_campaign_id),p_economic_value_minor,case when p_economic_value_minor is null then null else p_economic_currency end);
 metric:=case p_event_type when'CONTENT_VIEWED'then'VIEW'when'CTA_CLICKED'then'CLICK'when'REGISTRATION_STARTED'then'LEAD'when'DIAGNOSTIC_STARTED'then'DIAGNOSTIC'when'OPPORTUNITY_CREATED'then'OPPORTUNITY'when'RFQ_STARTED'then'RFQ'when'CONTRACT_SIGNED'then'CONTRACT'else null end;
 if metric is not null then insert into public.marketing_metric_events(organization_id,campaign_id,metric,quantity,source_event_id,occurred_at)values(p_organization_id,p_campaign_id,metric,1,'attribution:'||e::text,p_occurred_at);end if;
 if p_economic_value_minor is not null then insert into public.marketing_metric_events(organization_id,campaign_id,metric,quantity,value_minor,currency,source_event_id,occurred_at)values(p_organization_id,coalesce(attributed,p_campaign_id),'ATTRIBUTED_VALUE',1,p_economic_value_minor,p_economic_currency,'attribution-value:'||e::text,p_occurred_at);end if;
 r:=jsonb_build_object('outcome','MARKETING_ATTRIBUTION_INGESTED','event_id',e,'lead_id',l,'attributed_campaign_id',coalesce(attributed,p_campaign_id),'touchpoint_count',jsonb_array_length(touches));
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(p_organization_id,null,'SERVICE','marketing.attribution.ingested','marketing_attribution_event',e::text,p_correlation_id,jsonb_build_object('event_type',p_event_type,'campaign_id',p_campaign_id),repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values(p_organization_id,'marketing_attribution_event',e::text,'MarketingAttributionEventIngestedV1',p_correlation_id,r,p_idempotency_key);
 perform private.finish_marketing_worker_command('marketing.attribution.ingest',p_idempotency_key,r);return r;end$$;

create or replace function public.ingest_marketing_attribution_event_v1(p_organization_id uuid,p_campaign_id uuid,p_content_id uuid,p_event_type text,p_source text,p_medium text,p_visitor_hash text,p_economic_value_minor bigint,p_occurred_at timestamptz,p_metadata jsonb,p_idempotency_key text,p_correlation_id uuid default extensions.gen_random_uuid())returns jsonb language plpgsql security definer set search_path=pg_catalog,private as $$begin
 if auth.role()is distinct from'service_role'then raise exception'MARKETING_ATTRIBUTION_WORKER_DENIED'using errcode='42501';end if;
 if p_event_type is null or p_event_type not in('CONTENT_VIEWED','CTA_CLICKED','LANDING_VIEWED')or p_economic_value_minor is not null then raise exception'MARKETING_BUSINESS_SOURCE_REQUIRED'using errcode='42501';end if;
 return private.ingest_marketing_attribution_core_v2(p_organization_id,p_campaign_id,p_content_id,p_event_type,p_source,p_medium,p_visitor_hash,null,p_occurred_at,p_metadata,p_idempotency_key,null,p_correlation_id);
end$$;
create function private.process_marketing_business_fact_v2(p_fact_id uuid,p_preferred_touch_id uuid default null)returns jsonb language plpgsql security definer set search_path=pg_catalog,private set timezone='UTC' as $$
declare f private.marketing_business_facts_v2%rowtype;t private.marketing_verified_touches_v2%rowtype;bound private.marketing_business_bindings_v2%rowtype;src jsonb;outcome text;r jsonb;request_actor uuid;request_time timestamptz;preferred uuid:=p_preferred_touch_id;begin
 select*into f from private.marketing_business_facts_v2 where id=p_fact_id for update;if f.id is null then raise exception'MARKETING_BUSINESS_FACT_NOT_FOUND'using errcode='P0002';end if;
 src:=private.resolve_marketing_business_source_v2(f.event_type,f.source_id);if src->>'identity_hash'is distinct from f.identity_hash then raise exception'MARKETING_BUSINESS_SOURCE_MISMATCH'using errcode='23514';end if;
 select*into bound from private.marketing_business_bindings_v2 where fact_id=f.id;if found then return jsonb_build_object('outcome','MARKETING_BUSINESS_DEDUPLICATED','fact_id',f.id,'event_id',bound.attribution_event_id);end if;
 if not(src->>'eligible')::boolean then outcome:=src->>'reason';
 else
  if f.event_type='CONTRACT_SIGNED'then
   select request.created_by,request.created_at into request_actor,request_time from public.service_requests request where request.id=(src->>'request_id')::uuid and request.client_organization_id=f.source_organization_id;
   select binding.touch_id into preferred from private.marketing_business_facts_v2 rfqfact join private.marketing_business_bindings_v2 binding on binding.fact_id=rfqfact.id where rfqfact.event_type='RFQ_STARTED'and rfqfact.source_id=(src->>'request_id')::uuid;
   select*into t from private.marketing_verified_touches_v2 where actor_user_id=request_actor and(preferred is null or id=preferred)and issued_at<=request_time and expires_at>=f.occurred_at order by issued_at desc,id desc limit 1;
  else
   select*into t from private.marketing_verified_touches_v2 where actor_user_id=f.actor_user_id and(preferred is null or id=preferred)and issued_at<=f.occurred_at and expires_at>=f.occurred_at order by issued_at desc,id desc limit 1;
  end if;
  if t.id is null then outcome:='MARKETING_BUSINESS_SKIPPED_NO_TOUCH';
  elsif not private.marketing_consent_active(t.organization_id,'MARKETING_ANALYTICS')then outcome:='MARKETING_BUSINESS_SKIPPED_CONSENT';
  else
   r:=private.ingest_marketing_attribution_core_v2(t.organization_id,t.campaign_id,t.content_id,f.event_type,t.source,t.medium,t.visitor_hash,(src->>'amount_minor')::bigint,f.occurred_at,'{}','verified-business-fact:'||f.id::text,(src->>'currency')::char(3),f.id);
   insert into private.marketing_business_bindings_v2(fact_id,touch_id,source_hash,attribution_event_id)values(f.id,t.id,src->>'source_hash',(r->>'event_id')::bigint);outcome:='MARKETING_BUSINESS_ATTRIBUTED';
  end if;
 end if;
 insert into private.marketing_business_dispositions_v2(fact_id,outcome)values(f.id,outcome)on conflict do nothing;
 return jsonb_build_object('outcome',outcome,'fact_id',f.id,'event_id',r->'event_id');
end$$;
create function public.process_marketing_business_fact_v2(p_fact_id uuid)returns jsonb language plpgsql security definer set search_path=pg_catalog,private as $$begin
 if auth.role()is distinct from'service_role'then raise exception'MARKETING_ATTRIBUTION_WORKER_DENIED'using errcode='42501';end if;return private.process_marketing_business_fact_v2(p_fact_id);
end$$;
create function public.record_marketing_business_conversion_v2(p_event_type text,p_source_id uuid,p_touch_id uuid,p_idempotency_key text)returns jsonb language plpgsql security definer set search_path=pg_catalog,private as $$
declare f uuid;src jsonb;t private.marketing_verified_touches_v2%rowtype;begin
 if auth.role()is distinct from'service_role'then raise exception'MARKETING_ATTRIBUTION_WORKER_DENIED'using errcode='42501';end if;
 if p_event_type is null or p_event_type not in('REGISTRATION_STARTED','DIAGNOSTIC_STARTED','OPPORTUNITY_CREATED','RFQ_STARTED')or length(coalesce(p_idempotency_key,''))not between 8 and 200 then raise exception'MARKETING_BUSINESS_SOURCE_REQUIRED'using errcode='42501';end if;
 select*into t from private.marketing_verified_touches_v2 where id=p_touch_id;src:=private.resolve_marketing_business_source_v2(p_event_type,p_source_id);
 if t.id is null or t.actor_user_id is distinct from(src->>'actor_user_id')::uuid then raise exception'MARKETING_BUSINESS_ACTOR_MISMATCH'using errcode='42501';end if;
 f:=private.ensure_marketing_business_fact_v2(p_event_type,p_source_id);return private.process_marketing_business_fact_v2(f,t.id);
end$$;
create function public.process_marketing_contract_conversion_v2(p_envelope_id uuid)returns jsonb language plpgsql security definer set search_path=pg_catalog,private as $$declare e public.signature_envelopes%rowtype;f uuid;begin
 if auth.role()is distinct from'service_role'then raise exception'MARKETING_ATTRIBUTION_WORKER_DENIED'using errcode='42501';end if;
 select*into e from public.signature_envelopes where id=p_envelope_id;if e.id is null or e.status<>'SIGNED'or e.amendment_id is not null then raise exception'MARKETING_VERIFIED_CONTRACT_SIGNATURE_REQUIRED'using errcode='55000';end if;
 perform private.require_completed_contract_signature_v1(e.id);f:=private.ensure_marketing_business_fact_v2('CONTRACT_SIGNED',e.contract_id);return private.process_marketing_business_fact_v2(f);
end$$;
revoke all on function private.resolve_marketing_business_source_v2(text,uuid),private.ensure_marketing_business_fact_v2(text,uuid),private.capture_marketing_business_fact_v2(),private.ingest_marketing_attribution_core_v2(uuid,uuid,uuid,text,text,text,text,bigint,timestamptz,jsonb,text,character,uuid),private.process_marketing_business_fact_v2(uuid,uuid)from public,anon,authenticated,service_role;
revoke all on function public.register_verified_marketing_touch_v2(uuid,uuid,uuid,uuid,text,text,text,timestamptz),public.process_marketing_business_fact_v2(uuid),public.record_marketing_business_conversion_v2(text,uuid,uuid,text),public.process_marketing_contract_conversion_v2(uuid)from public,anon,authenticated,service_role;
grant execute on function public.register_verified_marketing_touch_v2(uuid,uuid,uuid,uuid,text,text,text,timestamptz),public.process_marketing_business_fact_v2(uuid),public.record_marketing_business_conversion_v2(text,uuid,uuid,text),public.process_marketing_contract_conversion_v2(uuid)to service_role;
-- Credit-note issuance archives are idempotent, source-bound and safe to resume after configuration repair.
create or replace function private.operational_event_replay_is_safe(p_type text,p_error text)returns boolean language sql immutable set search_path=pg_catalog as $$
 select p_type in('MarketingBusinessFactReadyV2','ContractSignedV1','SignatureSimulationStepRequestedV1','SignatureEnvelopeReadyV1','ContractSignatureRequestedV1','ContractAmendmentSignatureRequestedV1','ClientCommercialDocumentIssuedV1','SocialNativeVerificationRequestedV1','AdminActionAuthorizedV1','DocumentUploadedV1','ProviderBillingPdfArchivedV1','ProviderInvoiceIssuedV1','ProviderStatementIssuedV1','ProviderCreditNoteIssuedV1','ProviderBillingDocumentsReadyV1','PrivacyRetentionActionRequestedV1','SubscriptionRefundAuthorizedV1','SubscriptionRefundReconciliationAuthorizedV1')or coalesce(p_error in('INVITATION_LOAD_FAILED','INVITATION_LOAD_INVALID','EMAIL_MODE_UNCONFIGURED','EMAIL_LIVE_DISABLED','EMAIL_RECIPIENT_NOT_ALLOWLISTED','EMAIL_PROVIDER_NOT_CONFIGURED','DOMAIN_CONSUMER_REQUIRED'),false)
$$;
revoke all on function private.operational_event_replay_is_safe(text,text)from public,anon,authenticated,service_role;

notify pgrst,'reload schema';
commit;
