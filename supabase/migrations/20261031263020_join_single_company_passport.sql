-- A company passport may buy and sell. An explicit read-only join can be
-- reviewed by any owner of that same passport; it never grants ownership.
begin;
do $$declare definition text;target text:='r.role_code=split_part(p_requested_role_code,''_'',1)||''_OWNER''';begin
 select pg_get_functiondef('public.request_organization_join_v1(text,text,text,text,uuid)'::regprocedure)into definition;
 if strpos(definition,target)=0 then raise exception'JOIN_PASSPORT_OWNER_PATCH_TARGET_MISSING';end if;
 execute replace(definition,target,'r.role_code in(''CLIENT_OWNER'',''PROVIDER_OWNER'',''FRANCHISE_OWNER'')');
end$$;
notify pgrst,'reload schema';
commit;
