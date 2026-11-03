begin;
-- Accounting may reserve/release within its existing financial scope but is
-- not a native execution role. Keep forms aligned with the command ACL.
do $$declare d text;needle text;begin
 d:=pg_get_functiondef('public.get_client_benefit_lifecycle_v1(uuid,uuid,uuid,uuid)'::regprocedure);
 needle:='''may_execute'',(private.has_org_role(p_organization_id,array[''CLIENT_OWNER'',''CLIENT_ADMIN''])or private.client_owns_member_benefit_v1(id))';
 if strpos(d,needle)=0 then raise exception'NATIVE_CLIENT_ROLE_PROJECTION_SOURCE_MISMATCH';end if;
 d:=replace(d,needle,needle||'and private.has_org_role(p_organization_id,array[''CLIENT_OWNER'',''CLIENT_ADMIN'',''CLIENT_BUYER''])');execute d;
 d:=pg_get_functiondef('public.get_client_benefit_rfq_context_v1(uuid,uuid)'::regprocedure);
 needle:='if r.id is null or auth.uid()is null or not(';if strpos(d,needle)=0 then raise exception'NATIVE_RFQ_READ_ROLE_SOURCE_MISMATCH';end if;
 d:=replace(d,needle,'if r.id is null or auth.uid()is null or not private.has_org_role(r.organization_id,array[''CLIENT_OWNER'',''CLIENT_ADMIN'',''CLIENT_BUYER''])or not(');execute d;
 d:=pg_get_functiondef('public.create_client_benefit_rfq_v1(uuid,bigint,jsonb,text)'::regprocedure);
 needle:='if r.id is null or auth.uid()is null or auth.jwt()->>''aal''is distinct from''aal2''or not(';if strpos(d,needle)=0 then raise exception'NATIVE_RFQ_CREATE_ROLE_SOURCE_MISMATCH';end if;
 d:=replace(d,needle,'if r.id is null or auth.uid()is null or auth.jwt()->>''aal''is distinct from''aal2''or not private.has_org_role(r.organization_id,array[''CLIENT_OWNER'',''CLIENT_ADMIN'',''CLIENT_BUYER''])or not(');
 needle:='if auth.uid()is null or auth.jwt()->>''aal''is distinct from''aal2''or not(';if strpos(d,needle)=0 then raise exception'NATIVE_RFQ_CREATE_LOCK_ROLE_SOURCE_MISMATCH';end if;
 d:=replace(d,needle,'if auth.uid()is null or auth.jwt()->>''aal''is distinct from''aal2''or not private.has_org_role(r.organization_id,array[''CLIENT_OWNER'',''CLIENT_ADMIN'',''CLIENT_BUYER''])or not(');execute d;
end$$;
notify pgrst,'reload schema';
commit;
