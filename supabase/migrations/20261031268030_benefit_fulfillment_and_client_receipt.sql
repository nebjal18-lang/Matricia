begin;

create table public.benefit_fulfillment_steps_v1(
 id uuid primary key default extensions.gen_random_uuid(),
 redemption_id uuid not null references public.benefit_redemptions(id),
 organization_id uuid not null references public.organizations(id),
 action text not null check(action in('SCHEDULE','START')),
 from_status text not null,to_status text not null,
 scheduled_for timestamptz,reason text not null check(length(btrim(reason))between 10 and 2000),
 created_by uuid not null references auth.users(id),created_at timestamptz not null default clock_timestamp()
);
create table public.benefit_delivery_proposals_v1(
 id uuid primary key default extensions.gen_random_uuid(),
 redemption_id uuid not null references public.benefit_redemptions(id),
 organization_id uuid not null references public.organizations(id),
 redemption_row_version bigint not null,
 summary text not null check(length(btrim(summary))between 20 and 10000),
 service_reference text not null check(length(btrim(service_reference))between 3 and 2000),
 completed_at timestamptz not null,source_hash text not null check(source_hash~'^[a-f0-9]{64}$'),
 created_by uuid not null references auth.users(id),created_at timestamptz not null default clock_timestamp()
);
create table public.benefit_client_receipts_v1(
 id uuid primary key default extensions.gen_random_uuid(),
 proposal_id uuid not null unique references public.benefit_delivery_proposals_v1(id),
 redemption_id uuid not null references public.benefit_redemptions(id),
 organization_id uuid not null references public.organizations(id),
 accepted boolean not null,reason text not null check(length(btrim(reason))between 10 and 2000),
 source_hash text not null,receipt_hash text not null check(receipt_hash~'^[a-f0-9]{64}$'),
 accepted_by uuid not null references auth.users(id),created_at timestamptz not null
);
create index benefit_fulfillment_steps_latest_v1_idx on public.benefit_fulfillment_steps_v1(redemption_id,created_at desc,id desc);
create index benefit_delivery_proposals_latest_v1_idx on public.benefit_delivery_proposals_v1(redemption_id,created_at desc,id desc);
create index benefit_client_receipts_accepted_v1_idx on public.benefit_client_receipts_v1(redemption_id,receipt_hash)where accepted;
create index benefit_redemptions_organization_created_v1_idx on public.benefit_redemptions(organization_id,created_at desc,id);

create function private.benefit_fulfillment_reader_v1(p_org uuid)returns boolean language sql stable security definer set search_path=pg_catalog,private as $$
 select auth.uid()is not null and(private.has_org_role(p_org,array['CLIENT_OWNER','CLIENT_ADMIN','CLIENT_ACCOUNTING'])or(auth.jwt()->>'aal'='aal2'and private.credits_admin_access()))
$$;
revoke all on function private.benefit_fulfillment_reader_v1(uuid)from public,anon,authenticated,service_role;
grant execute on function private.benefit_fulfillment_reader_v1(uuid)to authenticated;
do $$declare t text;begin
 foreach t in array array['benefit_fulfillment_steps_v1','benefit_delivery_proposals_v1','benefit_client_receipts_v1']loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
  execute format('grant select on public.%I to authenticated',t);
  execute format('create policy benefit_fulfillment_scoped_read on public.%I for select to authenticated using(private.benefit_fulfillment_reader_v1(organization_id))',t);
  execute format('create trigger benefit_fulfillment_immutable before update or delete on public.%I for each row execute function private.prevent_update_delete()',t);
 end loop;
end$$;

create function private.benefit_operations_access_v1()returns boolean language sql stable security definer set search_path=pg_catalog,private as $$
 select auth.uid()is not null and auth.jwt()->>'aal'='aal2'and private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN'])and not private.has_platform_role(array['READ_ONLY_AUDITOR'])
$$;
create function private.record_benefit_fulfillment_fact_v1(p_org uuid,p_redemption uuid,p_event text,p_result jsonb,p_key text)returns void language plpgsql security definer set search_path=pg_catalog,public,extensions as $$
declare correlation uuid:=extensions.gen_random_uuid();begin
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)
 values(p_org,auth.uid(),'USER',p_event,'benefit_redemption',p_redemption::text,correlation,p_result,repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)
 values(p_org,'benefit_redemption',p_redemption::text,p_event,correlation,p_result,p_key);
end$$;
revoke all on function private.benefit_operations_access_v1(),private.record_benefit_fulfillment_fact_v1(uuid,uuid,text,jsonb,text)from public,anon,authenticated,service_role;

create function private.benefit_reserved_funding_ready_v1(p_redemption uuid)returns boolean language sql stable security definer set search_path=pg_catalog,public,private as $$
 select exists(select 1 from public.credit_lot_movements where redemption_id=p_redemption and movement_type='RESERVE')
 and not exists(select 1 from public.credit_lot_movements m join public.credit_lots l on l.id=m.credit_lot_id where m.redemption_id=p_redemption and m.movement_type='RESERVE'and(private.credit_lot_funding_status_v1(l.id)is distinct from'ELIGIBLE'or l.expires_at<=statement_timestamp()))
$$;
revoke all on function private.benefit_reserved_funding_ready_v1(uuid)from public,anon,authenticated,service_role;

create function public.advance_benefit_fulfillment_v1(p_redemption_id uuid,p_expected_row_version bigint,p_action text,p_scheduled_for timestamptz,p_reason text,p_idempotency_key text)returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,private set timezone='UTC' as $$
declare d public.benefit_redemptions%rowtype;org uuid;h text;cached jsonb;result jsonb;next_status text;step uuid;scheduled timestamptz;begin
 if not private.benefit_operations_access_v1()then raise exception'BENEFIT_OPERATIONS_MFA_REQUIRED'using errcode='42501';end if;
 select organization_id into org from public.benefit_redemptions where id=p_redemption_id;
 if org is null then raise exception'BENEFIT_FULFILLMENT_DENIED'using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('subscription-financial:'||org::text,0));
 select*into d from public.benefit_redemptions where id=p_redemption_id for update;
 if not private.benefit_operations_access_v1()then raise exception'BENEFIT_OPERATIONS_MFA_REQUIRED'using errcode='42501';end if;
 h:=private.canonical_request_hash(jsonb_build_object('redemption',d.id,'version',p_expected_row_version,'action',p_action,'scheduled_for',p_scheduled_for,'reason',btrim(p_reason)));
 cached:=private.begin_credit_command(org,'benefit.fulfillment.advance',p_idempotency_key,h,auth.uid());if cached is not null then return cached;end if;
 if p_expected_row_version is distinct from d.row_version then raise exception'STALE_BENEFIT_REDEMPTION'using errcode='40001';end if;
 if exists(select 1 from public.benefit_versions where id=d.benefit_version_id and fulfillment_mode='AUTOMATED_PLATFORM')then raise exception'BENEFIT_NATIVE_PLATFORM_EXECUTOR_REQUIRED'using errcode='55000';end if;
 if p_action is null or p_action not in('SCHEDULE','START')or length(btrim(coalesce(p_reason,'')))not between 10 and 2000 then raise exception'INVALID_BENEFIT_FULFILLMENT'using errcode='22023';end if;
 if not exists(select 1 from public.organizations where id=org and status='ACTIVE')or not private.benefit_reserved_funding_ready_v1(d.id)then raise exception'BENEFIT_CURRENT_FUNDING_REQUIRED'using errcode='55000';end if;
 if not private.subscription_financially_clear(org)then raise exception'SUBSCRIPTION_FINANCIAL_HOLD'using errcode='55000';end if;
 if d.reservation_expires_at<=clock_timestamp()then raise exception'BENEFIT_RESERVATION_EXPIRED'using errcode='55000';end if;
 if p_action='SCHEDULE'then
  if d.status not in('RESERVED','SCHEDULED')or p_scheduled_for is null or p_scheduled_for<clock_timestamp()-interval'1 minute'or p_scheduled_for>d.reservation_expires_at then raise exception'INVALID_BENEFIT_SCHEDULE'using errcode='55000';end if;
  next_status:='SCHEDULED';
 else
  select scheduled_for into scheduled from public.benefit_fulfillment_steps_v1 where redemption_id=d.id and action='SCHEDULE'order by created_at desc,id desc limit 1;
  if d.status<>'SCHEDULED'or scheduled is null or scheduled>clock_timestamp()or p_scheduled_for is not null then raise exception'BENEFIT_NOT_READY_TO_START'using errcode='55000';end if;
  next_status:='IN_PROGRESS';
 end if;
 insert into public.benefit_fulfillment_steps_v1(redemption_id,organization_id,action,from_status,to_status,scheduled_for,reason,created_by)
 values(d.id,org,p_action,d.status,next_status,p_scheduled_for,btrim(p_reason),auth.uid())returning id into step;
 update public.benefit_redemptions set status=next_status,updated_at=clock_timestamp(),row_version=row_version+1 where id=d.id;
 result:=jsonb_build_object('outcome',case when p_action='SCHEDULE'then'BENEFIT_SCHEDULED'else'BENEFIT_STARTED'end,'redemption_id',d.id,'step_id',step,'status',next_status,'row_version',(d.row_version+1)::text);
 perform private.record_benefit_fulfillment_fact_v1(org,d.id,case when p_action='SCHEDULE'then'BenefitScheduledV1'else'BenefitStartedV1'end,result,p_idempotency_key);
 perform private.finish_credit_command(org,'benefit.fulfillment.advance',p_idempotency_key,result);return result;
end$$;

create function public.propose_benefit_delivery_v1(p_redemption_id uuid,p_expected_row_version bigint,p_summary text,p_service_reference text,p_completed_at timestamptz,p_idempotency_key text)returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,private set timezone='UTC' as $$
declare d public.benefit_redemptions%rowtype;org uuid;h text;cached jsonb;result jsonb;proposal uuid;started timestamptz;effective_completion timestamptz;proposal_hash text;begin
 if not private.benefit_operations_access_v1()then raise exception'BENEFIT_OPERATIONS_MFA_REQUIRED'using errcode='42501';end if;
 select organization_id into org from public.benefit_redemptions where id=p_redemption_id;
 if org is null then raise exception'BENEFIT_FULFILLMENT_DENIED'using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('subscription-financial:'||org::text,0));
 select*into d from public.benefit_redemptions where id=p_redemption_id for update;
 if not private.benefit_operations_access_v1()then raise exception'BENEFIT_OPERATIONS_MFA_REQUIRED'using errcode='42501';end if;
 h:=private.canonical_request_hash(jsonb_build_object('redemption',d.id,'version',p_expected_row_version,'summary',btrim(p_summary),'reference',btrim(p_service_reference),'completed_at',p_completed_at));
 cached:=private.begin_credit_command(org,'benefit.delivery.propose',p_idempotency_key,h,auth.uid());if cached is not null then return cached;end if;
 if p_expected_row_version is distinct from d.row_version then raise exception'STALE_BENEFIT_REDEMPTION'using errcode='40001';end if;
 if exists(select 1 from public.benefit_versions where id=d.benefit_version_id and fulfillment_mode='AUTOMATED_PLATFORM')then raise exception'BENEFIT_NATIVE_PLATFORM_EXECUTOR_REQUIRED'using errcode='55000';end if;
 if d.status<>'IN_PROGRESS'or length(btrim(coalesce(p_summary,'')))not between 20 and 10000 or length(btrim(coalesce(p_service_reference,'')))not between 3 and 2000 then raise exception'INVALID_BENEFIT_DELIVERY_REPORT'using errcode='22023';end if;
 if exists(select 1 from public.benefit_delivery_proposals_v1 p where p.redemption_id=d.id and not exists(select 1 from public.benefit_client_receipts_v1 r where r.proposal_id=p.id))then raise exception'BENEFIT_CLIENT_REVIEW_PENDING'using errcode='55000';end if;
 select max(created_at)into started from public.benefit_fulfillment_steps_v1 where redemption_id=d.id and action='START';
 -- NULL records completion as attested now, while retaining a stable retry payload.
 effective_completion:=coalesce(p_completed_at,clock_timestamp());
 if started is null or effective_completion<started or effective_completion>clock_timestamp()then raise exception'INVALID_BENEFIT_COMPLETION_TIME'using errcode='22023';end if;
 proposal_hash:=private.canonical_request_hash(jsonb_build_object('redemption_id',d.id,'organization_id',org,'redemption_row_version',d.row_version+1,'summary',btrim(p_summary),'service_reference',btrim(p_service_reference),'completed_at',effective_completion,'operator_user_id',auth.uid()));
 insert into public.benefit_delivery_proposals_v1(redemption_id,organization_id,redemption_row_version,summary,service_reference,completed_at,source_hash,created_by)
 values(d.id,org,d.row_version+1,btrim(p_summary),btrim(p_service_reference),effective_completion,proposal_hash,auth.uid())returning id into proposal;
 update public.benefit_redemptions set updated_at=clock_timestamp(),row_version=row_version+1 where id=d.id;
 result:=jsonb_build_object('outcome','BENEFIT_DELIVERY_REVIEW_REQUIRED','redemption_id',d.id,'proposal_id',proposal,'source_hash',proposal_hash,'row_version',(d.row_version+1)::text,'evidence_kind','OPERATIONAL_REPORT');
 perform private.record_benefit_fulfillment_fact_v1(org,d.id,'BenefitDeliveryProposedV1',result,p_idempotency_key);
 perform private.finish_credit_command(org,'benefit.delivery.propose',p_idempotency_key,result);return result;
end$$;

create function public.decide_my_benefit_delivery_v1(p_proposal_id uuid,p_expected_source_hash text,p_expected_row_version bigint,p_accept boolean,p_reason text,p_idempotency_key text)returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,private set timezone='UTC' as $$
declare d public.benefit_redemptions%rowtype;p public.benefit_delivery_proposals_v1%rowtype;h text;cached jsonb;result jsonb;receipt uuid;decision_hash text;decided_at timestamptz:=clock_timestamp();begin
 select*into p from public.benefit_delivery_proposals_v1 where id=p_proposal_id;
 if p.id is null or auth.uid()is null or auth.jwt()->>'aal'is distinct from'aal2'or not private.has_org_role(p.organization_id,array['CLIENT_OWNER','CLIENT_ADMIN'])or auth.uid()=p.created_by then raise exception'BENEFIT_INDEPENDENT_CLIENT_RECEIPT_REQUIRED'using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('subscription-financial:'||p.organization_id::text,0));
 select*into d from public.benefit_redemptions where id=p.redemption_id for update;
 if not private.has_org_role(p.organization_id,array['CLIENT_OWNER','CLIENT_ADMIN'])then raise exception'BENEFIT_INDEPENDENT_CLIENT_RECEIPT_REQUIRED'using errcode='42501';end if;
 h:=private.canonical_request_hash(jsonb_build_object('proposal',p.id,'source',p_expected_source_hash,'version',p_expected_row_version,'accept',p_accept,'reason',btrim(p_reason)));
 cached:=private.begin_credit_command(p.organization_id,'benefit.delivery.receipt',p_idempotency_key,h,auth.uid());if cached is not null then return cached;end if;
 if p_accept is null or length(btrim(coalesce(p_reason,'')))not between 10 and 2000 then raise exception'INVALID_BENEFIT_RECEIPT'using errcode='22023';end if;
 if p_expected_source_hash is distinct from p.source_hash or p_expected_row_version is distinct from d.row_version or p.redemption_row_version is distinct from d.row_version then raise exception'STALE_BENEFIT_DELIVERY_PROPOSAL'using errcode='40001';end if;
 if d.status<>'IN_PROGRESS'or exists(select 1 from public.benefit_client_receipts_v1 where proposal_id=p.id)then raise exception'BENEFIT_DELIVERY_ALREADY_DECIDED'using errcode='55000';end if;
 decision_hash:=private.canonical_request_hash(jsonb_build_object('redemption_id',d.id,'proposal_id',p.id,'proposal_hash',p.source_hash,'accepted',p_accept,'reason',btrim(p_reason),'accepted_by',auth.uid(),'accepted_at',decided_at));
 insert into public.benefit_client_receipts_v1(proposal_id,redemption_id,organization_id,accepted,reason,source_hash,receipt_hash,accepted_by,created_at)
 values(p.id,d.id,p.organization_id,p_accept,btrim(p_reason),p.source_hash,decision_hash,auth.uid(),decided_at)returning id into receipt;
 update public.benefit_redemptions set status=case when p_accept then'DELIVERED'else status end,delivery_proof_hash=case when p_accept then decision_hash else null end,updated_at=decided_at,row_version=row_version+1 where id=d.id;
 result:=jsonb_build_object('outcome',case when p_accept then'BENEFIT_DELIVERY_ACCEPTED'else'BENEFIT_DELIVERY_REJECTED'end,'redemption_id',d.id,'receipt_id',receipt,'receipt_hash',decision_hash,'status',case when p_accept then'DELIVERED'else d.status end,'row_version',(d.row_version+1)::text);
 perform private.record_benefit_fulfillment_fact_v1(p.organization_id,d.id,case when p_accept then'BenefitDeliveryAcceptedV1'else'BenefitDeliveryRejectedV1'end,result,p_idempotency_key);
 perform private.finish_credit_command(p.organization_id,'benefit.delivery.receipt',p_idempotency_key,result);return result;
end$$;

create function private.benefit_report_hash_v1(p public.benefit_delivery_proposals_v1)returns text language sql immutable set search_path=pg_catalog,private set timezone='UTC' as $$
 select private.canonical_request_hash(jsonb_build_object('redemption_id',(p).redemption_id,'organization_id',(p).organization_id,'redemption_row_version',(p).redemption_row_version,'summary',(p).summary,'service_reference',(p).service_reference,'completed_at',(p).completed_at,'operator_user_id',(p).created_by))
$$;
revoke all on function private.benefit_report_hash_v1(public.benefit_delivery_proposals_v1)from public,anon,authenticated,service_role;

create function private.benefit_accepted_receipt_v1(p_redemption_id uuid,p_proof_hash text)returns jsonb language sql stable security definer set search_path=pg_catalog,public,private set timezone='UTC' as $$
 select jsonb_build_object('redemption_id',d.id,'organization_id',d.organization_id,'receipt_id',r.id,'receipt_hash',r.receipt_hash,'proposal_id',p.id,'proposal_hash',p.source_hash,'operator_user_id',p.created_by,'accepted_by',r.accepted_by,'accepted_at',r.created_at,'status',d.status,'evidence_kind','OPERATIONAL_REPORT_WITH_INDEPENDENT_CLIENT_RECEIPT','fulfillment_mode',b.fulfillment_mode,'native_file_bytes_verified',false,'malware_scan_attested',false)
 from public.benefit_redemptions d join public.benefit_versions b on b.id=d.benefit_version_id and b.fulfillment_mode<>'AUTOMATED_PLATFORM'join public.benefit_client_receipts_v1 r on r.redemption_id=d.id and r.organization_id=d.organization_id and r.accepted
 join public.benefit_delivery_proposals_v1 p on p.id=r.proposal_id and p.redemption_id=d.id and p.organization_id=d.organization_id and p.source_hash=r.source_hash and p.created_by<>r.accepted_by
 where p.source_hash=private.benefit_report_hash_v1(p)and d.id=p_redemption_id and d.status in('DELIVERED','CONSUMED')and d.delivery_proof_hash=p_proof_hash and r.receipt_hash=p_proof_hash
 and r.receipt_hash=private.canonical_request_hash(jsonb_build_object('redemption_id',d.id,'proposal_id',p.id,'proposal_hash',p.source_hash,'accepted',true,'reason',r.reason,'accepted_by',r.accepted_by,'accepted_at',r.created_at))
$$;
revoke all on function private.benefit_accepted_receipt_v1(uuid,text)from public,anon,authenticated,service_role;

create function private.require_benefit_native_client_receipt_v1()returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if tg_op='INSERT'then
  if new.status in('DELIVERED','CONSUMED')then raise exception'BENEFIT_NATIVE_CLIENT_RECEIPT_REQUIRED'using errcode='55000';end if;
  return new;
 end if;
 if new.status in('DELIVERED','CONSUMED')and(new.status is distinct from old.status or new.delivery_proof_hash is distinct from old.delivery_proof_hash)and not exists(
  select 1 from public.benefit_client_receipts_v1 r join public.benefit_delivery_proposals_v1 p on p.id=r.proposal_id and p.redemption_id=r.redemption_id
  where p.source_hash=private.benefit_report_hash_v1(p)and r.redemption_id=new.id and r.organization_id=new.organization_id and r.accepted and r.receipt_hash=new.delivery_proof_hash and r.source_hash=p.source_hash and r.accepted_by<>p.created_by
 )then raise exception'BENEFIT_NATIVE_CLIENT_RECEIPT_REQUIRED'using errcode='55000';end if;
 return new;
end$$;
create trigger benefit_native_client_receipt before insert or update on public.benefit_redemptions for each row execute function private.require_benefit_native_client_receipt_v1();
revoke all on function private.require_benefit_native_client_receipt_v1()from public,anon,authenticated,service_role;

create function public.list_benefit_fulfillment_v1(p_organization_id uuid default null,p_page integer default 1)returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,private set timezone='UTC' as $$
declare total bigint;rows jsonb;central boolean:=auth.jwt()->>'aal'='aal2'and private.credits_admin_access();begin
 if auth.uid()is null or(p_organization_id is null and not coalesce(central,false))or(p_organization_id is not null and not private.benefit_fulfillment_reader_v1(p_organization_id))then raise exception'BENEFIT_FULFILLMENT_DENIED'using errcode='42501';end if;
 if p_page is null or p_page not between 1 and 100000 then raise exception'INVALID_PAGE'using errcode='22023';end if;
 select count(*)into total from public.benefit_redemptions d where p_organization_id is null or d.organization_id=p_organization_id;
 select coalesce(jsonb_agg(jsonb_build_object(
 'id',d.id,'organization_id',d.organization_id,'organization_name',o.display_name,'name_fr',b.name_fr,'name_ar',b.name_ar,
 'status',d.status,'row_version',d.row_version::text,'units',d.units::text,'reserved_credits',d.reserved_credits::text,'reservation_expires_at',d.reservation_expires_at,'delivery_proof_hash',d.delivery_proof_hash,
 'can_operate',private.benefit_operations_access_v1()and b.fulfillment_mode<>'AUTOMATED_PLATFORM','execution_requires_native',b.fulfillment_mode='AUTOMATED_PLATFORM','funding_ready',private.benefit_reserved_funding_ready_v1(d.id),
 'can_receive',auth.jwt()->>'aal'='aal2'and private.has_org_role(d.organization_id,array['CLIENT_OWNER','CLIENT_ADMIN'])and d.status='IN_PROGRESS'and p.id is not null and r.id is null and p.created_by<>auth.uid()and p.redemption_row_version=d.row_version,
 'receipt_requires_mfa',coalesce(auth.jwt()->>'aal','aal1')<>'aal2'and private.has_org_role(d.organization_id,array['CLIENT_OWNER','CLIENT_ADMIN'])and d.status='IN_PROGRESS'and p.id is not null and r.id is null and p.created_by<>auth.uid()and p.redemption_row_version=d.row_version,
 'scheduled_for',(select scheduled_for from public.benefit_fulfillment_steps_v1 where redemption_id=d.id and action='SCHEDULE'order by created_at desc,id desc limit 1),
 'proposal',case when p.id is null then null else jsonb_build_object('id',p.id,'source_hash',p.source_hash,'summary',p.summary,'service_reference',p.service_reference,'completed_at',p.completed_at)end,
 'receipt',case when r.id is null then null else jsonb_build_object('id',r.id,'accepted',r.accepted,'reason',r.reason,'receipt_hash',r.receipt_hash,'created_at',r.created_at)end
 )order by d.created_at desc,d.id),'[]')into rows from(select*from public.benefit_redemptions where p_organization_id is null or organization_id=p_organization_id order by created_at desc,id limit 25 offset((p_page-1)*25))d
 join public.benefit_versions b on b.id=d.benefit_version_id join public.organizations o on o.id=d.organization_id
 left join lateral(select*from public.benefit_delivery_proposals_v1 where redemption_id=d.id order by created_at desc,id desc limit 1)p on true
 left join public.benefit_client_receipts_v1 r on r.proposal_id=p.id;
 return jsonb_build_object('rows',rows,'page',p_page,'has_next',p_page::bigint*25<total,'total',total::text);
end$$;
revoke all on function public.list_benefit_fulfillment_v1(uuid,integer)from public,anon,authenticated,service_role;
grant execute on function public.list_benefit_fulfillment_v1(uuid,integer)to authenticated;

revoke all on function public.advance_benefit_fulfillment_v1(uuid,bigint,text,timestamptz,text,text),public.propose_benefit_delivery_v1(uuid,bigint,text,text,timestamptz,text),public.decide_my_benefit_delivery_v1(uuid,text,bigint,boolean,text,text)from public,anon,authenticated,service_role;
grant execute on function public.advance_benefit_fulfillment_v1(uuid,bigint,text,timestamptz,text,text),public.propose_benefit_delivery_v1(uuid,bigint,text,text,timestamptz,text),public.decide_my_benefit_delivery_v1(uuid,text,bigint,boolean,text,text)to authenticated;
notify pgrst,'reload schema';
commit;
