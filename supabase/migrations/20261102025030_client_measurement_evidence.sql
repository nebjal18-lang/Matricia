begin;
-- Only an authenticated finance reader sees their own private evidence choices.
create function public.list_client_measurement_context_v1(p_organization_id uuid)returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $$
declare subjects jsonb;documents jsonb;
begin
 if auth.uid()is null or not coalesce(private.client_portfolio_read(p_organization_id,auth.uid()),false)then raise exception 'CLIENT_MEASUREMENT_CONTEXT_DENIED'using errcode='42501';end if;
 select coalesce(jsonb_agg(jsonb_build_object('type',s.kind,'id',s.id,'label_fr',s.fr,'label_ar',s.ar)order by s.kind,s.fr),'[]')into subjects from(
 select o.id,'ORGANIZATION'::text kind,o.display_name fr,o.display_name ar from public.organizations o where o.id=p_organization_id and o.status='ACTIVE'
 union all select r.id,'RECOMMENDATION',r.title_fr,r.title_ar from public.diagnostic_recommendations r where r.organization_id=p_organization_id
 union all select p.id,'PROJECT',v.name_fr,v.name_ar from public.client_projects p join public.client_project_versions v on v.project_id=p.id and v.version=p.current_version where p.organization_id=p_organization_id
 union all select c.id,'CONTRACT','Contrat · '||left(c.id::text,8),'عقد · '||left(c.id::text,8)from public.contracts c where c.client_organization_id=p_organization_id
 )s;
 select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'label',d.original_file_name)order by d.uploaded_at desc,d.id),'[]')into documents
 from public.client_compliance_documents d where d.organization_id=p_organization_id and d.status='VERIFIED'and d.scan_status='CLEAN'and(d.expires_on is null or d.expires_on>=current_date)
 and exists(select 1 from private.client_document_scan_results s where s.id=d.current_scan_result_id and s.document_id=d.id and s.organization_id=d.organization_id and s.result='CLEAN'and s.computed_sha256=d.declared_sha256);
 return jsonb_build_object('organization_id',p_organization_id,'subjects',subjects,'documents',documents);
end$$;
-- Extend the typed registry validator; keep legacy verified registries valid.
create or replace function private.valid_tenant_baseline_evidence(p_organization_id uuid,p_refs jsonb)returns boolean language plpgsql stable security definer set search_path=pg_catalog as $$declare e jsonb;x uuid;begin
 if jsonb_typeof(p_refs)<>'array'or jsonb_array_length(p_refs)=0 or jsonb_array_length(p_refs)>50 then return false;end if;
 for e in select value from jsonb_array_elements(p_refs)loop
  if jsonb_typeof(e)<>'object'or(select array_agg(k order by k)from jsonb_object_keys(e)k)<>array['id','registry']::text[]or coalesce(e->>'id','')!~'^[0-9a-f-]{36}$'then return false;end if;x:=(e->>'id')::uuid;
  if e->>'registry'='CLIENT_COMPLIANCE_EVIDENCE'then
   if not exists(select 1 from public.client_compliance_evidence q where q.id=x and q.organization_id=p_organization_id and q.review_status='VERIFIED')then return false;end if;
  elsif e->>'registry'='PROVIDER_DOCUMENT_VERSION'then
   if not exists(select 1 from public.provider_document_versions q where q.id=x and q.provider_organization_id=p_organization_id and q.status='VERIFIED'and(q.expires_on is null or q.expires_on>current_date))then return false;end if;
  elsif e->>'registry'='CLIENT_DOCUMENT'then
   if not exists(select 1 from public.client_compliance_documents d where d.id=x and d.organization_id=p_organization_id and d.status='VERIFIED'and d.scan_status='CLEAN'and(d.expires_on is null or d.expires_on>=current_date)and exists(select 1 from private.client_document_scan_results scan where scan.id=d.current_scan_result_id and scan.document_id=d.id and scan.organization_id=d.organization_id and scan.result='CLEAN'and scan.computed_sha256=d.declared_sha256))then return false;end if;
  else return false;end if;
 end loop;return true;exception when invalid_text_representation then return false;end$$;
create function private.client_measurement_evidence_v1(p_organization_id uuid,p_document_id uuid)returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $$
declare d public.client_compliance_documents%rowtype;
begin
 if auth.uid()is null or not coalesce(private.client_portfolio_read(p_organization_id,auth.uid()),false)then raise exception 'CLIENT_MEASUREMENT_EVIDENCE_DENIED'using errcode='42501';end if;
 select * into d from public.client_compliance_documents where id=p_document_id and organization_id=p_organization_id and status='VERIFIED'and scan_status='CLEAN'and(expires_on is null or expires_on>=current_date);
 if d.id is null or not exists(select 1 from private.client_document_scan_results s where s.id=d.current_scan_result_id and s.document_id=d.id and s.organization_id=d.organization_id and s.result='CLEAN'and s.computed_sha256=d.declared_sha256)then raise exception 'VERIFIED_CLEAN_MEASUREMENT_DOCUMENT_REQUIRED'using errcode='23514';end if;
 return jsonb_build_object('refs',jsonb_build_array(jsonb_build_object('registry','CLIENT_DOCUMENT','id',d.id)),'hash',d.declared_sha256);
end$$;
create function public.capture_client_baseline_with_document_v1(p_organization_id uuid,p_subject_type text,p_subject_id uuid,p_metric_code text,p_baseline_amount_minor bigint,p_currency text,p_period_start date,p_period_end date,p_source_type text,p_source_reference text,p_document_id uuid,p_methodology_version text,p_idempotency_key text)returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$declare e jsonb;begin
 e:=private.client_measurement_evidence_v1(p_organization_id,p_document_id);
 return public.capture_verified_baseline(p_organization_id,p_subject_type,p_subject_id,p_metric_code,p_baseline_amount_minor,p_currency,p_period_start,p_period_end,p_source_type,p_source_reference,e->'refs',e->>'hash',p_methodology_version,p_idempotency_key);
end$$;
create function public.calculate_client_roi_with_document_v1(p_recommendation_id uuid,p_baseline_id uuid,p_actual_amount_minor bigint,p_implementation_cost_minor bigint,p_actual_period_start date,p_actual_period_end date,p_actual_source_type text,p_actual_source_reference text,p_document_id uuid,p_formula_version text,p_idempotency_key text)returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$declare e jsonb;o uuid;begin
 select organization_id into o from public.measurement_baselines where id=p_baseline_id;
 e:=private.client_measurement_evidence_v1(o,p_document_id);
 return public.calculate_recommendation_roi(p_recommendation_id,p_baseline_id,p_actual_amount_minor,p_implementation_cost_minor,p_actual_period_start,p_actual_period_end,p_actual_source_type,p_actual_source_reference,e->'refs',e->>'hash',p_formula_version,p_idempotency_key);
end$$;
create function public.record_client_savings_with_document_v1(p_baseline_id uuid,p_actual_amount_minor bigint,p_actual_period_start date,p_actual_period_end date,p_source_type text,p_source_reference text,p_document_id uuid,p_formula_version text,p_idempotency_key text)returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$declare e jsonb;o uuid;begin
 select organization_id into o from public.measurement_baselines where id=p_baseline_id;
 e:=private.client_measurement_evidence_v1(o,p_document_id);
 return public.record_verified_savings(p_baseline_id,p_actual_amount_minor,p_actual_period_start,p_actual_period_end,p_source_type,p_source_reference,e->'refs',e->>'hash',p_formula_version,p_idempotency_key);
end$$;
create function public.advance_client_referral_with_document_v1(p_conversion_id uuid,p_to_stage text,p_document_id uuid,p_expected_row_version integer,p_idempotency_key text)returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$declare e jsonb;o uuid;begin
 select target_organization_id into o from public.referral_conversions where id=p_conversion_id;
 e:=private.client_measurement_evidence_v1(o,p_document_id);
 return public.advance_referral_conversion(p_conversion_id,p_to_stage,e->'refs',e->>'hash',p_expected_row_version,p_idempotency_key);
end$$;
revoke all on function public.advance_client_referral_with_document_v1(uuid,text,uuid,integer,text)from public,anon,authenticated,service_role;
grant execute on function public.advance_client_referral_with_document_v1(uuid,text,uuid,integer,text)to authenticated;
revoke all on function private.client_measurement_evidence_v1(uuid,uuid)from public,anon,authenticated,service_role;
revoke all on function public.list_client_measurement_context_v1(uuid),public.capture_client_baseline_with_document_v1(uuid,text,uuid,text,bigint,text,date,date,text,text,uuid,text,text),public.calculate_client_roi_with_document_v1(uuid,uuid,bigint,bigint,date,date,text,text,uuid,text,text),public.record_client_savings_with_document_v1(uuid,bigint,date,date,text,text,uuid,text,text)from public,anon,authenticated,service_role;
grant execute on function public.list_client_measurement_context_v1(uuid),public.capture_client_baseline_with_document_v1(uuid,text,uuid,text,bigint,text,date,date,text,text,uuid,text,text),public.calculate_client_roi_with_document_v1(uuid,uuid,bigint,bigint,date,date,text,text,uuid,text,text),public.record_client_savings_with_document_v1(uuid,bigint,date,date,text,text,uuid,text,text)to authenticated;
notify pgrst,'reload schema';
commit;
