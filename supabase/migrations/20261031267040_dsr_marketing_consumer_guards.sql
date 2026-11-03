begin;
set local search_path=pg_catalog,public;
-- Exact subject and purpose scopes; original business records and legal/security messages remain authoritative.
create function private.locked_marketing_processing_allowed_v1(p_organization_id uuid,p_subject_user_id uuid)returns boolean language plpgsql volatile security definer set search_path=pg_catalog,private as $$begin
 if p_organization_id is null or p_subject_user_id is null then return false;end if;
 perform pg_advisory_xact_lock(hashtextextended('privacy-processing-restriction:'||p_organization_id::text||':'||p_subject_user_id::text,0));
 return not private.dsr_processing_is_restricted_v1(p_organization_id,p_subject_user_id,'MARKETING');
end$$;
revoke all on function private.locked_marketing_processing_allowed_v1(uuid,uuid)from public,anon,authenticated,service_role;
create or replace function public.register_verified_marketing_touch_v2(p_actor_user_id uuid,p_organization_id uuid,p_campaign_id uuid,p_content_id uuid,p_source text,p_medium text,p_visitor_hash text,p_expires_at timestamptz)returns jsonb language plpgsql security definer set search_path=pg_catalog,private set timezone='UTC' as $$
declare h text;id uuid;begin
 if auth.role()is distinct from'service_role'then raise exception'MARKETING_ATTRIBUTION_WORKER_DENIED'using errcode='42501';end if;
 if not exists(select 1 from auth.users where auth.users.id=p_actor_user_id and email_confirmed_at is not null)or p_visitor_hash is null or p_visitor_hash!~'^[0-9a-f]{64}$'or coalesce(p_source,'')!~'^[a-z0-9_.-]{2,80}$'or coalesce(p_medium,'')!~'^[a-z0-9_.-]{2,80}$'or p_expires_at is null or p_expires_at<=clock_timestamp()or p_expires_at>clock_timestamp()+interval'30 days 5 minutes'or not exists(select 1 from public.marketing_campaigns c join public.marketing_content t on t.campaign_id=c.id where c.id=p_campaign_id and c.organization_id=p_organization_id and t.id=p_content_id)then raise exception'INVALID_VERIFIED_MARKETING_TOUCH'using errcode='22023';end if;
 if not private.locked_marketing_processing_allowed_v1(p_organization_id,p_actor_user_id)then return jsonb_build_object('outcome','MARKETING_BUSINESS_SKIPPED_RESTRICTION');end if;
 if not private.marketing_consent_active(p_organization_id,'MARKETING_ANALYTICS')then return jsonb_build_object('outcome','MARKETING_BUSINESS_SKIPPED_CONSENT');end if;
 h:=private.canonical_request_hash(jsonb_build_object('actor',p_actor_user_id,'organization',p_organization_id,'campaign',p_campaign_id,'content',p_content_id,'source',p_source,'medium',p_medium,'visitor_hash',p_visitor_hash,'expires_at',p_expires_at));
 insert into private.marketing_verified_touches_v2(actor_user_id,organization_id,campaign_id,content_id,source,medium,visitor_hash,issued_at,expires_at,request_hash)values(p_actor_user_id,p_organization_id,p_campaign_id,p_content_id,p_source,p_medium,p_visitor_hash,p_expires_at-interval'30 days',p_expires_at,h)on conflict do nothing;
 select t.id into id from private.marketing_verified_touches_v2 t where actor_user_id=p_actor_user_id and request_hash=h;
 return jsonb_build_object('outcome','MARKETING_TOUCH_CAPTURED','touch_id',id);
end$$;
create or replace function private.ensure_marketing_business_fact_v2(p_type text,p_source uuid)returns uuid language plpgsql security definer set search_path=pg_catalog,private set timezone='UTC' as $$
declare r jsonb;id uuid;begin
 r:=private.resolve_marketing_business_source_v2(p_type,p_source);
 if not private.locked_marketing_processing_allowed_v1((r->>'organization_id')::uuid,(r->>'actor_user_id')::uuid)then return null;end if;
 insert into private.marketing_business_facts_v2(event_type,source_id,source_organization_id,actor_user_id,occurred_at,identity_hash)values(p_type,p_source,(r->>'organization_id')::uuid,(r->>'actor_user_id')::uuid,(r->>'occurred_at')::timestamptz,r->>'identity_hash')on conflict do nothing;
 select f.id into id from private.marketing_business_facts_v2 f where event_type=p_type and source_id=p_source;return id;
end$$;
create or replace function private.capture_marketing_business_fact_v2()returns trigger language plpgsql security definer set search_path=pg_catalog,private set timezone='UTC' as $$
declare typ text;org uuid;actor uuid;at_time timestamptz;h text;fid uuid;begin
 case tg_table_name when'organizations'then typ:='REGISTRATION_STARTED';org:=new.id;actor:=new.created_by;at_time:=new.created_at;
 when'public_diagnostic_intakes'then typ:='DIAGNOSTIC_STARTED';org:=new.organization_id;actor:=new.created_by;at_time:=new.created_at;
 when'diagnostic_runs'then typ:='OPPORTUNITY_CREATED';org:=new.organization_id;actor:=new.completed_by;at_time:=new.completed_at;
 when'service_requests'then typ:='RFQ_STARTED';org:=new.client_organization_id;actor:=new.created_by;at_time:=new.created_at;
 else raise exception'INVALID_MARKETING_SOURCE_TRIGGER'using errcode='55000';end case;
 if not private.locked_marketing_processing_allowed_v1(org,actor)then return new;end if;
 if not exists(select 1 from private.marketing_verified_touches_v2 where actor_user_id=actor and issued_at<=at_time and expires_at>=at_time)then return new;end if;
 h:=private.canonical_request_hash(jsonb_build_object('event',typ,'id',new.id,'organization',org,'actor',actor,'occurred_at',at_time));
 insert into private.marketing_business_facts_v2(event_type,source_id,source_organization_id,actor_user_id,occurred_at,identity_hash)values(typ,new.id,org,actor,at_time,h)on conflict do nothing returning id into fid;
 if fid is not null then insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values(org,'marketing_business_fact',fid::text,'MarketingBusinessFactReadyV2',fid,jsonb_build_object('fact_id',fid),'marketing-business-fact:'||fid::text)on conflict do nothing;end if;return new;
end$$;
create or replace function private.process_marketing_business_fact_v2(p_fact_id uuid,p_preferred_touch_id uuid default null)returns jsonb language plpgsql security definer set search_path=pg_catalog,private set timezone='UTC' as $$
declare f private.marketing_business_facts_v2%rowtype;t private.marketing_verified_touches_v2%rowtype;bound private.marketing_business_bindings_v2%rowtype;src jsonb;outcome text;r jsonb;request_actor uuid;request_time timestamptz;preferred uuid:=p_preferred_touch_id;begin
 if p_fact_id is null then return jsonb_build_object('outcome','MARKETING_BUSINESS_SKIPPED_RESTRICTION');end if;
 select*into f from private.marketing_business_facts_v2 where id=p_fact_id;if f.id is null then raise exception'MARKETING_BUSINESS_FACT_NOT_FOUND'using errcode='P0002';end if;
 if not private.locked_marketing_processing_allowed_v1(f.source_organization_id,f.actor_user_id)then return jsonb_build_object('outcome','MARKETING_BUSINESS_SKIPPED_RESTRICTION','fact_id',f.id);end if;
 select*into f from private.marketing_business_facts_v2 where id=p_fact_id for update;
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
insert into public.notification_preference_categories(code,label_fr,label_ar,mandatory)values('MARKETING','Communications marketing','الرسائل التسويقية',false)on conflict(code)do nothing;
-- Future marketing records cannot acquire a mandatory flag to bypass the optional-purpose gate.
-- Historical custom mandatory records keep their distinct legal-basis transport checks.
alter table public.notification_template_versions add constraint notification_marketing_optional_v1 check(category_code<>'MARKETING'or not mandatory)not valid;
alter table public.notification_instances add constraint notification_instance_marketing_optional_v1 check(category_code<>'MARKETING'or not mandatory)not valid;
create function private.guard_marketing_notification_processing_v1()returns trigger language plpgsql security definer set search_path=pg_catalog,private as $$begin
 if new.category_code='MARKETING'and not new.mandatory and not private.locked_marketing_processing_allowed_v1(new.organization_id,new.recipient_user_id)then raise exception'MARKETING_PROCESSING_RESTRICTED'using errcode='55000';end if;return new;
end$$;
revoke all on function private.guard_marketing_notification_processing_v1()from public,anon,authenticated,service_role;
create trigger marketing_notification_processing_restriction before insert on public.notification_instances for each row execute function private.guard_marketing_notification_processing_v1();

create or replace function public.authorize_notification_delivery_send_v1(p_delivery_id uuid,p_lease_token uuid,p_worker_id text,p_correlation_id uuid default extensions.gen_random_uuid())returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private,extensions as $$
declare d public.notification_deliveries%rowtype;n public.notification_instances%rowtype;allowed boolean:=false;r jsonb;billing_blocked boolean:=false;restriction_blocked boolean:=false;
begin
 if auth.role()is distinct from'service_role'then raise exception'NOTIFICATION_SEND_AUTH_DENIED'using errcode='42501';end if;
 select*into d from public.notification_deliveries where id=p_delivery_id for update;select*into n from public.notification_instances where id=d.notification_id;
 if d.id is null or d.lease_token is distinct from p_lease_token or d.lease_owner is distinct from btrim(p_worker_id)or d.leased_until<=clock_timestamp()then raise exception'NOTIFICATION_LEASE_INVALID'using errcode='40001';end if;
 if n.category_code='MARKETING'and not n.mandatory then restriction_blocked:=not private.locked_marketing_processing_allowed_v1(n.organization_id,n.recipient_user_id);end if;
 if n.event_type='ProviderBillingPdfReadyV1' then
  if to_regprocedure('private.provider_billing_notification_send_authorized_v1(uuid)')is null then raise exception'BILLING_NOTIFICATION_AUTHORIZATION_UNAVAILABLE'using errcode='55000';end if;
  billing_blocked:=not coalesce(private.provider_billing_notification_send_authorized_v1(n.id),false);
 end if;
 if restriction_blocked or billing_blocked then allowed:=false;
 elsif d.channel='EMAIL'and exists(select 1 from public.notification_email_suppressions where user_id=n.recipient_user_id and mailbox_hash=encode(extensions.digest(convert_to((select lower(btrim(email))from auth.users where id=n.recipient_user_id),'UTF8'),'sha256'),'hex'))then allowed:=false;
 elsif d.channel<>'EMAIL'then allowed:=true;
 elsif n.mandatory then allowed:=exists(select 1 from public.notification_mandatory_policy_versions mp where mp.id=n.mandatory_policy_version_id and mp.category_code=n.category_code and mp.legal_basis=n.legal_basis and mp.status='ACTIVE'and mp.effective_from<=clock_timestamp()and(mp.effective_until is null or mp.effective_until>clock_timestamp()));
 else allowed:=private.notification_email_consent_active(n.recipient_user_id,n.organization_id,n.category_code)and exists(select 1 from public.user_notification_preferences p where p.user_id=n.recipient_user_id and p.organization_id=n.organization_id and p.category_code=n.category_code and p.channel='EMAIL'and p.delivery_mode in('IMMEDIATE','DIGEST')and p.delivery_mode=d.delivery_mode);
 end if;
 if allowed then return jsonb_build_object('outcome','NOTIFICATION_SEND_AUTHORIZED','authorized',true,'delivery_id',d.id);end if;
 update public.notification_deliveries set status='SKIPPED',next_attempt_at=null,last_error_code=case when restriction_blocked then'MARKETING_PROCESSING_RESTRICTED'when billing_blocked then'BILLING_DOCUMENT_SUPERSEDED_OR_RECIPIENT_INVALID'when exists(select 1 from public.notification_email_suppressions where user_id=n.recipient_user_id and mailbox_hash=encode(extensions.digest(convert_to((select lower(btrim(email))from auth.users where id=n.recipient_user_id),'UTF8'),'sha256'),'hex'))then'EMAIL_RECIPIENT_SUPPRESSED'when n.mandatory then'MANDATORY_LEGAL_BASIS_INACTIVE'else'PREFERENCE_WITHDRAWN'end,lease_token=null,lease_owner=null,leased_until=null,terminal_at=clock_timestamp(),row_version=row_version+1,updated_at=clock_timestamp()where id=d.id;
 r:=jsonb_build_object('outcome','NOTIFICATION_SEND_BLOCKED','authorized',false,'delivery_id',d.id,'reason',case when restriction_blocked then'MARKETING_PROCESSING_RESTRICTED'when billing_blocked then'BILLING_DOCUMENT_SUPERSEDED_OR_RECIPIENT_INVALID'when exists(select 1 from public.notification_email_suppressions where user_id=n.recipient_user_id and mailbox_hash=encode(extensions.digest(convert_to((select lower(btrim(email))from auth.users where id=n.recipient_user_id),'UTF8'),'sha256'),'hex'))then'EMAIL_RECIPIENT_SUPPRESSED'when n.mandatory then'MANDATORY_LEGAL_BASIS_INACTIVE'else'PREFERENCE_WITHDRAWN'end);
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(n.organization_id,null,'SERVICE','notification.delivery.send_blocked','notification_delivery',d.id::text,p_correlation_id,r,repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values(n.organization_id,'notification_delivery',d.id::text,'NotificationDeliveryBlockedV1',p_correlation_id,r,'notification-send-blocked:'||d.id::text||':'||d.row_version::text)on conflict do nothing;
 return r;
end$$;
create table private.dsr_restriction_consumer_guards_v1(guard_type text not null,function_signature text not null,source_hash text not null,scope text not null,subject_field text not null,organization_field text not null,primary key(guard_type,function_signature));
revoke all on private.dsr_restriction_consumer_guards_v1 from public,anon,authenticated,service_role;
create trigger dsr_restriction_consumer_guards_immutable before update or delete on private.dsr_restriction_consumer_guards_v1 for each row execute function private.prevent_update_delete();
insert into private.dsr_restriction_consumer_guards_v1(guard_type,function_signature,source_hash,scope,subject_field,organization_field)
select typ,sig,encode(extensions.digest(convert_to(pg_get_functiondef(sig::regprocedure),'UTF8'),'sha256'),'hex'),scope,subject,org from(values
('MARKETING_TOUCH_REGISTRATION','public.register_verified_marketing_touch_v2(uuid,uuid,uuid,uuid,text,text,text,timestamptz)','CAMPAIGN_ORGANIZATION_ONLY','p_actor_user_id','p_organization_id'),
('MARKETING_SOURCE_FACT_CAPTURE','private.capture_marketing_business_fact_v2()','BUSINESS_SOURCE_ORGANIZATION_ONLY','source_actor','source_organization'),
('MARKETING_SOURCE_FACT_CAPTURE','private.ensure_marketing_business_fact_v2(text,uuid)','BUSINESS_SOURCE_ORGANIZATION_ONLY','resolved.actor_user_id','resolved.organization_id'),
('MARKETING_BUSINESS_ATTRIBUTION','private.process_marketing_business_fact_v2(uuid,uuid)','BUSINESS_SOURCE_ORGANIZATION_ONLY','fact.actor_user_id','fact.source_organization_id'),
('MARKETING_NOTIFICATION_TRANSPORT','public.authorize_notification_delivery_send_v1(uuid,uuid,text,uuid)','MESSAGE_ORGANIZATION_MARKETING_CATEGORY_ONLY','notification.recipient_user_id','notification.organization_id'),
('MARKETING_NOTIFICATION_TRANSPORT','private.guard_marketing_notification_processing_v1()','MESSAGE_ORGANIZATION_MARKETING_CATEGORY_ONLY','new.recipient_user_id','new.organization_id')
)q(typ,sig,scope,subject,org);
create table private.dsr_restriction_consumer_dependencies_v1(function_signature text primary key,source_hash text not null);
revoke all on private.dsr_restriction_consumer_dependencies_v1 from public,anon,authenticated,service_role;
create trigger dsr_restriction_consumer_dependencies_immutable before update or delete on private.dsr_restriction_consumer_dependencies_v1 for each row execute function private.prevent_update_delete();
insert into private.dsr_restriction_consumer_dependencies_v1(function_signature,source_hash)select sig,encode(extensions.digest(convert_to(pg_get_functiondef(sig::regprocedure),'UTF8'),'sha256'),'hex')from unnest(array['private.dsr_processing_is_restricted_v1(uuid,uuid,text)','private.locked_marketing_processing_allowed_v1(uuid,uuid)'])sig;
create table private.dsr_restriction_consumer_bindings_v1(object_type text not null,target_table text not null,object_name text not null,definition_hash text not null,primary key(object_type,target_table,object_name));
revoke all on private.dsr_restriction_consumer_bindings_v1 from public,anon,authenticated,service_role;
create trigger dsr_restriction_consumer_bindings_immutable before update or delete on private.dsr_restriction_consumer_bindings_v1 for each row execute function private.prevent_update_delete();
insert into private.dsr_restriction_consumer_bindings_v1
select 'TRIGGER',target,name,encode(extensions.digest(convert_to(pg_get_triggerdef(t.oid),'UTF8'),'sha256'),'hex')from(values('public.organizations','organization_marketing_fact'),('public.public_diagnostic_intakes','diagnostic_intake_marketing_fact'),('public.diagnostic_runs','diagnostic_run_marketing_fact'),('public.service_requests','service_request_marketing_fact'),('public.notification_instances','marketing_notification_processing_restriction'))q(target,name)join pg_trigger t on t.tgrelid=target::regclass and t.tgname=name;
insert into private.dsr_restriction_consumer_bindings_v1
select 'CONSTRAINT',target,name,encode(extensions.digest(convert_to(pg_get_constraintdef(c.oid),'UTF8'),'sha256'),'hex')from(values('public.notification_template_versions','notification_marketing_optional_v1'),('public.notification_instances','notification_instance_marketing_optional_v1'))q(target,name)join pg_constraint c on c.conrelid=target::regclass and c.conname=name;
create function private.dsr_restriction_consumer_proof_v1(p_purpose text)returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare guards jsonb;dependencies jsonb;begin
 if p_purpose is distinct from'MARKETING'then return null;end if;
 if(select count(*)from private.dsr_restriction_consumer_bindings_v1)<>7 or exists(select 1 from private.dsr_restriction_consumer_bindings_v1 b where definition_hash is distinct from case object_type when'TRIGGER'then(select encode(extensions.digest(convert_to(pg_get_triggerdef(t.oid),'UTF8'),'sha256'),'hex')from pg_trigger t where t.tgrelid=to_regclass(b.target_table)and t.tgname=b.object_name and t.tgenabled in('O','A'))when'CONSTRAINT'then(select encode(extensions.digest(convert_to(pg_get_constraintdef(c.oid),'UTF8'),'sha256'),'hex')from pg_constraint c where c.conrelid=to_regclass(b.target_table)and c.conname=b.object_name)end)then return null;end if;
 if(select count(*)from private.dsr_restriction_consumer_guards_v1)<>6 or(select count(distinct guard_type)from private.dsr_restriction_consumer_guards_v1)<>4 then return null;end if;
 if exists(select 1 from private.dsr_restriction_consumer_guards_v1 where to_regprocedure(function_signature)is null or source_hash is distinct from encode(extensions.digest(convert_to(pg_get_functiondef(to_regprocedure(function_signature)),'UTF8'),'sha256'),'hex'))then return null;end if;
 -- A function that exists but is detached/disabled is not an installed consumer.
 if(select count(*)from pg_trigger where not tgisinternal and tgenabled in('O','A')and tgname in('organization_marketing_fact','diagnostic_intake_marketing_fact','diagnostic_run_marketing_fact','service_request_marketing_fact')and tgfoid='private.capture_marketing_business_fact_v2()'::regprocedure)<>4 then return null;end if;
 if(select count(*)from pg_constraint where conname in('notification_marketing_optional_v1','notification_instance_marketing_optional_v1')and contype='c')<>2 then return null;end if;
 if not exists(select 1 from pg_trigger where tgrelid='public.notification_instances'::regclass and tgname='marketing_notification_processing_restriction'and tgenabled in('O','A')and tgfoid='private.guard_marketing_notification_processing_v1()'::regprocedure)then return null;end if;
 if(select count(*)from private.dsr_restriction_consumer_dependencies_v1)<>2 or exists(select 1 from private.dsr_restriction_consumer_dependencies_v1 where to_regprocedure(function_signature)is null or source_hash is distinct from encode(extensions.digest(convert_to(pg_get_functiondef(to_regprocedure(function_signature)),'UTF8'),'sha256'),'hex'))then return null;end if;
 select jsonb_agg(jsonb_build_object('name',function_signature,'source_hash',source_hash)order by function_signature)into dependencies from private.dsr_restriction_consumer_dependencies_v1;
 select jsonb_agg(jsonb_build_object('type',typ,'name',typ,'source_hash',private.canonical_request_hash(implementations),'implementations',implementations)order by typ)into guards from(select guard_type typ,jsonb_agg(jsonb_build_object('name',function_signature,'source_hash',source_hash,'scope',scope,'subject_field',subject_field,'organization_field',organization_field)order by function_signature)implementations from private.dsr_restriction_consumer_guards_v1 group by guard_type)q;
 return jsonb_build_object('ready',true,'purpose','MARKETING','version',1,'guard_count',4,'guards',guards,'dependencies',dependencies,'bindings',(select jsonb_agg(to_jsonb(b)order by object_type,target_table,object_name)from private.dsr_restriction_consumer_bindings_v1 b),'scopes',jsonb_build_object('touch','CAMPAIGN_ORGANIZATION_ONLY','source_fact','BUSINESS_SOURCE_ORGANIZATION_ONLY','conversion','BUSINESS_SOURCE_ORGANIZATION_ONLY','notification','MESSAGE_ORGANIZATION_OPTIONAL_MARKETING_CATEGORY_ONLY','subject','EXACT_VERIFIED_SUBJECT_ONLY','other_organizations_restricted',false,'business_sources_preserved',true,'existing_history_erased',false,'non_marketing_security_legal_messages_preserved',true,'historical_custom_mandatory_messages_preserved',true,'new_mandatory_marketing_records_forbidden',true,'anonymous_unlinked_aggregate_views_covered',false));
end$$;
revoke all on function private.dsr_restriction_consumer_proof_v1(text)from public,anon,authenticated,service_role;

notify pgrst,'reload schema';
commit;
