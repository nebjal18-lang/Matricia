-- Resolve exact legacy RFQ sources without rewriting their immutable request version.
-- A request's existing approved snapshot remains pinned when later mappings change.
create function private.resolve_quote_service_tax_policy_v1(p_rfq_provider_id uuid)returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,private as $$
declare r public.service_requests%rowtype;v public.service_request_versions%rowtype;origin jsonb;ids uuid[];vid uuid;country text;effective date;policy jsonb;m public.service_tax_category_mappings%rowtype;env text;begin
 select sr.*into r from public.rfq_providers rp join public.rfqs rfq on rfq.id=rp.rfq_id join public.service_requests sr on sr.id=rfq.request_id where rp.id=p_rfq_provider_id;
 select srv.*into v from public.rfq_providers rp join public.rfqs rfq on rfq.id=rp.rfq_id join public.service_request_versions srv on srv.id=rfq.request_version_id and srv.request_id=r.id where rp.id=p_rfq_provider_id;
 if r.id is null or v.id is null then raise exception'RFQ_INVITATION_NOT_FOUND'using errcode='P0002';end if;
 if to_regclass('public.service_request_tax_origins_v1')is not null then execute'select to_jsonb(o)from public.service_request_tax_origins_v1 o where request_id=$1'into origin using r.id;end if;
 if origin is not null then
  if origin->>'organization_id'is distinct from r.client_organization_id::text or origin->>'service_content_hash'is distinct from v.catalog_snapshot_hash or origin->>'currency'is distinct from v.currency_code::text then raise exception'SERVICE_TAX_ORIGIN_CHANGED'using errcode='40001';end if;
  vid:=(origin->>'service_version_id')::uuid;country:=origin->>'country_code';effective:=(origin->>'tax_effective_on')::date;
 else
  select array_agg(id order by id)into ids from public.catalog_service_versions where service_id=r.service_id and library_id=r.library_id and content_hash=v.catalog_snapshot_hash and status in('PUBLISHED','RETIRED')and published_at is not null;
  if coalesce(cardinality(ids),0)<>1 then raise exception'SERVICE_TAX_EXACT_SOURCE_REQUIRED'using errcode='55000';end if;
  vid:=ids[1];select country_code into country from public.organizations where id=r.client_organization_id;
  if exists(select 1 from public.admin_organization_identity_revisions_v1 i join public.admin_operational_action_requests a on a.id=i.action_request_id where i.organization_id=r.client_organization_id and i.created_at>r.created_at and a.redacted_summary?'country')then raise exception'SERVICE_TAX_ORIGIN_REVIEW_REQUIRED'using errcode='55000';end if;
  effective:=(r.created_at at time zone'Africa/Casablanca')::date;
 end if;
 env:=private.service_tax_mapping_environment_v1();policy:=v.required_quote_data->'tax_category_policy_snapshot';
 if policy is null then policy:=private.resolve_service_tax_category_v1(vid,country,v.currency_code,effective);
 else
  if jsonb_typeof(policy)is distinct from'object'or coalesce(policy->>'mapping_id','')!~'^[0-9a-f-]{36}$'then raise exception'SERVICE_TAX_PINNED_POLICY_INVALID'using errcode='55000';end if;
  select*into m from public.service_tax_category_mappings where id=(policy->>'mapping_id')::uuid;
  if m.id is null or m.service_version_id is distinct from vid or m.service_content_hash is distinct from v.catalog_snapshot_hash or m.country_code is distinct from country or m.currency is distinct from v.currency_code or m.environment is distinct from env or m.content_hash is distinct from policy->>'content_hash'or m.category_code is distinct from policy->>'category_code'or policy->>'effective_on'is distinct from effective::text or m.valid_from>effective or(m.valid_until is not null and m.valid_until<effective)or(m.development_only and env not in('DEVELOPMENT','STAGING'))or not exists(select 1 from public.service_tax_mapping_decisions d where d.proposal_id=m.id and d.decision='APPROVED')then raise exception'SERVICE_TAX_PINNED_POLICY_INVALID'using errcode='55000';end if;
  -- Reconstruct the projection from the immutable registry; caller JSON is not copied.
  policy:=jsonb_build_object('mapping_id',m.id,'version',m.version,'category_code',m.category_code,'content_hash',m.content_hash,'service_version_id',m.service_version_id,'service_content_hash',m.service_content_hash,'country_code',m.country_code,'currency',m.currency,'effective_on',effective::text,'valid_from',m.valid_from::text,'valid_until',m.valid_until::text,'approval_reference',m.approval_reference,'approved_at',m.approved_at,'environment',m.environment,'development_only',m.development_only,'service_snapshot',m.service_snapshot);
 end if;
 if not exists(select 1 from public.catalog_service_versions sv where sv.id=vid and sv.service_id=r.service_id and sv.library_id=r.library_id and sv.content_hash=v.catalog_snapshot_hash)then raise exception'SERVICE_TAX_EXACT_SOURCE_REQUIRED'using errcode='55000';end if;
 if not exists(select 1 from public.tax_categories where code=policy->>'category_code'and category_kind='SERVICE'and status='ACTIVE')then raise exception'SERVICE_TAX_CATEGORY_NOT_ACTIVE'using errcode='55000';end if;
 return policy||jsonb_build_object('request_id',r.id,'request_version_id',v.id,'origin_kind',coalesce(origin->>'origin_kind','LEGACY_EXACT_SOURCE'));
end$$;
create function private.quote_payload_with_service_tax_v1(p_rfq_provider_id uuid,p_payload jsonb)returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,private as $$declare policy jsonb;line jsonb;begin
 policy:=private.resolve_quote_service_tax_policy_v1(p_rfq_provider_id);
 if p_payload->>'currency'is distinct from policy->>'currency'then raise exception'QUOTE_CURRENCY_MUST_MATCH_REQUEST'using errcode='22023';end if;
 for line in select value from jsonb_array_elements(p_payload->'items')loop perform private.assert_quote_tax_rule((line->>'tax_rule_version_id')::uuid,policy->>'category_code',(p_payload->>'proposed_start_date')::date);end loop;
 return(p_payload-'service_tax_policy_snapshot')||jsonb_build_object('service_tax_policy_snapshot',policy);
end$$;
revoke all on function private.resolve_quote_service_tax_policy_v1(uuid),private.quote_payload_with_service_tax_v1(uuid,jsonb)from public,anon,authenticated,service_role;
-- Preserve command OIDs, existing authority/CAS guards and raw-request replay.
do $$declare definition text;marker text;begin
 definition:=pg_get_functiondef('public.create_quote_revision_pre_cas_v1(uuid,jsonb,text,text,uuid)'::regprocedure);
 marker:='nullif(btrim(srv.required_quote_data->>''tax_category_code''),'''')';
 if position(marker in definition)=0 then raise exception'QUOTE_CATEGORY_PATCH_SOURCE_MISMATCH';end if;
 execute replace(definition,marker,'(private.resolve_quote_service_tax_policy_v1(rp.id)->>''category_code'')');
 definition:=pg_get_functiondef('public.create_quote_revision_legacy_0156(uuid,jsonb,text,text,uuid)'::regprocedure);
 marker:=' select * into v_quote from public.quotes where rfq_id=v_rp.rfq_id';
 if position(marker in definition)=0 then raise exception'QUOTE_FISCAL_SNAPSHOT_PATCH_SOURCE_MISMATCH';end if;
 definition:=replace(definition,marker,$patch$ p_payload:=private.quote_payload_with_service_tax_v1(p_rfq_provider_id,p_payload);
 v_hash:=private.canonical_request_hash(jsonb_build_object('operation','quote.revision.create.v1','rfq_provider_id',p_rfq_provider_id,'payload',p_payload,'change_reason',btrim(p_change_reason)));
$patch$||marker);
 marker:='jsonb_build_object(''money'',''MINOR_UNITS'',''quantity'',''NUMERIC_18_4'',''tax_lines'',v_basis)';
 if position(marker in definition)=0 then raise exception'QUOTE_FISCAL_BASIS_PATCH_SOURCE_MISMATCH';end if;
 execute replace(definition,marker,marker||'||jsonb_build_object(''service_tax_policy_snapshot'',p_payload->''service_tax_policy_snapshot'')');
end$$;
create function public.list_provider_quote_service_tax_policies_v1(p_provider_organization_id uuid,p_rfq_provider_ids uuid[])returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,private as $$declare item uuid;policy jsonb;result jsonb:='[]';begin
 if not private.has_org_role(p_provider_organization_id,array['PROVIDER_OWNER','PROVIDER_MANAGER','PROVIDER_SALES','PROVIDER_VIEWER'],auth.uid())then raise exception'QUOTE_PROVIDER_SCOPE_DENIED'using errcode='42501';end if;
 if p_rfq_provider_ids is null or cardinality(p_rfq_provider_ids)>100 or exists(select 1 from unnest(p_rfq_provider_ids)x where x is null)then raise exception'INVALID_QUOTE_INVITATION_IDS'using errcode='22023';end if;
 foreach item in array p_rfq_provider_ids loop
  if not exists(select 1 from public.rfq_providers where id=item and provider_organization_id=p_provider_organization_id)then raise exception'QUOTE_PROVIDER_SCOPE_DENIED'using errcode='42501';end if;
  begin policy:=private.resolve_quote_service_tax_policy_v1(item);result:=result||jsonb_build_array(jsonb_build_object('invitation_id',item,'category_code',policy->>'category_code','policy',policy,'blocked_reason',null));
  exception when sqlstate'55000' or sqlstate'40001'then result:=result||jsonb_build_array(jsonb_build_object('invitation_id',item,'category_code',null,'policy',null,'blocked_reason',sqlerrm));end;
 end loop;return result;
end$$;
revoke all on function public.list_provider_quote_service_tax_policies_v1(uuid,uuid[])from public,anon,authenticated,service_role;
grant execute on function public.list_provider_quote_service_tax_policies_v1(uuid,uuid[])to authenticated;
notify pgrst,'reload schema';
