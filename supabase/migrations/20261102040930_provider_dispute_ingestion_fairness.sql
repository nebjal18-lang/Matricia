begin;
-- A missing collection mandate or fiscal prerequisite stays retryable without
-- consuming every bounded run ahead of other final financial consequences.
create table private.provider_dispute_ingestion_attempts_v1(
 consequence_id uuid primary key references public.dispute_financial_consequences(id),
 last_attempt_at timestamptz not null,
 attempt_count bigint not null
);
alter table private.provider_dispute_ingestion_attempts_v1 enable row level security;
revoke all on private.provider_dispute_ingestion_attempts_v1 from public,anon,authenticated,service_role;
do $migration$
declare definition text;needle text;
begin
 definition:=pg_get_functiondef('private.ingest_provider_dispute_payables_v1(integer)'::regprocedure);
 needle:='order by c.created_at,c.id limit p_limit loop';
 if strpos(definition,needle)=0 then raise exception'DISPUTE_INGEST_FAIRNESS_ORDER_PATCH_MISSING';end if;
 definition:=replace(definition,needle,'order by coalesce((select a.last_attempt_at from private.provider_dispute_ingestion_attempts_v1 a where a.consequence_id=c.id),''-infinity''::timestamptz),c.created_at,c.id limit p_limit loop');
 needle:='limit p_limit loop'||chr(10)||' begin';
 if strpos(definition,needle)=0 then raise exception'DISPUTE_INGEST_FAIRNESS_ATTEMPT_PATCH_MISSING';end if;
 definition:=replace(definition,needle,'limit p_limit loop'||$patch$
 insert into private.provider_dispute_ingestion_attempts_v1(consequence_id,last_attempt_at,attempt_count)values(x.id,clock_timestamp(),1)on conflict(consequence_id)do update set last_attempt_at=excluded.last_attempt_at,attempt_count=private.provider_dispute_ingestion_attempts_v1.attempt_count+1;
$patch$||' begin');
 execute definition;
end $migration$;
notify pgrst,'reload schema';
commit;
