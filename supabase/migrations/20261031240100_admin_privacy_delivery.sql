begin;
create function public.get_admin_privacy_console_v1()returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,private as $$
begin
 if not private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN','COMPLIANCE_MANAGER','READ_ONLY_AUDITOR'],auth.uid())then raise exception'ADMIN_PRIVACY_DENIED'using errcode='42501';end if;
 return jsonb_build_object(
 'organizations',coalesce((select jsonb_agg(jsonb_build_object('id',id,'display_name',display_name)order by display_name,id)from public.organizations),'[]'::jsonb),
 'requests',coalesce((select jsonb_agg(jsonb_build_object('id',id,'organization_id',organization_id,'request_type',request_type,'status',status,'due_at',due_at,'row_version',row_version)order by due_at,id)from public.data_subject_requests),'[]'::jsonb),
 'policies',coalesce((select jsonb_agg(jsonb_build_object('id',id,'organization_id',organization_id,'disposition',disposition,'retention_days',retention_days)order by organization_id,id)from public.retention_policies where status='ACTIVE'and effective_from<=current_date and(effective_until is null or effective_until>=current_date)),'[]'::jsonb));
end$$;
revoke all on function public.get_admin_privacy_console_v1()from public,anon,authenticated,service_role;
grant execute on function public.get_admin_privacy_console_v1()to authenticated;
-- An empty/incomplete register must never produce a green production gate.
create or replace function public.assert_privacy_production_ready(p_organization_id uuid)returns boolean language plpgsql stable security definer set search_path=pg_catalog,public,private as $$
begin
 if auth.jwt()->>'aal'is distinct from'aal2'or not private.privacy_manage_access(p_organization_id)then raise exception'PRIVACY_PRODUCTION_GATE_DENIED'using errcode='42501';end if;
 if not exists(select 1 from public.processing_activities where organization_id=p_organization_id and status='ACTIVE')
 or exists(select 1 from public.processing_activities a where a.organization_id=p_organization_id and a.status<>'RETIRED'and(a.status<>'ACTIVE'or a.cndp_formality_status not in('NOT_REQUIRED','COMPLETED')or a.effective_from is null or a.effective_from>current_date or a.effective_until<current_date
 or not exists(select 1 from public.processing_purposes p where p.processing_activity_id=a.id and length(btrim(p.legal_basis_reference))>0)
 or not exists(select 1 from public.data_categories d where d.processing_activity_id=a.id)
 or exists(select 1 from public.data_categories d where d.processing_activity_id=a.id and not exists(select 1 from public.retention_policies r where r.data_category_id=d.id and r.status='ACTIVE'and r.effective_from<=current_date and(r.effective_until is null or r.effective_until>=current_date)))))
 or exists(select 1 from unnest(array['fr-MA','ar-MA'])l where not exists(select 1 from public.privacy_notices n where n.organization_id=p_organization_id and n.locale=l and n.status='PUBLISHED'and n.effective_from<=clock_timestamp()))
 or exists(select 1 from public.international_transfers where organization_id=p_organization_id and(compliance_status<>'APPROVED'or expires_at<=clock_timestamp()))
 or exists(select 1 from public.processors where organization_id=p_organization_id and status='ACTIVE'and(dpa_status not in('SIGNED','NOT_REQUIRED')or security_review_status<>'APPROVED'))
 or exists(select 1 from public.subprocessor_register where organization_id=p_organization_id and authorization_status not in('APPROVED','REMOVED'))
 then raise exception'PRIVACY_PRODUCTION_GATE_BLOCKED'using errcode='55000';end if;
 return true;
end$$;
-- Sensitive DSR decisions require a traceable reason and private export references.
alter function public.transition_data_subject_request(uuid,integer,text,text,text,uuid)rename to transition_data_subject_request_delivery_internal;
revoke all on function public.transition_data_subject_request_delivery_internal(uuid,integer,text,text,text,uuid)from public,anon,authenticated,service_role;
create function public.transition_data_subject_request(p_request_id uuid,p_expected_version integer,p_new_status text,p_decision_reason_code text,p_export_storage_reference text,p_correlation_id uuid)returns integer language plpgsql security definer set search_path=pg_catalog,public,private as $$
begin
 if auth.jwt()->>'aal'is distinct from'aal2'then raise exception'PRIVACY_DSR_MFA_REQUIRED'using errcode='42501';end if;
 if length(btrim(coalesce(p_decision_reason_code,'')))not between 3 and 100 or p_correlation_id is null or(p_export_storage_reference is not null and(p_export_storage_reference like'%://%'or p_export_storage_reference like'%..%'or p_export_storage_reference like'/%'))then raise exception'INVALID_PRIVACY_DSR_EVIDENCE'using errcode='22023';end if;
 return public.transition_data_subject_request_delivery_internal(p_request_id,p_expected_version,p_new_status,p_decision_reason_code,p_export_storage_reference,p_correlation_id);
end$$;
revoke all on function public.transition_data_subject_request(uuid,integer,text,text,text,uuid)from public,anon,authenticated,service_role;
grant execute on function public.transition_data_subject_request(uuid,integer,text,text,text,uuid)to authenticated;
notify pgrst,'reload schema';
commit;
