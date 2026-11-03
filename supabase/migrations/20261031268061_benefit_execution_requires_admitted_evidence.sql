begin;
-- New manual execution must follow the evidence kind explicitly approved at
-- reservation or by an independent legacy admission review. The original
-- command remains responsible for replay before this new-operation guard.
do $migration$
declare signature text; definition text; needle text; guard text;
begin
 if to_regprocedure('private.benefit_admitted_fulfillment_evidence_v1(uuid)')is null then
  raise exception 'BENEFIT_ADMISSION_DEPENDENCY_REQUIRED' using errcode='55000';
 end if;
 needle:=$needle$if exists(select 1 from public.benefit_versions where id=d.benefit_version_id and fulfillment_mode='AUTOMATED_PLATFORM')then raise exception'BENEFIT_NATIVE_PLATFORM_EXECUTOR_REQUIRED'using errcode='55000';end if;$needle$;
 guard:=$guard$
 if private.benefit_admitted_fulfillment_evidence_v1(d.id)is distinct from'HUMAN_OPERATOR_REPORT_AND_INDEPENDENT_CLIENT_RECEIPT_V1'then raise exception'BENEFIT_ADMITTED_MANUAL_EVIDENCE_REQUIRED'using errcode='55000';end if;$guard$;
 foreach signature in array array[
  'public.advance_benefit_fulfillment_v1(uuid,bigint,text,timestamp with time zone,text,text)',
  'public.propose_benefit_delivery_v1(uuid,bigint,text,text,timestamp with time zone,text)'
 ]loop
  definition:=pg_get_functiondef(signature::regprocedure);
  if strpos(definition,needle)=0 or strpos(substr(definition,strpos(definition,needle)+length(needle)),needle)>0 then
   raise exception 'BENEFIT_EXECUTION_GUARD_PATCH_TARGET_CHANGED: %',signature;
  end if;
  execute replace(definition,needle,needle||guard);
 end loop;
 definition:=pg_get_functiondef('public.list_benefit_fulfillment_v1(uuid,integer)'::regprocedure);
 needle:=$needle$'can_operate',private.benefit_operations_access_v1()and b.fulfillment_mode<>'AUTOMATED_PLATFORM',$needle$;
 if strpos(definition,needle)=0 then raise exception 'BENEFIT_EXECUTION_PROJECTION_PATCH_TARGET_CHANGED';end if;
 execute replace(definition,needle,$replacement$'can_operate',private.benefit_operations_access_v1()and b.fulfillment_mode<>'AUTOMATED_PLATFORM'and coalesce(private.benefit_admitted_fulfillment_evidence_v1(d.id)='HUMAN_OPERATOR_REPORT_AND_INDEPENDENT_CLIENT_RECEIPT_V1',false),
 'execution_policy_required',b.fulfillment_mode<>'AUTOMATED_PLATFORM'and private.benefit_admitted_fulfillment_evidence_v1(d.id)is distinct from'HUMAN_OPERATOR_REPORT_AND_INDEPENDENT_CLIENT_RECEIPT_V1',$replacement$);
end
$migration$;
-- A report created before this forward migration is not itself a delegation.
-- Refusals remain possible; new accepted delivery/consumption must be admitted.
do $migration$
declare definition text;needle text;guard text;
begin
 definition:=pg_get_functiondef('public.decide_my_benefit_delivery_v1(uuid,text,bigint,boolean,text,text)'::regprocedure);
 needle:=$needle$if p_accept is null or length(btrim(coalesce(p_reason,'')))not between 10 and 2000 then$needle$;
 guard:=$guard$if p_accept is true and private.benefit_admitted_fulfillment_evidence_v1(d.id)is distinct from'HUMAN_OPERATOR_REPORT_AND_INDEPENDENT_CLIENT_RECEIPT_V1'then raise exception'BENEFIT_ADMITTED_MANUAL_EVIDENCE_REQUIRED'using errcode='55000';end if;
 $guard$;
 if strpos(definition,needle)=0 then raise exception'BENEFIT_RECEIPT_ADMISSION_PATCH_TARGET_CHANGED';end if;
 execute replace(definition,needle,guard||needle);
 definition:=pg_get_functiondef('private.require_benefit_native_client_receipt_v1()'::regprocedure);
 needle:=$needle$begin
 if tg_op='INSERT'then$needle$;
 guard:=$guard$begin
 if tg_op='UPDATE'and new.status in('DELIVERED','CONSUMED')and(new.status is distinct from old.status or new.delivery_proof_hash is distinct from old.delivery_proof_hash)and private.benefit_admitted_fulfillment_evidence_v1(new.id)is distinct from'HUMAN_OPERATOR_REPORT_AND_INDEPENDENT_CLIENT_RECEIPT_V1'then raise exception'BENEFIT_ADMITTED_MANUAL_EVIDENCE_REQUIRED'using errcode='55000';end if;
 if tg_op='INSERT'then$guard$;
 if strpos(definition,needle)=0 then raise exception'BENEFIT_RECEIPT_TRIGGER_PATCH_TARGET_CHANGED';end if;
 execute replace(definition,needle,guard);
 definition:=pg_get_functiondef('private.benefit_accepted_receipt_v1(uuid,text)'::regprocedure);
 needle:=$needle$where p.source_hash=private.benefit_report_hash_v1(p)and d.id=p_redemption_id$needle$;
 if strpos(definition,needle)=0 then raise exception'BENEFIT_ACCOUNTING_ADMISSION_PATCH_TARGET_CHANGED';end if;
 execute replace(definition,needle,$replacement$where private.benefit_admitted_fulfillment_evidence_v1(d.id)='HUMAN_OPERATOR_REPORT_AND_INDEPENDENT_CLIENT_RECEIPT_V1'and p.source_hash=private.benefit_report_hash_v1(p)and d.id=p_redemption_id$replacement$);
end
$migration$;
notify pgrst,'reload schema';
commit;
