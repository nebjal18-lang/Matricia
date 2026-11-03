begin;
-- The implemented policy deliberately starts a new fully paid canonical period.
-- No proration or refund rate is invented, and no policy is published by migration.
create table private.subscription_upgrade_policies_v1(
 id uuid primary key default extensions.gen_random_uuid(),source_plan_version_id uuid not null references public.subscription_plan_versions(id),target_plan_version_id uuid not null references public.subscription_plan_versions(id),
 billing_interval text not null check(billing_interval in('MONTHLY','ANNUAL')),mode text not null check(mode='FULL_NEW_CYCLE'),version integer not null check(version>0),
 terms_fr text not null check(length(btrim(terms_fr))between 20 and 8000),terms_ar text not null check(length(btrim(terms_ar))between 20 and 8000),
 valid_from timestamptz not null,valid_until timestamptz,quote_ttl_seconds integer not null check(quote_ttl_seconds between 60 and 900),
 source_hash text not null check(source_hash~'^[a-f0-9]{64}$'),content_hash text not null check(content_hash~'^[a-f0-9]{64}$'),reference text not null check(length(btrim(reference))between 8 and 1000),
 created_by uuid not null references auth.users(id),created_at timestamptz not null default clock_timestamp(),unique(source_plan_version_id,target_plan_version_id,billing_interval,version),
 check(source_plan_version_id<>target_plan_version_id),check(valid_until is null or valid_until>valid_from)
);
create table private.subscription_upgrade_policy_decisions_v1(
 policy_id uuid primary key references private.subscription_upgrade_policies_v1(id),approved boolean not null,content_hash text not null,
 decided_by uuid not null references auth.users(id),decided_at timestamptz not null default clock_timestamp(),reason text not null check(length(btrim(reason))between 10 and 2000)
);
create table private.subscription_upgrade_policy_withdrawals_v1(
 policy_id uuid primary key references private.subscription_upgrade_policies_v1(id),withdrawn_by uuid not null references auth.users(id),withdrawn_at timestamptz not null default clock_timestamp(),reason text not null check(length(btrim(reason))between 10 and 2000)
);
create table private.subscription_upgrade_quotes_v1(
 id uuid primary key default extensions.gen_random_uuid(),organization_id uuid not null references public.organizations(id),subscription_id uuid not null references public.subscriptions(id),
 source_cycle_id uuid not null references public.subscription_cycles(id),source_row_version bigint not null,source_plan_version_id uuid not null references public.subscription_plan_versions(id),
 target_plan_version_id uuid not null references public.subscription_plan_versions(id),policy_id uuid not null references private.subscription_upgrade_policies_v1(id),
 billing_interval text not null,amount_minor bigint not null check(amount_minor>0),currency char(3)not null,source_period_end timestamptz not null,
 source_snapshot jsonb not null,content_hash text not null check(content_hash~'^[a-f0-9]{64}$'),created_by uuid not null references auth.users(id),
 created_at timestamptz not null default clock_timestamp(),expires_at timestamptz not null,idempotency_key text not null,
 unique(organization_id,created_by,idempotency_key)
);
create table private.subscription_upgrade_checkouts_v1(
 preparation_id uuid primary key references public.subscription_payment_preparations(id),quote_id uuid not null unique references private.subscription_upgrade_quotes_v1(id),
 organization_id uuid not null references public.organizations(id),accepted_hash text not null,accepted_by uuid not null references auth.users(id),accepted_at timestamptz not null default clock_timestamp()
);
-- A database-private transaction capability, never a JWT/GUC or browser assertion.
create table private.subscription_upgrade_admission_context_v1(
 backend_pid integer not null,transaction_id bigint not null,organization_id uuid not null,quote_id uuid not null references private.subscription_upgrade_quotes_v1(id),
 primary key(backend_pid,transaction_id,organization_id)
);
create table private.subscription_upgrade_applications_v1(
 payment_event_id bigint primary key references public.subscription_payment_events(id),organization_id uuid not null references public.organizations(id),quote_id uuid not null unique references private.subscription_upgrade_quotes_v1(id),
 source_cycle_id uuid not null references public.subscription_cycles(id),target_cycle_id uuid not null references public.subscription_cycles(id),policy_id uuid not null references private.subscription_upgrade_policies_v1(id),
 financial_journal_id uuid not null references public.financial_journals(id),created_at timestamptz not null default clock_timestamp(),correlation_id uuid not null
);
do $$declare t text;begin foreach t in array array['subscription_upgrade_policies_v1','subscription_upgrade_policy_decisions_v1','subscription_upgrade_policy_withdrawals_v1','subscription_upgrade_quotes_v1','subscription_upgrade_checkouts_v1','subscription_upgrade_admission_context_v1','subscription_upgrade_applications_v1']loop
 execute format('alter table private.%I enable row level security',t);execute format('revoke all on private.%I from public,anon,authenticated,service_role',t);
 if t<>'subscription_upgrade_admission_context_v1'then execute format('create trigger %I before update or delete on private.%I for each row execute function private.prevent_update_delete()',left(t,40)||'_immutable',t);end if;
end loop;end$$;

create function private.subscription_upgrade_policy_source_v1(p_source uuid,p_target uuid,p_interval text)returns jsonb language sql stable security definer set search_path=pg_catalog as $$
 select jsonb_build_object('source_plan_id',s.id,'source_hash',s.content_hash,'source_status',s.status,'source_currency',s.currency,
 'source_price_minor',(case p_interval when'MONTHLY'then s.monthly_price_minor when'ANNUAL'then s.annual_price_minor end)::text,
 'target_plan_id',t.id,'target_hash',t.content_hash,'target_status',t.status,'target_currency',t.currency,
 'target_price_minor',(case p_interval when'MONTHLY'then t.monthly_price_minor when'ANNUAL'then t.annual_price_minor end)::text,
 'target_valid_from',t.valid_from,'target_valid_to',t.valid_to,'billing_interval',p_interval)
 from public.subscription_plan_versions s cross join public.subscription_plan_versions t where s.id=p_source and t.id=p_target
$$;
create function private.subscription_upgrade_policy_ready_v1(p_policy uuid,p_at timestamptz default statement_timestamp())returns boolean language sql stable security definer set search_path=pg_catalog as $$
 select exists(select 1 from private.subscription_upgrade_policies_v1 p join private.subscription_upgrade_policy_decisions_v1 d on d.policy_id=p.id and d.approved and d.content_hash=p.content_hash and d.decided_by<>p.created_by
 join public.subscription_plan_versions s on s.id=p.source_plan_version_id join public.subscription_plan_versions t on t.id=p.target_plan_version_id
 where p.id=p_policy and p.valid_from<=p_at and(p.valid_until is null or p.valid_until>p_at)and not exists(select 1 from private.subscription_upgrade_policy_withdrawals_v1 w where w.policy_id=p.id)
 and p.source_hash=private.canonical_request_hash(private.subscription_upgrade_policy_source_v1(s.id,t.id,p.billing_interval))
 and t.status='ACTIVE'and t.valid_from<=(p_at at time zone'Africa/Casablanca')::date and(t.valid_to is null or t.valid_to>=(p_at at time zone'Africa/Casablanca')::date)
 and s.currency=t.currency and(case p.billing_interval when'MONTHLY'then t.monthly_price_minor>s.monthly_price_minor else t.annual_price_minor>s.annual_price_minor end))
$$;
create function public.propose_subscription_upgrade_policy_v1(p_source_plan_version_id uuid,p_target_plan_version_id uuid,p_billing_interval text,p_terms_fr text,p_terms_ar text,p_valid_from timestamptz,p_valid_until timestamptz,p_quote_ttl_seconds integer,p_reference text)returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare source jsonb;h text;x uuid;v integer;begin
 if not coalesce(private.credit_revenue_finance_access_v1(auth.uid(),true),false)then raise exception'UPGRADE_POLICY_CONFIGURATION_DENIED'using errcode='42501';end if;
 if p_billing_interval is null or p_billing_interval not in('MONTHLY','ANNUAL')or length(btrim(coalesce(p_terms_fr,'')))not between 20 and 8000 or length(btrim(coalesce(p_terms_ar,'')))not between 20 and 8000 or p_valid_from is null or(p_valid_until is not null and p_valid_until<=p_valid_from)or p_quote_ttl_seconds is null or p_quote_ttl_seconds not between 60 and 900 or length(btrim(coalesce(p_reference,'')))not between 8 and 1000 then raise exception'INVALID_UPGRADE_POLICY'using errcode='22023';end if;
 source:=private.subscription_upgrade_policy_source_v1(p_source_plan_version_id,p_target_plan_version_id,p_billing_interval);
 if source is null or p_source_plan_version_id=p_target_plan_version_id or source->>'target_status'<>'ACTIVE'or source->>'source_currency'<>source->>'target_currency'or(source->>'target_price_minor')::bigint<=(source->>'source_price_minor')::bigint then raise exception'INVALID_UPGRADE_POLICY_PLANS'using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('upgrade-policy:'||p_source_plan_version_id::text||':'||p_target_plan_version_id::text||':'||p_billing_interval,0));
 if not private.credit_revenue_finance_access_v1(auth.uid(),true)then raise exception'UPGRADE_POLICY_CONFIGURATION_DENIED'using errcode='42501';end if;
 select coalesce(max(version),0)+1 into v from private.subscription_upgrade_policies_v1 where source_plan_version_id=p_source_plan_version_id and target_plan_version_id=p_target_plan_version_id and billing_interval=p_billing_interval;
 h:=private.canonical_request_hash(jsonb_build_object('source',source,'mode','FULL_NEW_CYCLE','version',v,'terms_fr',btrim(p_terms_fr),'terms_ar',btrim(p_terms_ar),'valid_from',p_valid_from,'valid_until',p_valid_until,'quote_ttl_seconds',p_quote_ttl_seconds,'reference',btrim(p_reference)));
 insert into private.subscription_upgrade_policies_v1(source_plan_version_id,target_plan_version_id,billing_interval,mode,version,terms_fr,terms_ar,valid_from,valid_until,quote_ttl_seconds,source_hash,content_hash,reference,created_by)
 values(p_source_plan_version_id,p_target_plan_version_id,p_billing_interval,'FULL_NEW_CYCLE',v,btrim(p_terms_fr),btrim(p_terms_ar),p_valid_from,p_valid_until,p_quote_ttl_seconds,private.canonical_request_hash(source),h,btrim(p_reference),auth.uid())returning id into x;
 insert into public.audit_events(actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(auth.uid(),'USER','subscription.upgrade.policy_proposed','subscription_upgrade_policy',x::text,extensions.gen_random_uuid(),jsonb_build_object('content_hash',h,'source_hash',private.canonical_request_hash(source)),repeat('0',64));
 return jsonb_build_object('outcome','UPGRADE_POLICY_PROPOSED','policy_id',x,'content_hash',h);
end$$;
create function public.decide_subscription_upgrade_policy_v1(p_policy_id uuid,p_expected_hash text,p_approve boolean,p_reason text)returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare p private.subscription_upgrade_policies_v1%rowtype;begin
 if not coalesce(private.credit_revenue_finance_access_v1(auth.uid(),true),false)then raise exception'UPGRADE_POLICY_CONFIGURATION_DENIED'using errcode='42501';end if;
 select*into p from private.subscription_upgrade_policies_v1 where id=p_policy_id for update;
 if p.id is null or p.created_by=auth.uid()or not private.credit_revenue_finance_access_v1(p.created_by,true)or not private.credit_revenue_finance_access_v1(auth.uid(),true)then raise exception'UPGRADE_POLICY_INDEPENDENT_REVIEW_REQUIRED'using errcode='42501';end if;
 if p_expected_hash is distinct from p.content_hash or p.source_hash is distinct from private.canonical_request_hash(private.subscription_upgrade_policy_source_v1(p.source_plan_version_id,p.target_plan_version_id,p.billing_interval))then raise exception'STALE_UPGRADE_POLICY'using errcode='40001';end if;
 if p_approve is null or length(btrim(coalesce(p_reason,'')))not between 10 and 2000 then raise exception'INVALID_UPGRADE_POLICY_REVIEW'using errcode='22023';end if;
 insert into private.subscription_upgrade_policy_decisions_v1(policy_id,approved,content_hash,decided_by,reason)values(p.id,p_approve,p.content_hash,auth.uid(),btrim(p_reason));
 insert into public.audit_events(actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(auth.uid(),'USER','subscription.upgrade.policy_decided','subscription_upgrade_policy',p.id::text,extensions.gen_random_uuid(),jsonb_build_object('approved',p_approve,'content_hash',p.content_hash),repeat('0',64));
 return jsonb_build_object('outcome','UPGRADE_POLICY_DECIDED','approved',p_approve);
end$$;
create function public.withdraw_subscription_upgrade_policy_v1(p_policy_id uuid,p_reason text)returns jsonb language plpgsql security definer set search_path=pg_catalog as $$begin
 if not coalesce(private.credit_revenue_finance_access_v1(auth.uid(),true),false)then raise exception'UPGRADE_POLICY_CONFIGURATION_DENIED'using errcode='42501';end if;
 if not exists(select 1 from private.subscription_upgrade_policies_v1 where id=p_policy_id)or length(btrim(coalesce(p_reason,'')))not between 10 and 2000 then raise exception'INVALID_UPGRADE_POLICY_REVIEW'using errcode='22023';end if;
 insert into private.subscription_upgrade_policy_withdrawals_v1(policy_id,withdrawn_by,reason)values(p_policy_id,auth.uid(),btrim(p_reason));
 insert into public.audit_events(actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(auth.uid(),'USER','subscription.upgrade.policy_withdrawn','subscription_upgrade_policy',p_policy_id::text,extensions.gen_random_uuid(),jsonb_build_object('withdrawn',true),repeat('0',64));
 return jsonb_build_object('outcome','UPGRADE_POLICY_WITHDRAWN');
end$$;

create function public.list_client_subscription_upgrade_options_v1(p_organization_id uuid)returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare funding jsonb;options jsonb;begin
 if auth.uid()is null or not private.subscription_read_access(p_organization_id,auth.uid())then raise exception'UPGRADE_OPTIONS_DENIED'using errcode='42501';end if;
 funding:=private.current_subscription_funding_v1(p_organization_id,statement_timestamp());
 if funding is null then return jsonb_build_object('status','CURRENT_FUNDING_REQUIRED','options','[]'::jsonb);end if;
 select coalesce(jsonb_agg(jsonb_build_object('policy_id',p.id,'policy_hash',p.content_hash,'target_plan_version_id',t.id,'plan_code',sp.code,'billing_interval',p.billing_interval,'mode',p.mode,'amount_minor',(case p.billing_interval when'MONTHLY'then t.monthly_price_minor else t.annual_price_minor end)::text,'currency',t.currency,'terms_fr',p.terms_fr,'terms_ar',p.terms_ar)order by sp.code,p.version desc),'[]')into options
 from private.subscription_upgrade_policies_v1 p join public.subscription_plan_versions t on t.id=p.target_plan_version_id join public.subscription_plans sp on sp.id=t.plan_id
 where p.source_plan_version_id=(funding->>'funded_plan_version_id')::uuid and private.subscription_upgrade_policy_ready_v1(p.id)
 and not exists(select 1 from private.subscription_upgrade_policies_v1 newer where newer.source_plan_version_id=p.source_plan_version_id and newer.target_plan_version_id=p.target_plan_version_id and newer.billing_interval=p.billing_interval and newer.version>p.version and private.subscription_upgrade_policy_ready_v1(newer.id));
 return jsonb_build_object('status','AVAILABLE','can_manage',private.has_org_role(p_organization_id,array['CLIENT_OWNER','CLIENT_ADMIN']),'can_checkout',auth.jwt()->>'aal'='aal2'and private.has_org_role(p_organization_id,array['CLIENT_OWNER','CLIENT_ADMIN']),'options',options);
end$$;
create function public.create_client_subscription_upgrade_quote_v1(p_organization_id uuid,p_policy_id uuid,p_idempotency_key text)returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare p private.subscription_upgrade_policies_v1%rowtype;s public.subscriptions%rowtype;t public.subscription_plan_versions%rowtype;funding jsonb;q private.subscription_upgrade_quotes_v1%rowtype;snapshot jsonb;h text;x uuid;begin
 if auth.uid()is null or auth.jwt()->>'aal'is distinct from'aal2'or not private.has_org_role(p_organization_id,array['CLIENT_OWNER','CLIENT_ADMIN'])then raise exception'UPGRADE_QUOTE_DENIED'using errcode='42501';end if;
 if length(coalesce(p_idempotency_key,''))not between 8 and 180 then raise exception'INVALID_UPGRADE_QUOTE'using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('subscription-financial:'||p_organization_id::text,0));
 if not private.has_org_role(p_organization_id,array['CLIENT_OWNER','CLIENT_ADMIN'])then raise exception'UPGRADE_QUOTE_DENIED'using errcode='42501';end if;
 select*into q from private.subscription_upgrade_quotes_v1 where organization_id=p_organization_id and created_by=auth.uid()and idempotency_key=p_idempotency_key;
 if q.id is not null then
  if q.policy_id<>p_policy_id then raise exception'IDEMPOTENCY_PAYLOAD_MISMATCH'using errcode='22000';end if;
  return jsonb_build_object('outcome','UPGRADE_QUOTED','quote_id',q.id,'content_hash',q.content_hash,'amount_minor',q.amount_minor::text,'currency',q.currency,'expires_at',q.expires_at,'snapshot',q.source_snapshot);
 end if;
 select*into s from public.subscriptions where organization_id=p_organization_id for update;
 funding:=private.current_subscription_funding_v1(p_organization_id,statement_timestamp());
 select*into p from private.subscription_upgrade_policies_v1 where id=p_policy_id;
 select*into t from public.subscription_plan_versions where id=p.target_plan_version_id;
 if funding is null or s.status<>'ACTIVE'or p.id is null or p.source_plan_version_id is distinct from(funding->>'funded_plan_version_id')::uuid or not private.subscription_upgrade_policy_ready_v1(p.id)then raise exception'APPROVED_UPGRADE_POLICY_REQUIRED'using errcode='55000';end if;
 if not private.subscription_financially_clear(p_organization_id)or not private.client_identity_allows_new_operations(p_organization_id)then raise exception'UPGRADE_OPERATION_RESTRICTED'using errcode='55000';end if;
 snapshot:=jsonb_build_object('policy_id',p.id,'policy_hash',p.content_hash,'source_cycle_id',funding->>'cycle_id','source_plan_version_id',p.source_plan_version_id,'source_period_end',s.current_period_end,'source_row_version',s.row_version::text,'target_plan_version_id',t.id,'target_plan_hash',t.content_hash,'billing_interval',p.billing_interval,'mode',p.mode,'amount_minor',(case p.billing_interval when'MONTHLY'then t.monthly_price_minor else t.annual_price_minor end)::text,'currency',t.currency,'terms_fr',p.terms_fr,'terms_ar',p.terms_ar,'paid_credits_treatment','PRESERVE_ORIGINAL_SCHEDULES_AND_EXPIRIES');
 h:=private.canonical_request_hash(snapshot);
 insert into private.subscription_upgrade_quotes_v1(organization_id,subscription_id,source_cycle_id,source_row_version,source_plan_version_id,target_plan_version_id,policy_id,billing_interval,amount_minor,currency,source_period_end,source_snapshot,content_hash,created_by,expires_at,idempotency_key)
 values(p_organization_id,s.id,(funding->>'cycle_id')::uuid,s.row_version,p.source_plan_version_id,t.id,p.id,p.billing_interval,(snapshot->>'amount_minor')::bigint,t.currency,s.current_period_end,snapshot,h,auth.uid(),least(clock_timestamp()+make_interval(secs=>p.quote_ttl_seconds),s.current_period_end),p_idempotency_key)returning id into x;
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(p_organization_id,auth.uid(),'USER','subscription.upgrade.quoted','subscription_upgrade_quote',x::text,extensions.gen_random_uuid(),jsonb_build_object('policy_id',p.id,'content_hash',h),repeat('0',64));
 select*into q from private.subscription_upgrade_quotes_v1 where id=x;
 return jsonb_build_object('outcome','UPGRADE_QUOTED','quote_id',q.id,'content_hash',h,'amount_minor',q.amount_minor::text,'currency',q.currency,'expires_at',q.expires_at,'snapshot',snapshot);
end$$;

create function private.subscription_upgrade_quote_current_v1(p_quote uuid,p_at timestamptz,p_require_current_policy boolean default true)returns boolean language plpgsql stable security definer set search_path=pg_catalog as $$
declare q private.subscription_upgrade_quotes_v1%rowtype;s public.subscriptions%rowtype;funding jsonb;t public.subscription_plan_versions%rowtype;begin
 select*into q from private.subscription_upgrade_quotes_v1 where id=p_quote;
 select*into s from public.subscriptions where id=q.subscription_id and organization_id=q.organization_id;
 select*into t from public.subscription_plan_versions where id=q.target_plan_version_id;
 funding:=private.current_subscription_funding_v1(q.organization_id,p_at);
 return coalesce(q.id is not null and date_trunc('second',q.created_at)<=p_at and p_at<q.expires_at and q.content_hash=private.canonical_request_hash(q.source_snapshot)
 and s.status='ACTIVE'and s.row_version=q.source_row_version and s.plan_version_id=q.source_plan_version_id and s.current_period_end=q.source_period_end
 and funding->>'cycle_id'=q.source_cycle_id::text and funding->>'funded_plan_version_id'=q.source_plan_version_id::text
 and t.id is not null and t.status='ACTIVE'and t.content_hash=q.source_snapshot->>'target_plan_hash'and t.currency=q.currency
 and q.amount_minor=case q.billing_interval when'MONTHLY'then t.monthly_price_minor else t.annual_price_minor end
 and(not p_require_current_policy or private.subscription_upgrade_policy_ready_v1(q.policy_id,p_at))
 and private.subscription_financially_clear(q.organization_id)and private.client_identity_allows_new_operations(q.organization_id),false);
end$$;
create function private.subscription_upgrade_admission_context_valid_v1(p_organization_id uuid,p_target uuid default null)returns boolean language sql stable security definer set search_path=pg_catalog as $$
 select exists(select 1 from private.subscription_upgrade_admission_context_v1 c join private.subscription_upgrade_quotes_v1 q on q.id=c.quote_id
 where c.backend_pid=pg_backend_pid()and c.transaction_id=txid_current()and c.organization_id=p_organization_id and q.organization_id=c.organization_id
 and(q.target_plan_version_id=p_target or p_target is null)and q.created_by=auth.uid()and auth.jwt()->>'aal'='aal2'
 and private.has_org_role(c.organization_id,array['CLIENT_OWNER','CLIENT_ADMIN'])and private.subscription_upgrade_quote_current_v1(q.id,statement_timestamp()))
$$;
alter function private.assert_subscription_checkout_activatable_v1(uuid)rename to assert_subscription_checkout_before_upgrade_v1;
create function private.assert_subscription_checkout_activatable_v1(p_organization_id uuid)returns void language plpgsql security definer set search_path=pg_catalog as $$begin
 if private.subscription_upgrade_admission_context_valid_v1(p_organization_id)then return;end if;
 perform private.assert_subscription_checkout_before_upgrade_v1(p_organization_id);
end$$;
-- A capability cannot be reused to prepare a different target under the same
-- organization. The lower-level canonical ABI remains private.
do $$declare d text;marker text:='perform private.assert_payment_runtime_v1(p_gateway,p_provider_environment,p_legacy);';begin
 d:=pg_get_functiondef('private.prepare_subscription_payment_context_core_v1(uuid,uuid,text,text,text,text,boolean)'::regprocedure);
 if position(marker in d)=0 then raise exception'UPGRADE_PREPARATION_SOURCE_MISMATCH';end if;
 d:=replace(d,marker,'if exists(select 1 from private.subscription_upgrade_admission_context_v1 where backend_pid=pg_backend_pid()and transaction_id=txid_current()and organization_id=p_organization_id)and not private.subscription_upgrade_admission_context_valid_v1(p_organization_id,p_plan_version_id)then raise exception''UPGRADE_TARGET_SCOPE_DENIED''using errcode=''42501'';end if;'||marker);execute d;
end$$;
create function public.prepare_client_subscription_upgrade_payment_v1(p_organization_id uuid,p_quote_id uuid,p_accepted_hash text,p_consent boolean,p_gateway text,p_provider_environment text,p_idempotency_key text)returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare q private.subscription_upgrade_quotes_v1%rowtype;c private.subscription_upgrade_checkouts_v1%rowtype;prep public.subscription_payment_preparations%rowtype;r jsonb;begin
 if auth.uid()is null or auth.jwt()->>'aal'is distinct from'aal2'or not private.has_org_role(p_organization_id,array['CLIENT_OWNER','CLIENT_ADMIN'])then raise exception'UPGRADE_CHECKOUT_DENIED'using errcode='42501';end if;
 if p_consent is distinct from true then raise exception'UPGRADE_TERMS_CONSENT_REQUIRED'using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('subscription-financial:'||p_organization_id::text,0));
 if not private.has_org_role(p_organization_id,array['CLIENT_OWNER','CLIENT_ADMIN'])then raise exception'UPGRADE_CHECKOUT_DENIED'using errcode='42501';end if;
 select*into q from private.subscription_upgrade_quotes_v1 where id=p_quote_id and organization_id=p_organization_id and created_by=auth.uid();
 if q.id is null or q.content_hash is distinct from p_accepted_hash then raise exception'UPGRADE_QUOTE_SCOPE_DENIED'using errcode='42501';end if;
 select*into c from private.subscription_upgrade_checkouts_v1 where quote_id=q.id;
 if c.preparation_id is not null then
  select*into prep from public.subscription_payment_preparations where id=c.preparation_id;
  if prep.idempotency_key<>p_idempotency_key or prep.gateway<>p_gateway or prep.provider_environment<>p_provider_environment then raise exception'UPGRADE_CHECKOUT_ALREADY_PREPARED'using errcode='55000';end if;
  r:=private.prepare_subscription_payment_context_core_v1(p_organization_id,q.target_plan_version_id,q.billing_interval,p_gateway,p_idempotency_key,p_provider_environment,false);
  return r||jsonb_build_object('plan_version_id',q.target_plan_version_id,'billing_interval',q.billing_interval,'organization_id',q.organization_id,'upgrade_quote_id',q.id,'upgrade_hash',q.content_hash);
 end if;
 if exists(select 1 from public.subscription_payment_preparations where organization_id=p_organization_id and idempotency_key=p_idempotency_key)or not private.subscription_upgrade_quote_current_v1(q.id,statement_timestamp())then raise exception'STALE_UPGRADE_QUOTE'using errcode='40001';end if;
 insert into private.subscription_upgrade_admission_context_v1 values(pg_backend_pid(),txid_current(),p_organization_id,q.id);
 r:=private.prepare_subscription_payment_context_core_v1(p_organization_id,q.target_plan_version_id,q.billing_interval,p_gateway,p_idempotency_key,p_provider_environment,false);
 delete from private.subscription_upgrade_admission_context_v1 where backend_pid=pg_backend_pid()and transaction_id=txid_current()and organization_id=p_organization_id;
 select*into prep from public.subscription_payment_preparations where id=(r->>'preparation_id')::uuid;
 if prep.amount_minor is distinct from q.amount_minor or prep.plan_version_id is distinct from q.target_plan_version_id or prep.billing_interval is distinct from q.billing_interval or prep.organization_id is distinct from q.organization_id then raise exception'UPGRADE_PREPARATION_TERMS_MISMATCH'using errcode='23514';end if;
 insert into private.subscription_upgrade_checkouts_v1(preparation_id,quote_id,organization_id,accepted_hash,accepted_by)values(prep.id,q.id,q.organization_id,q.content_hash,auth.uid());
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(q.organization_id,auth.uid(),'USER','subscription.upgrade.checkout_accepted','subscription_upgrade_quote',q.id::text,extensions.gen_random_uuid(),jsonb_build_object('policy_id',q.policy_id,'accepted_hash',q.content_hash,'preparation_id',prep.id),repeat('0',64));
 return r||jsonb_build_object('plan_version_id',q.target_plan_version_id,'billing_interval',q.billing_interval,'organization_id',q.organization_id,'upgrade_quote_id',q.id,'upgrade_hash',q.content_hash);
end$$;
create function private.subscription_upgrade_capture_admissible_v1(p_intent_id uuid,p_paid_at timestamptz)returns boolean language sql stable security definer set search_path=pg_catalog as $$
 select exists(select 1 from public.subscription_payment_intents i join public.subscription_payment_preparations p on p.organization_id=i.organization_id and p.idempotency_key=i.idempotency_key and p.plan_version_id=i.plan_version_id
 join private.subscription_upgrade_checkouts_v1 c on c.preparation_id=p.id and c.organization_id=i.organization_id
 join private.subscription_upgrade_quotes_v1 q on q.id=c.quote_id and q.content_hash=c.accepted_hash and q.created_by=c.accepted_by
 where i.id=p_intent_id and i.amount_minor=q.amount_minor and i.currency=q.currency and i.billing_interval=q.billing_interval and i.plan_version_id=q.target_plan_version_id
 and p.amount_minor=q.amount_minor and p.currency=q.currency and p.gateway=i.gateway and p.provider_environment=i.provider_environment and p.deployment_environment=i.deployment_environment
 and date_trunc('second',c.accepted_at)<=p_paid_at and private.subscription_upgrade_quote_current_v1(q.id,p_paid_at,false))
$$;
-- Only the exact authorized intent extends the paid activation state. Existing
-- amount/environment/journal/event/cycle checks continue unchanged.
do $$declare d text;marker text:='subscription.current_period_end<=p_paid_at and subscription.current_period_end<=statement_timestamp()))then';begin
 d:=pg_get_functiondef('private.process_subscription_payment_context_core_v1(text,text,text,text,text,bigint,character,timestamptz,text,text,text,uuid)'::regprocedure);
 if position(marker in d)=0 then raise exception'UPGRADE_ACTIVATION_SOURCE_MISMATCH';end if;
 d:=replace(d,marker,'subscription.current_period_end<=p_paid_at and subscription.current_period_end<=statement_timestamp())or(subscription.status=''ACTIVE''and private.subscription_upgrade_capture_admissible_v1(intent.id,p_paid_at)))then');execute d;
end$$;
alter function public.prepare_subscription_payment_capture_v2(uuid,text)rename to prepare_subscription_payment_capture_before_upgrade_v2;
alter function public.prepare_subscription_payment_capture_before_upgrade_v2(uuid,text)set schema private;
create function public.prepare_subscription_payment_capture_v2(p_payment_intent_id uuid,p_provider_environment text)returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare i public.subscription_payment_intents%rowtype;q private.subscription_upgrade_quotes_v1%rowtype;r jsonb;begin
 select*into i from public.subscription_payment_intents where id=p_payment_intent_id;
 if auth.uid()is null or i.id is null or auth.jwt()->>'aal'is distinct from'aal2'or not private.has_org_role(i.organization_id,array['CLIENT_OWNER','CLIENT_ADMIN'])then raise exception'PAYMENT_CAPTURE_DENIED'using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('subscription-financial:'||i.organization_id::text,0));
 if not private.has_org_role(i.organization_id,array['CLIENT_OWNER','CLIENT_ADMIN'])then raise exception'PAYMENT_CAPTURE_DENIED'using errcode='42501';end if;
 select quote.*into q from private.subscription_upgrade_quotes_v1 quote join private.subscription_upgrade_checkouts_v1 c on c.quote_id=quote.id join public.subscription_payment_preparations p on p.id=c.preparation_id and p.organization_id=i.organization_id and p.idempotency_key=i.idempotency_key;
 if q.id is null or exists(select 1 from public.subscription_payment_events where payment_intent_id=i.id and event_type='PAYMENT_SUCCEEDED')then return private.prepare_subscription_payment_capture_before_upgrade_v2(p_payment_intent_id,p_provider_environment);end if;
 if q.created_by<>auth.uid()or not private.subscription_upgrade_quote_current_v1(q.id,statement_timestamp(),false)then raise exception'STALE_UPGRADE_QUOTE'using errcode='40001';end if;
 insert into private.subscription_upgrade_admission_context_v1 values(pg_backend_pid(),txid_current(),i.organization_id,q.id);
 r:=private.prepare_subscription_payment_capture_before_upgrade_v2(p_payment_intent_id,p_provider_environment);
 delete from private.subscription_upgrade_admission_context_v1 where backend_pid=pg_backend_pid()and transaction_id=txid_current()and organization_id=i.organization_id;
 return r;
end$$;

create function private.record_subscription_upgrade_application_v1()returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare c private.subscription_upgrade_checkouts_v1%rowtype;q private.subscription_upgrade_quotes_v1%rowtype;cycle uuid;result jsonb;begin
 select checkout.*into c from private.subscription_upgrade_checkouts_v1 checkout join public.subscription_payment_preparations p on p.id=checkout.preparation_id join public.subscription_payment_intents i on i.organization_id=p.organization_id and i.idempotency_key=p.idempotency_key where i.id=new.payment_intent_id;
 if c.preparation_id is null then return new;end if;
 select*into q from private.subscription_upgrade_quotes_v1 where id=c.quote_id;
 cycle:=private.subscription_payment_cycle_v1(new.id);
 if cycle is null or new.activation_result->>'outcome'<>'SUBSCRIPTION_ACTIVATED'or new.amount_minor<>q.amount_minor or new.currency<>q.currency then raise exception'UPGRADE_CANONICAL_FUNDING_REQUIRED'using errcode='23514';end if;
 insert into private.subscription_upgrade_applications_v1(payment_event_id,organization_id,quote_id,source_cycle_id,target_cycle_id,policy_id,financial_journal_id,correlation_id)values(new.id,new.organization_id,q.id,q.source_cycle_id,cycle,q.policy_id,(new.activation_result->>'financial_journal_id')::uuid,new.correlation_id);
 result:=jsonb_build_object('subscription_id',q.subscription_id,'organization_id',q.organization_id,'source_cycle_id',q.source_cycle_id,'target_cycle_id',cycle,'policy_id',q.policy_id,'quote_id',q.id,'payment_event_id',new.id::text,'change_mode','UPGRADE_FULL_NEW_CYCLE');
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(new.organization_id,null,'SERVICE','subscription.upgrade.applied','subscription',q.subscription_id::text,new.correlation_id,result,repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values(new.organization_id,'subscription',q.subscription_id::text,'SubscriptionChangedV1',new.correlation_id,result,'subscription-upgrade:'||new.id::text);
 return new;
end$$;
create trigger subscription_upgrade_application_record after insert on public.subscription_payment_events for each row when(new.event_type='PAYMENT_SUCCEEDED')execute function private.record_subscription_upgrade_application_v1();

do $$declare f regprocedure;begin foreach f in array array[
 'private.subscription_upgrade_policy_source_v1(uuid,uuid,text)'::regprocedure,'private.subscription_upgrade_policy_ready_v1(uuid,timestamptz)'::regprocedure,
 'private.subscription_upgrade_quote_current_v1(uuid,timestamptz,boolean)'::regprocedure,'private.subscription_upgrade_admission_context_valid_v1(uuid,uuid)'::regprocedure,
 'private.subscription_upgrade_capture_admissible_v1(uuid,timestamptz)'::regprocedure,'private.assert_subscription_checkout_before_upgrade_v1(uuid)'::regprocedure,
 'private.assert_subscription_checkout_activatable_v1(uuid)'::regprocedure,'private.prepare_subscription_payment_capture_before_upgrade_v2(uuid,text)'::regprocedure,
 'private.record_subscription_upgrade_application_v1()'::regprocedure]loop execute format('revoke all on function %s from public,anon,authenticated,service_role',f);end loop;
 foreach f in array array[
 'public.propose_subscription_upgrade_policy_v1(uuid,uuid,text,text,text,timestamptz,timestamptz,integer,text)'::regprocedure,
 'public.decide_subscription_upgrade_policy_v1(uuid,text,boolean,text)'::regprocedure,'public.withdraw_subscription_upgrade_policy_v1(uuid,text)'::regprocedure,
 'public.list_client_subscription_upgrade_options_v1(uuid)'::regprocedure,'public.create_client_subscription_upgrade_quote_v1(uuid,uuid,text)'::regprocedure,
 'public.prepare_client_subscription_upgrade_payment_v1(uuid,uuid,text,boolean,text,text,text)'::regprocedure,'public.prepare_subscription_payment_capture_v2(uuid,text)'::regprocedure]loop
 execute format('revoke all on function %s from public,anon,authenticated,service_role',f);execute format('grant execute on function %s to authenticated',f);end loop;
end$$;
notify pgrst,'reload schema';
commit;
