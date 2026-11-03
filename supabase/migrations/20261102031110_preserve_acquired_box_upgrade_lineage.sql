begin;
-- Paying a governed price difference changes current plan entitlements, not the
-- Box acquired with the original full payment. A new full cycle starts a new
-- Box basis. No payment, approval, selection, grant or cycle is rewritten.
create function private.current_customer_box_funding_v1(p_org uuid,p_at timestamptz)returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,private as $$
declare current_funding jsonb;ancestor uuid;c public.subscription_cycles%rowtype;begin
 current_funding:=private.current_subscription_funding_v1(p_org,p_at);if current_funding is null then return null;end if;
 ancestor:=private.subscription_box_funding_cycle_v1((current_funding->>'cycle_id')::uuid);
 select*into c from public.subscription_cycles where id=ancestor and organization_id=p_org and subscription_id=(current_funding->>'subscription_id')::uuid and period_start<=p_at and period_end>p_at;
 if c.id is null or not private.subscription_cycle_funding_compatible_v1(c.id)then return null;end if;
 return jsonb_build_object('subscription_id',c.subscription_id,'cycle_id',c.id,'funded_plan_version_id',c.plan_version_id,'period_start',c.period_start,'period_end',c.period_end);
end$$;
revoke all on function private.current_customer_box_funding_v1(uuid,timestamptz)from public,anon,authenticated,service_role;
do $$declare d text;needle text;begin
 d:=pg_get_functiondef('private.customer_box_configuration_context_v1(uuid,uuid)'::regprocedure);
 needle:='f:=private.current_subscription_funding_v1(p_organization_id,statement_timestamp());';
 if strpos(d,needle)=0 then raise exception'BOX_UPGRADE_CONFIGURATION_SOURCE_MISMATCH';end if;
 d:=replace(d,needle,'f:=private.current_customer_box_funding_v1(p_organization_id,statement_timestamp());');execute d;
 d:=pg_get_functiondef('private.benefit_customer_box_evidence_v1(uuid,uuid,uuid[],timestamptz)'::regprocedure);
 needle:='binding.cycle_id=p_cycle';if strpos(d,needle)=0 then raise exception'BOX_UPGRADE_EVIDENCE_SOURCE_MISMATCH';end if;
 d:=replace(d,needle,'binding.cycle_id=private.subscription_box_funding_cycle_v1(p_cycle)');execute d;
 d:=pg_get_functiondef('private.box_native_binding_source_v1(uuid,uuid,uuid,timestamptz)'::regprocedure);
 needle:='f.cycle_id=p_cycle';if strpos(d,needle)=0 then raise exception'BOX_UPGRADE_NATIVE_SOURCE_MISMATCH';end if;
 d:=replace(d,needle,'f.cycle_id=private.subscription_box_funding_cycle_v1(p_cycle)');execute d;
 d:=pg_get_functiondef('private.benefit_box_subscription_funding_v1(uuid,uuid,timestamptz)'::regprocedure);
 needle:='if box is null then return private.current_subscription_funding_v1(p_org,p_at);end if;';if strpos(d,needle)=0 then raise exception'BOX_UPGRADE_ADMISSION_SOURCE_MISMATCH';end if;
 d:=replace(d,needle,'if box is null then return private.current_customer_box_funding_v1(p_org,p_at);end if;');execute d;
end$$;
notify pgrst,'reload schema';
commit;
