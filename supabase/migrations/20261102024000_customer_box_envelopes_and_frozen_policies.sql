begin;
-- Typed Boxes keep the same governed funding and immutable selection contract.
-- Allocations are spending ceilings, not a second credit balance or new grants.
create table public.customer_box_envelope_versions_v1(
 id uuid primary key default extensions.gen_random_uuid(),customer_box_id uuid not null references public.customer_boxes(id),
 organization_id uuid not null references public.organizations(id),scope text not null check(scope in('MEMBER','LIBRARY')),
 target_id uuid not null,version integer not null check(version>0),credit_limit bigint not null check(credit_limit>=0),
 created_by uuid not null references auth.users(id),created_at timestamptz not null default clock_timestamp(),
 reason text not null check(length(btrim(reason))between 5 and 1000),unique(customer_box_id,scope,target_id,version)
);
create table public.customer_box_redemption_allocations_v1(
 redemption_id uuid primary key references public.benefit_redemptions(id),customer_box_id uuid not null references public.customer_boxes(id),
 organization_id uuid not null references public.organizations(id),envelope_version_id uuid not null references public.customer_box_envelope_versions_v1(id),
 allocated_credits bigint not null check(allocated_credits>0),created_at timestamptz not null default clock_timestamp()
);
alter table public.customer_box_envelope_versions_v1 enable row level security;
alter table public.customer_box_redemption_allocations_v1 enable row level security;
revoke all on public.customer_box_envelope_versions_v1,public.customer_box_redemption_allocations_v1 from public,anon,authenticated,service_role;
create trigger customer_box_envelope_immutable before update or delete on public.customer_box_envelope_versions_v1 for each row execute function private.prevent_update_delete();
create trigger customer_box_redemption_allocation_immutable before update or delete on public.customer_box_redemption_allocations_v1 for each row execute function private.prevent_update_delete();
create index customer_box_envelope_head_idx on public.customer_box_envelope_versions_v1(customer_box_id,scope,target_id,version desc);

-- Snapshot approved admission policies in the offer before any PSP operation.
-- New rules need independent approval of this enriched source. No old approval
-- is rewritten and no policy is invented for an historical acquisition.
do $$declare d text;begin
 d:=pg_get_functiondef('private.box_configuration_source_v1(uuid)'::regprocedure);
 if position('or b.box_type in(''MULTI_USER'',''MULTI_LIBRARY'')'in d)=0 then raise exception'BOX_TYPED_SOURCE_PATCH_MISMATCH';end if;
 d:=replace(d,'or b.box_type in(''MULTI_USER'',''MULTI_LIBRARY'')','');
 d:=replace(d,'''library_id'',v.library_id)', '''library_id'',v.library_id,''admission_policy'',private.box_benefit_policy_snapshot_v1(v.id))');
 -- This replacement is compiled after the helper below exists.
 perform set_config('matricia.box_source_definition',d,true);
end$$;
create function private.box_benefit_policy_snapshot_v1(p_version uuid)returns jsonb
language sql stable security definer set search_path=pg_catalog,public,private as $$
 select jsonb_build_object('policy_id',p.id,'content_hash',p.content_hash,'source_hash',p.source_hash,'effective_from',p.effective_from,'effective_until',p.effective_until,
 'quota_scope',p.quota_scope,'quota_units',p.quota_units::text,'capacity_units',p.capacity_units::text,'fulfillment_evidence_kind',p.fulfillment_evidence_kind,
 'cancellation_rule_version',p.source_snapshot->>'cancellation_rule_version')
 from public.benefit_admission_policy_versions_v1 p join public.benefit_admission_policy_decisions_v1 d on d.policy_id=p.id and d.decision='APPROVE'and d.content_hash=p.content_hash and d.decided_by<>p.created_by
 where p.benefit_version_id=p_version and p.effective_from<=statement_timestamp()and(p.effective_until is null or p.effective_until>statement_timestamp())
 and p.source_hash=private.canonical_request_hash(private.benefit_admission_source_v1(p_version))order by p.version desc limit 1
$$;
do $$begin execute current_setting('matricia.box_source_definition');end$$;

create function private.customer_box_envelope_used_v1(p_box uuid,p_scope text,p_target uuid,p_exclude uuid default null)returns numeric
language sql stable security definer set search_path=pg_catalog,public as $$
 select coalesce(sum(a.allocated_credits),0)from public.customer_box_redemption_allocations_v1 a
 join public.customer_box_envelope_versions_v1 e on e.id=a.envelope_version_id join public.benefit_redemptions r on r.id=a.redemption_id
 where a.customer_box_id=p_box and e.scope=p_scope and e.target_id=p_target and r.id is distinct from p_exclude
 and r.status in('RESERVED','SCHEDULED','IN_PROGRESS','DELIVERED','CONSUMED')
$$;
create function public.set_customer_box_envelope_v1(p_customer_box_id uuid,p_scope text,p_target_id uuid,p_expected_version integer,p_credit_limit bigint,p_reason text,p_idempotency_key text)returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare b public.customer_boxes%rowtype;v public.box_versions%rowtype;head public.customer_box_envelope_versions_v1%rowtype;allocated numeric;used numeric;h text;r jsonb;new_id uuid;begin
 select*into b from public.customer_boxes where id=p_customer_box_id;
 if b.id is null or auth.uid()is null or auth.jwt()->>'aal'is distinct from'aal2'or not private.has_org_role(b.organization_id,array['CLIENT_OWNER','CLIENT_ADMIN'])then raise exception'BOX_ENVELOPE_MANAGE_DENIED'using errcode='42501';end if;
 if p_scope is null or p_scope not in('MEMBER','LIBRARY')or p_target_id is null or p_expected_version is null or p_expected_version<0 or p_credit_limit is null or p_credit_limit<0 or length(btrim(coalesce(p_reason,'')))not between 5 and 1000 then raise exception'INVALID_BOX_ENVELOPE'using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('subscription-financial:'||b.organization_id::text,0));
 perform id from public.organizations where id=b.organization_id and status='ACTIVE'for share;
 if not found or auth.jwt()->>'aal'is distinct from'aal2'or not private.has_org_role(b.organization_id,array['CLIENT_OWNER','CLIENT_ADMIN'])then raise exception'BOX_ENVELOPE_MANAGE_DENIED'using errcode='42501';end if;
 select*into v from public.box_versions where id=b.box_version_id;
 h:=private.canonical_request_hash(jsonb_build_object('box',b.id,'scope',p_scope,'target',p_target_id,'version',p_expected_version,'limit',p_credit_limit::text,'reason',btrim(p_reason)));
 r:=private.begin_credit_command(b.organization_id,'customer.box.envelope',p_idempotency_key,h,auth.uid());if r is not null then return r;end if;
 if b.period_start>clock_timestamp()or b.period_end<=clock_timestamp()or not exists(select 1 from public.customer_box_funding_sources_v1 where customer_box_id=b.id)then raise exception'BOX_ENVELOPE_FUNDED_PERIOD_REQUIRED'using errcode='55000';end if;
 if(p_scope='MEMBER'and v.box_type<>'MULTI_USER')or(p_scope='LIBRARY'and v.box_type<>'MULTI_LIBRARY')then raise exception'BOX_ENVELOPE_SCOPE_MISMATCH'using errcode='23514';end if;
 if p_credit_limit>0 and p_scope='MEMBER'and not exists(select 1 from public.organization_memberships m where m.organization_id=b.organization_id and m.user_id=p_target_id and m.status='ACTIVE'and exists(select 1 from public.organization_member_roles mr where mr.membership_id=m.id and mr.revoked_at is null and mr.role_code in('CLIENT_OWNER','CLIENT_ADMIN','CLIENT_BUYER','CLIENT_ACCOUNTING')))then raise exception'BOX_ENVELOPE_ACTIVE_MEMBER_REQUIRED'using errcode='23514';end if;
 if p_scope='LIBRARY'and not exists(select 1 from jsonb_array_elements(b.selections_snapshot)s where s->>'library_id'=p_target_id::text)then raise exception'BOX_ENVELOPE_LIBRARY_NOT_SELECTED'using errcode='23514';end if;
 select*into head from public.customer_box_envelope_versions_v1 where customer_box_id=b.id and scope=p_scope and target_id=p_target_id order by version desc limit 1;
 if coalesce(head.version,0)<>p_expected_version then raise exception'STALE_BOX_ENVELOPE'using errcode='40001';end if;
 used:=private.customer_box_envelope_used_v1(b.id,p_scope,p_target_id);
 if used>p_credit_limit then raise exception'BOX_ENVELOPE_COMMITTED_CREDITS_REQUIRED'using errcode='23514';end if;
 select coalesce(sum(credit_limit),0)into allocated from(select distinct on(target_id)target_id,credit_limit from public.customer_box_envelope_versions_v1 where customer_box_id=b.id and scope=p_scope and target_id<>p_target_id order by target_id,version desc)latest;
 if allocated+p_credit_limit>v.credit_budget then raise exception'BOX_ENVELOPE_TOTAL_BUDGET_EXCEEDED'using errcode='23514';end if;
 insert into public.customer_box_envelope_versions_v1(customer_box_id,organization_id,scope,target_id,version,credit_limit,created_by,reason)
 values(b.id,b.organization_id,p_scope,p_target_id,p_expected_version+1,p_credit_limit,auth.uid(),btrim(p_reason))returning id into new_id;
 r:=jsonb_build_object('outcome','BOX_ENVELOPE_SAVED','envelope_id',new_id,'version',p_expected_version+1,'credit_limit',p_credit_limit::text);
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(b.organization_id,auth.uid(),'USER','customer.box.envelope_saved','customer_box',b.id::text,extensions.gen_random_uuid(),r,repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values(b.organization_id,'customer_box',b.id::text,'CustomerBoxEnvelopeSavedV1',extensions.gen_random_uuid(),r,p_idempotency_key);
 perform private.finish_credit_command(b.organization_id,'customer.box.envelope',p_idempotency_key,r);return r;
end$$;

-- Every native reservation is checked, including callers bypassing the UI.
-- Existing global wallet/FEFO allocation remains the only money authority.
create function private.enforce_customer_box_envelope_v1()returns trigger
language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare b public.customer_boxes%rowtype;v public.box_versions%rowtype;e public.customer_box_envelope_versions_v1%rowtype;s text;target uuid;library uuid;spent numeric;allowed numeric;begin
 select cb.*into b from public.customer_boxes cb join public.customer_box_funding_sources_v1 f on f.customer_box_id=cb.id
 where cb.organization_id=new.organization_id and cb.period_start<=clock_timestamp()and cb.period_end>clock_timestamp()
 and exists(select 1 from jsonb_array_elements(cb.selections_snapshot)x where x->>'benefit_version_id'=new.benefit_version_id::text)
 order by cb.created_at desc,cb.id limit 1;
 if b.id is null then return new;end if;
 select*into v from public.box_versions where id=b.box_version_id;
 if v.box_type not in('MULTI_USER','MULTI_LIBRARY')then return new;end if;
 perform pg_advisory_xact_lock(hashtextextended('subscription-financial:'||new.organization_id::text,0));
 select coalesce(sum((x->>'units')::numeric),0)into allowed from jsonb_array_elements(b.selections_snapshot)x where x->>'benefit_version_id'=new.benefit_version_id::text;
 select coalesce(sum(r.units),0)into spent from public.benefit_redemptions r join public.customer_box_redemption_allocations_v1 a on a.redemption_id=r.id where a.customer_box_id=b.id and r.benefit_version_id=new.benefit_version_id and r.status in('RESERVED','SCHEDULED','IN_PROGRESS','DELIVERED','CONSUMED');
 if spent+new.units>allowed then raise exception'BOX_SELECTED_UNITS_EXCEEDED'using errcode='23514';end if;
 if v.box_type='MULTI_USER'then s:='MEMBER';target:=new.created_by;
 else s:='LIBRARY';select library_id into target from public.benefit_versions where id=new.benefit_version_id;end if;
 select*into e from public.customer_box_envelope_versions_v1 where customer_box_id=b.id and scope=s and target_id=target order by version desc limit 1;
 if e.id is null or private.customer_box_envelope_used_v1(b.id,s,target)+new.reserved_credits>e.credit_limit then raise exception'BOX_ENVELOPE_INSUFFICIENT_AVAILABLE'using errcode='23514';end if;
 insert into public.customer_box_redemption_allocations_v1(redemption_id,customer_box_id,organization_id,envelope_version_id,allocated_credits)values(new.id,b.id,new.organization_id,e.id,new.reserved_credits);
 return new;
end$$;
-- Runs after existing admission trigger; neither can replace the other.
create trigger zz_customer_box_envelope_guard after insert on public.benefit_redemptions for each row execute function private.enforce_customer_box_envelope_v1();

create function public.get_customer_box_envelopes_v1(p_customer_box_id uuid)returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,public,private as $$
declare b public.customer_boxes%rowtype;kind text;items jsonb;targets jsonb;begin
 select*into b from public.customer_boxes where id=p_customer_box_id;
 if b.id is null or auth.uid()is null or not private.credits_client_access(b.organization_id)then raise exception'BOX_ENVELOPE_READ_DENIED'using errcode='42501';end if;
 select box_type into kind from public.box_versions where id=b.box_version_id;
 select coalesce(jsonb_agg(jsonb_build_object('target_id',e.target_id,'version',e.version,'credit_limit',e.credit_limit::text,'used',private.customer_box_envelope_used_v1(b.id,e.scope,e.target_id)::text)order by e.target_id),'[]')into items
 from(select distinct on(scope,target_id)*from public.customer_box_envelope_versions_v1 where customer_box_id=b.id order by scope,target_id,version desc)e;
 if kind='MULTI_USER'then
 select coalesce(jsonb_agg(jsonb_build_object('id',m.user_id,'name',coalesce(p.display_name,'Membre / عضو'))order by m.activated_at,m.id),'[]')into targets from public.organization_memberships m left join public.user_profiles p on p.id=m.user_id where m.organization_id=b.organization_id and m.status='ACTIVE'and exists(select 1 from public.organization_member_roles r where r.membership_id=m.id and r.revoked_at is null and r.role_code in('CLIENT_OWNER','CLIENT_ADMIN','CLIENT_BUYER','CLIENT_ACCOUNTING'));
 elsif kind='MULTI_LIBRARY'then
 select coalesce(jsonb_agg(jsonb_build_object('id',l.id,'name',coalesce(lv.name_fr,l.code),'name_ar',coalesce(lv.name_ar,l.code))order by l.id),'[]')into targets from public.catalog_libraries l left join public.catalog_library_versions lv on lv.id=l.current_published_version_id where l.id in(select(x->>'library_id')::uuid from jsonb_array_elements(b.selections_snapshot)x where x->>'library_id'is not null);
 else targets:='[]';end if;
 return jsonb_build_object('box_id',b.id,'box_type',kind,'scope',case kind when'MULTI_USER'then'MEMBER'when'MULTI_LIBRARY'then'LIBRARY'else null end,'targets',targets,'envelopes',items,'can_manage',auth.jwt()->>'aal'='aal2'and private.has_org_role(b.organization_id,array['CLIENT_OWNER','CLIENT_ADMIN']));
end$$;
revoke all on function private.box_benefit_policy_snapshot_v1(uuid),private.customer_box_envelope_used_v1(uuid,text,uuid,uuid),private.enforce_customer_box_envelope_v1(),public.set_customer_box_envelope_v1(uuid,text,uuid,integer,bigint,text,text),public.get_customer_box_envelopes_v1(uuid)from public,anon,authenticated,service_role;
grant execute on function public.set_customer_box_envelope_v1(uuid,text,uuid,integer,bigint,text,text),public.get_customer_box_envelopes_v1(uuid)to authenticated;
notify pgrst,'reload schema';
commit;
