begin;
-- Fully paid cycles can overlap after an immediate full-cycle upgrade. A
-- member's explicit Box must select its own policy, period and allocation.
create function private.member_box_reserve_context_v1(p_org uuid,p_benefit uuid)returns uuid
language plpgsql stable security definer set search_path=pg_catalog,private as $$
declare ids uuid[];begin
 select array_agg(c.customer_box_id)into ids from private.member_box_command_capabilities_v1 c
 where c.backend_pid=pg_backend_pid()and c.transaction_id=txid_current()and c.actor_id=auth.uid()and c.organization_id=p_org and c.benefit_version_id=p_benefit and c.operation='RESERVE';
 if cardinality(ids)>1 then raise exception'MEMBER_BOX_COMMAND_CONTEXT_AMBIGUOUS'using errcode='42501';end if;return ids[1];
end$$;
create function private.benefit_box_subscription_funding_v1(p_org uuid,p_benefit uuid,p_at timestamptz)returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,private as $$
declare box uuid;cycle public.subscription_cycles%rowtype;version_id uuid;proof jsonb;begin
 box:=private.member_box_reserve_context_v1(p_org,p_benefit);
 if box is null then return private.current_subscription_funding_v1(p_org,p_at);end if;
 select c.* into cycle from public.customer_boxes cb join public.customer_box_funding_sources_v1 f on f.customer_box_id=cb.id and f.organization_id=cb.organization_id join public.subscription_cycles c on c.id=f.cycle_id and c.organization_id=cb.organization_id and c.subscription_id=cb.subscription_id where cb.id=box and cb.organization_id=p_org and cb.period_start<=p_at and cb.period_end>p_at;
 if cycle.id is null then return null;end if;select box_version_id into version_id from public.customer_boxes where id=box;
 proof:=private.benefit_customer_box_evidence_v1(p_org,cycle.id,array[version_id],p_at);
 if proof->>'customer_box_id'is distinct from box::text then return null;end if;
 return jsonb_build_object('subscription_id',cycle.subscription_id,'cycle_id',cycle.id,'funded_plan_version_id',cycle.plan_version_id,'period_start',cycle.period_start,'period_end',cycle.period_end);
end$$;
revoke all on function private.member_box_reserve_context_v1(uuid,uuid),private.benefit_box_subscription_funding_v1(uuid,uuid,timestamptz)from public,anon,authenticated,service_role;
do $$declare d text;needle text;begin
 d:=pg_get_functiondef('private.acquired_box_benefit_policy_v1(uuid,uuid,timestamptz)'::regprocedure);
 needle:='where cb.organization_id=p_org and';if strpos(d,needle)=0 then raise exception'ACQUIRED_MEMBER_POLICY_CONTEXT_SOURCE_MISMATCH';end if;
 d:=replace(d,needle,needle||'(private.member_box_reserve_context_v1(p_org,p_version)is null or cb.id=private.member_box_reserve_context_v1(p_org,p_version))and');execute d;
 d:=pg_get_functiondef('private.benefit_admission_status_v1(uuid,uuid,bigint,timestamptz,uuid)'::regprocedure);
 needle:='period:=private.current_subscription_funding_v1(p_org,p_at);';if strpos(d,needle)=0 then raise exception'ACQUIRED_MEMBER_PERIOD_CONTEXT_SOURCE_MISMATCH';end if;
 d:=replace(d,needle,'period:=private.benefit_box_subscription_funding_v1(p_org,p_version,p_at);');execute d;
 d:=pg_get_functiondef('private.enforce_customer_box_envelope_v1()'::regprocedure);
 needle:='where cb.organization_id=new.organization_id and';if strpos(d,needle)=0 then raise exception'ACQUIRED_MEMBER_ALLOCATION_CONTEXT_SOURCE_MISMATCH';end if;
 d:=replace(d,needle,needle||'(private.member_box_reserve_context_v1(new.organization_id,new.benefit_version_id)is null or cb.id=private.member_box_reserve_context_v1(new.organization_id,new.benefit_version_id))and');
 needle:=' select cb.*into b from';if strpos(d,needle)=0 then raise exception'ACQUIRED_MEMBER_AMBIGUITY_SOURCE_MISMATCH';end if;
 d:=replace(d,needle,' if private.member_box_reserve_context_v1(new.organization_id,new.benefit_version_id)is null and(select count(*)from public.customer_boxes x join public.customer_box_funding_sources_v1 f on f.customer_box_id=x.id where x.organization_id=new.organization_id and x.period_start<=clock_timestamp()and x.period_end>clock_timestamp()and exists(select 1 from jsonb_array_elements(x.selections_snapshot)choice where choice->>''benefit_version_id''=new.benefit_version_id::text))>1 then raise exception''BOX_RESERVATION_CONTEXT_REQUIRED''using errcode=''55000'';end if;'||needle);execute d;
 d:=pg_get_functiondef('private.freeze_native_benefit_reservation_v1()'::regprocedure);
 needle:='expected:=promised->''binding'';box_id:=(promised->>''customer_box_id'')::uuid;';if strpos(d,needle)=0 then raise exception'ACQUIRED_NATIVE_ALLOCATION_CONTEXT_SOURCE_MISMATCH';end if;
 d:=replace(d,needle,'select a.customer_box_id into box_id from public.customer_box_redemption_allocations_v1 a where a.redemption_id=new.id; if box_id is not null and box_id::text is distinct from promised->>''customer_box_id''then raise exception''ACQUIRED_NATIVE_BOX_ALLOCATION_MISMATCH''using errcode=''55000'';end if;'||needle);execute d;
end$$;
notify pgrst,'reload schema';
commit;
