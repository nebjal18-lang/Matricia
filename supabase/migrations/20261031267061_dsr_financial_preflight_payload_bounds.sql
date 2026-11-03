begin;
create or replace function private.dsr_subject_financial_records_v1(p_request_id uuid)
returns jsonb language plpgsql stable security definer
set search_path=pg_catalog,public,private as $$
declare d public.data_subject_requests%rowtype; subject_user uuid; records jsonb; record_count bigint; record_bytes bigint;
begin
 if not private.dsr_response_staff_v1() then
  raise exception 'DSR_RESPONSE_STAFF_REQUIRED' using errcode='42501';
 end if;
 select * into d from public.data_subject_requests where id=p_request_id;
 subject_user:=private.dsr_account_subject_v1(d.id);
 if d.id is null or d.status<>'IN_REVIEW' or d.verified_at is null
 or d.request_type not in('ACCESS','PORTABILITY') or subject_user is null then
  raise exception 'PRIVACY_VERIFIED_EXPORT_SUBJECT_REQUIRED' using errcode='42501';
 end if;
 -- Do not build an unbounded JSON document before deciding to use a batch.
 select count(*),coalesce(sum(octet_length(record::text)),0)into record_count,record_bytes
 from(select record from private.dsr_subject_financial_rows_v2(p_request_id)limit 20001)sentinel;
 if record_count>20000 or record_bytes+greatest(2,2*record_count)>12000000 then
  raise exception'PRIVACY_EXPORT_REQUIRES_BATCH_JOB'using errcode='55000';
 end if;
 select coalesce(jsonb_agg(record order by source,record_id),'[]'::jsonb) into records
 from private.dsr_subject_financial_rows_v2(p_request_id) personal_records;
 if jsonb_array_length(records)>20000 or octet_length(records::text)>12000000 then
  raise exception 'PRIVACY_EXPORT_REQUIRES_BATCH_JOB' using errcode='55000';
 end if;
 return jsonb_build_object('format','MATRICIA_SUBJECT_FINANCIAL_RECORDS_V1','organization_id',d.organization_id,
  'selection','PERSONALLY_AUTHORED_OR_SIGNED_IN_REQUEST_ORGANIZATION','records',records,
  'restrictions',jsonb_build_array('OTHER_PERSONS_AND_ORGANIZATION_LEDGER_EXCLUDED','PROVIDER_TOKENS_AND_RAW_SIGNATURE_PROOFS_EXCLUDED'),
  'retention','DISCLOSURE_DOES_NOT_ALTER_IMMUTABLE_LEDGER_OR_RETENTION');
end $$;


create or replace function private.dsr_subject_financial_page_v2(p_request_id uuid,p_after_source text default null,p_after_record_id text default null,p_page_size integer default 250)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,private as $$
declare rows jsonb;has_next boolean;cursor jsonb;record_count bigint;record_bytes bigint;
begin
 if not private.dsr_response_staff_v1()then raise exception'DSR_RESPONSE_STAFF_REQUIRED'using errcode='42501';end if;
 if p_page_size is null or p_page_size not between 1 and 1000 or(p_after_source is null)is distinct from(p_after_record_id is null)or(p_after_source is not null and(p_after_source!~'^[A-Z][A-Z0-9_]{2,79}$'or length(p_after_record_id)not between 1 and 128))then raise exception'INVALID_DSR_FINANCIAL_CURSOR'using errcode='22023';end if;
 -- A very large record also requires the materialized byte/chunk protocol.
 -- STABLE keeps this preflight and the following read on one query snapshot.
 select count(*),coalesce(sum(octet_length(jsonb_build_object('source',f.source,'record_id',f.record_id,'record',f.record)::text)),0)
 into record_count,record_bytes from(
  select r.source,r.record_id,r.record from private.dsr_subject_financial_rows_v2(p_request_id)r
  where p_after_source is null or(r.source collate "C",r.record_id collate "C")>(p_after_source collate "C",p_after_record_id collate "C")
  order by r.source collate "C",r.record_id collate "C"limit p_page_size
 )f;
 if record_bytes+greatest(2,2*record_count)>1048576 then raise exception'PRIVACY_EXPORT_REQUIRES_BATCH_JOB'using errcode='55000';end if;
 with selected as materialized(
  select f.source,f.record_id,f.record from private.dsr_subject_financial_rows_v2(p_request_id)f
  where p_after_source is null or(f.source collate "C",f.record_id collate "C")>(p_after_source collate "C",p_after_record_id collate "C")
  order by f.source collate "C",f.record_id collate "C"limit p_page_size+1
 ),page as(select*from selected order by source collate "C",record_id collate "C"limit p_page_size)
 select coalesce((select jsonb_agg(jsonb_build_object('source',source,'record_id',record_id,'record',record)order by source collate "C",record_id collate "C")from page),'[]'),
  (select count(*)>p_page_size from selected),
  (select jsonb_build_object('source',source,'record_id',record_id)from page order by source collate "C"desc,record_id collate "C"desc limit 1)
 into rows,has_next,cursor;
 return jsonb_build_object('format','MATRICIA_SUBJECT_FINANCIAL_PAGE_V2','request_id',p_request_id,'records',rows,'has_next',has_next,'next_cursor',case when has_next then cursor else null end,'selection','PERSONALLY_AUTHORED_OR_SIGNED_IN_REQUEST_ORGANIZATION','capture_semantics','LIVE_DIAGNOSTIC_PAGE_NOT_A_COMPLETE_MATERIALIZED_CAPTURE');
end$$;

notify pgrst,'reload schema';
commit;
