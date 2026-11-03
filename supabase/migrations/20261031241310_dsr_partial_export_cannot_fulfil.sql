begin;
create or replace function public.transition_data_subject_request(p_request_id uuid,p_expected_version integer,p_new_status text,p_decision_reason_code text,p_export_storage_reference text,p_correlation_id uuid)returns integer language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare d public.data_subject_requests%rowtype;reference text:=p_export_storage_reference;
begin
 if auth.jwt()->>'aal'is distinct from'aal2'then raise exception'PRIVACY_DSR_MFA_REQUIRED'using errcode='42501';end if;
 select*into d from public.data_subject_requests where id=p_request_id;
 if not private.privacy_manage_access(d.organization_id)then raise exception'PRIVACY_DSR_TRANSITION_DENIED'using errcode='42501';end if;
 if length(btrim(coalesce(p_decision_reason_code,'')))not between 3 and 100 or p_correlation_id is null or(reference is not null and(reference like'%://%'or reference like'%..%'or reference like'/%'))then raise exception'INVALID_PRIVACY_DSR_EVIDENCE'using errcode='22023';end if;
 if p_new_status='FULFILLED'and d.request_type in('ACCESS','PORTABILITY')then
  -- The existing export covers only account and own correspondence. It neither
  -- establishes full requested scope nor proves delivery to the verified subject.
  raise exception'PRIVACY_SCOPE_REVIEW_AND_SUBJECT_DELIVERY_REQUIRED'using errcode='55000';
 end if;
 if p_new_status='FULFILLED'and d.request_type='RECTIFICATION'and not exists(select 1 from public.privacy_data_subject_rectification_proofs_v1 where request_id=d.id and organization_id=d.organization_id)then raise exception'PRIVACY_RECTIFICATION_EXECUTION_PROOF_REQUIRED'using errcode='55000';end if;
 if p_new_status='FULFILLED'and d.request_type='ERASURE'then raise exception'PRIVACY_FULL_ERASURE_EVIDENCE_REQUIRED'using errcode='55000';end if;
 return public.transition_data_subject_request_delivery_internal(p_request_id,p_expected_version,p_new_status,p_decision_reason_code,reference,p_correlation_id);
end$$;

commit;
