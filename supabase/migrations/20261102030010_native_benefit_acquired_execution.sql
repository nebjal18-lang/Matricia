begin;
-- Bind the implementation promised with the immutable pre-PSP Box terms, not
-- whichever implementation happens to be the latest when the member executes.
create or replace function private.box_benefit_policy_snapshot_v1(p_version uuid)returns jsonb
language sql stable security definer set search_path=pg_catalog,private as $$
 select jsonb_build_object('policy_id',p.id,'content_hash',p.content_hash,'source_hash',p.source_hash,'effective_from',p.effective_from,'effective_until',p.effective_until,
 'quota_scope',p.quota_scope,'quota_units',p.quota_units::text,'capacity_units',p.capacity_units::text,'fulfillment_evidence_kind',p.fulfillment_evidence_kind,
 'cancellation_rule_version',p.source_snapshot->>'cancellation_rule_version','fulfillment_mode',p.source_snapshot->>'fulfillment_mode',
 'native_binding',case when n.id is not null then jsonb_build_object('id',n.id,'content_hash',n.content_hash,'source_hash',n.source_hash,'executor',n.executor,'config',n.config)end)
 from public.benefit_admission_policy_versions_v1 p join public.benefit_admission_policy_decisions_v1 d on d.policy_id=p.id and d.decision='APPROVE'and d.content_hash=p.content_hash and d.decided_by<>p.created_by
 left join lateral(select *from private.benefit_native_binding_v1(p_version))n on true
 where p.benefit_version_id=p_version and p.effective_from<=statement_timestamp()and(p.effective_until is null or p.effective_until>statement_timestamp())
 and p.source_hash=private.canonical_request_hash(private.benefit_admission_source_v1(p_version))order by p.version desc limit 1
$$;

create table public.benefit_native_execution_sources_v1(
 redemption_id uuid primary key references public.benefit_redemptions(id),organization_id uuid not null references public.organizations(id),
 benefit_version_id uuid not null references public.benefit_versions(id),binding_id uuid not null references public.benefit_native_bindings_v1(id),
 customer_box_id uuid references public.customer_boxes(id),binding_hash text not null check(binding_hash~'^[a-f0-9]{64}$'),
 binding_snapshot jsonb not null check(jsonb_typeof(binding_snapshot)='object'),source_hash text not null check(source_hash~'^[a-f0-9]{64}$'),
 created_by uuid not null references auth.users(id),created_at timestamptz not null default clock_timestamp()
);
alter table public.benefit_native_execution_sources_v1 enable row level security;
revoke all on public.benefit_native_execution_sources_v1 from public,anon,authenticated,service_role;
create trigger benefit_native_execution_source_immutable before update or delete on public.benefit_native_execution_sources_v1
for each row execute function private.prevent_update_delete();

create function private.box_native_binding_source_v1(p_org uuid,p_version uuid,p_cycle uuid,p_at timestamptz)returns jsonb
language sql stable security definer set search_path=pg_catalog,private as $$
 select jsonb_build_object('customer_box_id',cb.id,'binding',benefit#>'{admission_policy,native_binding}')
 from public.customer_boxes cb join public.customer_box_funding_sources_v1 f on f.customer_box_id=cb.id and f.organization_id=cb.organization_id
 join public.box_configuration_approvals_v1 approval on approval.id=f.approval_id
 cross join lateral jsonb_array_elements(approval.source_snapshot->'slots')slot
 cross join lateral jsonb_array_elements(slot->'benefits')benefit
 where cb.organization_id=p_org and f.cycle_id=p_cycle and cb.period_start<=p_at and cb.period_end>p_at
 and benefit->>'id'=p_version::text and exists(select 1 from jsonb_array_elements(cb.selections_snapshot)s where s->>'benefit_version_id'=p_version::text)
 and private.box_checkout_promise_matches_v1(f.context_snapshot,f.payment_event_id,approval.id)
 and private.benefit_customer_box_evidence_v1(p_org,p_cycle,array[cb.box_version_id],p_at)->>'customer_box_id'=cb.id::text
 order by cb.created_at,cb.id limit 1
$$;

create function private.freeze_native_benefit_reservation_v1()returns trigger
language plpgsql security definer set search_path=pg_catalog,private as $$
declare b public.benefit_versions%rowtype;admission public.benefit_redemption_admissions_v1%rowtype;
 promised jsonb;binding public.benefit_native_bindings_v1%rowtype;expected jsonb;box_id uuid;source jsonb;
begin
 select*into b from public.benefit_versions where id=new.benefit_version_id;
 if b.fulfillment_mode not in('AUTOMATED_PLATFORM','SUBCONTRACTOR_POOL','VOLUME_POOL','RFQ')then return new;end if;
 select*into admission from public.benefit_redemption_admissions_v1 where redemption_id=new.id;
 if admission.redemption_id is null then raise exception'BENEFIT_RESERVATION_ADMISSION_REQUIRED'using errcode='55000';end if;
 promised:=private.box_native_binding_source_v1(new.organization_id,new.benefit_version_id,admission.subscription_cycle_id,admission.admitted_at);
 if promised is not null then
  expected:=promised->'binding';box_id:=(promised->>'customer_box_id')::uuid;
  if expected is null or expected='null'::jsonb then raise exception'ACQUIRED_BENEFIT_NATIVE_BINDING_REVIEW_REQUIRED'using errcode='55000';end if;
  select n.*into binding from public.benefit_native_bindings_v1 n
   join public.benefit_native_binding_decisions_v1 d on d.binding_id=n.id and d.approved and d.decided_by<>n.created_by and d.content_hash=n.content_hash
   where n.id=(expected->>'id')::uuid and n.benefit_version_id=b.id and n.content_hash=expected->>'content_hash'
   and n.source_hash=expected->>'source_hash'and n.executor=expected->>'executor'and n.config=expected->'config';
 else
  -- Direct, non-Box benefit reservations pin the approved implementation at the
  -- instant of reservation. No previously purchased Box promise is invented.
  binding:=private.benefit_native_binding_v1(b.id);
 end if;
 if binding.id is null or binding.source_hash is distinct from private.canonical_request_hash(private.benefit_admission_source_v1(b.id))then raise exception'BENEFIT_NATIVE_BINDING_REVIEW_REQUIRED'using errcode='55000';end if;
 source:=jsonb_build_object('redemption_id',new.id,'benefit_version_id',b.id,'customer_box_id',box_id,'binding_id',binding.id,'binding_hash',binding.content_hash,'executor',binding.executor,'config',binding.config);
 insert into public.benefit_native_execution_sources_v1(redemption_id,organization_id,benefit_version_id,binding_id,customer_box_id,binding_hash,binding_snapshot,source_hash,created_by)
 values(new.id,new.organization_id,b.id,binding.id,box_id,binding.content_hash,source,private.canonical_request_hash(source),new.created_by);
 return new;
end$$;
create trigger zzz_freeze_native_benefit_reservation after insert on public.benefit_redemptions
for each row execute function private.freeze_native_benefit_reservation_v1();

create function private.reserved_benefit_native_binding_v1(p_redemption_id uuid)returns public.benefit_native_bindings_v1
language sql stable security definer set search_path=pg_catalog,private as $$
 select n from public.benefit_native_execution_sources_v1 s
 join public.benefit_redemptions r on r.id=s.redemption_id and r.organization_id=s.organization_id and r.benefit_version_id=s.benefit_version_id
 join public.benefit_native_bindings_v1 n on n.id=s.binding_id and n.benefit_version_id=s.benefit_version_id and n.content_hash=s.binding_hash
 join public.benefit_native_binding_decisions_v1 d on d.binding_id=n.id and d.approved and d.decided_by<>n.created_by and d.content_hash=n.content_hash
 where s.redemption_id=p_redemption_id and s.source_hash=private.canonical_request_hash(s.binding_snapshot)
 and s.binding_snapshot->>'binding_id'=n.id::text and s.binding_snapshot->>'binding_hash'=n.content_hash
 and s.binding_snapshot->>'executor'=n.executor and s.binding_snapshot->'config'=n.config
 and n.source_hash=private.canonical_request_hash(private.benefit_admission_source_v1(r.benefit_version_id))
$$;

-- Every side effect revalidates the live actor after all lock waits, then uses
-- the exact implementation acquired/pinned earlier. Changing a later binding
-- cannot change a pending or paid obligation.
do $$declare d text;needle text;begin
 d:=pg_get_functiondef('public.execute_benefit_native_v1(uuid,bigint,jsonb,text)'::regprocedure);
 needle:='select*into r from public.benefit_redemptions where id=p_redemption_id for update;';
 if strpos(d,needle)=0 then raise exception'BENEFIT_NATIVE_LOCK_RECHECK_SOURCE_MISMATCH';end if;
 d:=replace(d,needle,needle||chr(10)||' if r.id is null or auth.uid()is null or auth.jwt()->>''aal''is distinct from''aal2''or not(private.has_org_role(r.organization_id,array[''CLIENT_OWNER'',''CLIENT_ADMIN'',''CLIENT_BUYER''])or private.benefit_operations_access_v1())then raise exception''BENEFIT_NATIVE_EXECUTION_DENIED''using errcode=''42501'';end if;');
 needle:='binding:=private.benefit_native_binding_v1(b.id);';
 if strpos(d,needle)=0 then raise exception'BENEFIT_NATIVE_ACQUIRED_SOURCE_MISMATCH';end if;
 d:=replace(d,needle,'binding:=private.reserved_benefit_native_binding_v1(r.id);');
 execute d;
 d:=pg_get_functiondef('public.decide_benefit_native_binding_v1(uuid,text,boolean,text)'::regprocedure);
 needle:='select*into b from public.benefit_native_bindings_v1 where id=p_binding_id for update;';
 if strpos(d,needle)=0 then raise exception'BENEFIT_NATIVE_BINDING_RECHECK_SOURCE_MISMATCH';end if;
 d:=replace(d,needle,needle||'if not coalesce(private.benefit_admission_staff_v1(),false)then raise exception''BENEFIT_NATIVE_CONFIGURATION_DENIED''using errcode=''42501'';end if;');
 execute d;
end$$;

-- It is safe to show an unconfigured draft, but not to authorize its first PSP
-- call. Validate all advertised choices, including optional Box slots.
do $$declare d text;needle text;begin
 d:=pg_get_functiondef('private.freeze_subscription_box_checkout_terms_v1()'::regprocedure);
 needle:='if jsonb_array_length(options)=0 then raise exception''BOX_CHECKOUT_POLICY_REQUIRED''using errcode=''55000'';end if;';
 if strpos(d,needle)=0 then raise exception'BOX_CHECKOUT_EXECUTION_POLICY_SOURCE_MISMATCH';end if;
 d:=replace(d,needle,needle||chr(10)||' if exists(select 1 from jsonb_array_elements(options)option cross join lateral jsonb_array_elements(option#>''{source_snapshot,slots}'')slot cross join lateral jsonb_array_elements(slot->''benefits'')benefit where benefit->''admission_policy''is null or benefit->''admission_policy''=''null''::jsonb or(benefit#>>''{admission_policy,fulfillment_mode}''in(''AUTOMATED_PLATFORM'',''SUBCONTRACTOR_POOL'',''VOLUME_POOL'',''RFQ'')and(benefit#>''{admission_policy,native_binding}''is null or benefit#>''{admission_policy,native_binding}''=''null''::jsonb)))then raise exception''BOX_BENEFIT_EXECUTION_POLICY_REQUIRED''using errcode=''55000'';end if;');
 execute d;
end$$;
revoke all on function private.box_benefit_policy_snapshot_v1(uuid),private.box_native_binding_source_v1(uuid,uuid,uuid,timestamptz),private.freeze_native_benefit_reservation_v1(),private.reserved_benefit_native_binding_v1(uuid)from public,anon,authenticated,service_role;
notify pgrst,'reload schema';
commit;
