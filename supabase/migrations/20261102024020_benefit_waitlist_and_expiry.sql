begin;
-- Waiting for capacity does not reserve or mint credits. Admission is rerun
-- through the real FEFO command when the Client confirms the available place.
create table public.benefit_waitlist_requests_v1(
 id uuid primary key default extensions.gen_random_uuid(),organization_id uuid not null references public.organizations(id),
 benefit_version_id uuid not null references public.benefit_versions(id),wallet_id uuid not null references public.credit_wallets(id),
 units bigint not null check(units>0),created_by uuid not null references auth.users(id),created_at timestamptz not null default clock_timestamp(),
 idempotency_key text not null,unique(organization_id,created_by,idempotency_key)
);
create table public.benefit_waitlist_outcomes_v1(
 request_id uuid primary key references public.benefit_waitlist_requests_v1(id),organization_id uuid not null references public.organizations(id),
 outcome text not null check(outcome in('CANCELLED','RESERVED')),redemption_id uuid references public.benefit_redemptions(id),
 decided_by uuid not null references auth.users(id),created_at timestamptz not null default clock_timestamp(),check((outcome='RESERVED')=(redemption_id is not null))
);
alter table public.benefit_waitlist_requests_v1 enable row level security;
alter table public.benefit_waitlist_outcomes_v1 enable row level security;
revoke all on public.benefit_waitlist_requests_v1,public.benefit_waitlist_outcomes_v1 from public,anon,authenticated,service_role;
create trigger benefit_waitlist_request_immutable before update or delete on public.benefit_waitlist_requests_v1 for each row execute function private.prevent_update_delete();
create trigger benefit_waitlist_outcome_immutable before update or delete on public.benefit_waitlist_outcomes_v1 for each row execute function private.prevent_update_delete();
create function public.join_benefit_waitlist_v1(p_organization_id uuid,p_wallet_id uuid,p_benefit_version_id uuid,p_units bigint,p_idempotency_key text)returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare state jsonb;prior public.benefit_waitlist_requests_v1%rowtype;x uuid;r jsonb;begin
 if auth.uid()is null or auth.jwt()->>'aal'is distinct from'aal2'or not private.credits_client_access(p_organization_id)then raise exception'BENEFIT_WAITLIST_DENIED'using errcode='42501';end if;
 if p_units is null or p_units<1 or length(coalesce(p_idempotency_key,''))not between 8 and 180 then raise exception'INVALID_BENEFIT_WAITLIST'using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('subscription-financial:'||p_organization_id::text,0));
 perform id from public.credit_wallets where id=p_wallet_id and organization_id=p_organization_id and wallet_type='CLIENT'for update;
 if not found then raise exception'CLIENT_WALLET_NOT_FOUND'using errcode='42501';end if;
 select*into prior from public.benefit_waitlist_requests_v1 where organization_id=p_organization_id and created_by=auth.uid()and idempotency_key=p_idempotency_key;
 if prior.id is not null then
 if prior.benefit_version_id is distinct from p_benefit_version_id or prior.wallet_id is distinct from p_wallet_id or prior.units is distinct from p_units then raise exception'IDEMPOTENCY_PAYLOAD_MISMATCH'using errcode='22000';end if;
 return jsonb_build_object('outcome','BENEFIT_WAITLISTED','request_id',prior.id);end if;
 state:=private.benefit_admission_status_v1(p_organization_id,p_benefit_version_id,p_units,clock_timestamp());
 if state->>'blocked_reason'is distinct from'BENEFIT_CAPACITY_UNAVAILABLE'then raise exception'BENEFIT_WAITLIST_CAPACITY_ONLY'using errcode='55000';end if;
 insert into public.benefit_waitlist_requests_v1(organization_id,wallet_id,benefit_version_id,units,created_by,idempotency_key)values(p_organization_id,p_wallet_id,p_benefit_version_id,p_units,auth.uid(),p_idempotency_key)returning id into x;
 r:=jsonb_build_object('outcome','BENEFIT_WAITLISTED','request_id',x);
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(p_organization_id,auth.uid(),'USER','benefit.waitlisted','benefit_waitlist',x::text,extensions.gen_random_uuid(),r,repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values(p_organization_id,'benefit_waitlist',x::text,'BenefitWaitlistedV1',extensions.gen_random_uuid(),r,p_idempotency_key);
 return r;
end$$;
create function public.resolve_benefit_waitlist_v1(p_request_id uuid,p_cancel boolean,p_reservation_expires_at timestamptz,p_idempotency_key text)returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare q public.benefit_waitlist_requests_v1%rowtype;o public.benefit_waitlist_outcomes_v1%rowtype;r jsonb;red uuid;begin
 select*into q from public.benefit_waitlist_requests_v1 where id=p_request_id;
 if q.id is null or auth.uid()is null or auth.jwt()->>'aal'is distinct from'aal2'or not private.credits_client_access(q.organization_id)then raise exception'BENEFIT_WAITLIST_DENIED'using errcode='42501';end if;
 if p_cancel is null or length(coalesce(p_idempotency_key,''))not between 8 and 180 then raise exception'INVALID_BENEFIT_WAITLIST'using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('subscription-financial:'||q.organization_id::text,0));
 perform id from public.benefit_waitlist_requests_v1 where id=q.id for update;
 select*into o from public.benefit_waitlist_outcomes_v1 where request_id=q.id;
 if o.request_id is not null then
 if o.outcome is distinct from(case when p_cancel then'CANCELLED'else'RESERVED'end)then raise exception'BENEFIT_WAITLIST_ALREADY_RESOLVED'using errcode='55000';end if;
 return jsonb_build_object('outcome','BENEFIT_WAITLIST_'||o.outcome,'request_id',q.id,'redemption_id',o.redemption_id);end if;
 if not p_cancel then r:=public.reserve_benefit_credits(q.organization_id,q.wallet_id,q.benefit_version_id,q.units,p_reservation_expires_at,p_idempotency_key,extensions.gen_random_uuid());red:=(r->>'redemption_id')::uuid;end if;
 insert into public.benefit_waitlist_outcomes_v1(request_id,organization_id,outcome,redemption_id,decided_by)values(q.id,q.organization_id,case when p_cancel then'CANCELLED'else'RESERVED'end,red,auth.uid());
 r:=jsonb_build_object('outcome',case when p_cancel then'BENEFIT_WAITLIST_CANCELLED'else'BENEFIT_WAITLIST_RESERVED'end,'request_id',q.id,'redemption_id',red);
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(q.organization_id,auth.uid(),'USER','benefit.waitlist_resolved','benefit_waitlist',q.id::text,extensions.gen_random_uuid(),r,repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values(q.organization_id,'benefit_waitlist',q.id::text,'BenefitWaitlistResolvedV1',extensions.gen_random_uuid(),r,p_idempotency_key);return r;
end$$;
create function public.expire_my_benefit_reservation_v1(p_redemption_id uuid,p_expected_row_version bigint,p_idempotency_key text)returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare d public.benefit_redemptions%rowtype;r jsonb;h text;begin
 select*into d from public.benefit_redemptions where id=p_redemption_id;
 if d.id is null or auth.uid()is null or auth.jwt()->>'aal'is distinct from'aal2'or not private.credits_client_access(d.organization_id)then raise exception'BENEFIT_EXPIRY_DENIED'using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('subscription-financial:'||d.organization_id::text,0));
 perform id from public.credit_wallets where id=d.wallet_id for update;
 select*into d from public.benefit_redemptions where id=p_redemption_id for update;
 h:=private.canonical_request_hash(jsonb_build_object('redemption',d.id,'version',p_expected_row_version));r:=private.begin_credit_command(d.organization_id,'benefit.expire',p_idempotency_key,h,auth.uid());if r is not null then return r;end if;
 if d.row_version is distinct from p_expected_row_version then raise exception'STALE_BENEFIT_REDEMPTION'using errcode='40001';end if;
 if d.status<>'RESERVED'or d.reservation_expires_at>clock_timestamp()then raise exception'BENEFIT_RESERVATION_NOT_EXPIRED'using errcode='55000';end if;
 -- Reuse the exact existing lot release; never change a ledger or a lot.
 perform public.release_benefit_credits(d.id,'RESERVATION_EXPIRED',p_idempotency_key||':release',extensions.gen_random_uuid());
 update public.benefit_redemptions set status='EXPIRED',row_version=row_version+1,updated_at=clock_timestamp()where id=d.id;
 r:=jsonb_build_object('outcome','BENEFIT_EXPIRED','redemption_id',d.id,'released_credits',d.reserved_credits::text);
 insert into public.benefit_redemption_events(organization_id,redemption_id,from_status,to_status,reason_code,idempotency_key,correlation_id,actor_user_id)values(d.organization_id,d.id,'CANCELLED','EXPIRED','RESERVATION_EXPIRED',p_idempotency_key,extensions.gen_random_uuid(),auth.uid());
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(d.organization_id,auth.uid(),'USER','benefit.expired','benefit_redemption',d.id::text,extensions.gen_random_uuid(),r,repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values(d.organization_id,'benefit_redemption',d.id::text,'BenefitExpiredV1',extensions.gen_random_uuid(),r,p_idempotency_key);
 perform private.finish_credit_command(d.organization_id,'benefit.expire',p_idempotency_key,r);return r;
end$$;
revoke all on function public.join_benefit_waitlist_v1(uuid,uuid,uuid,bigint,text),public.resolve_benefit_waitlist_v1(uuid,boolean,timestamptz,text),public.expire_my_benefit_reservation_v1(uuid,bigint,text)from public,anon,authenticated,service_role;
grant execute on function public.join_benefit_waitlist_v1(uuid,uuid,uuid,bigint,text),public.resolve_benefit_waitlist_v1(uuid,boolean,timestamptz,text),public.expire_my_benefit_reservation_v1(uuid,bigint,text)to authenticated;
notify pgrst,'reload schema';
commit;
