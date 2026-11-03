begin;
-- Fair retry metadata is operational state, never a mutable financial ledger.
create table private.provider_billing_execution_attempts_v1(provider_organization_id uuid not null references public.organizations(id),currency char(3)not null,last_attempt_at timestamptz not null,attempt_count bigint not null,primary key(provider_organization_id,currency));
alter table private.provider_billing_execution_attempts_v1 enable row level security;
revoke all on private.provider_billing_execution_attempts_v1 from public,anon,authenticated,service_role;
do $migration$
declare definition text;needle text;
begin
 definition:=pg_get_functiondef('private.ingest_provider_dispute_payables_v1(integer)'::regprocedure);
 if strpos(definition,'m.contract_version_id')=0 then raise exception'DISPUTE_SOURCE_VERSION_PATCH_MISSING';end if;
 definition:=replace(definition,'m.contract_version_id','dc.contract_version_id');
 needle:='  category:=case when';
 if strpos(definition,needle)=0 then raise exception'DISPUTE_BENEFICIARY_PATCH_MISSING';end if;
 definition:=replace(definition,needle,$patch$
  if x.consequence_type='CONTRACTUAL_PENALTY'then
   insert into public.provider_billing_exceptions_v1(provider_organization_id,period_end,source_id,reason_code,context)
   values(x.provider_organization_id,ending,x.id,case when x.beneficiary_organization_id is not null then'CLIENT_BENEFICIARY_COLLECTION_MANDATE_REQUIRED'else'PENALTY_BENEFICIARY_REVIEW_REQUIRED'end,jsonb_build_object('dispute_case_id',x.dispute_case_id,'contract_version_id',x.contract_version_id,'beneficiary_organization_id',x.beneficiary_organization_id,'amount_minor',x.amount_minor::text,'currency',x.currency))on conflict do nothing;
   continue;
  end if;
$patch$||needle);
 execute definition;
 definition:=pg_get_functiondef('public.run_provider_billing_scheduler_v1(integer)'::regprocedure);
 needle:='order by p.provider_organization_id,p.currency limit p_limit loop';
 if strpos(definition,needle)=0 then raise exception'CLOSING_FAIRNESS_ORDER_PATCH_MISSING';end if;
 definition:=replace(definition,needle,'order by coalesce((select a.last_attempt_at from private.provider_billing_execution_attempts_v1 a where a.provider_organization_id=p.provider_organization_id and a.currency=p.currency),''-infinity''::timestamptz),p.provider_organization_id,p.currency limit p_limit loop');
 needle:=' begin'||chr(10)||'  select*into period';
 if strpos(definition,needle)=0 then raise exception'CLOSING_FAIRNESS_ATTEMPT_PATCH_MISSING';end if;
 definition:=replace(definition,needle,$patch$
 insert into private.provider_billing_execution_attempts_v1(provider_organization_id,currency,last_attempt_at,attempt_count)values(cfg.provider_organization_id,cfg.currency,clock_timestamp(),1)on conflict(provider_organization_id,currency)do update set last_attempt_at=excluded.last_attempt_at,attempt_count=private.provider_billing_execution_attempts_v1.attempt_count+1;
$patch$||needle);execute definition;
 -- A historical admission is a reviewed client receipt, not permission to turn
 -- an unclassified penalty or third-party liability into Matricia revenue.
 definition:=pg_get_functiondef('public.admit_provider_payable_v1(uuid,text)'::regprocedure);
 needle:=' if length(btrim(coalesce(p_reason';
 if strpos(definition,needle)=0 then raise exception'LEGACY_RECEIPT_TYPE_PATCH_MISSING';end if;
 execute replace(definition,needle,' if e.event_type is distinct from''CLIENT_RECEIPT_CONFIRMED''then raise exception''LEGACY_RECEIPT_ADMISSION_ONLY''using errcode=''55000'';end if;'||needle);
end $migration$;
notify pgrst,'reload schema';
commit;
