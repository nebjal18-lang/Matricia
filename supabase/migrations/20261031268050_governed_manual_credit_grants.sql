begin;
-- Capture the mature issuer only after its canonical subscription funding
-- guards exist. A deployment missing this dependency fails before any change.
do $$begin
 if not exists(select 1 from pg_trigger where tgrelid='public.credit_lots'::regclass and tgname='credit_lot_subscription_payment_binding'and tgenabled='O'and tgfoid=to_regprocedure('private.bind_subscription_credit_payment_v1()'))or not exists(select 1 from pg_trigger where tgrelid='public.credit_lots'::regclass and tgname='credit_lot_subscription_currency'and tgenabled='O'and tgfoid=to_regprocedure('private.prepare_subscription_credit_currency_v1()'))then raise exception'MANUAL_CREDIT_CANONICAL_SUBSCRIPTION_DEPENDENCY_REQUIRED'using errcode='55000';end if;
end$$;
create table public.manual_credit_grant_requests_v1(id uuid primary key default extensions.gen_random_uuid(),organization_id uuid not null references public.organizations(id),wallet_id uuid not null references public.credit_wallets(id),source_type text not null check(source_type in('ADMIN_GRANT','BONUS','PROMOTION')),quantity bigint not null check(quantity>0),expires_at timestamptz not null check(isfinite(expires_at)),library_id uuid references public.catalog_libraries(id),source_reference text not null,reason text not null,environment text not null check(environment in('DEVELOPMENT','STAGING','PRODUCTION')),content_hash text not null check(content_hash~'^[a-f0-9]{64}$'),created_by uuid not null references auth.users(id),created_at timestamptz not null default clock_timestamp(),idempotency_key text not null,unique(created_by,idempotency_key));
create table public.manual_credit_grant_reviews_v1(request_id uuid primary key references public.manual_credit_grant_requests_v1(id),content_hash text not null check(content_hash~'^[a-f0-9]{64}$'),decision text not null check(decision in('APPROVED','REJECTED')),reason text not null,approval_reference text not null,review_proof_hash text not null check(review_proof_hash~'^[a-f0-9]{64}$'),decided_by uuid not null references auth.users(id),decided_at timestamptz not null default clock_timestamp());
create table public.manual_credit_grant_executions_v1(request_id uuid primary key references public.manual_credit_grant_requests_v1(id),credit_lot_id uuid not null unique references public.credit_lots(id),review_proof_hash text not null,result jsonb not null,executed_by uuid not null references auth.users(id),executed_at timestamptz not null default clock_timestamp());
alter table public.manual_credit_grant_requests_v1 enable row level security;
alter table public.manual_credit_grant_reviews_v1 enable row level security;
alter table public.manual_credit_grant_executions_v1 enable row level security;
revoke all on public.manual_credit_grant_requests_v1,public.manual_credit_grant_reviews_v1,public.manual_credit_grant_executions_v1 from public,anon,authenticated,service_role;
create trigger manual_credit_requests_immutable before update or delete on public.manual_credit_grant_requests_v1 for each row execute function private.prevent_client_delivery_history_change();
create trigger manual_credit_reviews_immutable before update or delete on public.manual_credit_grant_reviews_v1 for each row execute function private.prevent_client_delivery_history_change();
create trigger manual_credit_executions_immutable before update or delete on public.manual_credit_grant_executions_v1 for each row execute function private.prevent_client_delivery_history_change();
create function private.manual_credit_finance_v1(p_actor uuid default auth.uid())returns boolean language sql stable security definer set search_path=pg_catalog,private as $$select auth.uid()is not null and auth.jwt()->>'aal'='aal2'and private.has_platform_role(array['FINANCE_MANAGER','SUPER_ADMIN'],p_actor)$$;
revoke all on function private.manual_credit_finance_v1(uuid)from public,anon,authenticated,service_role;
-- A private copy retains the mature ledgers, native SC funding guards and
-- idempotency. Public manual inputs cannot reach it. Native award_reward keeps
-- its verified rule/event/independent approval/caps and fixes every core term.
do $$declare definition text;begin
 select pg_get_functiondef('public.issue_credits(uuid,uuid,text,bigint,timestamptz,uuid,text,bigint,text,text,text,uuid)'::regprocedure)into definition;
 definition:=replace(definition,'FUNCTION public.issue_credits(','FUNCTION private.issue_credits_authorized_core_v1(');
 if strpos(definition,'FUNCTION private.issue_credits_authorized_core_v1(')=0 then raise exception'MANUAL_CREDIT_CORE_PATCH_SOURCE_MISMATCH';end if;execute definition;
 select pg_get_functiondef('public.award_reward(uuid,uuid,uuid,text,text,text,jsonb,text,text,uuid)'::regprocedure)into definition;
 if strpos(definition,'issued:=public.issue_credits(')=0 or strpos(definition,'REWARD_SOURCE_RULE_BINDING_FAILED')=0 or strpos(definition,'REWARD_RECIPIENT_CAP_EXCEEDED')=0 or strpos(definition,'REWARD_GLOBAL_CAP_EXCEEDED')=0 then raise exception'MANUAL_CREDIT_NATIVE_REWARD_PATCH_SOURCE_MISMATCH';end if;
 definition:=replace(definition,'issued:=public.issue_credits(','issued:=private.issue_credits_authorized_core_v1(');execute definition;
end$$;
revoke all on function private.issue_credits_authorized_core_v1(uuid,uuid,text,bigint,timestamptz,uuid,text,bigint,text,text,text,uuid)from public,anon,authenticated,service_role;
create or replace function public.issue_credits(p_organization_id uuid,p_wallet_id uuid,p_source_type text,p_quantity bigint,p_expires_at timestamptz,p_library_id uuid,p_source_reference text,p_revenue_value_minor bigint,p_rule_version text,p_approval_reference text,p_idempotency_key text,p_correlation_id uuid default extensions.gen_random_uuid())returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private,extensions as $$begin
 if auth.uid()is null or auth.jwt()->>'aal'is distinct from'aal2'or not private.credits_admin_access()then raise exception'CREDIT_ISSUE_DENIED'using errcode='42501';end if;
 if p_source_type='EXTRA_PURCHASE'then raise exception'CREDIT_PACK_CANONICAL_PAYMENT_REQUIRED'using errcode='55000';end if;
 if p_source_type is null or p_source_type in('ADMIN_GRANT','BONUS','PROMOTION')then raise exception'CREDIT_MANUAL_GOVERNED_REQUEST_REQUIRED'using errcode='55000';end if;
 return private.issue_credits_authorized_core_v1(p_organization_id,p_wallet_id,p_source_type,p_quantity,p_expires_at,p_library_id,p_source_reference,p_revenue_value_minor,p_rule_version,p_approval_reference,p_idempotency_key,p_correlation_id);
end$$;
create function public.request_manual_credit_grant_v1(p_organization_id uuid,p_wallet_id uuid,p_source_type text,p_quantity bigint,p_expires_at timestamptz,p_library_id uuid,p_source_reference text,p_reason text,p_idempotency_key text)returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private set timezone='UTC' as $$
declare request public.manual_credit_grant_requests_v1%rowtype;environment_value text;h text;result jsonb;c uuid:=extensions.gen_random_uuid();begin
 if not private.manual_credit_finance_v1()then raise exception'MANUAL_CREDIT_FINANCE_AAL2_REQUIRED'using errcode='42501';end if;
 if p_organization_id is null or p_wallet_id is null or p_source_type is null or p_source_type not in('ADMIN_GRANT','BONUS','PROMOTION')or p_quantity is null or p_quantity<=0 or p_expires_at is null or not isfinite(p_expires_at)or length(btrim(coalesce(p_source_reference,'')))not between 3 and 500 or length(btrim(coalesce(p_reason,'')))not between 10 and 2000 or length(coalesce(p_idempotency_key,''))not between 8 and 200 then raise exception'INVALID_MANUAL_CREDIT_REQUEST'using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('subscription-financial:'||p_organization_id::text,0));
 perform pg_advisory_xact_lock(hashtextextended('manual-credit-request:'||auth.uid()::text||':'||p_idempotency_key,0));
 perform 1 from public.credit_wallets where id=p_wallet_id and organization_id=p_organization_id and wallet_type='CLIENT'for update;
 if not found then raise exception'MANUAL_CREDIT_CLIENT_WALLET_REQUIRED'using errcode='23514';end if;
 if not private.manual_credit_finance_v1()then raise exception'MANUAL_CREDIT_FINANCE_AAL2_REQUIRED'using errcode='42501';end if;
 select environment into environment_value from private.admin_execution_environment_v1 where singleton;
 if environment_value is null then raise exception'MANUAL_CREDIT_TRUSTED_ENVIRONMENT_REQUIRED'using errcode='55000';end if;
 h:=private.canonical_request_hash(jsonb_build_object('organization',p_organization_id,'wallet',p_wallet_id,'source_type',p_source_type,'quantity',p_quantity::text,'expires_at',p_expires_at,'library',p_library_id,'source',btrim(p_source_reference),'reason',btrim(p_reason),'environment',environment_value,'revenue_value_minor','0','rule_version','MANUAL_CREDIT_GRANT_V1'));
 select*into request from public.manual_credit_grant_requests_v1 where created_by=auth.uid()and idempotency_key=p_idempotency_key;
 if request.id is not null then if request.content_hash is distinct from h then raise exception'IDEMPOTENCY_KEY_REUSED'using errcode='22023';end if;return jsonb_build_object('outcome','MANUAL_CREDIT_GRANT_REQUESTED','request_id',request.id,'content_hash',h,'status','PENDING_REVIEW');end if;
 if not exists(select 1 from public.organizations where id=p_organization_id and status='ACTIVE')or p_expires_at<=clock_timestamp()then raise exception'MANUAL_CREDIT_ACTIVE_ORGANIZATION_AND_FUTURE_EXPIRY_REQUIRED'using errcode='55000';end if;
 insert into public.manual_credit_grant_requests_v1(organization_id,wallet_id,source_type,quantity,expires_at,library_id,source_reference,reason,environment,content_hash,created_by,idempotency_key)values(p_organization_id,p_wallet_id,p_source_type,p_quantity,p_expires_at,p_library_id,btrim(p_source_reference),btrim(p_reason),environment_value,h,auth.uid(),p_idempotency_key)returning*into request;
 result:=jsonb_build_object('outcome','MANUAL_CREDIT_GRANT_REQUESTED','request_id',request.id,'content_hash',h,'status','PENDING_REVIEW');
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(request.organization_id,auth.uid(),'USER','credits.manual.requested','manual_credit_grant',request.id::text,c,result,repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values(request.organization_id,'manual_credit_grant',request.id::text,'ManualCreditGrantRequestedV1',c,result,'manual-credit-request:'||request.id::text);return result;
end$$;
create function public.review_manual_credit_grant_v1(p_request_id uuid,p_expected_content_hash text,p_approve boolean,p_terms_confirmed boolean,p_approval_reference text,p_reason text)returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare request public.manual_credit_grant_requests_v1%rowtype;review public.manual_credit_grant_reviews_v1%rowtype;environment_value text;proof text;result jsonb;c uuid:=extensions.gen_random_uuid();begin
 if not private.manual_credit_finance_v1()then raise exception'MANUAL_CREDIT_FINANCE_AAL2_REQUIRED'using errcode='42501';end if;
 select organization_id into request.organization_id from public.manual_credit_grant_requests_v1 where id=p_request_id;
 if request.organization_id is null then raise exception'MANUAL_CREDIT_REQUEST_NOT_FOUND'using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('subscription-financial:'||request.organization_id::text,0));
 select*into request from public.manual_credit_grant_requests_v1 where id=p_request_id for update;
 if not private.manual_credit_finance_v1()or not private.manual_credit_finance_v1(request.created_by)or request.created_by=auth.uid()then raise exception'MANUAL_CREDIT_INDEPENDENT_FINANCE_REVIEW_REQUIRED'using errcode='42501';end if;
 select environment into environment_value from private.admin_execution_environment_v1 where singleton;
 if environment_value is distinct from request.environment then raise exception'MANUAL_CREDIT_ENVIRONMENT_MISMATCH'using errcode='55000';end if;
 if p_expected_content_hash is distinct from request.content_hash then raise exception'STALE_MANUAL_CREDIT_REQUEST'using errcode='40001';end if;
 if p_approve is null or(p_approve and p_terms_confirmed is distinct from true)or length(btrim(coalesce(p_approval_reference,'')))not between 8 and 500 or length(btrim(coalesce(p_reason,'')))not between 10 and 2000 then raise exception'MANUAL_CREDIT_DOCUMENTED_REVIEW_REQUIRED'using errcode='22023';end if;
 result:=jsonb_build_object('outcome','MANUAL_CREDIT_GRANT_REVIEWED','request_id',request.id,'content_hash',request.content_hash,'status',case when p_approve then'APPROVED'else'REJECTED'end);
 select*into review from public.manual_credit_grant_reviews_v1 where request_id=request.id;
 if review.request_id is not null then if review.decided_by=auth.uid()and review.decision=result->>'status'and review.reason=btrim(p_reason)and review.approval_reference=btrim(p_approval_reference)then return result||jsonb_build_object('review_proof_hash',review.review_proof_hash);end if;raise exception'MANUAL_CREDIT_ALREADY_REVIEWED'using errcode='55000';end if;
 proof:=private.canonical_request_hash(result||jsonb_build_object('reviewer',auth.uid(),'reference',btrim(p_approval_reference),'reason',btrim(p_reason)));
 insert into public.manual_credit_grant_reviews_v1(request_id,content_hash,decision,reason,approval_reference,review_proof_hash,decided_by)values(request.id,request.content_hash,result->>'status',btrim(p_reason),btrim(p_approval_reference),proof,auth.uid());result:=result||jsonb_build_object('review_proof_hash',proof);
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(request.organization_id,auth.uid(),'USER','credits.manual.reviewed','manual_credit_grant',request.id::text,c,result,repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values(request.organization_id,'manual_credit_grant',request.id::text,'ManualCreditGrantReviewedV1',c,result,'manual-credit-review:'||request.id::text);return result;
end$$;
create function public.execute_manual_credit_grant_v1(p_request_id uuid,p_expected_content_hash text,p_expected_review_proof_hash text,p_idempotency_key text)returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare request public.manual_credit_grant_requests_v1%rowtype;review public.manual_credit_grant_reviews_v1%rowtype;execution public.manual_credit_grant_executions_v1%rowtype;environment_value text;result jsonb;c uuid:=extensions.gen_random_uuid();begin
 if not private.manual_credit_finance_v1()then raise exception'MANUAL_CREDIT_FINANCE_AAL2_REQUIRED'using errcode='42501';end if;
 if length(coalesce(p_idempotency_key,''))not between 8 and 200 then raise exception'INVALID_IDEMPOTENCY_KEY'using errcode='22023';end if;
 select organization_id into request.organization_id from public.manual_credit_grant_requests_v1 where id=p_request_id;
 if request.organization_id is null then raise exception'MANUAL_CREDIT_REQUEST_NOT_FOUND'using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('subscription-financial:'||request.organization_id::text,0));
 select*into request from public.manual_credit_grant_requests_v1 where id=p_request_id for update;
 perform 1 from public.credit_wallets where id=request.wallet_id and organization_id=request.organization_id and wallet_type='CLIENT'for update;
 if not found then raise exception'MANUAL_CREDIT_CLIENT_WALLET_REQUIRED'using errcode='23514';end if;
 select*into review from public.manual_credit_grant_reviews_v1 where request_id=request.id;
 select environment into environment_value from private.admin_execution_environment_v1 where singleton;
 if not private.manual_credit_finance_v1()or not private.manual_credit_finance_v1(request.created_by)or not private.manual_credit_finance_v1(review.decided_by)or review.decided_by=request.created_by then raise exception'MANUAL_CREDIT_CURRENT_AUTHORITIES_REQUIRED'using errcode='42501';end if;
 if environment_value is distinct from request.environment then raise exception'MANUAL_CREDIT_ENVIRONMENT_MISMATCH'using errcode='55000';end if;
 if p_expected_content_hash is distinct from request.content_hash or p_expected_review_proof_hash is distinct from review.review_proof_hash then raise exception'STALE_MANUAL_CREDIT_REQUEST'using errcode='40001';end if;
 if review.request_id is null or review.decision<>'APPROVED'or review.content_hash<>request.content_hash then raise exception'MANUAL_CREDIT_APPROVED_REVIEW_REQUIRED'using errcode='55000';end if;
 select*into execution from public.manual_credit_grant_executions_v1 where request_id=request.id;
 if execution.request_id is not null then return execution.result;end if;
 if request.expires_at<=clock_timestamp()or not exists(select 1 from public.organizations where id=request.organization_id and status='ACTIVE')then raise exception'MANUAL_CREDIT_ACTIVE_ORGANIZATION_AND_FUTURE_EXPIRY_REQUIRED'using errcode='55000';end if;
 result:=private.issue_credits_authorized_core_v1(request.organization_id,request.wallet_id,request.source_type,request.quantity,request.expires_at,request.library_id,request.source_reference,0,'MANUAL_CREDIT_GRANT_V1','manual-credit-review:'||request.id::text,'manual-credit-execute:'||request.id::text,c);
 if result->>'outcome'is distinct from'CREDITS_ISSUED'then raise exception'MANUAL_CREDIT_EXECUTION_NOT_CONFIRMED'using errcode='55000';end if;
 result:=result||jsonb_build_object('outcome','MANUAL_CREDIT_GRANT_EXECUTED','request_id',request.id,'status','EXECUTED','review_proof_hash',review.review_proof_hash,'quantity',request.quantity::text,'entry_id',result->>'entry_id','revenue_value_minor','0');
 insert into public.manual_credit_grant_executions_v1(request_id,credit_lot_id,review_proof_hash,result,executed_by)values(request.id,(result->>'credit_lot_id')::uuid,review.review_proof_hash,result,auth.uid());
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(request.organization_id,auth.uid(),'USER','credits.manual.executed','manual_credit_grant',request.id::text,c,result,repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values(request.organization_id,'manual_credit_grant',request.id::text,'ManualCreditGrantExecutedV1',c,result,'manual-credit-execute:'||request.id::text);return result;
end$$;
-- Existing promotion grants had no independently approved authority. Keep the
-- real workflow, deriving the requested terms from the selected active version,
-- and present PENDING_REVIEW until the separate Finance review and execution.
create or replace function public.grant_credit_promotion(p_promotion_version_id uuid,p_organization_id uuid,p_wallet_id uuid,p_idempotency_key text,p_correlation_id uuid default extensions.gen_random_uuid())returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare promotion public.credit_promotion_versions%rowtype;request public.manual_credit_grant_requests_v1%rowtype;cap bigint;begin
 if not private.manual_credit_finance_v1()then raise exception'MANUAL_CREDIT_FINANCE_AAL2_REQUIRED'using errcode='42501';end if;
 if length(coalesce(p_idempotency_key,''))not between 8 and 180 then raise exception'INVALID_IDEMPOTENCY_KEY'using errcode='22023';end if;
 select*into request from public.manual_credit_grant_requests_v1 where created_by=auth.uid()and idempotency_key='promotion-request:'||p_idempotency_key;
 if request.id is not null then if request.organization_id is distinct from p_organization_id or request.wallet_id is distinct from p_wallet_id or request.source_reference is distinct from'PROMOTION_VERSION:'||p_promotion_version_id::text then raise exception'IDEMPOTENCY_KEY_REUSED'using errcode='22023';end if;return public.request_manual_credit_grant_v1(request.organization_id,request.wallet_id,request.source_type,request.quantity,request.expires_at,request.library_id,request.source_reference,request.reason,request.idempotency_key);end if;
 select*into promotion from public.credit_promotion_versions where id=p_promotion_version_id;
 select value_integer into cap from public.platform_parameter_versions where parameter_key='CREDIT_PROMOTION_MAX_BONUS'and status='ACTIVE';
 if promotion.id is null or promotion.status<>'ACTIVE'or promotion.effective_from>clock_timestamp()or(promotion.effective_until is not null and promotion.effective_until<=clock_timestamp())or(cap is not null and promotion.bonus_credits>cap)then raise exception'CREDIT_PROMOTION_NOT_GRANTABLE'using errcode='55000';end if;
 return public.request_manual_credit_grant_v1(p_organization_id,p_wallet_id,'PROMOTION',promotion.bonus_credits,clock_timestamp()+make_interval(days=>promotion.validity_days),null,'PROMOTION_VERSION:'||promotion.id::text,'Allocation of the selected promotion version; independent Finance review required before any credit is issued.','promotion-request:'||p_idempotency_key);
end$$;
create function public.get_manual_credit_grant_console_v1(p_page integer default 1,p_status text default'ALL')returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,private as $$
declare items jsonb;total bigint;begin
 if not private.manual_credit_finance_v1()then raise exception'MANUAL_CREDIT_FINANCE_AAL2_REQUIRED'using errcode='42501';end if;
 if p_page is null or p_page not between 1 and 100000 or p_status is null or p_status not in('ALL','PENDING_REVIEW','APPROVED','REJECTED','EXECUTED')then raise exception'INVALID_MANUAL_CREDIT_PAGE'using errcode='22023';end if;
 select count(*)into total from public.manual_credit_grant_requests_v1 r left join public.manual_credit_grant_reviews_v1 review on review.request_id=r.id left join public.manual_credit_grant_executions_v1 execution on execution.request_id=r.id where p_status='ALL'or p_status=case when execution.request_id is not null then'EXECUTED'else coalesce(review.decision,'PENDING_REVIEW')end;
 select coalesce(jsonb_agg(item order by created_at desc,id),'[]')into items from(select r.created_at,r.id,jsonb_build_object('id',r.id,'organization_id',r.organization_id,'organization_name',o.display_name,'wallet_id',r.wallet_id,'source_type',r.source_type,'quantity',r.quantity::text,'expires_at',r.expires_at,'library_id',r.library_id,'source_reference',r.source_reference,'reason',r.reason,'environment',r.environment,'content_hash',r.content_hash,'created_by',r.created_by,'created_at',r.created_at,'status',case when execution.request_id is not null then'EXECUTED'else coalesce(review.decision,'PENDING_REVIEW')end,'review_proof_hash',review.review_proof_hash,'review_reason',review.reason,'approval_reference',review.approval_reference,'decided_by',review.decided_by,'decided_at',review.decided_at,'credit_lot_id',execution.credit_lot_id,'can_review',review.request_id is null and r.created_by<>auth.uid(),'can_execute',coalesce(execution.request_id is null and review.decision='APPROVED'and r.expires_at>statement_timestamp()and o.status='ACTIVE'and private.manual_credit_finance_v1(r.created_by)and private.manual_credit_finance_v1(review.decided_by)and r.environment=(select environment from private.admin_execution_environment_v1 where singleton),false))item from public.manual_credit_grant_requests_v1 r join public.organizations o on o.id=r.organization_id left join public.manual_credit_grant_reviews_v1 review on review.request_id=r.id left join public.manual_credit_grant_executions_v1 execution on execution.request_id=r.id where p_status='ALL'or p_status=case when execution.request_id is not null then'EXECUTED'else coalesce(review.decision,'PENDING_REVIEW')end order by r.created_at desc,r.id limit 25 offset((p_page-1)*25))selected;
 return jsonb_build_object('actor_id',auth.uid(),'items',items,'total',total,'page',p_page,'has_next',p_page::bigint*25<total);
end$$;
revoke all on function public.request_manual_credit_grant_v1(uuid,uuid,text,bigint,timestamptz,uuid,text,text,text),public.review_manual_credit_grant_v1(uuid,text,boolean,boolean,text,text),public.execute_manual_credit_grant_v1(uuid,text,text,text),public.get_manual_credit_grant_console_v1(integer,text)from public,anon,authenticated,service_role;
grant execute on function public.request_manual_credit_grant_v1(uuid,uuid,text,bigint,timestamptz,uuid,text,text,text),public.review_manual_credit_grant_v1(uuid,text,boolean,boolean,text,text),public.execute_manual_credit_grant_v1(uuid,text,text,text),public.get_manual_credit_grant_console_v1(integer,text)to authenticated;
notify pgrst,'reload schema';
commit;
