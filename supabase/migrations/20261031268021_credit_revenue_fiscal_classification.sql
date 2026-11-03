begin;
-- Fiscal recognition is never inferred from an unconfigured paid gross amount.
-- The existing four-eyes product policy also pins the non-cash recognition
-- accounts. This does not create a second cash entry or intercompany transfer.
create function private.validate_credit_recognition_mapping_v1(p_mapping jsonb)
returns void language plpgsql immutable set search_path=pg_catalog as $$
declare k text;v jsonb;codes text[]:='{}';begin
 if jsonb_typeof(p_mapping)is distinct from'object'or(select array_agg(key order by key)from jsonb_object_keys(p_mapping)key)is distinct from array['benefit_pool','core','tax','unallocated']::text[]then raise exception'APPROVED_RECOGNITION_ACCOUNT_MAPPING_REQUIRED'using errcode='22023';end if;
 foreach k in array array['core','benefit_pool','unallocated','tax']loop
  v:=p_mapping->k;
  if jsonb_typeof(v)is distinct from'object'or(select array_agg(key order by key)from jsonb_object_keys(v)key)is distinct from array['code','name_ar','name_fr']::text[]or coalesce(v->>'code','')!~'^[A-Z][A-Z0-9_]{2,60}$'or length(btrim(coalesce(v->>'name_fr','')))not between 2 and 200 or length(btrim(coalesce(v->>'name_ar','')))not between 2 and 200 or v->>'code'=any(codes)then raise exception'INVALID_RECOGNITION_ACCOUNT_MAPPING'using errcode='22023';end if;
  codes:=array_append(codes,v->>'code');
 end loop;
end$$;
revoke all on function private.validate_credit_recognition_mapping_v1(jsonb)from public,anon,authenticated,service_role;
do $$declare definition text;old_condition text:='from jsonb_object_keys(p_snapshot)key)is distinct from array[''billing_policy_version_id'']';marker text:='elsif p_kind=''ALLOCATION''then';begin
 select pg_get_functiondef('private.validate_credit_revenue_policy_v1(text,text,uuid,uuid,character,jsonb)'::regprocedure)into definition;
 if(length(definition)-length(replace(definition,old_condition,'')))/length(old_condition)<>1 or(length(definition)-length(replace(definition,marker,'')))/length(marker)<>1 then raise exception'FISCAL_POLICY_VALIDATION_SOURCE_MISMATCH';end if;
 definition:=replace(definition,old_condition,'from jsonb_object_keys(p_snapshot-''recognition_accounts'')key)is distinct from array[''billing_policy_version_id'']');
 definition:=replace(definition,marker,'perform private.validate_credit_recognition_mapping_v1(p_snapshot->''recognition_accounts'');'||chr(10)||' '||marker);
 execute definition;
end$$;

create table private.credit_economic_classification_journals_v1(
 classification_id uuid primary key references public.credit_economic_classifications_v1(id),financial_journal_id uuid not null unique references public.financial_journals(id),
 source_hash text not null check(source_hash~'^[a-f0-9]{64}$'),created_at timestamptz not null default clock_timestamp()
);
alter table private.credit_economic_classification_journals_v1 enable row level security;
revoke all on private.credit_economic_classification_journals_v1 from public,anon,authenticated,service_role;
create trigger credit_economic_classification_journals_immutable before update or delete on private.credit_economic_classification_journals_v1 for each row execute function private.prevent_update_delete();

create function private.credit_economic_pending_v1(p_funding uuid,p_redemption uuid,p_status text,p_reason text,p_context jsonb,p_correlation uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
begin
 insert into public.credit_economic_processing_events_v1(funding_source_id,redemption_id,status,reason_code,context_hash,details,correlation_id)
 values(p_funding,p_redemption,p_status,p_reason,private.canonical_request_hash(p_context),p_context,p_correlation)on conflict do nothing;
 return jsonb_build_object('status',p_status,'reason_code',p_reason,'funding_source_id',p_funding,'redemption_id',p_redemption);
end$$;
revoke all on function private.credit_economic_pending_v1(uuid,uuid,text,text,jsonb,uuid)from public,anon,authenticated,service_role;

create function private.classify_credit_economic_funding_v1(p_funding_source_id uuid,p_correlation_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare f public.credit_economic_funding_sources_v1%rowtype;c public.credit_economic_classifications_v1%rowtype;
 fiscal jsonb;allocation jsonb;billing public.client_billing_policy_versions%rowtype;invoice public.client_commercial_documents%rowtype;
 posting private.payment_posting_contexts_v1%rowtype;capture_source private.payment_suspense_journal_sources_v1%rowtype;
 pack public.credit_pack_payment_events_v1%rowtype;sub public.subscription_payment_events%rowtype;plan public.subscription_plan_versions%rowtype;
 actor uuid;tax bigint;net bigint;core bigint:=0;pool bigint:=0;unallocated bigint:=0;snapshot jsonb;h text;class_id uuid:=extensions.gen_random_uuid();journal uuid:=extensions.gen_random_uuid();
 mapping jsonb;entry record;account_id uuid;account_kind text;amount bigint;reason_context jsonb;
begin
 perform pg_advisory_xact_lock(hashtextextended('credit-economic-funding:'||p_funding_source_id::text,0));
 select*into f from public.credit_economic_funding_sources_v1 where id=p_funding_source_id;
 if f.id is null then raise exception'CREDIT_ECONOMIC_SOURCE_NOT_FOUND'using errcode='42501';end if;
 select*into c from public.credit_economic_classifications_v1 where funding_source_id=f.id order by version desc limit 1;
 if c.id is not null then return jsonb_build_object('status','READY','classification_id',c.id,'content_hash',c.content_hash,'replayed',true);end if;
 reason_context:=jsonb_build_object('source_hash',f.source_hash,'source_kind',f.source_kind,'gross_minor',f.gross_minor::text,'currency',f.currency);
 if f.source_hash is distinct from private.canonical_request_hash(f.source_snapshot)then raise exception'CREDIT_ECONOMIC_SOURCE_HASH_MISMATCH'using errcode='23514';end if;
 if f.source_kind='CREDIT_PACK'then
  select*into pack from public.credit_pack_payment_events_v1 where gateway||':'||provider_environment||':'||payment_reference=f.source_id and organization_id=f.organization_id and pack_version_id=f.source_version_id and financial_journal_id=f.financial_journal_id;
  if pack.id is null or private.credit_pack_payment_source_v1(pack.id)is null or not private.credit_pack_payment_funding_environment_compatible_v1(pack.id)or private.credit_lot_extra_funding_status_v1(pack.credit_lot_id)<>'ELIGIBLE'then return private.credit_economic_pending_v1(f.id,null,'SOURCE_REVIEW_REQUIRED','PURCHASE_CAPTURE_NOT_ADMISSIBLE',reason_context,p_correlation_id);end if;
  actor:=(select p.actor_id from public.credit_pack_payment_preparations_v1 p join public.credit_pack_payment_intents_v1 i on i.preparation_id=p.id where i.id=pack.payment_intent_id);
 else
  select*into sub from public.subscription_payment_events where gateway||':'||provider_environment||':'||payment_reference=f.source_id and organization_id=f.organization_id and event_type='PAYMENT_SUCCEEDED'and(activation_result->>'financial_journal_id')::uuid=f.financial_journal_id order by id limit 1;
  if sub.id is null or private.subscription_payment_cycle_v1(sub.id)is null or not private.subscription_payment_funding_environment_compatible_v1(sub.id)then return private.credit_economic_pending_v1(f.id,null,'SOURCE_REVIEW_REQUIRED','SUBSCRIPTION_CAPTURE_NOT_ADMISSIBLE',reason_context,p_correlation_id);end if;
  select*into plan from public.subscription_plan_versions where id=f.source_version_id;
  actor:=(select created_by from public.subscription_payment_intents where id=sub.payment_intent_id);
  select*into invoice from public.client_commercial_documents where payment_event_id=sub.id and kind='INVOICE'and organization_id=f.organization_id and currency=f.currency and total_minor=f.gross_minor;
 end if;
 fiscal:=private.approved_credit_revenue_policy_v1('FISCAL',f.source_kind,f.source_version_id,f.currency,f.paid_at::date);
 allocation:=private.approved_credit_revenue_policy_v1('ALLOCATION',f.source_kind,f.source_version_id,f.currency,f.paid_at::date);
 if fiscal is null then return private.credit_economic_pending_v1(f.id,null,'PENDING_FISCAL_REVIEW','APPROVED_PRODUCT_FISCAL_CONTEXT_REQUIRED',reason_context,p_correlation_id);end if;
 if allocation is null then return private.credit_economic_pending_v1(f.id,null,'PENDING_ALLOCATION_POLICY','APPROVED_PRODUCT_ALLOCATION_POLICY_REQUIRED',reason_context,p_correlation_id);end if;
 perform private.validate_credit_revenue_policy_v1('FISCAL',f.source_kind,f.source_version_id,null,f.currency,fiscal->'policy_snapshot');
 perform private.validate_credit_revenue_policy_v1('ALLOCATION',f.source_kind,f.source_version_id,null,f.currency,allocation->'policy_snapshot');
 select*into billing from public.client_billing_policy_versions where id=(fiscal#>>'{policy_snapshot,billing_policy_version_id}')::uuid and valid_from<=f.paid_at::date;
 if billing.id is null then return private.credit_economic_pending_v1(f.id,null,'PENDING_FISCAL_REVIEW','FISCAL_CONTEXT_NOT_EFFECTIVE_AT_CAPTURE',reason_context,p_correlation_id);end if;
 tax:=round(f.gross_minor::numeric*billing.tax_rate_bps/(10000+ billing.tax_rate_bps))::bigint;net:=f.gross_minor-tax;
 if invoice.id is not null and(invoice.policy_version_id<>billing.id or invoice.tax_minor<>tax or invoice.subtotal_minor<>net)then return private.credit_economic_pending_v1(f.id,null,'PENDING_FISCAL_REVIEW','CANONICAL_INVOICE_CONTEXT_DIVERGENCE',reason_context||jsonb_build_object('invoice_id',invoice.id),p_correlation_id);end if;
 if f.source_kind='SUBSCRIPTION'then
  if plan.id is null or plan.core_allocation_basis_points+plan.benefit_pool_allocation_basis_points<>10000 then raise exception'PAID_PLAN_SPLIT_REQUIRED'using errcode='23514';end if;
  core:=floor(net::numeric*plan.core_allocation_basis_points/10000)::bigint;pool:=net-core;
 else unallocated:=net;end if;
 select*into capture_source from private.payment_suspense_journal_sources_v1 where source_kind=f.source_kind and source_id=f.source_id and financial_journal_id=f.financial_journal_id;
 select*into posting from private.payment_posting_contexts_v1 where id=capture_source.posting_context_id;
 if posting.id is null or actor is null or posting.organization_id<>f.organization_id or posting.currency<>f.currency then return private.credit_economic_pending_v1(f.id,null,'SOURCE_REVIEW_REQUIRED','FROZEN_CAPTURE_POSTING_CONTEXT_REQUIRED',reason_context,p_correlation_id);end if;
 mapping:=fiscal#>'{policy_snapshot,recognition_accounts}';
 snapshot:=jsonb_build_object('funding_source_id',f.id,'source_hash',f.source_hash,'fiscal_policy',fiscal,'billing_policy',to_jsonb(billing),'invoice',case when invoice.id is not null then to_jsonb(invoice)end,'allocation_policy',allocation,'plan',case when plan.id is not null then to_jsonb(plan)end,'gross_minor',f.gross_minor::text,'net_minor',net::text,'tax_minor',tax::text,'core_minor',core::text,'benefit_pool_minor',pool::text,'unallocated_credit_minor',unallocated::text,'currency',f.currency,'capture_journal_id',f.financial_journal_id,'posting_context_hash',posting.context_hash,'classification_journal_id',journal);
 h:=private.canonical_request_hash(snapshot);
 insert into public.credit_economic_classifications_v1(id,funding_source_id,version,fiscal_policy_id,source_document_id,allocation_policy_id,gross_minor,net_minor,tax_minor,core_minor,benefit_pool_minor,unallocated_credit_minor,classification_snapshot,content_hash,created_by,correlation_id)
 values(class_id,f.id,1,(fiscal->>'id')::uuid,invoice.id,(allocation->>'id')::uuid,f.gross_minor,net,tax,core,pool,unallocated,snapshot,h,actor,p_correlation_id);
 insert into public.financial_journals(id,organization_id,journal_type,currency,idempotency_scope,idempotency_key,correlation_id,effective_at,description,created_by)
 values(journal,f.organization_id,'CREDIT_REVENUE_CLASSIFICATION',f.currency,'credit.economic.classification',f.id::text,p_correlation_id,f.paid_at,'Governed fiscal recognition of verified payment; no additional cash',actor);
 insert into public.financial_entries(organization_id,journal_id,account_id,direction,amount_minor,currency)values(f.organization_id,journal,posting.suspense_account_id,'DEBIT',f.gross_minor,f.currency);
 for entry in select*from(values('core',core),('benefit_pool',pool),('unallocated',unallocated),('tax',tax))x(kind,value)loop
  if entry.value=0 then continue;end if;
  account_kind:=case entry.kind when'tax'then'LIABILITY'else'REVENUE'end;
  if mapping#>>array[entry.kind,'code']in(select code from public.financial_accounts where id in(posting.cash_account_id,posting.suspense_account_id))then raise exception'RECOGNITION_ACCOUNT_COLLIDES_WITH_CASH_OR_SUSPENSE'using errcode='23514';end if;
  insert into public.financial_accounts(organization_id,code,name,account_type,currency)values(f.organization_id,mapping#>>array[entry.kind,'code'],mapping#>>array[entry.kind,'name_fr'],account_kind,f.currency)on conflict(organization_id,code)do nothing;
  select id into account_id from public.financial_accounts where organization_id=f.organization_id and code=mapping#>>array[entry.kind,'code'];
  if not exists(select 1 from public.financial_accounts where id=account_id and organization_id=f.organization_id and currency=f.currency and account_type=account_kind)then raise exception'RECOGNITION_ACCOUNT_TYPE_MISMATCH'using errcode='23514';end if;
  insert into public.financial_entries(organization_id,journal_id,account_id,direction,amount_minor,currency)values(f.organization_id,journal,account_id,'CREDIT',entry.value,f.currency);
 end loop;
 insert into private.credit_economic_classification_journals_v1(classification_id,financial_journal_id,source_hash)values(class_id,journal,h);
 insert into public.credit_revenue_ledger_v1(funding_source_id,classification_id,entry_type,revenue_class,amount_minor,currency,source_key,source_hash,correlation_id)
 values(f.id,class_id,'CLASSIFY','CAPTURE_GROSS_PENDING',-f.gross_minor,f.currency,class_id::text,h,p_correlation_id);
 for entry in select*from(values('CORE_SUBSCRIPTION_REVENUE',core),('BENEFIT_POOL_REVENUE',pool),('UNALLOCATED_CREDIT_REVENUE',unallocated),('TAX_EXCLUDED',tax))x(kind,value)loop
  if entry.value<>0 then insert into public.credit_revenue_ledger_v1(funding_source_id,classification_id,entry_type,revenue_class,amount_minor,currency,source_key,source_hash,correlation_id)values(f.id,class_id,'CLASSIFY',entry.kind,entry.value,f.currency,class_id::text,h,p_correlation_id);end if;
 end loop;
 insert into public.credit_economic_funding_evidence_v1(funding_source_id,evidence_kind,evidence_id,evidence_hash,evidence_snapshot,correlation_id)
 values(f.id,case when invoice.id is null then'FISCAL_CONTEXT'else'FISCAL_DOCUMENT'end,coalesce(invoice.id,(fiscal->>'id')::uuid)::text,h,snapshot,p_correlation_id)on conflict do nothing;
 perform private.credit_economic_pending_v1(f.id,null,'READY','FISCAL_CLASSIFICATION_RECORDED',jsonb_build_object('classification_id',class_id,'source_hash',h),p_correlation_id);
 insert into public.audit_events(organization_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(f.organization_id,'SERVICE','credit.economic.classified','credit_economic_classification',class_id::text,p_correlation_id,jsonb_build_object('source_hash',h,'funding_source_id',f.id,'journal_id',journal),repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values(f.organization_id,'credit_economic_classification',class_id::text,'CreditEconomicClassifiedV1',p_correlation_id,jsonb_build_object('classification_id',class_id,'funding_source_id',f.id,'content_hash',h),'economic-classification:'||class_id::text);
 return jsonb_build_object('status','READY','classification_id',class_id,'content_hash',h,'classification_journal_id',journal,'net_minor',net::text,'tax_minor',tax::text,'replayed',false);
end$$;
revoke all on function private.classify_credit_economic_funding_v1(uuid,uuid)from public,anon,authenticated,service_role;

create function public.reconcile_credit_economic_funding_v1(p_funding_source_id uuid,p_correlation_id uuid default extensions.gen_random_uuid())returns jsonb language plpgsql security definer set search_path=pg_catalog as $$begin
 if not private.credit_revenue_finance_access_v1(auth.uid(),true)then raise exception'CREDIT_ECONOMIC_RECONCILIATION_DENIED'using errcode='42501';end if;
 return private.classify_credit_economic_funding_v1(p_funding_source_id,p_correlation_id);
end$$;
revoke all on function public.reconcile_credit_economic_funding_v1(uuid,uuid)from public,anon,authenticated,service_role;
grant execute on function public.reconcile_credit_economic_funding_v1(uuid,uuid)to authenticated;
notify pgrst,'reload schema';
commit;
