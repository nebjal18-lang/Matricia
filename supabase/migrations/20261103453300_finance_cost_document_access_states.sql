begin;
-- Session, assurance and habilitation are separate user prerequisites. Unknown
-- or missing assurance never counts as AAL2, including composite Finance roles.
create function private.assert_finance_cost_document_access_v1(p_write boolean)
returns void language plpgsql stable security definer set search_path=pg_catalog as $$
begin
 if auth.uid()is null then raise exception'FINANCE_COST_UNAUTHENTICATED'using errcode='42501';end if;
 if p_write is null or private.has_platform_role(case when p_write then array['SUPER_ADMIN','FINANCE_MANAGER']else array['SUPER_ADMIN','MATRICIA_ADMIN','FINANCE_MANAGER','READ_ONLY_AUDITOR']end,auth.uid())is distinct from true
  or(p_write and private.has_platform_role(array['READ_ONLY_AUDITOR'],auth.uid()))then
  if p_write then raise exception'FINANCE_COST_DOCUMENT_WRITE_DENIED'using errcode='42501';else raise exception'FINANCE_COST_DOCUMENT_READ_DENIED'using errcode='42501';end if;
 end if;
 if auth.jwt()->>'aal'is distinct from'aal2'then raise exception'FINANCE_COST_MFA_REQUIRED'using errcode='42501';end if;
 if private.credit_revenue_finance_access_v1(auth.uid(),p_write)is distinct from true then
  if p_write then raise exception'FINANCE_COST_DOCUMENT_WRITE_DENIED'using errcode='42501';else raise exception'FINANCE_COST_DOCUMENT_READ_DENIED'using errcode='42501';end if;
 end if;
end$$;
revoke all on function private.assert_finance_cost_document_access_v1(boolean)from public,anon,authenticated,service_role;
do $migration$
declare signature text;definition text;needle text;
begin
 foreach signature in array array[
  'public.reserve_finance_cost_document_v1(text,uuid,text,text,integer,text,uuid)',
  'public.get_finance_cost_upload_context_v1(uuid)',
  'public.commit_finance_cost_document_upload_v1(uuid,text,integer)',
  'public.retry_finance_cost_document_scan_v1(uuid,text)',
  'public.revoke_finance_cost_document_v1(uuid,text)'
 ]loop
  definition:=pg_get_functiondef(signature::regprocedure);
  needle:='if private.credit_revenue_finance_access_v1(auth.uid(),true)is distinct from true then raise exception''FINANCE_COST_DOCUMENT_WRITE_DENIED''using errcode=''42501'';end if;';
  if strpos(definition,needle)=0 then raise exception'FINANCE_COST_WRITE_ACCESS_SOURCE_CHANGED: %',signature;end if;
  execute replace(definition,needle,'perform private.assert_finance_cost_document_access_v1(true);');
 end loop;
 foreach signature in array array['public.authorize_finance_cost_document_read_v1(uuid)','public.get_finance_cost_documents_v1(text,uuid,integer)']loop
  definition:=pg_get_functiondef(signature::regprocedure);
  needle:='if private.credit_revenue_finance_access_v1()is distinct from true then raise exception''FINANCE_COST_DOCUMENT_READ_DENIED''using errcode=''42501'';end if;';
  if strpos(definition,needle)=0 then raise exception'FINANCE_COST_READ_ACCESS_SOURCE_CHANGED: %',signature;end if;
  execute replace(definition,needle,'perform private.assert_finance_cost_document_access_v1(false);');
 end loop;
end $migration$;
commit;
