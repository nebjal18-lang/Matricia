begin;
-- security_invoker views need an executable read boundary. The unrestricted
-- calculation remains private for matching/settlement; this wrapper checks the
-- caller's billing scope before returning a single invoice's derived amount.
create function public.get_provider_invoice_overdue_v1(p_invoice_id uuid)returns bigint language plpgsql stable security definer set search_path=pg_catalog,public,private as $$
declare org uuid;begin
 select provider_organization_id into org from public.provider_invoices where id=p_invoice_id;
 if not coalesce(auth.role()='service_role'or private.provider_billing_access(org,auth.uid()),false)then raise exception'PROVIDER_INVOICE_READ_DENIED'using errcode='42501';end if;
 return private.provider_invoice_overdue_minor_v1(p_invoice_id);
end$$;
revoke all on function public.get_provider_invoice_overdue_v1(uuid)from public,anon,authenticated,service_role;
grant execute on function public.get_provider_invoice_overdue_v1(uuid)to authenticated,service_role;
create or replace view public.provider_invoice_balances with(security_invoker=true)as
select i.*,totals.paid_minor,greatest(i.total_minor-totals.paid_minor-coalesce(credited.credited_minor,0),0)::bigint outstanding_minor,
 case when i.total_minor-totals.paid_minor-coalesce(credited.credited_minor,0)<=0 then'PAID'
 when public.get_provider_invoice_overdue_v1(i.id)>0 then'OVERDUE'
 when exists(select 1 from public.provider_payment_plans plan join lateral(select d.status from public.provider_payment_plan_decisions d where d.plan_id=plan.id order by d.decision_version desc limit 1)latest on true where plan.invoice_id=i.id and latest.status='APPROVED')then'PAYMENT_PLAN'
 when i.due_on<current_date then'OVERDUE'when totals.paid_minor+coalesce(credited.credited_minor,0)>0 then'PARTIALLY_PAID'else'ISSUED'end payment_status,
 coalesce(credited.credited_minor,0)::bigint credited_minor,greatest(totals.paid_minor+coalesce(credited.credited_minor,0)-i.total_minor,0)::bigint available_credit_minor
from public.provider_invoices i
left join(select invoice_id,sum(amount_minor)::bigint paid_minor from public.provider_payment_allocations group by invoice_id)paid on paid.invoice_id=i.id
left join(select invoice_id,sum(total_minor)::bigint credited_minor from public.provider_credit_notes group by invoice_id)credited on credited.invoice_id=i.id
left join(select target_invoice_id,sum(amount_minor)::bigint amount from public.provider_invoice_credit_transfers group by target_invoice_id)incoming on incoming.target_invoice_id=i.id
left join(select source_invoice_id,sum(amount_minor)::bigint amount from public.provider_invoice_credit_transfers group by source_invoice_id)outgoing on outgoing.source_invoice_id=i.id
cross join lateral(select(coalesce(paid.paid_minor,0)+coalesce(incoming.amount,0)-coalesce(outgoing.amount,0))::bigint paid_minor)totals;

create function public.list_provider_invoice_due_states_v1(p_invoice_ids uuid[])returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,private as $$begin
 if cardinality(p_invoice_ids)>100 then raise exception'INVALID_PAGE'using errcode='22023';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'overdue_minor',private.provider_invoice_overdue_minor_v1(i.id)::text))from public.provider_invoices i where i.id=any(p_invoice_ids)and private.provider_billing_access(i.provider_organization_id,auth.uid())),'[]');end$$;
-- A source requiring a historical exception review cannot silently become invoice eligible.
create table public.provider_payable_admissions_v1(payable_event_id uuid primary key references public.provider_payable_events(id),reason text not null,reviewed_by uuid not null references auth.users(id),reviewed_at timestamptz not null default clock_timestamp());
alter table public.provider_payable_admissions_v1 enable row level security;
revoke all on public.provider_payable_admissions_v1 from public,anon,authenticated,service_role;
create trigger payable_admissions_immutable before update or delete on public.provider_payable_admissions_v1 for each row execute function private.prevent_update_delete();
create function public.admit_provider_payable_v1(p_event_id uuid,p_reason text)returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare e public.provider_payable_events%rowtype;begin
 select*into e from public.provider_payable_events where id=p_event_id;
 if not private.provider_finance_reviewer_v1()or e.id is null or e.created_by=auth.uid()or private.is_active_org_member(e.provider_organization_id,auth.uid())or private.is_active_org_member(e.client_organization_id,auth.uid())then raise exception'INDEPENDENT_FINANCE_REVIEW_REQUIRED'using errcode='42501';end if;
 if length(btrim(coalesce(p_reason,'')))not between 10 and 2000 or not exists(select 1 from public.provider_payable_event_proofs p join private.provider_payment_proof_scan_results s on s.id=p.scan_result_id and s.result='CLEAN'and s.computed_sha256=p.sha256 where p.payable_event_id=e.id)then raise exception'REVIEWED_RECEIPT_PROOF_REQUIRED'using errcode='55000';end if;
 insert into public.provider_payable_admissions_v1(payable_event_id,reason,reviewed_by)values(e.id,p_reason,auth.uid())on conflict do nothing;
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(e.provider_organization_id,auth.uid(),'USER','provider.payable.admitted','provider_payable_event',e.id::text,e.id,jsonb_build_object('reason',p_reason),repeat('0',64));return jsonb_build_object('outcome','PROVIDER_PAYABLE_ADMITTED');end$$;
do $$declare d text;needle text;begin
 select pg_get_functiondef('public.run_provider_billing_scheduler_v1(integer)'::regprocedure)into d;
 needle:='if private.provider_contract_recipient_snapshot_v1(e.contract_version_id)is null then';
 if strpos(d,needle)=0 then raise exception'ELIGIBILITY_PATCH_TARGET_MISSING';end if;
 d:=replace(d,needle,'if not exists(select 1 from public.provider_financial_declaration_decisions_v1 dd where dd.decision=''APPROVED''and dd.response->>''payable_event_id''=e.id::text)and not exists(select 1 from public.provider_payable_admissions_v1 a where a.payable_event_id=e.id)then insert into public.provider_billing_exceptions_v1(provider_organization_id,period_end,source_id,reason_code)values(cfg.provider_organization_id,ending,e.id,''INDEPENDENT_RECEIPT_REVIEW_REQUIRED'')on conflict do nothing;continue;end if;'||needle);execute d;
end$$;
-- Ordinary documents are never manufactured by a provider through a legacy ABI.
create function private.guard_provider_billing_issuer_v1()returns trigger language plpgsql security definer set search_path=pg_catalog,private as $$begin
 if auth.role()is distinct from'service_role'and(not private.provider_finance_reviewer_v1()or private.is_active_org_member(new.provider_organization_id,auth.uid()))then raise exception'INDEPENDENT_FINANCE_ISSUER_REQUIRED'using errcode='42501';end if;return new;end$$;
revoke all on function private.guard_provider_billing_issuer_v1()from public,anon,authenticated,service_role;
create trigger governed_provider_statement_insert before insert on public.provider_statements for each row execute function private.guard_provider_billing_issuer_v1();
create trigger governed_provider_invoice_insert before insert on public.provider_invoices for each row execute function private.guard_provider_billing_issuer_v1();
-- Statement/dispute transitions produce durable outbox evidence even when no document is emitted.
create function private.provider_billing_workflow_outbox_v1()returns trigger language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare rowdata jsonb:=to_jsonb(new);org uuid;resource text;begin
 org:=nullif(rowdata->>'provider_organization_id','')::uuid;
 if org is null and rowdata?'period_id'then select provider_organization_id into org from public.provider_billing_periods_v1 where id=(rowdata->>'period_id')::uuid;end if;
 if org is null and rowdata?'policy_id'then select provider_organization_id into org from public.provider_closing_policies_v1 where id=(rowdata->>'policy_id')::uuid;end if;
 if org is null and rowdata?'dispute_id'then select p.provider_organization_id into org from public.provider_billing_line_disputes_v1 d join public.provider_billing_periods_v1 p on p.id=d.period_id where d.id=(rowdata->>'dispute_id')::uuid;end if;
 resource:=coalesce(rowdata->>'id',rowdata->>'period_id',rowdata->>'policy_id',rowdata->>'dispute_id');
 if org is not null then insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values(org,tg_table_name,resource,'ProviderBillingWorkflowChangedV1',extensions.gen_random_uuid(),jsonb_build_object('source_table',tg_table_name,'source_id',resource),'billing-workflow:'||tg_table_name||':'||resource);end if;return new;end$$;
revoke all on function private.provider_billing_workflow_outbox_v1()from public,anon,authenticated,service_role;
do $$declare t text;begin foreach t in array array['provider_closing_policies_v1','provider_closing_policy_decisions_v1','provider_billing_periods_v1','provider_billing_line_disputes_v1','provider_billing_dispute_resolutions_v1','provider_billing_period_completions_v1']loop execute format('create trigger billing_workflow_outbox after insert on public.%I for each row execute function private.provider_billing_workflow_outbox_v1()',t);end loop;end$$;
revoke all on function public.list_provider_invoice_due_states_v1(uuid[]),public.admit_provider_payable_v1(uuid,text)from public,anon,authenticated,service_role;
grant execute on function public.list_provider_invoice_due_states_v1(uuid[]),public.admit_provider_payable_v1(uuid,text)to authenticated;
notify pgrst,'reload schema';
create function public.get_provider_finance_admin_context_v1(p_org uuid default null)returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,private as $$begin
 if not private.provider_finance_reviewer_v1()then raise exception'INDEPENDENT_FINANCE_REVIEW_REQUIRED'using errcode='42501';end if;
 return jsonb_build_object('organizations',coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'name',o.display_name)order by o.display_name,o.id)from public.organizations o where exists(select 1 from public.provider_profiles p where p.provider_organization_id=o.id)),'[]'),
 'accounts',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'code',a.code,'currency',a.currency,'type',a.account_type)order by a.code,a.id)from public.financial_accounts a where a.organization_id=p_org),'[]'),
 'policies',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'created_by',p.created_by,'currency',p.currency,'effective_from',p.effective_from,'due_days',p.due_days,'dispute_days',p.dispute_days,'reference',p.reference,'decision',d.approved)order by p.created_at desc,p.id)from public.provider_closing_policies_v1 p left join public.provider_closing_policy_decisions_v1 d on d.policy_id=p.id where p.provider_organization_id=p_org),'[]'),
 'payments',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'reference',p.payment_reference,'currency',p.currency,'amount_minor',p.amount_minor::text))from public.provider_payments p where p.provider_organization_id=p_org),'[]'),
 'invoices',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'number',i.invoice_number,'currency',i.currency,'outstanding_minor',i.outstanding_minor::text,'payment_status',i.payment_status))from public.provider_invoice_balances i where i.provider_organization_id=p_org and i.outstanding_minor>0),'[]'));
end$$;
revoke all on function public.get_provider_finance_admin_context_v1(uuid)from public,anon,authenticated,service_role;
grant execute on function public.get_provider_finance_admin_context_v1(uuid)to authenticated;
create function public.get_provider_declaration_proof_v1(p_declaration_id uuid)returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,private as $$
declare d public.provider_financial_declarations_v1%rowtype;u public.provider_payment_proof_uploads%rowtype;begin
 select*into d from public.provider_financial_declarations_v1 where id=p_declaration_id;
 if d.id is null or not private.provider_declaration_access_v1(d.id)then raise exception'DECLARATION_PROOF_DENIED'using errcode='42501';end if;
 select*into u from public.provider_payment_proof_uploads where id=d.upload_id;
 if u.scan_status<>'CLEAN'then raise exception'CLEAN_DECLARATION_PROOF_REQUIRED'using errcode='55000';end if;
 return jsonb_build_object('bucket',u.storage_bucket,'path',u.storage_object_path,'mime',u.declared_mime_type,'sha256',u.declared_sha256);
end$$;
create function private.provider_declaration_file_access_v1(p_path text)returns boolean language sql stable security definer set search_path=pg_catalog,public,private as $$select exists(select 1 from public.provider_financial_declarations_v1 d join public.provider_payment_proof_uploads u on u.id=d.upload_id where u.storage_object_path=p_path and u.scan_status='CLEAN'and private.provider_declaration_access_v1(d.id))$$;
revoke all on function private.provider_declaration_file_access_v1(text)from public,anon,authenticated,service_role;
grant execute on function private.provider_declaration_file_access_v1(text)to authenticated;
create policy provider_declared_proof_read on storage.objects for select to authenticated using(bucket_id='provider-qualification'and private.provider_declaration_file_access_v1(name));
revoke all on function public.get_provider_declaration_proof_v1(uuid)from public,anon,authenticated,service_role;
grant execute on function public.get_provider_declaration_proof_v1(uuid)to authenticated;
notify pgrst,'reload schema';
-- Expose the effective plan status for all existing consumer views as well as RFQ guards.
create function public.get_provider_billing_scheduler_health_v1()returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,private as $$begin
 if not private.provider_finance_reviewer_v1()then raise exception'FINANCE_HEALTH_DENIED'using errcode='42501';end if;
 return jsonb_build_object('unfinished_periods',(select count(*)from public.provider_billing_periods_v1 p where not exists(select 1 from public.provider_billing_period_completions_v1 c where c.period_id=p.id)),'exceptions',(select count(*)from public.provider_billing_exceptions_v1));end$$;
revoke all on function public.get_provider_billing_scheduler_health_v1()from public,anon,authenticated,service_role;
grant execute on function public.get_provider_billing_scheduler_health_v1()to authenticated;
notify pgrst,'reload schema';
-- A submitted declaration is evidence, including a refused declaration. It cannot
-- be deleted through the pre-upload orphan cleanup policy while Finance reviews it.
create function private.provider_declaration_object_retained_v1(p_path text)returns boolean language sql stable security definer set search_path=pg_catalog,public as $$select exists(select 1 from public.provider_financial_declarations_v1 d join public.provider_payment_proof_uploads u on u.id=d.upload_id where u.storage_object_path=p_path)$$;
revoke all on function private.provider_declaration_object_retained_v1(text)from public,anon,authenticated,service_role;
grant execute on function private.provider_declaration_object_retained_v1(text)to authenticated;
drop policy provider_payment_proof_storage_orphan_delete on storage.objects;
create policy provider_payment_proof_storage_orphan_delete on storage.objects for delete to authenticated using(private.provider_payment_proof_upload_allowed(bucket_id,name,auth.uid())and not private.provider_declaration_object_retained_v1(name));
notify pgrst,'reload schema';
-- The historical recipient review must render a real quote field before Finance
-- can inspect and approve a legacy contractual recipient.
do $$declare d text;begin
 select pg_get_functiondef('public.get_provider_billing_recipient_review_context_v1(uuid)'::regprocedure)into d;
 if strpos(d,'q.title')=0 then raise exception'RECIPIENT_REVIEW_QUOTE_FIELD_PATCH_MISSING';end if;
 execute replace(d,'q.title','q.solution_fr');
end$$;
commit;
