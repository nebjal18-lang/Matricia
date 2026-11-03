begin;
-- A member's Box envelope is not general financial authority. This transient
-- capability can be issued only by the narrowly scoped commands below and is
-- consumed within their backend/transaction; no browser role can read/write it.
create table private.member_box_command_capabilities_v1(
 backend_pid integer not null,transaction_id bigint not null,actor_id uuid not null,
 organization_id uuid not null,customer_box_id uuid not null,benefit_version_id uuid not null,
 correlation_id uuid not null,operation text not null check(operation in('RESERVE','RELEASE')),redemption_id uuid,
 primary key(backend_pid,transaction_id,correlation_id),
 check((operation='RELEASE')=(redemption_id is not null))
);
alter table private.member_box_command_capabilities_v1 enable row level security;
revoke all on private.member_box_command_capabilities_v1 from public,anon,authenticated,service_role;

create function private.member_box_reserve_authorized_v1(p_org uuid,p_benefit uuid,p_correlation uuid)returns boolean
language sql stable security definer set search_path=pg_catalog,private as $$
 select auth.uid()is not null and auth.jwt()->>'aal'='aal2'
 and private.has_org_role(p_org,array['CLIENT_OWNER','CLIENT_ADMIN','CLIENT_BUYER','CLIENT_ACCOUNTING'])
 and exists(select 1 from private.member_box_command_capabilities_v1 c
 where c.backend_pid=pg_backend_pid()and c.transaction_id=txid_current()and c.actor_id=auth.uid()
 and c.organization_id=p_org and c.benefit_version_id=p_benefit and c.correlation_id=p_correlation and c.operation='RESERVE')
$$;
create function private.member_box_release_authorized_v1(p_redemption uuid,p_correlation uuid)returns boolean
language sql stable security definer set search_path=pg_catalog,private as $$
 select auth.uid()is not null and auth.jwt()->>'aal'='aal2'
 and exists(select 1 from private.member_box_command_capabilities_v1 c
 where c.backend_pid=pg_backend_pid()and c.transaction_id=txid_current()and c.actor_id=auth.uid()
 and c.redemption_id=p_redemption and c.correlation_id=p_correlation and c.operation='RELEASE'
 and private.has_org_role(c.organization_id,array['CLIENT_OWNER','CLIENT_ADMIN','CLIENT_BUYER','CLIENT_ACCOUNTING']))
$$;
-- Add a strictly command-bound alternative at each reservation authority check.
-- RLS, credits_client_access, public wallet/financial readers are unchanged.
do $$declare d text;needle text;begin
 d:=pg_get_functiondef('public.reserve_benefit_credits(uuid,uuid,uuid,bigint,timestamptz,text,uuid)'::regprocedure);
 needle:='not private.credits_client_access(p_organization_id,a)';
 if strpos(d,needle)=0 then raise exception'MEMBER_BOX_RESERVE_AUTH_SOURCE_MISMATCH';end if;
 execute replace(d,needle,'not(private.credits_client_access(p_organization_id,a)or private.member_box_reserve_authorized_v1(p_organization_id,p_benefit_version_id,p_correlation_id))');
 d:=pg_get_functiondef('private.enforce_benefit_admission_v1()'::regprocedure);
 needle:='not private.credits_client_access(new.organization_id)';
 if strpos(d,needle)=0 then raise exception'MEMBER_BOX_ADMISSION_AUTH_SOURCE_MISMATCH';end if;
 execute replace(d,needle,'not(private.credits_client_access(new.organization_id)or private.member_box_reserve_authorized_v1(new.organization_id,new.benefit_version_id,new.correlation_id))');
 d:=pg_get_functiondef('private.finalize_benefit_credit_reservation_v1()'::regprocedure);
 needle:='not private.credits_client_access(r.organization_id)';
 if strpos(d,needle)=0 then raise exception'MEMBER_BOX_FINAL_RESERVE_AUTH_SOURCE_MISMATCH';end if;
 execute replace(d,needle,'not(private.credits_client_access(r.organization_id)or private.member_box_reserve_authorized_v1(r.organization_id,r.benefit_version_id,r.correlation_id))');
 d:=pg_get_functiondef('public.release_benefit_credits(uuid,text,text,uuid)'::regprocedure);
 needle:='not private.credits_client_access(d.organization_id,a)';
 if strpos(d,needle)=0 then raise exception'MEMBER_BOX_RELEASE_AUTH_SOURCE_MISMATCH';end if;
 execute replace(d,needle,'not(private.credits_client_access(d.organization_id,a)or private.member_box_release_authorized_v1(d.id,p_correlation_id))');
end$$;

create function public.reserve_my_box_benefit_v1(p_customer_box_id uuid,p_benefit_version_id uuid,p_units bigint,p_reservation_expires_at timestamptz,p_idempotency_key text)returns jsonb
language plpgsql security definer set search_path=pg_catalog,private as $$
declare b public.customer_boxes%rowtype;e public.customer_box_envelope_versions_v1%rowtype;funding public.customer_box_funding_sources_v1%rowtype;
 actor uuid:=auth.uid();wallet uuid;correlation uuid:=extensions.gen_random_uuid();h text;r jsonb;proof jsonb;result_id uuid;
begin
 select cb.*into b from public.customer_boxes cb join public.box_versions v on v.id=cb.box_version_id and v.box_type='MULTI_USER'where cb.id=p_customer_box_id;
 if actor is null or b.id is null or auth.jwt()->>'aal'is distinct from'aal2'or not private.has_org_role(b.organization_id,array['CLIENT_OWNER','CLIENT_ADMIN','CLIENT_BUYER','CLIENT_ACCOUNTING'])then raise exception'MEMBER_BOX_RESERVATION_DENIED'using errcode='42501';end if;
 if p_units is null or p_units<1 or p_reservation_expires_at is null or length(coalesce(p_idempotency_key,''))not between 8 and 100 then raise exception'INVALID_MEMBER_BOX_RESERVATION'using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('subscription-financial:'||b.organization_id::text,0));
 select id into wallet from public.credit_wallets where organization_id=b.organization_id and wallet_type='CLIENT'for update;
 if wallet is null or auth.jwt()->>'aal'is distinct from'aal2'or not private.has_org_role(b.organization_id,array['CLIENT_OWNER','CLIENT_ADMIN','CLIENT_BUYER','CLIENT_ACCOUNTING'])then raise exception'MEMBER_BOX_RESERVATION_DENIED'using errcode='42501';end if;
 h:=private.canonical_request_hash(jsonb_build_object('box',b.id,'member',actor,'benefit',p_benefit_version_id,'units',p_units::text,'expires',p_reservation_expires_at));
 r:=private.begin_credit_command(b.organization_id,'member.box.reserve',p_idempotency_key,h,actor);if r is not null then return r;end if;
 if b.period_start>clock_timestamp()or b.period_end<=clock_timestamp()or p_reservation_expires_at> b.period_end or p_reservation_expires_at<=clock_timestamp()then raise exception'MEMBER_BOX_PERIOD_REQUIRED'using errcode='55000';end if;
 select*into funding from public.customer_box_funding_sources_v1 where customer_box_id=b.id and organization_id=b.organization_id;
 proof:=private.benefit_customer_box_evidence_v1(b.organization_id,funding.cycle_id,array[b.box_version_id],clock_timestamp());
 if proof->>'customer_box_id'is distinct from b.id::text then raise exception'MEMBER_BOX_FUNDED_PROMISE_REQUIRED'using errcode='55000';end if;
 if not exists(select 1 from jsonb_array_elements(b.selections_snapshot)s where s->>'benefit_version_id'=p_benefit_version_id::text)then raise exception'MEMBER_BOX_BENEFIT_NOT_SELECTED'using errcode='42501';end if;
 select*into e from public.customer_box_envelope_versions_v1 where customer_box_id=b.id and scope='MEMBER'and target_id=actor order by version desc limit 1;
 if e.id is null or e.credit_limit<=private.customer_box_envelope_used_v1(b.id,'MEMBER',actor)then raise exception'MEMBER_BOX_ENVELOPE_UNAVAILABLE'using errcode='23514';end if;
 insert into private.member_box_command_capabilities_v1 values(pg_backend_pid(),txid_current(),actor,b.organization_id,b.id,p_benefit_version_id,correlation,'RESERVE',null);
 r:=public.reserve_benefit_credits(b.organization_id,wallet,p_benefit_version_id,p_units,p_reservation_expires_at,'member-box:'||b.id::text||':'||p_idempotency_key,correlation);
 delete from private.member_box_command_capabilities_v1 where backend_pid=pg_backend_pid()and transaction_id=txid_current()and correlation_id=correlation;
 result_id:=(r->>'redemption_id')::uuid;
 if r->>'outcome'is distinct from'BENEFIT_RESERVED'or not exists(select 1 from public.customer_box_redemption_allocations_v1 a join public.benefit_redemptions d on d.id=a.redemption_id where a.redemption_id=result_id and a.customer_box_id=b.id and a.organization_id=b.organization_id and d.created_by=actor)then raise exception'MEMBER_BOX_RESERVATION_SCOPE_MISMATCH'using errcode='55000';end if;
 r:=jsonb_build_object('outcome','MEMBER_BOX_BENEFIT_RESERVED','redemption_id',result_id,'reserved_credits',r->>'reserved_credits','customer_box_id',b.id);
 perform private.finish_credit_command(b.organization_id,'member.box.reserve',p_idempotency_key,r);return r;
end$$;

create function public.release_my_box_reservation_v1(p_redemption_id uuid,p_expected_row_version bigint,p_reason text,p_idempotency_key text)returns jsonb
language plpgsql security definer set search_path=pg_catalog,private as $$
declare d public.benefit_redemptions%rowtype;b uuid;actor uuid:=auth.uid();correlation uuid:=extensions.gen_random_uuid();h text;r jsonb;
begin
 select r.*into d from public.benefit_redemptions r join public.customer_box_redemption_allocations_v1 a on a.redemption_id=r.id join public.customer_boxes cb on cb.id=a.customer_box_id join public.box_versions v on v.id=cb.box_version_id and v.box_type='MULTI_USER'where r.id=p_redemption_id and r.created_by=actor;
 if actor is null or d.id is null or auth.jwt()->>'aal'is distinct from'aal2'or not private.has_org_role(d.organization_id,array['CLIENT_OWNER','CLIENT_ADMIN','CLIENT_BUYER','CLIENT_ACCOUNTING'])then raise exception'MEMBER_BOX_RELEASE_DENIED'using errcode='42501';end if;
 if p_expected_row_version is null or p_expected_row_version<1 or length(btrim(coalesce(p_reason,'')))not between 3 and 80 or length(coalesce(p_idempotency_key,''))not between 8 and 100 then raise exception'INVALID_MEMBER_BOX_RELEASE'using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('subscription-financial:'||d.organization_id::text,0));perform 1 from public.credit_wallets where id=d.wallet_id for update;
 select*into d from public.benefit_redemptions where id=p_redemption_id for update;
 if d.created_by is distinct from actor or auth.jwt()->>'aal'is distinct from'aal2'or not private.has_org_role(d.organization_id,array['CLIENT_OWNER','CLIENT_ADMIN','CLIENT_BUYER','CLIENT_ACCOUNTING'])then raise exception'MEMBER_BOX_RELEASE_DENIED'using errcode='42501';end if;
 h:=private.canonical_request_hash(jsonb_build_object('redemption',d.id,'version',p_expected_row_version,'reason',btrim(p_reason)));
 r:=private.begin_credit_command(d.organization_id,'member.box.release',p_idempotency_key,h,actor);if r is not null then return r;end if;
 if d.row_version is distinct from p_expected_row_version then raise exception'STALE_BENEFIT_REDEMPTION'using errcode='40001';end if;
 select customer_box_id into b from public.customer_box_redemption_allocations_v1 where redemption_id=d.id;
 insert into private.member_box_command_capabilities_v1 values(pg_backend_pid(),txid_current(),actor,d.organization_id,b,d.benefit_version_id,correlation,'RELEASE',d.id);
 r:=public.release_benefit_credits(d.id,btrim(p_reason),'member-box-release:'||p_idempotency_key,correlation);
 delete from private.member_box_command_capabilities_v1 where backend_pid=pg_backend_pid()and transaction_id=txid_current()and correlation_id=correlation;
 if r->>'outcome'is distinct from'BENEFIT_RELEASED'then raise exception'MEMBER_BOX_RELEASE_NOT_CONFIRMED'using errcode='55000';end if;
 r:=jsonb_build_object('outcome','MEMBER_BOX_RESERVATION_RELEASED','redemption_id',d.id,'released_credits',r->>'released_credits');
 perform private.finish_credit_command(d.organization_id,'member.box.release',p_idempotency_key,r);return r;
end$$;

create function public.get_my_box_workspace_v1(p_organization_id uuid,p_after uuid default null,p_limit integer default 25)returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,private as $$
declare actor uuid:=auth.uid();items jsonb;next_id uuid;
begin
 if actor is null or not private.has_org_role(p_organization_id,array['CLIENT_OWNER','CLIENT_ADMIN','CLIENT_BUYER','CLIENT_ACCOUNTING'])then raise exception'MEMBER_BOX_READ_DENIED'using errcode='42501';end if;
 if p_limit is null or p_limit not between 1 and 25 then raise exception'INVALID_MEMBER_BOX_PAGE'using errcode='22023';end if;
 with candidates as(
 select cb.id,cb.period_start,cb.period_end,cb.box_version_id,v.name_fr,v.name_ar,cb.selections_snapshot,e.credit_limit,
 private.customer_box_envelope_used_v1(cb.id,'MEMBER',actor)used,
 (private.subscription_financially_clear(cb.organization_id)and private.client_identity_allows_new_operations(cb.organization_id)and private.benefit_customer_box_evidence_v1(cb.organization_id,(select f.cycle_id from public.customer_box_funding_sources_v1 f where f.customer_box_id=cb.id),array[cb.box_version_id],statement_timestamp())->>'customer_box_id'=cb.id::text)funding_ready
 from public.customer_boxes cb join public.box_versions v on v.id=cb.box_version_id and v.box_type='MULTI_USER'
 join lateral(select*from public.customer_box_envelope_versions_v1 x where x.customer_box_id=cb.id and x.scope='MEMBER'and x.target_id=actor order by x.version desc limit 1)e on true
 where cb.organization_id=p_organization_id and(p_after is null or cb.id>p_after)order by cb.id limit p_limit+1
 ),page as(select*from candidates order by id limit p_limit)
 select coalesce(jsonb_agg(jsonb_build_object('id',page.id,'name_fr',page.name_fr,'name_ar',page.name_ar,'period_start',page.period_start,'period_end',page.period_end,
 'funding_ready',coalesce(page.funding_ready,false),'credit_limit',page.credit_limit::text,'used',page.used::text,'available',greatest(0,page.credit_limit-page.used)::text,
 'benefits',(select coalesce(jsonb_agg(jsonb_build_object('id',v.id,'name_fr',v.name_fr,'name_ar',v.name_ar,'credit_cost',v.credit_cost::text)order by v.id),'[]')from public.benefit_versions v where exists(select 1 from jsonb_array_elements(page.selections_snapshot)s where s->>'benefit_version_id'=v.id::text)),
 'redemptions',(select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'name_fr',v.name_fr,'name_ar',v.name_ar,'status',r.status,'reserved_credits',r.reserved_credits::text,'expires_at',r.reservation_expires_at,'row_version',r.row_version::text)order by r.created_at desc,r.id),'[]')from public.customer_box_redemption_allocations_v1 a join public.benefit_redemptions r on r.id=a.redemption_id join public.benefit_versions v on v.id=r.benefit_version_id where a.customer_box_id=page.id and a.organization_id=p_organization_id and r.created_by=actor)
 )order by page.id),'[]'),case when(select count(*)from candidates)>p_limit then(select max(id::text)::uuid from page)else null end into items,next_id from page;
 return jsonb_build_object('organization_id',p_organization_id,'boxes',items,'next',next_id,'aal2',auth.jwt()->>'aal'='aal2');
end$$;
revoke all on function private.member_box_reserve_authorized_v1(uuid,uuid,uuid),private.member_box_release_authorized_v1(uuid,uuid),public.reserve_my_box_benefit_v1(uuid,uuid,bigint,timestamptz,text),public.release_my_box_reservation_v1(uuid,bigint,text,text),public.get_my_box_workspace_v1(uuid,uuid,integer)from public,anon,authenticated,service_role;
grant execute on function public.reserve_my_box_benefit_v1(uuid,uuid,bigint,timestamptz,text),public.release_my_box_reservation_v1(uuid,bigint,text,text),public.get_my_box_workspace_v1(uuid,uuid,integer)to authenticated;
notify pgrst,'reload schema';
commit;
