begin;
-- An executable binding is versioned and independently approved. Arbitrary SQL,
-- URLs and browser-provided prices are not part of this ABI.
create table public.benefit_native_bindings_v1(
 id uuid primary key default extensions.gen_random_uuid(),benefit_version_id uuid not null references public.benefit_versions(id),version integer not null check(version>0),
 executor text not null check(executor in('PLATFORM_ENTITLEMENT','SERVICE_POOL','RFQ_REQUEST')),
 config jsonb not null check(jsonb_typeof(config)='object'),source_hash text not null,content_hash text not null,
 created_by uuid not null references auth.users(id),created_at timestamptz not null default clock_timestamp(),
 reference text not null check(length(btrim(reference))between 8 and 1000),unique(benefit_version_id,version)
);
create table public.benefit_native_binding_decisions_v1(
 binding_id uuid primary key references public.benefit_native_bindings_v1(id),approved boolean not null,content_hash text not null,
 decided_by uuid not null references auth.users(id),created_at timestamptz not null default clock_timestamp(),reason text not null check(length(btrim(reason))between 10 and 2000)
);
create table public.benefit_native_execution_facts_v1(
 redemption_id uuid primary key references public.benefit_redemptions(id),organization_id uuid not null references public.organizations(id),
 binding_id uuid not null references public.benefit_native_bindings_v1(id),executor text not null,result jsonb not null,
 created_by uuid not null references auth.users(id),created_at timestamptz not null default clock_timestamp(),valid_until timestamptz not null,
 entitlement_code text,source_hash text not null
);
do $$declare t text;begin foreach t in array array['benefit_native_bindings_v1','benefit_native_binding_decisions_v1','benefit_native_execution_facts_v1']loop
 execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
 execute format('create trigger %I before update or delete on public.%I for each row execute function private.prevent_update_delete()',left(t,40)||'_immutable',t);
end loop;end$$;
create function private.benefit_native_binding_v1(p_version uuid)returns public.benefit_native_bindings_v1
language sql stable security definer set search_path=pg_catalog,public,private as $$
 select b from public.benefit_native_bindings_v1 b join public.benefit_native_binding_decisions_v1 d on d.binding_id=b.id and d.approved and d.content_hash=b.content_hash and d.decided_by<>b.created_by
 where b.benefit_version_id=p_version and b.source_hash=private.canonical_request_hash(private.benefit_admission_source_v1(p_version))order by b.version desc limit 1
$$;
create function public.propose_benefit_native_binding_v1(p_benefit_version_id uuid,p_executor text,p_config jsonb,p_reference text)returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare b public.benefit_versions%rowtype;x uuid;v integer;h text;s text;begin
 if not coalesce(private.benefit_admission_staff_v1(),false)then raise exception'BENEFIT_NATIVE_CONFIGURATION_DENIED'using errcode='42501';end if;
 if p_executor is null or p_executor not in('PLATFORM_ENTITLEMENT','SERVICE_POOL','RFQ_REQUEST')or jsonb_typeof(p_config)is distinct from'object'or length(btrim(coalesce(p_reference,'')))not between 8 and 1000 then raise exception'INVALID_BENEFIT_NATIVE_BINDING'using errcode='22023';end if;
 select*into b from public.benefit_versions where id=p_benefit_version_id;
 if b.id is null or b.status<>'ACTIVE'then raise exception'ACTIVE_BENEFIT_VERSION_REQUIRED'using errcode='55000';end if;
 if p_executor='PLATFORM_ENTITLEMENT'then
 if b.fulfillment_mode<>'AUTOMATED_PLATFORM'or b.benefit_type not in('PLATFORM_FEATURE','PRIORITY','ACCESS_RIGHT')or(p_config-'entitlement_code'-'duration_seconds')<>'{}'::jsonb or coalesce(p_config->>'entitlement_code','')!~'^[A-Z][A-Z0-9_]{1,79}$'or coalesce(p_config->>'duration_seconds','')!~'^[1-9][0-9]{0,8}$'or not exists(select 1 from public.plan_entitlements where entitlement_code=p_config->>'entitlement_code')then raise exception'INVALID_PLATFORM_ENTITLEMENT_BINDING'using errcode='22023';end if;
 elsif p_executor='SERVICE_POOL'then
 if b.fulfillment_mode not in('VOLUME_POOL','SUBCONTRACTOR_POOL')or(p_config-'pool_id'-'units_per_benefit')<>'{}'::jsonb or coalesce(p_config->>'units_per_benefit','')!~'^[1-9][0-9]{0,8}$'or not exists(select 1 from public.service_inventory_pools p join public.framework_agreement_versions av on av.id=p.agreement_version_id join public.framework_agreements a on a.id=av.agreement_id join public.service_skus sv on sv.id=a.sku_id where p.id=(p_config->>'pool_id')::uuid and sv.service_id=b.service_id and p.status in('ACTIVE','LOW_STOCK'))then raise exception'INVALID_SERVICE_POOL_BINDING'using errcode='22023';end if;
 else
 if b.fulfillment_mode<>'RFQ'or b.service_id is null or p_config<>'{}'::jsonb then raise exception'INVALID_RFQ_REQUEST_BINDING'using errcode='22023';end if;
 end if;
 perform pg_advisory_xact_lock(hashtextextended('benefit-admission:'||b.id::text,0));
 if not coalesce(private.benefit_admission_staff_v1(),false)then raise exception'BENEFIT_NATIVE_CONFIGURATION_DENIED'using errcode='42501';end if;
 select coalesce(max(version),0)+1 into v from public.benefit_native_bindings_v1 where benefit_version_id=b.id;
 s:=private.canonical_request_hash(private.benefit_admission_source_v1(b.id));h:=private.canonical_request_hash(jsonb_build_object('benefit',b.id,'version',v,'source',s,'executor',p_executor,'config',p_config,'reference',btrim(p_reference)));
 insert into public.benefit_native_bindings_v1(benefit_version_id,version,executor,config,source_hash,content_hash,created_by,reference)values(b.id,v,p_executor,p_config,s,h,auth.uid(),btrim(p_reference))returning id into x;
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(null,auth.uid(),'USER','benefit.native_binding_proposed','benefit_native_binding',x::text,extensions.gen_random_uuid(),jsonb_build_object('content_hash',h),repeat('0',64));
 return jsonb_build_object('outcome','BENEFIT_NATIVE_BINDING_PROPOSED','binding_id',x,'content_hash',h);
end$$;
create function public.decide_benefit_native_binding_v1(p_binding_id uuid,p_expected_hash text,p_approve boolean,p_reason text)returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare b public.benefit_native_bindings_v1%rowtype;begin
 if not coalesce(private.benefit_admission_staff_v1(),false)then raise exception'BENEFIT_NATIVE_CONFIGURATION_DENIED'using errcode='42501';end if;
 select*into b from public.benefit_native_bindings_v1 where id=p_binding_id for update;
 if b.id is null or b.created_by=auth.uid()then raise exception'BENEFIT_NATIVE_INDEPENDENT_APPROVAL_REQUIRED'using errcode='42501';end if;
 if p_approve is null or length(btrim(coalesce(p_reason,'')))not between 10 and 2000 then raise exception'INVALID_BENEFIT_NATIVE_REVIEW'using errcode='22023';end if;
 if b.content_hash is distinct from p_expected_hash or b.source_hash is distinct from private.canonical_request_hash(private.benefit_admission_source_v1(b.benefit_version_id))then raise exception'STALE_BENEFIT_NATIVE_BINDING'using errcode='40001';end if;
 insert into public.benefit_native_binding_decisions_v1(binding_id,approved,content_hash,decided_by,reason)values(b.id,p_approve,b.content_hash,auth.uid(),btrim(p_reason));
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(null,auth.uid(),'USER','benefit.native_binding_reviewed','benefit_native_binding',b.id::text,extensions.gen_random_uuid(),jsonb_build_object('approved',p_approve,'content_hash',b.content_hash),repeat('0',64));
 return jsonb_build_object('outcome','BENEFIT_NATIVE_BINDING_REVIEWED','approved',p_approve);
end$$;

create function public.execute_benefit_native_v1(p_redemption_id uuid,p_expected_row_version bigint,p_request_context jsonb,p_idempotency_key text)returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare r public.benefit_redemptions%rowtype;b public.benefit_versions%rowtype;binding public.benefit_native_bindings_v1%rowtype;old public.benefit_native_execution_facts_v1%rowtype;result jsonb;h text;expires timestamptz;source jsonb;begin
 select*into r from public.benefit_redemptions where id=p_redemption_id;
 if r.id is null or auth.uid()is null or auth.jwt()->>'aal'is distinct from'aal2'or not(private.has_org_role(r.organization_id,array['CLIENT_OWNER','CLIENT_ADMIN','CLIENT_BUYER'])or private.benefit_operations_access_v1())then raise exception'BENEFIT_NATIVE_EXECUTION_DENIED'using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('subscription-financial:'||r.organization_id::text,0));perform id from public.credit_wallets where id=r.wallet_id for update;
 select*into r from public.benefit_redemptions where id=p_redemption_id for update;
 h:=private.canonical_request_hash(jsonb_build_object('redemption',r.id,'version',p_expected_row_version,'context',p_request_context));
 result:=private.begin_credit_command(r.organization_id,'benefit.native.execute',p_idempotency_key,h,auth.uid());if result is not null then return result;end if;
 if r.row_version is distinct from p_expected_row_version then raise exception'STALE_BENEFIT_REDEMPTION'using errcode='40001';end if;
 if r.status not in('RESERVED','SCHEDULED','IN_PROGRESS')or r.reservation_expires_at<=clock_timestamp()or not private.benefit_reserved_funding_ready_v1(r.id)or not private.subscription_financially_clear(r.organization_id)or not private.client_identity_allows_new_operations(r.organization_id)then raise exception'BENEFIT_NATIVE_FUNDING_REQUIRED'using errcode='55000';end if;
 select*into b from public.benefit_versions where id=r.benefit_version_id;binding:=private.benefit_native_binding_v1(b.id);
 if binding.id is null then raise exception'BENEFIT_NATIVE_BINDING_REQUIRED'using errcode='55000';end if;
 if exists(select 1 from public.benefit_native_execution_facts_v1 where redemption_id=r.id)then raise exception'BENEFIT_ALREADY_EXECUTED'using errcode='55000';end if;
 expires:=r.reservation_expires_at;
 if binding.executor='PLATFORM_ENTITLEMENT'then
 if p_request_context<>'{}'::jsonb then raise exception'INVALID_PLATFORM_EXECUTION_CONTEXT'using errcode='22023';end if;
 expires:=least(expires,clock_timestamp()+make_interval(secs=>(binding.config->>'duration_seconds')::integer));
 result:=jsonb_build_object('outcome','PLATFORM_ENTITLEMENT_ACTIVATED','entitlement_code',binding.config->>'entitlement_code','valid_until',expires);
 elsif binding.executor='SERVICE_POOL'then
 if p_request_context<>'{}'::jsonb then raise exception'INVALID_POOL_EXECUTION_CONTEXT'using errcode='22023';end if;
 select least(expires,p.window_end,clock_timestamp()+p.reservation_ttl)into expires from public.service_inventory_pools p where p.id=(binding.config->>'pool_id')::uuid;
 result:=public.reserve_service_units((binding.config->>'pool_id')::uuid,r.organization_id,'BENEFIT:'||r.id::text,r.units::numeric*(binding.config->>'units_per_benefit')::numeric,expires,p_idempotency_key||':pool',extensions.gen_random_uuid());
 else
 if not private.has_org_role(r.organization_id,array['CLIENT_OWNER','CLIENT_ADMIN','CLIENT_BUYER'])then raise exception'BENEFIT_RFQ_CLIENT_CONFIRMATION_REQUIRED'using errcode='42501';end if;
 -- The normal request command validates catalogue/questionnaire hashes and
 -- incomplete data stays INFORMATION_REQUIRED; no consultation is fabricated.
 result:=public.create_service_request(r.organization_id,b.library_id,b.service_id,nullif(p_request_context->>'questionnaire_version_id','')::uuid,p_request_context->'payload','Consultation depuis un avantage acquis',p_idempotency_key||':rfq',extensions.gen_random_uuid());
 end if;
 source:=jsonb_build_object('redemption',r.id,'binding_id',binding.id,'binding_hash',binding.content_hash,'result',result,'valid_until',expires);
 insert into public.benefit_native_execution_facts_v1(redemption_id,organization_id,binding_id,executor,result,created_by,valid_until,entitlement_code,source_hash)
 values(r.id,r.organization_id,binding.id,binding.executor,result,auth.uid(),expires,case when binding.executor='PLATFORM_ENTITLEMENT'then binding.config->>'entitlement_code'end,private.canonical_request_hash(source));
 insert into public.benefit_fulfillment_steps_v1(redemption_id,organization_id,action,from_status,to_status,reason,created_by)values(r.id,r.organization_id,'START',r.status,'IN_PROGRESS','Exécution native vérifiée : '||binding.executor,auth.uid());
 update public.benefit_redemptions set status='IN_PROGRESS',row_version=row_version+1,updated_at=clock_timestamp()where id=r.id;
 result:=result||jsonb_build_object('redemption_id',r.id,'binding_id',binding.id,'row_version',(r.row_version+1)::text);
 perform private.record_benefit_fulfillment_fact_v1(r.organization_id,r.id,'BenefitNativeExecutedV1',result,p_idempotency_key);
 perform private.finish_credit_command(r.organization_id,'benefit.native.execute',p_idempotency_key,result);return result;
end$$;
create function private.benefit_platform_entitlement_v1(p_org uuid,p_code text,p_at timestamptz)returns boolean
language sql stable security definer set search_path=pg_catalog,public,private as $$
 select exists(select 1 from public.benefit_native_execution_facts_v1 f join public.benefit_redemptions r on r.id=f.redemption_id
 where f.organization_id=p_org and f.entitlement_code=p_code and f.executor='PLATFORM_ENTITLEMENT'and f.created_at<=p_at and f.valid_until>p_at and r.status in('IN_PROGRESS','DELIVERED','CONSUMED'))
$$;
-- Preserve the original authorization/financial/identity checks; only the
-- boolean entitlement decision gains this separately proved acquired right.
do $$declare d text;body text;begin
 d:=pg_get_functiondef('public.subscription_has_entitlement(uuid,text,timestamptz)'::regprocedure);
 body:=regexp_replace(btrim(split_part(split_part(d,'AS $function$',2),'$function$',1),' ;'||chr(10)||chr(13)), '^select[[:space:]]+', '', 'i');
 if body=''or body=d then raise exception'ENTITLEMENT_NATIVE_PATCH_SOURCE_MISMATCH';end if;
 -- Wrap the complete old predicate; the grant branch repeats every outer guard.
 execute 'create or replace function public.subscription_has_entitlement(p_organization_id uuid,p_entitlement_code text,p_at timestamptz default clock_timestamp())returns boolean language sql stable security definer set search_path=pg_catalog,public,private as $native$ select ('||body||') or (private.subscription_read_access(p_organization_id,auth.uid())and private.subscription_financially_clear(p_organization_id)and private.client_identity_allows_new_operations(p_organization_id)and not exists(select 1 from public.subscription_entitlement_suspensions x join public.subscriptions s on s.id=x.subscription_id where s.organization_id=p_organization_id and x.entitlement_code=p_entitlement_code and x.effective_from<=p_at and(x.effective_to is null or x.effective_to>p_at))and private.benefit_platform_entitlement_v1(p_organization_id,p_entitlement_code,p_at)) $native$';
end$$;

-- Native adapters must exist before AUTOMATED_PLATFORM may be admitted. The
-- independent receipt remains required; a side effect is not its acceptance.
do $$declare d text;begin
 d:=pg_get_functiondef('public.propose_benefit_admission_policy_v1(uuid,text,uuid,text,bigint,bigint,text[],uuid[],timestamptz,timestamptz,text,text,text,uuid)'::regprocedure);
 d:=replace(d,'''MATRICIA_INTERNAL'',''DIRECT_PROVIDER'',''SUBCONTRACTOR_POOL'',''VOLUME_POOL'',''RFQ'')then raise exception''BENEFIT_AUTOMATION_NOT_CONFIGURED''','''MATRICIA_INTERNAL'',''DIRECT_PROVIDER'',''SUBCONTRACTOR_POOL'',''VOLUME_POOL'',''RFQ'',''AUTOMATED_PLATFORM'')then raise exception''BENEFIT_AUTOMATION_NOT_CONFIGURED''');execute d;
 d:=pg_get_functiondef('private.benefit_admission_status_v1(uuid,uuid,bigint,timestamptz,uuid)'::regprocedure);
 d:=replace(d,'elsif b.fulfillment_mode=''AUTOMATED_PLATFORM''then reason:=''BENEFIT_AUTOMATION_NOT_CONFIGURED'';','elsif b.fulfillment_mode=''AUTOMATED_PLATFORM''and(private.benefit_native_binding_v1(b.id)).id is null then reason:=''BENEFIT_AUTOMATION_NOT_CONFIGURED'';');execute d;
 d:=pg_get_functiondef('public.propose_benefit_delivery_v1(uuid,bigint,text,text,timestamptz,text)'::regprocedure);
 d:=replace(d,'if exists(select 1 from public.benefit_versions where id=d.benefit_version_id and fulfillment_mode=''AUTOMATED_PLATFORM'')then raise exception''BENEFIT_NATIVE_PLATFORM_EXECUTOR_REQUIRED''using errcode=''55000'';end if;','if exists(select 1 from public.benefit_versions where id=d.benefit_version_id and fulfillment_mode=''AUTOMATED_PLATFORM'')and not exists(select 1 from public.benefit_native_execution_facts_v1 where redemption_id=d.id and executor=''PLATFORM_ENTITLEMENT'')then raise exception''BENEFIT_NATIVE_PLATFORM_EXECUTOR_REQUIRED''using errcode=''55000'';end if;');execute d;
 d:=pg_get_functiondef('private.benefit_admitted_fulfillment_evidence_v1(uuid)'::regprocedure);
 d:=replace(d,'''SUBCONTRACTOR_POOL'',''VOLUME_POOL'',''RFQ'')','''SUBCONTRACTOR_POOL'',''VOLUME_POOL'',''RFQ'',''AUTOMATED_PLATFORM'')');execute d;
 d:=pg_get_functiondef('private.benefit_accepted_receipt_v1(uuid,text)'::regprocedure);
 d:=replace(d,'and b.fulfillment_mode<>''AUTOMATED_PLATFORM''','and(b.fulfillment_mode<>''AUTOMATED_PLATFORM''or exists(select 1 from public.benefit_native_execution_facts_v1 native where native.redemption_id=d.id and native.executor=''PLATFORM_ENTITLEMENT''))');execute d;
end$$;
revoke all on function private.benefit_native_binding_v1(uuid),private.benefit_platform_entitlement_v1(uuid,text,timestamptz),public.propose_benefit_native_binding_v1(uuid,text,jsonb,text),public.decide_benefit_native_binding_v1(uuid,text,boolean,text),public.execute_benefit_native_v1(uuid,bigint,jsonb,text)from public,anon,authenticated,service_role;
grant execute on function public.propose_benefit_native_binding_v1(uuid,text,jsonb,text),public.decide_benefit_native_binding_v1(uuid,text,boolean,text),public.execute_benefit_native_v1(uuid,bigint,jsonb,text)to authenticated;
notify pgrst,'reload schema';
commit;
