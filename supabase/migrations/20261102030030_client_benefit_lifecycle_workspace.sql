begin;
-- A member may manage only their own allocated reservation; financial readers
-- retain their existing scope. This predicate does not grant wallet access.
create function private.client_owns_member_benefit_v1(p_redemption uuid)returns boolean
language sql stable security definer set search_path=pg_catalog,private as $$
 select exists(select 1 from public.benefit_redemptions r join public.customer_box_redemption_allocations_v1 a on a.redemption_id=r.id
 join public.customer_boxes cb on cb.id=a.customer_box_id join public.box_versions v on v.id=cb.box_version_id and v.box_type='MULTI_USER'
 where r.id=p_redemption and r.created_by=auth.uid()and private.has_org_role(r.organization_id,array['CLIENT_OWNER','CLIENT_ADMIN','CLIENT_BUYER','CLIENT_ACCOUNTING']))
$$;
-- Recheck mutable authority after lock waits in the existing capacity commands.
do $$declare d text;needle text;begin
 d:=pg_get_functiondef('public.join_benefit_waitlist_v1(uuid,uuid,uuid,bigint,text)'::regprocedure);
 needle:='if not found then raise exception''CLIENT_WALLET_NOT_FOUND''using errcode=''42501'';end if;';
 if strpos(d,needle)=0 then raise exception'WAITLIST_JOIN_RECHECK_SOURCE_MISMATCH';end if;
 d:=replace(d,needle,needle||' if auth.uid()is null or auth.jwt()->>''aal''is distinct from''aal2''or not private.credits_client_access(p_organization_id)then raise exception''BENEFIT_WAITLIST_DENIED''using errcode=''42501'';end if;');execute d;
 d:=pg_get_functiondef('public.resolve_benefit_waitlist_v1(uuid,boolean,timestamptz,text)'::regprocedure);
 needle:='perform id from public.benefit_waitlist_requests_v1 where id=q.id for update;';
 if strpos(d,needle)=0 then raise exception'WAITLIST_RESOLVE_RECHECK_SOURCE_MISMATCH';end if;
 d:=replace(d,needle,needle||' if auth.uid()is null or auth.jwt()->>''aal''is distinct from''aal2''or not private.credits_client_access(q.organization_id)then raise exception''BENEFIT_WAITLIST_DENIED''using errcode=''42501'';end if;');execute d;
 -- Buyer is authorized for their own acquired allocation, never another member's
 -- reservation guessed by identifier inside the same organization.
 d:=pg_get_functiondef('public.execute_benefit_native_v1(uuid,bigint,jsonb,text)'::regprocedure);
 needle:='h:=private.canonical_request_hash(jsonb_build_object(''redemption'',r.id,''version'',p_expected_row_version,''context'',p_request_context));';
 if strpos(d,needle)=0 then raise exception'BENEFIT_NATIVE_MEMBER_RECHECK_SOURCE_MISMATCH';end if;
 d:=replace(d,needle,'if not(private.benefit_operations_access_v1()or private.has_org_role(r.organization_id,array[''CLIENT_OWNER'',''CLIENT_ADMIN''])or private.client_owns_member_benefit_v1(r.id))then raise exception''BENEFIT_NATIVE_EXECUTION_DENIED''using errcode=''42501'';end if;'||needle);execute d;
end$$;
create or replace function public.expire_my_benefit_reservation_v1(p_redemption_id uuid,p_expected_row_version bigint,p_idempotency_key text)returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare d public.benefit_redemptions%rowtype;r jsonb;h text;begin
 select*into d from public.benefit_redemptions where id=p_redemption_id;
 if d.id is null or auth.uid()is null or auth.jwt()->>'aal'is distinct from'aal2'or not(private.credits_client_access(d.organization_id)or private.client_owns_member_benefit_v1(d.id))then raise exception'BENEFIT_EXPIRY_DENIED'using errcode='42501';end if;
 if p_expected_row_version is null or p_expected_row_version<1 or length(coalesce(p_idempotency_key,''))not between 8 and 90 then raise exception'INVALID_BENEFIT_EXPIRY'using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('subscription-financial:'||d.organization_id::text,0));perform id from public.credit_wallets where id=d.wallet_id for update;
 select*into d from public.benefit_redemptions where id=p_redemption_id for update;
 if d.id is null or auth.uid()is null or auth.jwt()->>'aal'is distinct from'aal2'or not(private.credits_client_access(d.organization_id)or private.client_owns_member_benefit_v1(d.id))then raise exception'BENEFIT_EXPIRY_DENIED'using errcode='42501';end if;
 h:=private.canonical_request_hash(jsonb_build_object('redemption',d.id,'version',p_expected_row_version));r:=private.begin_credit_command(d.organization_id,'benefit.expire',p_idempotency_key,h,auth.uid());if r is not null then return r;end if;
 if d.row_version is distinct from p_expected_row_version then raise exception'STALE_BENEFIT_REDEMPTION'using errcode='40001';end if;
 if d.status<>'RESERVED'or d.reservation_expires_at>clock_timestamp()then raise exception'BENEFIT_RESERVATION_NOT_EXPIRED'using errcode='55000';end if;
 if private.credits_client_access(d.organization_id)then perform public.release_benefit_credits(d.id,'RESERVATION_EXPIRED',p_idempotency_key||':release',extensions.gen_random_uuid());
 else perform public.release_my_box_reservation_v1(d.id,d.row_version,'RESERVATION_EXPIRED',p_idempotency_key||':release');end if;
 update public.benefit_redemptions set status='EXPIRED',row_version=row_version+1,updated_at=clock_timestamp()where id=d.id;
 r:=jsonb_build_object('outcome','BENEFIT_EXPIRED','redemption_id',d.id,'released_credits',d.reserved_credits::text);
 insert into public.benefit_redemption_events(organization_id,redemption_id,from_status,to_status,reason_code,idempotency_key,correlation_id,actor_user_id)values(d.organization_id,d.id,'CANCELLED','EXPIRED','RESERVATION_EXPIRED',p_idempotency_key,extensions.gen_random_uuid(),auth.uid());
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(d.organization_id,auth.uid(),'USER','benefit.expired','benefit_redemption',d.id::text,extensions.gen_random_uuid(),r,repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values(d.organization_id,'benefit_redemption',d.id::text,'BenefitExpiredV1',extensions.gen_random_uuid(),r,p_idempotency_key);
 perform private.finish_credit_command(d.organization_id,'benefit.expire',p_idempotency_key,r);return r;
end$$;
create function public.get_client_benefit_lifecycle_v1(p_organization_id uuid,p_after uuid default null,p_wait_after uuid default null,p_offer_after uuid default null)returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,private as $$
declare finance boolean;rows jsonb;waiting jsonb;offers jsonb;next_row uuid;next_wait uuid;next_offer uuid;begin
 if auth.uid()is null or not private.has_org_role(p_organization_id,array['CLIENT_OWNER','CLIENT_ADMIN','CLIENT_BUYER','CLIENT_ACCOUNTING'])then raise exception'BENEFIT_LIFECYCLE_READ_DENIED'using errcode='42501';end if;
 finance:=private.credits_client_access(p_organization_id);
 with candidates as(select r.*,b.name_fr,b.name_ar,b.library_id,b.service_id,(private.reserved_benefit_native_binding_v1(r.id)).executor executor,
 exists(select 1 from public.benefit_native_execution_facts_v1 f where f.redemption_id=r.id)executed
 from public.benefit_redemptions r join public.benefit_versions b on b.id=r.benefit_version_id
 where r.organization_id=p_organization_id and(finance or private.client_owns_member_benefit_v1(r.id))and(p_after is null or r.id>p_after)order by r.id limit 26),page as(select*from candidates order by id limit 25)
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'name_fr',name_fr,'name_ar',name_ar,'status',status,'row_version',row_version::text,'expires_at',reservation_expires_at,'executor',executor,'executed',executed,'library_id',library_id,'service_id',service_id,
 'may_execute',(private.has_org_role(p_organization_id,array['CLIENT_OWNER','CLIENT_ADMIN'])or private.client_owns_member_benefit_v1(id)))order by id),'[]'),case when(select count(*)from candidates)>25 then(select max(id::text)::uuid from page)end into rows,next_row from page;
 -- Wallet identifiers and capacity offers are financial scope only. Buyer sees
 -- their own allocated reservations above, never the global wallet below.
 with candidates as(select q.*,b.name_fr,b.name_ar from public.benefit_waitlist_requests_v1 q join public.benefit_versions b on b.id=q.benefit_version_id
 where finance and q.organization_id=p_organization_id and q.created_by=auth.uid()and not exists(select 1 from public.benefit_waitlist_outcomes_v1 o where o.request_id=q.id)
 and(p_wait_after is null or q.id>p_wait_after)order by q.id limit 26),page as(select*from candidates order by id limit 25)
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'name_fr',name_fr,'name_ar',name_ar,'units',units::text)order by id),'[]'),case when(select count(*)from candidates)>25 then(select max(id::text)::uuid from page)end into waiting,next_wait from page;
 with candidates as(select distinct b.id,b.name_fr,b.name_ar,w.id wallet_id from public.customer_boxes cb
 cross join lateral jsonb_array_elements(cb.selections_snapshot)s join public.benefit_versions b on b.id=(s->>'benefit_version_id')::uuid
 join public.credit_wallets w on w.organization_id=cb.organization_id and w.wallet_type='CLIENT'
 where finance and cb.organization_id=p_organization_id and cb.period_start<=statement_timestamp()and cb.period_end>statement_timestamp()
 and(p_offer_after is null or b.id>p_offer_after)and private.benefit_admission_status_v1(p_organization_id,b.id,1,statement_timestamp())->>'blocked_reason'='BENEFIT_CAPACITY_UNAVAILABLE'
 order by b.id limit 26),page as(select*from candidates order by id limit 25)
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'name_fr',name_fr,'name_ar',name_ar,'wallet_id',wallet_id)order by id),'[]'),case when(select count(*)from candidates)>25 then(select max(id::text)::uuid from page)end into offers,next_offer from page;
 return jsonb_build_object('organization_id',p_organization_id,'aal2',auth.jwt()->>'aal'='aal2','finance',finance,'redemptions',rows,'waiting',waiting,'offers',offers,'next',next_row,'next_wait',next_wait,'next_offer',next_offer);
end$$;
-- The Client supplies business fields only. Catalogue authority and native
-- linkage are derived server-side; no browser hash or object selector grants it.
create function public.get_client_benefit_rfq_context_v1(p_redemption_id uuid,p_organization_id uuid)returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,private as $$
declare r public.benefit_redemptions%rowtype;b public.benefit_versions%rowtype;n public.benefit_native_bindings_v1%rowtype;s public.catalog_service_versions%rowtype;existing uuid;begin
 select*into r from public.benefit_redemptions where id=p_redemption_id and organization_id=p_organization_id;
 if r.id is null or auth.uid()is null or not(private.has_org_role(r.organization_id,array['CLIENT_OWNER','CLIENT_ADMIN'])or private.client_owns_member_benefit_v1(r.id))then raise exception'BENEFIT_RFQ_CONTEXT_DENIED'using errcode='42501';end if;
 n:=private.reserved_benefit_native_binding_v1(r.id);if n.id is null or n.executor<>'RFQ_REQUEST'then raise exception'BENEFIT_RFQ_BINDING_REQUIRED'using errcode='55000';end if;
 select*into b from public.benefit_versions where id=r.benefit_version_id;
 select v.*into s from public.catalog_services c join public.catalog_service_versions v on v.id=c.current_published_version_id and v.service_id=c.id and v.library_id=c.library_id where c.id=b.service_id and c.library_id=b.library_id and c.status='PUBLISHED'and v.status='PUBLISHED'and v.published_at is not null;
 if s.id is null then raise exception'REQUEST_PUBLISHED_SERVICE_SOURCE_REQUIRED'using errcode='55000';end if;
 select(f.result->>'request_id')::uuid into existing from public.benefit_native_execution_facts_v1 f join public.service_requests q on q.id=(f.result->>'request_id')::uuid and q.client_organization_id=r.organization_id where f.redemption_id=r.id and f.executor='RFQ_REQUEST';
 return jsonb_build_object('redemption_id',r.id,'organization_id',r.organization_id,'row_version',r.row_version::text,'service_name_fr',s.name_fr,'service_name_ar',s.name_ar,'benefit_name_fr',b.name_fr,'benefit_name_ar',b.name_ar,'existing_request_id',existing);
end$$;
create function public.create_client_benefit_rfq_v1(p_redemption_id uuid,p_expected_row_version bigint,p_payload jsonb,p_idempotency_key text)returns jsonb
language plpgsql security definer set search_path=pg_catalog,private as $$
declare r public.benefit_redemptions%rowtype;b public.benefit_versions%rowtype;n public.benefit_native_bindings_v1%rowtype;catalog_hash text;payload jsonb;result jsonb;begin
 select*into r from public.benefit_redemptions where id=p_redemption_id;
 if r.id is null or auth.uid()is null or auth.jwt()->>'aal'is distinct from'aal2'or not(private.has_org_role(r.organization_id,array['CLIENT_OWNER','CLIENT_ADMIN'])or private.client_owns_member_benefit_v1(r.id))then raise exception'BENEFIT_RFQ_CONTEXT_DENIED'using errcode='42501';end if;
 if jsonb_typeof(p_payload)is distinct from'object'or length(btrim(coalesce(p_payload->>'description','')))not between 10 and 8000 or coalesce(p_payload->>'urgency','')not in('LOW','NORMAL','HIGH','CRITICAL')or p_payload->>'currency_code'is distinct from'MAD'or not(coalesce(p_payload->>'region_code','')=any(private.morocco_region_codes()))or(nullif(p_payload->>'budget_minor','')is not null and p_payload->>'budget_minor'!~'^[0-9]{1,18}$')then raise exception'INVALID_BENEFIT_RFQ_PAYLOAD'using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('subscription-financial:'||r.organization_id::text,0));perform id from public.credit_wallets where id=r.wallet_id for update;select*into r from public.benefit_redemptions where id=p_redemption_id for update;
 if auth.uid()is null or auth.jwt()->>'aal'is distinct from'aal2'or not(private.has_org_role(r.organization_id,array['CLIENT_OWNER','CLIENT_ADMIN'])or private.client_owns_member_benefit_v1(r.id))then raise exception'BENEFIT_RFQ_CONTEXT_DENIED'using errcode='42501';end if;
 n:=private.reserved_benefit_native_binding_v1(r.id);if n.id is null or n.executor<>'RFQ_REQUEST'then raise exception'BENEFIT_RFQ_BINDING_REQUIRED'using errcode='55000';end if;
 select*into b from public.benefit_versions where id=r.benefit_version_id;
 select v.content_hash into catalog_hash from public.catalog_services s join public.catalog_service_versions v on v.id=s.current_published_version_id and v.service_id=s.id and v.library_id=s.library_id where s.id=b.service_id and s.library_id=b.library_id and s.status='PUBLISHED'and v.status='PUBLISHED'and v.published_at is not null;
 if catalog_hash is null then raise exception'REQUEST_PUBLISHED_SERVICE_SOURCE_REQUIRED'using errcode='55000';end if;
 payload:=jsonb_build_object('description',btrim(p_payload->>'description'),'urgency',p_payload->>'urgency','desired_date',nullif(p_payload->>'desired_date',''),'budget_minor',nullif(p_payload->>'budget_minor',''),'currency_code','MAD','site_id',nullif(p_payload->>'site_id',''),'required_quote_data',jsonb_build_object('region_code',p_payload->>'region_code'),'required_fields_complete',false,'catalog_snapshot_hash',catalog_hash,'questionnaire_snapshot_hash',repeat('0',64));
 -- The normal request engine verifies site, tax, subscription and catalogue.
 -- This is an explicit incomplete draft, not a fabricated completed RFQ.
 result:=public.execute_benefit_native_v1(r.id,p_expected_row_version,jsonb_build_object('questionnaire_version_id',null,'payload',payload),p_idempotency_key);
 if result->>'outcome'is distinct from'SERVICE_REQUEST_CREATED'or result->>'request_id'is null then raise exception'BENEFIT_RFQ_CREATION_NOT_CONFIRMED'using errcode='55000';end if;return result;
end$$;
revoke all on function public.get_client_benefit_rfq_context_v1(uuid,uuid),public.create_client_benefit_rfq_v1(uuid,bigint,jsonb,text)from public,anon,authenticated,service_role;
grant execute on function public.get_client_benefit_rfq_context_v1(uuid,uuid),public.create_client_benefit_rfq_v1(uuid,bigint,jsonb,text)to authenticated;
revoke all on function private.client_owns_member_benefit_v1(uuid),public.get_client_benefit_lifecycle_v1(uuid,uuid,uuid,uuid)from public,anon,authenticated,service_role;
grant execute on function public.get_client_benefit_lifecycle_v1(uuid,uuid,uuid,uuid)to authenticated;
notify pgrst,'reload schema';
commit;
