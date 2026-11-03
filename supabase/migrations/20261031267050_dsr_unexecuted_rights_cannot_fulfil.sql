begin;
-- A human reference is not an executed objection, consent withdrawal or other
-- requested operation. Keep these requests in review until a typed command and
-- its real effect/delivery proof are available; never reinterpret them as a
-- global marketing restriction or manufacture a consent record.
do $$declare definition text;needle text;begin
 select pg_get_functiondef('public.transition_data_subject_request(uuid,integer,text,text,text,uuid)'::regprocedure)into definition;
 needle:='return public.transition_data_subject_request_delivery_internal(';
 if strpos(definition,needle)=0 then raise exception'DSR_UNEXECUTED_RIGHT_TRANSITION_PATCH_TARGET_MISSING';end if;
 if strpos(definition,'PRIVACY_TYPED_RIGHT_EXECUTION_PROOF_REQUIRED')=0 then definition:=replace(definition,needle,'if p_new_status=''FULFILLED''and d.request_type in(''OPPOSITION'',''CONSENT_WITHDRAWAL'',''OTHER'')then raise exception''PRIVACY_TYPED_RIGHT_EXECUTION_PROOF_REQUIRED''using errcode=''55000'';end if;'||chr(10)||needle);execute definition;end if;
end$$;
notify pgrst,'reload schema';
commit;
