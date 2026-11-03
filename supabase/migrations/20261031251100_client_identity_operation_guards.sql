-- Identity review blocks new commitments without changing paid cycles or credit history.
-- Depends on canonical verification history from 20261031241200.
begin;
create function private.client_identity_allows_new_operations(p_organization_id uuid)returns boolean language plpgsql stable security definer set search_path=pg_catalog,private as $$
declare c public.client_compliance_cases%rowtype;p public.client_profile_versions%rowtype;requirement record;
begin
 if exists(select 1 from public.client_administrative_anomalies a where a.organization_id=p_organization_id and a.blocking and a.anomaly_code in('ICE_NOT_VERIFIED','IF_NOT_VERIFIED','RC_NOT_VERIFIED','ICE_MISMATCH','IF_MISMATCH','RC_MISMATCH')and a.status in('OPEN','QUESTIONED'))then return false;end if;
 -- A new onboarding organization is not rejected merely because it is PENDING.
 -- A previously verified identity must, however, complete its new review.
 if not exists(select 1 from public.client_trials where organization_id=p_organization_id)and not exists(select 1 from public.client_identity_verification_history where organization_id=p_organization_id)then return true;end if;
 select*into c from public.client_compliance_cases where organization_id=p_organization_id;
 if not found or c.status<>'VERIFIED'or c.verified_at is null or c.current_profile_version is null then return false;end if;
 select*into p from public.client_profile_versions where compliance_case_id=c.id and organization_id=c.organization_id and version=c.current_profile_version;
 if not found or not exists(select 1 from public.client_identity_verification_history h where h.compliance_case_id=c.id and h.organization_id=c.organization_id and h.profile_version=p.version)then return false;end if;
 if not exists(select 1 from public.organization_identifiers i where i.organization_id=c.organization_id and i.identifier_type='ICE'and i.is_active and i.verification_status='VERIFIED'and lower(i.normalized_value::text)=lower(p.organization_snapshot#>>'{identifiers,ICE}'))
 or not exists(select 1 from public.organization_identifiers i where i.organization_id=c.organization_id and i.identifier_type='IF'and i.is_active and i.verification_status='VERIFIED'and lower(i.normalized_value::text)=lower(p.profile_data->>'if_number'))
 or not exists(select 1 from public.organization_identifiers i where i.organization_id=c.organization_id and i.identifier_type='RC'and i.is_active and i.verification_status='VERIFIED'and lower(i.normalized_value::text)=lower(p.profile_data->>'rc_number'))then return false;end if;
 for requirement in select r.document_type from public.client_document_requirement_versions r where r.organization_kind='CLIENT'and r.required and r.status='ACTIVE'and r.effective_from<=clock_timestamp()and(r.effective_to is null or r.effective_to>clock_timestamp())and(r.library_code is null or coalesce(p.profile_data->'library_codes','[]'::jsonb)?r.library_code)loop
  if not exists(select 1 from public.client_compliance_evidence e join public.client_compliance_documents d on d.id=e.source_document_id and d.organization_id=c.organization_id join private.client_document_scan_results scan on scan.id=d.current_scan_result_id and scan.document_id=d.id and scan.organization_id=d.organization_id
   where e.compliance_case_id=c.id and e.evidence_type=requirement.document_type and e.review_status='VERIFIED'and e.validation_state='SCANNED_CLEAN'and d.status='VERIFIED'and d.scan_status='CLEAN'and(d.expires_on is null or d.expires_on>=current_date)and scan.result='CLEAN'and scan.computed_sha256=d.declared_sha256 and scan.detected_mime_type=d.detected_mime_type and scan.detected_size_bytes=d.detected_size_bytes and scan.sequence=(select max(latest.sequence)from private.client_document_scan_results latest where latest.document_id=d.id))then return false;end if;
 end loop;
 return true;
end$$;
revoke all on function private.client_identity_allows_new_operations(uuid)from public,anon,authenticated,service_role;
create function private.serialize_client_identity_transition()returns trigger language plpgsql security definer set search_path=pg_catalog,private as $$
declare org uuid;
begin
 org:=case when tg_op='DELETE'then old.organization_id else new.organization_id end;
 if tg_op='UPDATE'and old.organization_id is distinct from new.organization_id then raise exception'IMMUTABLE_IDENTITY_ORGANIZATION'using errcode='23514';end if;
 perform pg_advisory_xact_lock(hashtextextended('subscription-financial:'||org::text,0));
 if tg_op='DELETE'then return old;end if;return new;
end$$;
create trigger client_compliance_identity_transition_lock before insert or update or delete on public.client_compliance_cases for each row execute function private.serialize_client_identity_transition();
create trigger organization_identifier_identity_transition_lock before insert or update or delete on public.organization_identifiers for each row execute function private.serialize_client_identity_transition();
create trigger client_document_identity_transition_lock before update of status,scan_status,current_scan_result_id,expires_on on public.client_compliance_documents for each row execute function private.serialize_client_identity_transition();
create trigger client_evidence_identity_transition_lock before insert or update or delete on public.client_compliance_evidence for each row execute function private.serialize_client_identity_transition();
revoke all on function private.serialize_client_identity_transition()from public,anon,authenticated,service_role;
create or replace function private.client_may_open_new_service_request(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select
    private.subscription_financially_clear(p_organization_id)
    and private.client_identity_allows_new_operations(p_organization_id)
    and not exists (
      select 1
      from public.subscriptions subscription
      where subscription.organization_id = p_organization_id
        and subscription.status not in ('TRIAL_ACTIVE', 'ACTIVE')
    )
    and not exists (
      select 1
      from public.client_trials trial
      where trial.organization_id = p_organization_id
        and (trial.status = 'TRIAL_EXPIRED' or trial.trial_ends_at <= now())
        and not exists (
          select 1
          from public.subscriptions paid
          where paid.organization_id = p_organization_id
            and paid.status = 'ACTIVE'
        )
    )
    and not exists (
      select 1
      from public.client_administrative_anomalies anomaly
      where anomaly.organization_id = p_organization_id
        and anomaly.anomaly_code = 'DOCUMENT_EXPIRED'
        and anomaly.status in ('OPEN', 'QUESTIONED')
    );
$$;
create or replace function public.subscription_has_entitlement(p_organization_id uuid,p_entitlement_code text,p_at timestamptz default clock_timestamp())returns boolean language sql stable security definer set search_path=pg_catalog,public,private as $$select private.subscription_read_access(p_organization_id,auth.uid())and private.subscription_financially_clear(p_organization_id)and private.client_identity_allows_new_operations(p_organization_id)and case when exists(select 1 from public.client_trials t join public.trial_entitlement_versions te on te.entitlement_code=p_entitlement_code and te.status='ACTIVE'and te.enabled and te.effective_from<=p_at and(te.effective_to is null or te.effective_to>p_at)where t.organization_id=p_organization_id and t.status='TRIAL_ACTIVE'and p_at<t.trial_ends_at and not exists(select 1 from public.subscriptions s join public.subscription_entitlement_suspensions x on x.subscription_id=s.id where s.organization_id=p_organization_id and x.entitlement_code=p_entitlement_code and x.effective_from<=p_at and(x.effective_to is null or x.effective_to>p_at)))then true else exists(select 1 from public.subscriptions s join public.plan_entitlements e on e.plan_version_id=s.plan_version_id where s.organization_id=p_organization_id and s.status='ACTIVE'and p_at<s.current_period_end and e.entitlement_code=p_entitlement_code and e.enabled and not exists(select 1 from public.subscription_entitlement_suspensions x where x.subscription_id=s.id and x.entitlement_code=e.entitlement_code and x.effective_from<=p_at and(x.effective_to is null or x.effective_to>p_at)))end$$;
create or replace function private.guard_subscription_financial_credit_operation()returns trigger language plpgsql security definer set search_path=pg_catalog,private as $$
begin
 if new.entry_type in('RESERVE','CONSUME')or(new.entry_type='GRANT'and new.reference_type='SUBSCRIPTION_GRANT')then
  perform pg_advisory_xact_lock(hashtextextended('subscription-financial:'||new.organization_id::text,0));
  if exists(select 1 from public.subscription_financial_holds h where h.organization_id=new.organization_id and h.active)then raise exception 'SUBSCRIPTION_FINANCIAL_HOLD'using errcode='55000';end if;
  if not private.client_identity_allows_new_operations(new.organization_id)then raise exception'CLIENT_IDENTITY_REVIEW_REQUIRED'using errcode='55000';end if;
 end if;
 return new;
end$$;
create or replace function private.guard_subscription_financial_new_request()returns trigger language plpgsql security definer set search_path=pg_catalog,private as $$
begin
 perform pg_advisory_xact_lock(hashtextextended('subscription-financial:'||new.client_organization_id::text,0));
 if exists(select 1 from public.subscription_financial_holds h where h.organization_id=new.client_organization_id and h.active)then raise exception 'SUBSCRIPTION_FINANCIAL_HOLD'using errcode='55000';end if;
 if not private.client_identity_allows_new_operations(new.client_organization_id)then raise exception'CLIENT_IDENTITY_REVIEW_REQUIRED'using errcode='55000';end if;
 return new;
end$$;
revoke all on function private.client_may_open_new_service_request(uuid),private.guard_subscription_financial_credit_operation(),private.guard_subscription_financial_new_request()from public,anon,authenticated,service_role;
-- New documents use the identity verified at capture time; existing snapshots never change.
create or replace function public.issue_client_commercial_document_v1(p_payment_event_id bigint,p_adjustment_id uuid,p_idempotency_key text,p_correlation_id uuid default extensions.gen_random_uuid())returns jsonb language plpgsql security definer set search_path=pg_catalog,private,extensions as $$
declare actor uuid:=auth.uid();pay public.subscription_payment_events%rowtype;adjustment public.subscription_payment_adjustments%rowtype;prior public.client_commercial_documents%rowtype;invoice public.client_commercial_documents%rowtype;
 policy public.client_billing_policy_versions%rowtype;policy_json jsonb;profile jsonb;organization_snapshot jsonb;profile_id uuid;buyer jsonb;issuer jsonb;
 doc_id uuid:=extensions.gen_random_uuid();doc_kind text;number text;issued date:=(current_timestamp at time zone'Africa/Casablanca')::date;
 amount bigint;net bigint;tax bigint;credited bigint;credited_tax bigint;h text;result jsonb;snapshot jsonb;source_hash text;
begin
 select*into pay from public.subscription_payment_events where id=p_payment_event_id;
 if actor is null or not found or coalesce(auth.jwt()->>'aal','')<>'aal2'or not(private.client_billing_admin(actor)or private.has_org_role(pay.organization_id,array['CLIENT_OWNER','CLIENT_ADMIN','CLIENT_ACCOUNTING'],actor))then raise exception'CLIENT_DOCUMENT_ISSUE_DENIED'using errcode='42501';end if;
 if pay.gateway='DEMO'then raise exception'SIMULATED_PAYMENT_NOT_INVOICEABLE'using errcode='55000';end if;
 perform pg_advisory_xact_lock(hashtextextended('client-commercial-payment:'||pay.id::text,0));
 h:=private.canonical_request_hash(jsonb_build_object('payment_event_id',pay.id,'adjustment_id',p_adjustment_id));
 result:=private.begin_contract_command(pay.organization_id,'client.commercial.issue',p_idempotency_key,h,actor);if result is not null then return result;end if;
 doc_kind:=case when p_adjustment_id is null then'INVOICE'else'CREDIT_NOTE'end;
 select*into prior from public.client_commercial_documents where payment_event_id=pay.id and((doc_kind='INVOICE'and client_commercial_documents.kind='INVOICE')or(doc_kind='CREDIT_NOTE'and adjustment_id=p_adjustment_id));
 if found then
  result:=jsonb_build_object('outcome','CLIENT_DOCUMENT_ALREADY_ISSUED','document_id',prior.id,'document_number',prior.document_number,'kind',prior.kind);
  perform private.finish_contract_command(pay.organization_id,'client.commercial.issue',p_idempotency_key,result);return result;
 end if;
 if doc_kind='CREDIT_NOTE'then
  select*into adjustment from public.subscription_payment_adjustments where id=p_adjustment_id and payment_event_id=pay.id and currency=pay.currency and event_type in('REFUND_SUCCEEDED','PAYMENT_REVERSED');
  if not found then raise exception'CONFIRMED_CLIENT_REFUND_REQUIRED'using errcode='23514';end if;
  select*into invoice from public.client_commercial_documents where payment_event_id=pay.id and client_commercial_documents.kind='INVOICE';
  if not found then
   perform public.issue_client_commercial_document_v1(pay.id,null,'source-invoice-'||pay.id::text,p_correlation_id);
   select*into invoice from public.client_commercial_documents where payment_event_id=pay.id and client_commercial_documents.kind='INVOICE';
  end if;
  if invoice.id is null or invoice.organization_id<>pay.organization_id then raise exception'CLIENT_ORIGINAL_INVOICE_REQUIRED'using errcode='23514';end if;
  select*into policy from public.client_billing_policy_versions where id=invoice.policy_version_id;
  issuer:=invoice.document_snapshot->'issuer';buyer:=invoice.document_snapshot->'buyer';amount:=adjustment.amount_minor;
  select coalesce(sum(total_minor),0),coalesce(sum(tax_minor),0)into credited,credited_tax from public.client_commercial_documents where original_invoice_id=invoice.id and client_commercial_documents.kind='CREDIT_NOTE';
  if credited+amount>invoice.total_minor then raise exception'CLIENT_CREDIT_EXCEEDS_INVOICE'using errcode='23514';end if;
  -- Cumulative proportional rounding guarantees that a full refund credits the
  -- original tax exactly, regardless of the order of partial credit notes.
  tax:=round(invoice.tax_minor::numeric*(credited+amount)/invoice.total_minor)::bigint-credited_tax;net:=amount-tax;
 else
  policy_json:=private.approved_billing_policy_snapshot(pay.currency,(pay.paid_at at time zone'Africa/Casablanca')::date);
  if policy_json is null then raise exception'BILLING_POLICY_REQUIRED'using errcode='55000';end if;
  select*into policy from public.client_billing_policy_versions where id=(policy_json->>'policy_id')::uuid;
  issuer:=policy.issuer_snapshot;
  with verified_versions as(
   select h.compliance_case_id,h.organization_id,h.profile_version,h.verified_at from public.client_identity_verification_history h where h.organization_id=pay.organization_id
   union all
   select t.compliance_case_id,t.organization_id,t.verified_profile_version,t.trial_started_at from public.client_trials t where t.organization_id=pay.organization_id and not exists(select 1 from public.client_identity_verification_history h where h.compliance_case_id=t.compliance_case_id and h.profile_version=t.verified_profile_version)
  )select p.profile_data,p.organization_snapshot,p.id into profile,organization_snapshot,profile_id from verified_versions v join public.client_profile_versions p on p.compliance_case_id=v.compliance_case_id and p.organization_id=v.organization_id and p.version=v.profile_version where v.organization_id=pay.organization_id and v.verified_at<=pay.paid_at and p.created_at<=pay.paid_at order by v.verified_at desc,p.version desc,p.id limit 1;
  if profile_id is null or length(btrim(coalesce(organization_snapshot->>'legal_name','')))not between 2 and 200 or length(btrim(coalesce(profile->>'legal_form','')))not between 2 and 100
   or length(btrim(coalesce(profile#>>'{registered_address,line1}','')))not between 3 and 300 or coalesce(organization_snapshot#>>'{identifiers,ICE}','')!~'^[0-9]{15}$'or coalesce(profile->>'if_number','')!~'^[0-9]{6,20}$'or length(btrim(coalesce(profile->>'rc_number','')))not between 2 and 80
   then raise exception'CLIENT_BILLING_IDENTITY_REQUIRED'using errcode='55000';end if;
  buyer:=jsonb_build_object('legal_name',organization_snapshot->>'legal_name','legal_form',profile->>'legal_form','address',concat_ws(', ',profile#>>'{registered_address,line1}',nullif(profile#>>'{registered_address,line2}',''),profile->>'registered_city'),'ice',organization_snapshot#>>'{identifiers,ICE}','if_number',profile->>'if_number','rc_number',profile->>'rc_number','profile_version_id',profile_id);
  amount:=pay.amount_minor;
  if amount<=0 then raise exception'POSITIVE_CAPTURE_REQUIRED'using errcode='23514';end if;
  tax:=round(amount::numeric*policy.tax_rate_bps/(10000+policy.tax_rate_bps))::bigint;net:=amount-tax;
 end if;
 number:=private.allocate_billing_document_number_v1(policy.id,doc_kind,issued);
 snapshot:=jsonb_build_object('id',doc_id,'number',number,'kind',doc_kind,'issued_on',issued,'currency',pay.currency,'subtotal_minor',net::text,'tax_minor',tax::text,'total_minor',amount::text,'tax_rate_bps',policy.tax_rate_bps,'tax_label_fr',policy.tax_label_fr,'tax_label_ar',policy.tax_label_ar,'tax_jurisdiction',policy.jurisdiction,'rounding_rule',policy.rounding_rule,'price_basis',policy.price_basis,'tax_rounding_basis',policy.tax_rounding_basis,'policy_version_id',policy.id,'policy_version',policy.version,'issuer',issuer,'buyer',buyer,'label_fr',policy.service_label_fr,'label_ar',policy.service_label_ar,'original_invoice_number',invoice.document_number,'payment_reference',pay.payment_reference,'paid_at',pay.paid_at,'payment_event_id',pay.id::text,'adjustment_id',p_adjustment_id);
 source_hash:=private.canonical_request_hash(snapshot);
 insert into public.client_commercial_documents(id,organization_id,kind,document_number,payment_event_id,adjustment_id,original_invoice_id,policy_version_id,issued_on,currency,subtotal_minor,tax_minor,total_minor,tax_rate_bps,document_snapshot,source_hash,created_by,correlation_id)
 values(doc_id,pay.organization_id,doc_kind,number,pay.id,p_adjustment_id,invoice.id,policy.id,issued,pay.currency,net,tax,amount,policy.tax_rate_bps,snapshot,source_hash,actor,p_correlation_id);
 result:=jsonb_build_object('outcome','CLIENT_DOCUMENT_ISSUED','document_id',doc_id,'document_number',number,'kind',doc_kind);
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(pay.organization_id,actor,'USER','client.commercial_document.issued','client_commercial_document',doc_id::text,p_correlation_id,jsonb_build_object('kind',doc_kind,'source_hash',source_hash,'policy_version_id',policy.id,'payment_event_id',pay.id::text,'adjustment_id',p_adjustment_id),repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values(pay.organization_id,'client_commercial_document',doc_id::text,'ClientCommercialDocumentIssuedV1',p_correlation_id,jsonb_build_object('document_id',doc_id),'client-document:'||doc_id::text);
 perform private.finish_contract_command(pay.organization_id,'client.commercial.issue',p_idempotency_key,result);return result;
end$$;
commit;
