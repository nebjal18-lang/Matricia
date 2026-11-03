begin;
-- Resolve acquired terms through the immutable, paid Box promise. A new policy
-- cannot silently replace the policy an existing Client bought.
create function private.acquired_box_benefit_policy_v1(p_org uuid,p_version uuid,p_at timestamptz)returns public.benefit_admission_policy_versions_v1
language sql stable security definer set search_path=pg_catalog,public,private as $$
 select p from public.customer_boxes cb join public.customer_box_funding_sources_v1 f on f.customer_box_id=cb.id and f.organization_id=cb.organization_id
 join public.box_configuration_approvals_v1 a on a.id=f.approval_id
 cross join lateral jsonb_array_elements(a.source_snapshot->'slots')s cross join lateral jsonb_array_elements(s->'benefits')b
 join public.benefit_admission_policy_versions_v1 p on p.id=(b#>>'{admission_policy,policy_id}')::uuid and p.content_hash=b#>>'{admission_policy,content_hash}'
 join public.benefit_admission_policy_decisions_v1 d on d.policy_id=p.id and d.content_hash=p.content_hash and d.decision='APPROVE'and d.decided_by<>p.created_by
 where cb.organization_id=p_org and cb.period_start<=p_at and cb.period_end>p_at and b->>'id'=p_version::text
 and exists(select 1 from jsonb_array_elements(cb.selections_snapshot)x where x->>'benefit_version_id'=p_version::text)
 and private.box_checkout_promise_matches_v1(f.context_snapshot,f.payment_event_id,a.id)
 order by cb.created_at desc,cb.id limit 1
$$;
do $$declare d text;needle text:='p:=private.benefit_admission_effective_v1(p_version,p_at);';begin
 d:=pg_get_functiondef('private.benefit_admission_status_v1(uuid,uuid,bigint,timestamptz,uuid)'::regprocedure);
 if position(needle in d)=0 then raise exception'BOX_ACQUIRED_POLICY_PATCH_MISMATCH';end if;
 d:=replace(d,needle,'p:=private.acquired_box_benefit_policy_v1(p_org,p_version,p_at);if p.id is null then p:=private.benefit_admission_effective_v1(p_version,p_at);end if;');
 execute d;
end$$;

-- Recommendations are explanations from actual unresolved diagnostic findings,
-- restricted to benefits in this Client's funded, approved configuration.
create function public.get_customer_box_recommendations_v1(p_organization_id uuid)returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,public,private as $$
declare c jsonb;rows jsonb;begin
 if auth.uid()is null or not private.credits_client_access(p_organization_id)then raise exception'BOX_RECOMMENDATION_READ_DENIED'using errcode='42501';end if;
 c:=private.customer_box_configuration_context_v1(p_organization_id,null);
 if c->>'status'not in('CONFIGURABLE','ALREADY_CONFIGURED')then return jsonb_build_object('status',c->>'status','recommendations','[]'::jsonb);end if;
 select coalesce(jsonb_agg(jsonb_build_object('benefit_version_id',matched.id,'name_fr',matched.name_fr,'name_ar',matched.name_ar,'credit_cost',matched.credit_cost::text,'recommendation_id',matched.recommendation_id,'anomaly_id',matched.anomaly_id,'reason_fr',matched.reason_fr,'reason_ar',matched.reason_ar,'priority',matched.priority)order by matched.priority,matched.id),'[]')into rows
 from(select distinct on(v.id)v.id,v.name_fr,v.name_ar,v.credit_cost,r.id recommendation_id,a.id anomaly_id,r.client_text_fr reason_fr,r.client_text_ar reason_ar,r.priority
 from public.benefit_versions v join public.diagnostic_recommendations r on r.service_id=v.service_id and r.organization_id=p_organization_id
 join public.diagnostic_anomalies a on a.id=r.anomaly_id and a.organization_id=p_organization_id and a.status='OPEN'
 where v.service_id is not null and exists(select 1 from jsonb_array_elements(c#>'{configuration,slots}')s cross join lateral jsonb_array_elements(s->'benefits')b where b->>'id'=v.id::text)
 order by v.id,r.priority,r.created_at desc,r.id)matched;
 return jsonb_build_object('status','AVAILABLE','recommendations',rows);
end$$;
revoke all on function private.acquired_box_benefit_policy_v1(uuid,uuid,timestamptz),public.get_customer_box_recommendations_v1(uuid)from public,anon,authenticated,service_role;
grant execute on function public.get_customer_box_recommendations_v1(uuid)to authenticated;
notify pgrst,'reload schema';
commit;
