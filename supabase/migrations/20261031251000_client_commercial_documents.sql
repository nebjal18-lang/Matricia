-- Client subscription invoices/credit notes are distinct from Provider commissions.
-- No identity or fiscal rate is seeded: approved, versioned configuration is mandatory.
begin;
create function private.client_billing_admin(p_actor uuid default auth.uid())returns boolean language sql stable security definer set search_path=pg_catalog,private as $$
 select p_actor is not null and coalesce(auth.jwt()->>'aal','')='aal2'and private.has_platform_role(array['SUPER_ADMIN','FINANCE_MANAGER'],p_actor)
$$;
create function private.can_read_client_billing(p_organization_id uuid)returns boolean language sql stable security definer set search_path=pg_catalog,private as $$
 select auth.uid()is not null and(private.has_org_role(p_organization_id,array['CLIENT_OWNER','CLIENT_ADMIN','CLIENT_ACCOUNTING','CLIENT_VIEWER'],auth.uid())or private.client_billing_admin(auth.uid()))
$$;
revoke all on function private.client_billing_admin(uuid),private.can_read_client_billing(uuid)from public,anon,authenticated,service_role;
grant execute on function private.can_read_client_billing(uuid)to authenticated;
create table public.client_billing_policy_versions(
 id uuid primary key default extensions.gen_random_uuid(),series_key text not null check(series_key~'^[A-Z][A-Z0-9_]{2,63}$'),version integer not null check(version>0),currency char(3)not null check(currency~'^[A-Z]{3}$'),
 tax_rate_bps integer not null check(tax_rate_bps between 0 and 10000),tax_label_fr text not null,tax_label_ar text not null,jurisdiction text not null,
 rounding_rule text not null default'HALF_UP'check(rounding_rule='HALF_UP'),price_basis text not null default'GROSS_INCLUDES_TAX'check(price_basis='GROSS_INCLUDES_TAX'),tax_rounding_basis text not null default'TAX_FROM_GROSS'check(tax_rounding_basis='TAX_FROM_GROSS'),
 issuer_snapshot jsonb not null check(jsonb_typeof(issuer_snapshot)='object'),invoice_prefix text not null check(invoice_prefix~'^[A-Z0-9]{2,12}$'),credit_prefix text not null check(credit_prefix~'^[A-Z0-9]{2,12}$'),
 invoice_start_number bigint not null check(invoice_start_number>0),credit_start_number bigint not null check(credit_start_number>0),
 valid_from date not null,service_label_fr text not null,service_label_ar text not null,approval_reference text not null,
 content_hash text not null check(content_hash~'^[0-9a-f]{64}$'),created_by uuid not null references auth.users(id),created_at timestamptz not null default clock_timestamp(),unique(series_key,version),check(invoice_prefix<>credit_prefix)
);
create table public.client_billing_policy_approvals(
 policy_id uuid primary key references public.client_billing_policy_versions(id),decision text not null check(decision in('APPROVED','REJECTED')),
 decided_by uuid not null references auth.users(id),reason text not null check(length(btrim(reason))between 10 and 2000),decided_at timestamptz not null default clock_timestamp()
);
create table private.billing_document_counters(series_key text not null,document_kind text not null check(document_kind in('INVOICE','CREDIT_NOTE')),fiscal_year integer not null,last_number bigint not null check(last_number>0),primary key(series_key,document_kind,fiscal_year));
create table public.client_commercial_documents(
 id uuid primary key default extensions.gen_random_uuid(),organization_id uuid not null references public.organizations(id),kind text not null check(kind in('INVOICE','CREDIT_NOTE')),document_number text not null unique,
 payment_event_id bigint not null references public.subscription_payment_events(id),adjustment_id uuid references public.subscription_payment_adjustments(id),original_invoice_id uuid references public.client_commercial_documents(id),
 policy_version_id uuid not null references public.client_billing_policy_versions(id),issued_on date not null,currency char(3)not null check(currency~'^[A-Z]{3}$'),
 subtotal_minor bigint not null check(subtotal_minor>=0),tax_minor bigint not null check(tax_minor>=0),total_minor bigint not null check(total_minor>0 and total_minor=subtotal_minor+tax_minor),
 tax_rate_bps integer not null check(tax_rate_bps between 0 and 10000),document_snapshot jsonb not null check(jsonb_typeof(document_snapshot)='object'),source_hash text not null check(source_hash~'^[0-9a-f]{64}$'),
 created_by uuid not null references auth.users(id),created_at timestamptz not null default clock_timestamp(),correlation_id uuid not null,
 check((kind='INVOICE'and adjustment_id is null and original_invoice_id is null)or(kind='CREDIT_NOTE'and adjustment_id is not null and original_invoice_id is not null))
);
create unique index client_commercial_one_invoice_per_capture on public.client_commercial_documents(payment_event_id)where kind='INVOICE';
create unique index client_commercial_one_credit_per_adjustment on public.client_commercial_documents(adjustment_id)where kind='CREDIT_NOTE';
create index client_commercial_org_history on public.client_commercial_documents(organization_id,created_at desc,id);
create table public.client_commercial_document_artifacts(
 document_id uuid not null references public.client_commercial_documents(id),locale text not null check(locale in('fr','ar')),source_hash text not null check(source_hash~'^[0-9a-f]{64}$'),
 pdf_sha256 text not null check(pdf_sha256~'^[0-9a-f]{64}$'),size_bytes integer not null check(size_bytes between 100 and 5242880),storage_path text not null unique,
 renderer_version text not null check(renderer_version='CLIENT_BILLING_PDF_V1'),archived_at timestamptz not null default clock_timestamp(),primary key(document_id,locale)
);
alter table public.client_billing_policy_versions enable row level security;
alter table public.client_billing_policy_approvals enable row level security;
alter table private.billing_document_counters enable row level security;
alter table public.client_commercial_documents enable row level security;
alter table public.client_commercial_document_artifacts enable row level security;
revoke all on public.client_billing_policy_versions,public.client_billing_policy_approvals,private.billing_document_counters,public.client_commercial_documents,public.client_commercial_document_artifacts from public,anon,authenticated,service_role;
grant select on public.client_commercial_documents,public.client_commercial_document_artifacts to authenticated;
create policy client_commercial_reader on public.client_commercial_documents for select to authenticated using(private.can_read_client_billing(organization_id));
create policy client_commercial_artifact_reader on public.client_commercial_document_artifacts for select to authenticated using(exists(select 1 from public.client_commercial_documents d where d.id=document_id));
create trigger client_billing_policy_immutable before update or delete on public.client_billing_policy_versions for each row execute function private.prevent_update_delete();
create trigger client_billing_approval_immutable before update or delete on public.client_billing_policy_approvals for each row execute function private.prevent_update_delete();
create trigger client_commercial_document_immutable before update or delete on public.client_commercial_documents for each row execute function private.prevent_update_delete();
create trigger client_commercial_artifact_immutable before update or delete on public.client_commercial_document_artifacts for each row execute function private.prevent_update_delete();

create function public.create_client_billing_policy_v1(p_payload jsonb,p_idempotency_key text)returns jsonb language plpgsql security definer set search_path=pg_catalog,private,extensions as $$
declare a uuid:=auth.uid();h text;r jsonb;issuer jsonb;policy uuid;p_version integer;p_rate integer;
begin
 if not private.client_billing_admin(a)then raise exception'BILLING_POLICY_CREATE_DENIED'using errcode='42501';end if;
 issuer:=p_payload->'issuer';
 if jsonb_typeof(p_payload)is distinct from'object'or octet_length(p_payload::text)>12000 or jsonb_typeof(issuer)is distinct from'object'
 or coalesce(p_payload->>'series_key','')!~'^[A-Z][A-Z0-9_]{2,63}$'or coalesce(p_payload->>'version','')!~'^[1-9][0-9]{0,5}$'or coalesce(p_payload->>'currency','')!~'^[A-Z]{3}$'
 or coalesce(p_payload->>'tax_rate_bps','')!~'^[0-9]{1,5}$'or length(btrim(coalesce(p_payload->>'tax_label_fr','')))not between 2 and 200 or length(btrim(coalesce(p_payload->>'tax_label_ar','')))not between 2 and 200
 or length(btrim(coalesce(p_payload->>'jurisdiction','')))not between 2 and 100 or coalesce(p_payload->>'invoice_prefix','')!~'^[A-Z0-9]{2,12}$'or coalesce(p_payload->>'credit_prefix','')!~'^[A-Z0-9]{2,12}$'or p_payload->>'invoice_prefix'=p_payload->>'credit_prefix'
 or coalesce(p_payload->>'invoice_start_number','')!~'^[1-9][0-9]{0,17}$'or coalesce(p_payload->>'credit_start_number','')!~'^[1-9][0-9]{0,17}$'or coalesce(p_payload->>'valid_from','')!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}$'or length(btrim(coalesce(p_payload->>'service_label_fr','')))not between 3 and 1000 or length(btrim(coalesce(p_payload->>'service_label_ar','')))not between 3 and 1000 or length(btrim(coalesce(p_payload->>'approval_reference','')))not between 3 and 500
 or length(btrim(coalesce(issuer->>'legal_name','')))not between 2 and 200 or length(btrim(coalesce(issuer->>'legal_form','')))not between 2 and 100 or length(btrim(coalesce(issuer->>'address','')))not between 3 and 1000
 or coalesce(issuer->>'ice','')!~'^[0-9]{15}$'or coalesce(issuer->>'if_number','')!~'^[0-9]{6,20}$'or length(btrim(coalesce(issuer->>'rc_number','')))not between 2 and 80 or coalesce(issuer->>'contact_email','')!~'^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
 then raise exception'BILLING_POLICY_CONFIGURATION_REQUIRED'using errcode='22023';end if;
 p_version:=(p_payload->>'version')::integer;p_rate:=(p_payload->>'tax_rate_bps')::integer;
 if p_rate>10000 then raise exception'INVALID_BILLING_TAX_RATE'using errcode='22023';end if;
 h:=private.canonical_request_hash(p_payload);r:=private.begin_admin_command('client.billing.policy.create',p_idempotency_key,h,a);if r is not null then return r;end if;
 select id into policy from public.client_billing_policy_versions where series_key=p_payload->>'series_key'and version=p_version;
 if policy is not null then raise exception'BILLING_POLICY_VERSION_EXISTS'using errcode='23505';end if;
 insert into public.client_billing_policy_versions(series_key,version,currency,tax_rate_bps,tax_label_fr,tax_label_ar,jurisdiction,issuer_snapshot,invoice_prefix,credit_prefix,invoice_start_number,credit_start_number,valid_from,service_label_fr,service_label_ar,approval_reference,content_hash,created_by)
 values(p_payload->>'series_key',p_version,(p_payload->>'currency')::char(3),p_rate,p_payload->>'tax_label_fr',p_payload->>'tax_label_ar',p_payload->>'jurisdiction',issuer,p_payload->>'invoice_prefix',p_payload->>'credit_prefix',(p_payload->>'invoice_start_number')::bigint,(p_payload->>'credit_start_number')::bigint,(p_payload->>'valid_from')::date,p_payload->>'service_label_fr',p_payload->>'service_label_ar',p_payload->>'approval_reference',h,a)returning id into policy;
 r:=jsonb_build_object('outcome','CLIENT_BILLING_POLICY_CREATED','policy_id',policy);
 insert into public.audit_events(actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(a,'USER','client.billing.policy_created','client_billing_policy_version',policy::text,policy,jsonb_build_object('content_hash',h),repeat('0',64));
 insert into public.event_outbox(aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values('client_billing_policy_version',policy::text,'ClientBillingPolicyCreatedV1',policy,jsonb_build_object('policy_id',policy),p_idempotency_key);
 perform private.finish_admin_command('client.billing.policy.create',p_idempotency_key,a,r);return r;
end$$;
create function public.approve_client_billing_policy_v1(p_policy_id uuid,p_approve boolean,p_reason text,p_idempotency_key text)returns jsonb language plpgsql security definer set search_path=pg_catalog,private,extensions as $$
declare a uuid:=auth.uid();p public.client_billing_policy_versions%rowtype;prior public.client_billing_policy_approvals%rowtype;h text;r jsonb;
begin
 if not private.client_billing_admin(a)then raise exception'BILLING_POLICY_APPROVAL_DENIED'using errcode='42501';end if;
 select*into p from public.client_billing_policy_versions where id=p_policy_id for update;
 if not found then raise exception'BILLING_POLICY_NOT_FOUND'using errcode='P0002';end if;
 if p.created_by=a then raise exception'FOUR_EYES_REQUIRED'using errcode='42501';end if;
 if not private.has_platform_role(array['SUPER_ADMIN','FINANCE_MANAGER'],p.created_by)then raise exception'BILLING_POLICY_CREATOR_AUTHORIZATION_REVOKED'using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('billing-policy-approval-numbering',0));
 if p_approve and exists(select 1 from public.client_billing_policy_versions other join public.client_billing_policy_approvals approved on approved.policy_id=other.id and approved.decision='APPROVED'where other.series_key<>p.series_key and(other.invoice_prefix in(p.invoice_prefix,p.credit_prefix)or other.credit_prefix in(p.invoice_prefix,p.credit_prefix)))then raise exception'BILLING_NUMBERING_SERIES_CONFLICT'using errcode='23514';end if;
 if p_approve is null or length(btrim(coalesce(p_reason,'')))not between 10 and 2000 then raise exception'INVALID_BILLING_POLICY_DECISION'using errcode='22023';end if;
 h:=private.canonical_request_hash(jsonb_build_object('policy',p.id,'approve',p_approve,'reason',btrim(p_reason)));r:=private.begin_admin_command('client.billing.policy.approve',p_idempotency_key,h,a);if r is not null then return r;end if;
 select*into prior from public.client_billing_policy_approvals where policy_id=p.id;
 if found then raise exception'BILLING_POLICY_ALREADY_DECIDED'using errcode='55000';end if;
 insert into public.client_billing_policy_approvals(policy_id,decision,decided_by,reason)values(p.id,case when p_approve then'APPROVED'else'REJECTED'end,a,btrim(p_reason));
 r:=jsonb_build_object('outcome',case when p_approve then'CLIENT_BILLING_POLICY_APPROVED'else'CLIENT_BILLING_POLICY_REJECTED'end,'policy_id',p.id);
 insert into public.audit_events(actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(a,'USER','client.billing.policy_decided','client_billing_policy_version',p.id::text,p.id,jsonb_build_object('approved',p_approve,'content_hash',p.content_hash),repeat('0',64));
 insert into public.event_outbox(aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values('client_billing_policy_version',p.id::text,'ClientBillingPolicyDecidedV1',p.id,jsonb_build_object('policy_id',p.id,'approved',p_approve),p_idempotency_key);
 perform private.finish_admin_command('client.billing.policy.approve',p_idempotency_key,a,r);return r;
end$$;

create function private.approved_billing_policy_snapshot(p_currency char(3),p_source_on date)returns jsonb language sql stable security definer set search_path=pg_catalog,private as $$
 select to_jsonb(p)||jsonb_build_object('policy_id',p.id,'invoice_start_number',p.invoice_start_number::text,'credit_start_number',p.credit_start_number::text)from public.client_billing_policy_versions p join public.client_billing_policy_approvals a on a.policy_id=p.id and a.decision='APPROVED'where p.currency=p_currency and p.valid_from<=p_source_on order by p.valid_from desc,p.version desc,p.created_at desc,p.id limit 1
$$;
create function public.get_approved_billing_policy_v1(p_currency char(3),p_source_on date)returns jsonb language plpgsql stable security definer set search_path=pg_catalog,private as $$
declare result jsonb;
begin
 if coalesce(auth.role(),'')<>'service_role'and not private.client_billing_admin(auth.uid())then raise exception'BILLING_POLICY_READ_DENIED'using errcode='42501';end if;
 result:=private.approved_billing_policy_snapshot(p_currency,p_source_on);if result is null then raise exception'BILLING_POLICY_REQUIRED'using errcode='55000';end if;return result;
end$$;
create function private.allocate_billing_document_number_v1(p_policy_id uuid,p_kind text,p_issued_on date)returns text language plpgsql security definer set search_path=pg_catalog,private as $$
declare p public.client_billing_policy_versions%rowtype;seq bigint;prefix text;y integer;
begin
 select*into p from public.client_billing_policy_versions where id=p_policy_id;
 if not found or p_kind not in('INVOICE','CREDIT_NOTE')or p_issued_on is null or not exists(select 1 from public.client_billing_policy_approvals where policy_id=p.id and decision='APPROVED')then raise exception'APPROVED_BILLING_POLICY_REQUIRED'using errcode='55000';end if;
 y:=extract(year from p_issued_on)::integer;prefix:=case when p_kind='INVOICE'then p.invoice_prefix else p.credit_prefix end;
 insert into private.billing_document_counters as counter(series_key,document_kind,fiscal_year,last_number)values(p.series_key,p_kind,y,case when p_kind='INVOICE'then p.invoice_start_number else p.credit_start_number end)on conflict(series_key,document_kind,fiscal_year)do update set last_number=greatest(counter.last_number+1,excluded.last_number) returning last_number into seq;
 return prefix||'-'||y::text||'-'||lpad(seq::text,greatest(8,length(seq::text)),'0');
end$$;

create function public.issue_client_commercial_document_v1(p_payment_event_id bigint,p_adjustment_id uuid,p_idempotency_key text,p_correlation_id uuid default extensions.gen_random_uuid())returns jsonb language plpgsql security definer set search_path=pg_catalog,private,extensions as $$
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
  select p.profile_data,p.organization_snapshot,p.id into profile,organization_snapshot,profile_id from public.client_trials t join public.client_profile_versions p on p.compliance_case_id=t.compliance_case_id and p.organization_id=t.organization_id and p.version=t.verified_profile_version where t.organization_id=pay.organization_id and p.created_at<=pay.paid_at and t.trial_started_at<=pay.paid_at limit 1;
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

create function public.get_client_billing_console_v1(p_page integer default 1)returns jsonb language plpgsql stable security definer set search_path=pg_catalog,private as $$
declare result jsonb;
begin
 if not private.client_billing_admin(auth.uid())then raise exception'CLIENT_BILLING_CONSOLE_DENIED'using errcode='42501';end if;
 if p_page is null or p_page not between 1 and 100000 then raise exception'INVALID_BILLING_PAGE'using errcode='22023';end if;
 with sources as(select p.*from public.subscription_payment_events p order by p.id desc offset(p_page-1)*100 limit 101)
 select jsonb_build_object('policies',coalesce((select jsonb_agg(to_jsonb(p)||jsonb_build_object('invoice_start_number',p.invoice_start_number::text,'credit_start_number',p.credit_start_number::text,'approval',(select to_jsonb(a)from public.client_billing_policy_approvals a where a.policy_id=p.id))order by p.created_at desc,p.id)from public.client_billing_policy_versions p),'[]'::jsonb),
 'sources',coalesce((select jsonb_agg(jsonb_build_object('payment_event_id',p.id::text,'organization_id',p.organization_id,'organization_name',o.legal_name,'payment_reference',p.payment_reference,'amount_minor',p.amount_minor::text,'currency',p.currency,'gateway',p.gateway,'paid_at',p.paid_at,'invoice_id',(select d.id from public.client_commercial_documents d where d.payment_event_id=p.id and d.kind='INVOICE'),
 'adjustments',coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'event_type',x.event_type,'amount_minor',x.amount_minor::text,'currency',x.currency,'occurred_at',x.occurred_at,'credit_note_id',(select d.id from public.client_commercial_documents d where d.adjustment_id=x.id))order by x.occurred_at,x.id)from public.subscription_payment_adjustments x where x.payment_event_id=p.id),'[]'::jsonb))order by p.id desc)from(select*from sources order by id desc limit 100)p join public.organizations o on o.id=p.organization_id),'[]'::jsonb),'has_next',(select count(*)>100 from sources),'page',p_page)into result;
 return result;
end$$;
create function public.list_client_commercial_documents_v1(p_organization_id uuid,p_query text default '',p_page integer default 1)returns jsonb language plpgsql stable security definer set search_path=pg_catalog,private as $$
declare result jsonb;
begin
 if not private.can_read_client_billing(p_organization_id)then raise exception'CLIENT_BILLING_READ_DENIED'using errcode='42501';end if;
 if p_page is null or p_page not between 1 and 100000 or length(coalesce(p_query,''))>200 then raise exception'INVALID_BILLING_PAGE'using errcode='22023';end if;
 with matched as(select d.*from public.client_commercial_documents d where d.organization_id=p_organization_id and(coalesce(p_query,'')=''or strpos(lower(d.document_number||' '||d.id::text||' '||d.payment_event_id::text),lower(p_query))>0)),page as(select*from matched order by created_at desc,id offset(p_page-1)*20 limit 21)
 select jsonb_build_object('documents',coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'kind',d.kind,'document_number',d.document_number,'payment_event_id',d.payment_event_id::text,'adjustment_id',d.adjustment_id,'original_invoice_id',d.original_invoice_id,'issued_on',d.issued_on,'currency',d.currency,'subtotal_minor',d.subtotal_minor::text,'tax_minor',d.tax_minor::text,'total_minor',d.total_minor::text,'source_hash',d.source_hash,
 'render_status',case when(select count(*)from public.client_commercial_document_artifacts a where a.document_id=d.id)=2 then'READY'else'PENDING_PDF'end)order by d.created_at desc,d.id)from page d),'[]'::jsonb),'total',(select count(*)from matched))into result;
 return result;
end$$;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)values('client-billing-documents','client-billing-documents',false,5242880,array['application/pdf'])on conflict(id)do nothing;
do $$begin if exists(select 1 from storage.buckets where id='client-billing-documents'and public)then raise exception'CLIENT_BILLING_BUCKET_MUST_BE_PRIVATE'using errcode='23514';end if;end$$;
create policy client_billing_objects_private on storage.objects as restrictive for all to anon,authenticated using(bucket_id<>'client-billing-documents')with check(bucket_id<>'client-billing-documents');
create function public.get_client_commercial_document_for_archive_v1(p_document_id uuid)returns jsonb language plpgsql stable security definer set search_path=pg_catalog,private as $$
declare d public.client_commercial_documents%rowtype;
begin
 if coalesce(auth.role(),'')<>'service_role'then raise exception'CLIENT_BILLING_ARCHIVE_DENIED'using errcode='42501';end if;
 select*into d from public.client_commercial_documents where id=p_document_id;if not found then raise exception'CLIENT_DOCUMENT_NOT_FOUND'using errcode='P0002';end if;
 return jsonb_build_object('id',d.id,'organization_id',d.organization_id,'snapshot',d.document_snapshot,'source_hash',d.source_hash,'artifacts',coalesce((select jsonb_agg(to_jsonb(a))from public.client_commercial_document_artifacts a where a.document_id=d.id),'[]'::jsonb));
end$$;
create function public.authorize_client_commercial_document_v1(p_document_id uuid)returns jsonb language plpgsql security definer set search_path=pg_catalog,private,extensions as $$
declare d public.client_commercial_documents%rowtype;
begin
 select*into d from public.client_commercial_documents where id=p_document_id;
 if not found or not private.can_read_client_billing(d.organization_id)then raise exception'CLIENT_BILLING_READ_DENIED'using errcode='42501';end if;
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(d.organization_id,auth.uid(),'USER','client.commercial_document.download_authorized','client_commercial_document',d.id::text,extensions.gen_random_uuid(),jsonb_build_object('source_hash',d.source_hash),repeat('0',64));
 return jsonb_build_object('id',d.id,'organization_id',d.organization_id,'snapshot',d.document_snapshot,'source_hash',d.source_hash,'artifacts',coalesce((select jsonb_agg(to_jsonb(a))from public.client_commercial_document_artifacts a where a.document_id=d.id),'[]'::jsonb));
end$$;
create function public.record_client_commercial_artifact_v1(p_document_id uuid,p_locale text,p_source_hash text,p_pdf_sha256 text,p_size_bytes integer)returns jsonb language plpgsql security definer set search_path=pg_catalog,private,extensions as $$
declare d public.client_commercial_documents%rowtype;existing public.client_commercial_document_artifacts%rowtype;path text;result jsonb;
begin
 if coalesce(auth.role(),'')<>'service_role'then raise exception'CLIENT_BILLING_ARCHIVE_DENIED'using errcode='42501';end if;
 select*into d from public.client_commercial_documents where id=p_document_id;
 if not found or p_source_hash is distinct from d.source_hash or p_locale is null or p_locale not in('fr','ar')or coalesce(p_pdf_sha256,'')!~'^[0-9a-f]{64}$'or p_size_bytes is null or p_size_bytes not between 100 and 5242880 then raise exception'INVALID_CLIENT_BILLING_ARTIFACT'using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('client-billing-artifact:'||d.id::text||':'||p_locale,0));
 path:=d.organization_id::text||'/'||d.id::text||'/'||p_locale||'/'||d.source_hash||'.pdf';
 select*into existing from public.client_commercial_document_artifacts where document_id=d.id and locale=p_locale;
 if found then
  if existing.source_hash<>p_source_hash or existing.pdf_sha256<>p_pdf_sha256 or existing.size_bytes<>p_size_bytes or existing.storage_path<>path then raise exception'CLIENT_BILLING_ARTIFACT_REPLAY_MISMATCH'using errcode='22000';end if;
  return to_jsonb(existing);
 end if;
 insert into public.client_commercial_document_artifacts(document_id,locale,source_hash,pdf_sha256,size_bytes,storage_path,renderer_version)values(d.id,p_locale,p_source_hash,p_pdf_sha256,p_size_bytes,path,'CLIENT_BILLING_PDF_V1')returning*into existing;
 result:=to_jsonb(existing);
 insert into public.audit_events(organization_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(d.organization_id,'SERVICE','client.commercial_document.archived','client_commercial_document',d.id::text,extensions.gen_random_uuid(),jsonb_build_object('locale',p_locale,'source_hash',p_source_hash,'pdf_sha256',p_pdf_sha256),repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values(d.organization_id,'client_commercial_document',d.id::text,'ClientCommercialDocumentArchivedV1',extensions.gen_random_uuid(),jsonb_build_object('document_id',d.id,'locale',p_locale,'pdf_sha256',p_pdf_sha256),'client-document-artifact:'||d.id::text||':'||p_locale);
 return result;
end$$;
revoke all on function private.approved_billing_policy_snapshot(character,date),private.allocate_billing_document_number_v1(uuid,text,date)from public,anon,authenticated,service_role;
revoke all on function public.create_client_billing_policy_v1(jsonb,text),public.approve_client_billing_policy_v1(uuid,boolean,text,text),public.issue_client_commercial_document_v1(bigint,uuid,text,uuid),public.get_client_billing_console_v1(integer),public.list_client_commercial_documents_v1(uuid,text,integer),public.authorize_client_commercial_document_v1(uuid),public.get_approved_billing_policy_v1(character,date),public.get_client_commercial_document_for_archive_v1(uuid),public.record_client_commercial_artifact_v1(uuid,text,text,text,integer)from public,anon,authenticated,service_role;
grant execute on function public.create_client_billing_policy_v1(jsonb,text),public.approve_client_billing_policy_v1(uuid,boolean,text,text),public.issue_client_commercial_document_v1(bigint,uuid,text,uuid),public.get_client_billing_console_v1(integer),public.list_client_commercial_documents_v1(uuid,text,integer),public.authorize_client_commercial_document_v1(uuid),public.get_approved_billing_policy_v1(character,date)to authenticated;
grant execute on function public.get_approved_billing_policy_v1(character,date),public.get_client_commercial_document_for_archive_v1(uuid),public.record_client_commercial_artifact_v1(uuid,text,text,text,integer)to service_role;
create table private.client_commercial_document_readiness(document_id uuid primary key references public.client_commercial_documents(id),ready_at timestamptz not null default clock_timestamp());
alter table private.client_commercial_document_readiness enable row level security;
revoke all on private.client_commercial_document_readiness from public,anon,authenticated,service_role;
create trigger client_commercial_readiness_immutable before update or delete on private.client_commercial_document_readiness for each row execute function private.prevent_update_delete();
create function public.complete_client_commercial_document_issue_v1(p_document_id uuid)returns jsonb language plpgsql security definer set search_path=pg_catalog,private,extensions as $$
declare d public.client_commercial_documents%rowtype;inserted integer;
begin
 if coalesce(auth.role(),'')<>'service_role'then raise exception'CLIENT_BILLING_ARCHIVE_DENIED'using errcode='42501';end if;
 select*into d from public.client_commercial_documents where id=p_document_id;
 if not found or(select count(*)from public.client_commercial_document_artifacts where document_id=d.id and source_hash=d.source_hash)<>2 then raise exception'CLIENT_BILLING_TRANSLATIONS_REQUIRED'using errcode='55000';end if;
 insert into private.client_commercial_document_readiness(document_id)values(d.id)on conflict do nothing;get diagnostics inserted=row_count;
 if inserted=0 then return jsonb_build_object('outcome','CLIENT_COMMERCIAL_DOCUMENT_READY','document_id',d.id);end if;
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values(d.organization_id,'client_commercial_document',d.id::text,'ClientCommercialDocumentReadyV1',d.id,jsonb_build_object('document_id',d.id),'client-document-ready:'||d.id::text)on conflict do nothing;
 return jsonb_build_object('outcome','CLIENT_COMMERCIAL_DOCUMENT_READY','document_id',d.id);
end$$;
revoke all on function public.complete_client_commercial_document_issue_v1(uuid)from public,anon,authenticated,service_role;
grant execute on function public.complete_client_commercial_document_issue_v1(uuid)to service_role;

commit;
