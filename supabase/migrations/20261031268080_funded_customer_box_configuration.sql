begin;
-- A real Box with slots previously failed with 42702: the loop variable
-- collided with the INSERT's SQL alias. Preserve the existing function OID.
do $$declare definition text;loop_start integer;loop_end integer;section text;begin
 definition:=pg_get_functiondef('public.create_box_version(uuid,text,text,text,text,bigint,integer,jsonb,bigint,bigint,bigint,text,timestamptz,jsonb,text,uuid)'::regprocedure);
 if position('  slot jsonb;'in definition)=0 or position('  for slot in select'in definition)=0 then raise exception'BOX_SLOT_ALIAS_PATCH_MISMATCH';end if;
 definition:=replace(definition,'  slot jsonb;','  candidate_slot jsonb;');
 loop_start:=position('  for slot in select'in definition);loop_end:=position('  hid :='in substring(definition from loop_start));
 if loop_end=0 then raise exception'BOX_SLOT_LOOP_PATCH_MISMATCH';end if;
 section:=substring(definition from loop_start for loop_end-1);
 definition:=replace(definition,section,regexp_replace(section,'\mslot\M','candidate_slot','g'));
 execute definition;
end$$;

-- Configuration does not mint, reserve or consume credits. One immutable Box
-- configuration is admitted by an exact funded cycle and a pre-approved source.
create table public.box_configuration_approvals_v1(
 id uuid primary key default extensions.gen_random_uuid(),plan_box_rule_id uuid not null unique references public.plan_box_rules(id),
 source_snapshot jsonb not null check(jsonb_typeof(source_snapshot)='object'),source_hash text not null check(source_hash~'^[0-9a-f]{64}$'),
 approved_by uuid not null references auth.users(id),approved_at timestamptz not null default clock_timestamp(),reason text not null check(length(btrim(reason))between 10 and 2000)
);
create table public.customer_box_funding_sources_v1(
 customer_box_id uuid primary key references public.customer_boxes(id),organization_id uuid not null references public.organizations(id),
 cycle_id uuid not null unique references public.subscription_cycles(id),payment_event_id bigint not null references public.subscription_payment_events(id),
 approval_id uuid not null references public.box_configuration_approvals_v1(id),context_snapshot jsonb not null,context_hash text not null check(context_hash~'^[0-9a-f]{64}$'),
 created_at timestamptz not null default clock_timestamp()
);
alter table public.box_configuration_approvals_v1 enable row level security;
alter table public.customer_box_funding_sources_v1 enable row level security;
revoke all on public.box_configuration_approvals_v1,public.customer_box_funding_sources_v1 from public,anon,authenticated,service_role;
create trigger box_configuration_approval_immutable before update or delete on public.box_configuration_approvals_v1 for each row execute function private.prevent_update_delete();
create trigger customer_box_funding_source_immutable before update or delete on public.customer_box_funding_sources_v1 for each row execute function private.prevent_update_delete();

create function private.box_configuration_source_v1(p_rule_id uuid)returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,private as $$
declare r public.plan_box_rules%rowtype;b public.box_versions%rowtype;slots jsonb;link_actor uuid;begin
 select*into r from public.plan_box_rules where id=p_rule_id;
 select*into b from public.box_versions where id=r.box_version_id;
 if r.id is null or b.id is null then raise exception'BOX_CONFIGURATION_SOURCE_REQUIRED'using errcode='55000';end if;
 if jsonb_typeof(r.rule_snapshot)is distinct from'object'or(r.rule_snapshot-'schema_version'-'period_unit'-'budget_rule')<>'{}'::jsonb
 or r.rule_snapshot->>'schema_version'is distinct from'1'or r.rule_snapshot->>'period_unit'is distinct from'SUBSCRIPTION_CYCLE'
 or coalesce(r.rule_snapshot->>'budget_rule','')not in('AT_MOST','EXACT')or b.rules_snapshot<>'{}'::jsonb
 or b.box_type in('MULTI_USER','MULTI_LIBRARY')then raise exception'BOX_TYPED_CONFIGURATION_REQUIRED'using errcode='55000';end if;
 select e.actor_user_id into link_actor from public.audit_events e where e.action='admin.plan_box.linked'and e.resource_type='plan_box_rule'and e.resource_id=r.id::text order by e.id limit 1;
 if link_actor is null then raise exception'BOX_RULE_AUTHORSHIP_REQUIRED'using errcode='55000';end if;
 if not exists(select 1 from public.box_slots where box_version_id=b.id)
 or exists(select 1 from public.box_slots s where s.box_version_id=b.id and(cardinality(s.allowed_benefit_version_ids)=0 or cardinality(s.allowed_benefit_version_ids)<>(select count(distinct x)from unnest(s.allowed_benefit_version_ids)x)
  or s.maximum_selections>cardinality(s.allowed_benefit_version_ids)or(s.slot_kind='MANDATORY'and s.minimum_selections=0)
  or(b.box_type='FIXED'and(s.minimum_selections<>cardinality(s.allowed_benefit_version_ids)or s.maximum_selections<>s.minimum_selections))
  or exists(select 1 from unnest(s.allowed_benefit_version_ids)x left join public.benefit_versions v on v.id=x where v.id is null or v.currency<>b.currency)))
 then raise exception'BOX_SLOT_CONFIGURATION_INVALID'using errcode='55000';end if;
 select jsonb_agg(jsonb_build_object('slot_code',s.slot_code,'slot_kind',s.slot_kind,'minimum_selections',s.minimum_selections,'maximum_selections',s.maximum_selections,
 'benefits',(select jsonb_agg(jsonb_build_object('id',v.id,'content_hash',v.content_hash,'name_fr',v.name_fr,'name_ar',v.name_ar,'credit_cost',v.credit_cost::text,'currency',v.currency,'library_id',v.library_id)order by v.id)from public.benefit_versions v where v.id=any(s.allowed_benefit_version_ids)))order by s.slot_code)into slots from public.box_slots s where s.box_version_id=b.id;
 return jsonb_build_object('schema_version',1,'rule_id',r.id,'plan_version_id',r.plan_version_id,'box_version_id',b.id,'box_hash',b.content_hash,'box_creator',b.created_by,'rule_creator',link_actor,
 'box_type',b.box_type,'name_fr',b.name_fr,'name_ar',b.name_ar,'version',b.version,'credit_budget',b.credit_budget::text,'currency',b.currency,'rollover_months',b.rollover_months,
 'rule',r.rule_snapshot,'rule_effective_from',r.effective_from,'rule_effective_to',r.effective_to,'box_effective_from',b.effective_from,'box_effective_to',b.effective_to,'slots',slots);
end$$;

create function public.get_box_configuration_approval_context_v1(p_plan_box_rule_id uuid)returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,private as $$declare s jsonb;ap public.box_configuration_approvals_v1%rowtype;begin
 if auth.uid()is null or auth.jwt()->>'aal'is distinct from'aal2'or not private.has_platform_role(array['SUPER_ADMIN','FINANCE_MANAGER'],auth.uid())then raise exception'BOX_CONFIGURATION_APPROVAL_DENIED'using errcode='42501';end if;
 s:=private.box_configuration_source_v1(p_plan_box_rule_id);select*into ap from public.box_configuration_approvals_v1 where plan_box_rule_id=p_plan_box_rule_id;
 return jsonb_build_object('source',s,'source_hash',private.canonical_request_hash(s),'approved',ap.id is not null,'approval_source_hash',ap.source_hash,'approval_current',ap.source_hash is not distinct from private.canonical_request_hash(s),'approval_id',ap.id,'approved_at',ap.approved_at,
 'can_approve',ap.id is null and auth.uid()::text<>s->>'box_creator'and auth.uid()::text<>s->>'rule_creator');
end$$;

create function public.approve_box_configuration_v1(p_plan_box_rule_id uuid,p_expected_source_hash text,p_reason text,p_idempotency_key text,p_correlation_id uuid default extensions.gen_random_uuid())returns jsonb
language plpgsql security definer set search_path=pg_catalog,private as $$declare a uuid:=auth.uid();s jsonb;r jsonb;org uuid;approval uuid;h text;begin
 if a is null or auth.jwt()->>'aal'is distinct from'aal2'or not private.has_platform_role(array['SUPER_ADMIN','FINANCE_MANAGER'],a)then raise exception'BOX_CONFIGURATION_APPROVAL_DENIED'using errcode='42501';end if;
 if p_expected_source_hash is null or length(btrim(coalesce(p_reason,'')))not between 10 and 2000 then raise exception'INVALID_BOX_CONFIGURATION_APPROVAL'using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('box-configuration-rule:'||p_plan_box_rule_id::text,0));
 select e.organization_id into org from public.audit_events e where e.action='admin.plan_box.linked'and e.resource_id=p_plan_box_rule_id::text order by e.id limit 1;
 s:=private.box_configuration_source_v1(p_plan_box_rule_id);
 if a::text=s->>'box_creator'or a::text=s->>'rule_creator'then raise exception'BOX_CONFIGURATION_SELF_APPROVAL_DENIED'using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('platform.account.access',0));
 perform id from auth.users where id=a for share;
 perform user_id from public.platform_user_roles where user_id=a and revoked_at is null order by role_code for share;
 if auth.jwt()->>'aal'is distinct from'aal2'or not private.has_platform_role(array['SUPER_ADMIN','FINANCE_MANAGER'],a)then raise exception'BOX_CONFIGURATION_APPROVAL_DENIED'using errcode='42501';end if;
 h:=private.canonical_request_hash(jsonb_build_object('rule',p_plan_box_rule_id,'source_hash',p_expected_source_hash,'reason',btrim(p_reason)));
 r:=private.begin_credit_command(org,'box.configuration.approve',p_idempotency_key,h,a);if r is not null then return r;end if;
 if private.canonical_request_hash(s)is distinct from p_expected_source_hash then raise exception'STALE_BOX_CONFIGURATION_SOURCE'using errcode='40001';end if;
 perform 1 from public.box_versions b where b.id=(s->>'box_version_id')::uuid and b.status='ACTIVE'and b.effective_from<=clock_timestamp()and(b.effective_to is null or b.effective_to>clock_timestamp())for update;
 if not found or not exists(select 1 from public.subscription_plan_versions where id=(s->>'plan_version_id')::uuid and currency=s->>'currency')or not exists(select 1 from public.plan_box_rules where id=p_plan_box_rule_id and status='ACTIVE')
 or exists(select 1 from public.box_slots slot join public.benefit_versions v on v.id=any(slot.allowed_benefit_version_ids)where slot.box_version_id=(s->>'box_version_id')::uuid and(v.status<>'ACTIVE'or v.effective_from>clock_timestamp()or(v.effective_to is not null and v.effective_to<=clock_timestamp())))then raise exception'BOX_CONFIGURATION_SOURCE_NOT_ACTIVE'using errcode='55000';end if;
 -- Locks and authority are checked after every potentially blocking source
 -- lock; a revoked reviewer cannot complete an approval after waiting.
 perform pg_advisory_xact_lock(hashtextextended('platform.account.access',0));
 perform id from auth.users where id=a for share;
 perform user_id from public.platform_user_roles where user_id=a and revoked_at is null order by role_code for share;
 if auth.uid()is distinct from a or auth.jwt()->>'aal'is distinct from'aal2'or not private.has_platform_role(array['SUPER_ADMIN','FINANCE_MANAGER'],a)then raise exception'BOX_CONFIGURATION_APPROVAL_DENIED'using errcode='42501';end if;
 s:=private.box_configuration_source_v1(p_plan_box_rule_id);
 if private.canonical_request_hash(s)is distinct from p_expected_source_hash then raise exception'STALE_BOX_CONFIGURATION_SOURCE'using errcode='40001';end if;
 insert into public.box_configuration_approvals_v1(plan_box_rule_id,source_snapshot,source_hash,approved_by,reason)values(p_plan_box_rule_id,s,p_expected_source_hash,a,btrim(p_reason))returning id into approval;
 r:=jsonb_build_object('outcome','BOX_CONFIGURATION_APPROVED','approval_id',approval,'plan_box_rule_id',p_plan_box_rule_id,'source_hash',p_expected_source_hash);
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(org,a,'USER','box.configuration.approved','box_configuration_approval',approval::text,p_correlation_id,r,repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values(org,'box_configuration_approval',approval::text,'BoxConfigurationApprovedV1',p_correlation_id,r,p_idempotency_key);
 perform private.finish_credit_command(org,'box.configuration.approve',p_idempotency_key,r);return r;
end$$;

create function private.customer_box_configuration_context_v1(p_organization_id uuid,p_plan_box_rule_id uuid)returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,private as $$
declare f jsonb;pay public.subscription_payment_events%rowtype;options jsonb;ap public.box_configuration_approvals_v1%rowtype;context jsonb;existing public.customer_boxes%rowtype;begin
 f:=private.current_subscription_funding_v1(p_organization_id,statement_timestamp());
 if f is null then return jsonb_build_object('organization_id',p_organization_id,'status','PAID_BOX_FUNDING_REQUIRED','options','[]'::jsonb);end if;
 select*into pay from public.subscription_payment_events where organization_id=p_organization_id and private.subscription_payment_cycle_v1(id)=(f->>'cycle_id')::uuid and private.subscription_payment_funding_environment_compatible_v1(id);
 select*into existing from public.customer_boxes where organization_id=p_organization_id and subscription_id=(f->>'subscription_id')::uuid and period_start=(f->>'period_start')::timestamptz;
 select coalesce(jsonb_agg(jsonb_build_object('rule_id',p.plan_box_rule_id,'approval_id',p.id,'name_fr',p.source_snapshot->>'name_fr','name_ar',p.source_snapshot->>'name_ar','box_type',p.source_snapshot->>'box_type','credit_budget',p.source_snapshot->>'credit_budget')order by p.id),'[]'::jsonb)into options
 from public.box_configuration_approvals_v1 p where p.source_snapshot->>'plan_version_id'=f->>'funded_plan_version_id'and p.approved_at<=pay.paid_at
 and(p.source_snapshot->>'rule_effective_from')::timestamptz<=pay.paid_at and(p.source_snapshot->>'rule_effective_to'is null or(p.source_snapshot->>'rule_effective_to')::timestamptz>pay.paid_at)
 and exists(select 1 from public.box_versions b where b.id=(p.source_snapshot->>'box_version_id')::uuid and b.created_at<=pay.paid_at and b.effective_from<=pay.paid_at and(b.effective_to is null or b.effective_to>pay.paid_at))
 and(p.source_snapshot->>'box_effective_from')::timestamptz<=pay.paid_at and(p.source_snapshot->>'box_effective_to'is null or(p.source_snapshot->>'box_effective_to')::timestamptz>pay.paid_at);
 if existing.id is not null then select approved.plan_box_rule_id into p_plan_box_rule_id from public.customer_box_funding_sources_v1 binding join public.box_configuration_approvals_v1 approved on approved.id=binding.approval_id where binding.customer_box_id=existing.id;
  if not found then return jsonb_build_object('organization_id',p_organization_id,'status','BOX_LEGACY_CONFIGURATION_REVIEW_REQUIRED','options','[]'::jsonb);end if;end if;
 if p_plan_box_rule_id is null and jsonb_array_length(options)=1 then p_plan_box_rule_id:=(options#>>'{0,rule_id}')::uuid;end if;
 select*into ap from public.box_configuration_approvals_v1 where plan_box_rule_id=p_plan_box_rule_id and id in(select(value->>'approval_id')::uuid from jsonb_array_elements(options));
 if ap.id is null then return jsonb_build_object('organization_id',p_organization_id,'status',case when jsonb_array_length(options)=0 then'BOX_APPROVED_CONFIGURATION_REQUIRED'else'BOX_SELECTION_REQUIRED'end,'options',options);end if;
 context:=jsonb_build_object('organization_id',p_organization_id,'funding',f,'payment_event_id',pay.id::text,'approval_id',ap.id,'source_hash',ap.source_hash,'rule_id',ap.plan_box_rule_id,'box_version_id',ap.source_snapshot->>'box_version_id');
 return jsonb_build_object('organization_id',p_organization_id,'status',case when existing.id is null then'CONFIGURABLE'else'ALREADY_CONFIGURED'end,'options',options,
 'context_hash',private.canonical_request_hash(context),'context',context,'configuration',ap.source_snapshot-'box_creator'-'rule_creator',
 'existing',case when existing.id is null then null else jsonb_build_object('id',existing.id,'box_version_id',existing.box_version_id,'selections',existing.selections_snapshot,'period_start',existing.period_start,'period_end',existing.period_end,'content_hash',existing.content_hash)end);
end$$;

create function public.get_customer_box_configuration_v1(p_organization_id uuid,p_plan_box_rule_id uuid default null)returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,private as $$begin
 if auth.uid()is null or not private.credits_client_access(p_organization_id,auth.uid())then raise exception'CUSTOMER_BOX_READ_DENIED'using errcode='42501';end if;
 return private.customer_box_configuration_context_v1(p_organization_id,p_plan_box_rule_id);
end$$;

create function public.configure_customer_box_v1(p_organization_id uuid,p_plan_box_rule_id uuid,p_expected_context_hash text,p_selections jsonb,p_idempotency_key text,p_correlation_id uuid default extensions.gen_random_uuid())returns jsonb
language plpgsql security definer set search_path=pg_catalog,private as $$
declare a uuid:=auth.uid();c jsonb;source jsonb;f jsonb;r jsonb;h text;slot jsonb;choice jsonb;benefit jsonb;total numeric:=0;selected integer;normalized jsonb:='[]';box uuid;ap uuid;begin
 if a is null or auth.jwt()->>'aal'is distinct from'aal2'or not private.has_org_role(p_organization_id,array['CLIENT_OWNER','CLIENT_ADMIN'],a)then raise exception'CUSTOMER_BOX_CONFIGURE_DENIED'using errcode='42501';end if;
 if p_plan_box_rule_id is null or p_expected_context_hash is null or jsonb_typeof(p_selections)is distinct from'array'or jsonb_array_length(p_selections)>1000 then raise exception'INVALID_CUSTOMER_BOX_SELECTION'using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('subscription-financial:'||p_organization_id::text,0));
 if not private.has_org_role(p_organization_id,array['CLIENT_OWNER','CLIENT_ADMIN'],a)or not exists(select 1 from public.organizations where id=p_organization_id and status='ACTIVE')then raise exception'CUSTOMER_BOX_CONFIGURE_DENIED'using errcode='42501';end if;
 perform id from auth.users where id=a for share;
 perform id from public.organizations where id=p_organization_id for share;
 perform id from public.organization_memberships where organization_id=p_organization_id and user_id=a and status='ACTIVE'order by id for share;
 perform membership_id from public.organization_member_roles where membership_id in(select id from public.organization_memberships where organization_id=p_organization_id and user_id=a)and revoked_at is null order by membership_id,role_code for share;
 if auth.jwt()->>'aal'is distinct from'aal2'or not private.has_org_role(p_organization_id,array['CLIENT_OWNER','CLIENT_ADMIN'],a)or not exists(select 1 from public.organizations where id=p_organization_id and status='ACTIVE')then raise exception'CUSTOMER_BOX_CONFIGURE_DENIED'using errcode='42501';end if;
 h:=private.canonical_request_hash(jsonb_build_object('rule',p_plan_box_rule_id,'context_hash',p_expected_context_hash,'selections',p_selections));
 r:=private.begin_credit_command(p_organization_id,'customer.box.configure',p_idempotency_key,h,a);if r is not null then return r;end if;
 if not private.subscription_financially_clear(p_organization_id)or not private.client_identity_allows_new_operations(p_organization_id)then raise exception'CUSTOMER_BOX_NEW_COMMITMENT_BLOCKED'using errcode='55000';end if;
 c:=private.customer_box_configuration_context_v1(p_organization_id,p_plan_box_rule_id);
 if c->>'status'is distinct from'CONFIGURABLE'then raise exception'CUSTOMER_BOX_CONFIGURATION_NOT_ADMISSIBLE'using errcode='55000';end if;
 if c->>'context_hash'is distinct from p_expected_context_hash then raise exception'STALE_CUSTOMER_BOX_CONTEXT'using errcode='40001';end if;
 source:=c->'configuration';f:=c#>'{context,funding}';ap:=(c#>>'{context,approval_id}')::uuid;
 -- No unrecognized keys, duplicate picks, arbitrary version or browser cost.
 for choice in select value from jsonb_array_elements(p_selections)loop
  if jsonb_typeof(choice)is distinct from'object'or(choice-'slot_code'-'benefit_version_id'-'units')<>'{}'::jsonb or coalesce(choice->>'units','')!~'^[1-9][0-9]{0,17}$'
   or not exists(select 1 from jsonb_array_elements(source->'slots')s where s->>'slot_code'=choice->>'slot_code'and exists(select 1 from jsonb_array_elements(s->'benefits')b where b->>'id'=choice->>'benefit_version_id'))
  then raise exception'INVALID_CUSTOMER_BOX_SELECTION'using errcode='22023';end if;
 end loop;
 if exists(select 1 from jsonb_array_elements(p_selections)x group by x->>'slot_code',x->>'benefit_version_id'having count(*)>1)then raise exception'DUPLICATE_CUSTOMER_BOX_SELECTION'using errcode='22023';end if;
 for slot in select value from jsonb_array_elements(source->'slots')loop
  select count(*)into selected from jsonb_array_elements(p_selections)x where x->>'slot_code'=slot->>'slot_code';
  if selected<(slot->>'minimum_selections')::integer or selected>(slot->>'maximum_selections')::integer then raise exception'CUSTOMER_BOX_SLOT_LIMIT'using errcode='23514';end if;
  for choice in select value from jsonb_array_elements(p_selections)x where x->>'slot_code'=slot->>'slot_code'loop
   select value into benefit from jsonb_array_elements(slot->'benefits')x where x->>'id'=choice->>'benefit_version_id';
   if source->>'box_type'='FIXED'and choice->>'units'<>'1'then raise exception'CUSTOMER_BOX_FIXED_SELECTION_REQUIRED'using errcode='23514';end if;
   total:=total+(choice->>'units')::numeric*(benefit->>'credit_cost')::numeric;
   normalized:=normalized||jsonb_build_array(choice||jsonb_build_object('benefit_hash',benefit->>'content_hash','credit_cost',benefit->>'credit_cost','library_id',benefit->'library_id'));
  end loop;
 end loop;
 if total>(source->>'credit_budget')::numeric or(source#>>'{rule,budget_rule}'='EXACT'and total<>(source->>'credit_budget')::numeric)then raise exception'CUSTOMER_BOX_BUDGET_EXCEEDED'using errcode='23514';end if;
 select coalesce(jsonb_agg(value order by value->>'slot_code',value->>'benefit_version_id'),'[]')into normalized from jsonb_array_elements(normalized);
 insert into public.customer_boxes(organization_id,subscription_id,box_version_id,period_start,period_end,selections_snapshot,content_hash,created_by)
 values(p_organization_id,(f->>'subscription_id')::uuid,(source->>'box_version_id')::uuid,(f->>'period_start')::timestamptz,(f->>'period_end')::timestamptz,normalized,private.canonical_request_hash(jsonb_build_object('context',c->'context','selections',normalized)),a)returning id into box;
 insert into public.customer_box_funding_sources_v1(customer_box_id,organization_id,cycle_id,payment_event_id,approval_id,context_snapshot,context_hash)
 values(box,p_organization_id,(f->>'cycle_id')::uuid,(c#>>'{context,payment_event_id}')::bigint,ap,c->'context',p_expected_context_hash);
 r:=jsonb_build_object('outcome','CUSTOMER_BOX_CONFIGURED','customer_box_id',box,'cycle_id',f->>'cycle_id','box_version_id',source->>'box_version_id','allocated_credits',total::text);
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(p_organization_id,a,'USER','customer.box.configured','customer_box',box::text,p_correlation_id,r,repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values(p_organization_id,'customer_box',box::text,'CustomerBoxConfiguredV1',p_correlation_id,r,p_idempotency_key);
 perform private.finish_credit_command(p_organization_id,'customer.box.configure',p_idempotency_key,r);return r;
end$$;
revoke all on function private.box_configuration_source_v1(uuid),private.customer_box_configuration_context_v1(uuid,uuid),public.get_box_configuration_approval_context_v1(uuid),public.approve_box_configuration_v1(uuid,text,text,text,uuid),public.get_customer_box_configuration_v1(uuid,uuid),public.configure_customer_box_v1(uuid,uuid,text,jsonb,text,uuid)from public,anon,authenticated,service_role;
grant execute on function public.get_box_configuration_approval_context_v1(uuid),public.approve_box_configuration_v1(uuid,text,text,text,uuid),public.get_customer_box_configuration_v1(uuid,uuid),public.configure_customer_box_v1(uuid,uuid,text,jsonb,text,uuid)to authenticated;
notify pgrst,'reload schema';
commit;
