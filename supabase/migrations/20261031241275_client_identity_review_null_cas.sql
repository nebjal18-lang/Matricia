begin;
do $$declare definition text;begin
 select pg_get_functiondef('public.review_client_canonical_identifiers_v1(uuid,integer,integer,text,uuid[],text,text,uuid)'::regprocedure)into definition;
 definition:=replace(definition,'if c.row_version<>p_expected_case_row_version or','if c.row_version is distinct from p_expected_case_row_version or');
 if strpos(definition,'p_expected_case_row_version is null')=0 then definition:=replace(definition,'if length(btrim(coalesce(p_reason,','if p_expected_case_row_version is null or p_expected_case_row_version<1 or p_expected_profile_version is null or p_expected_profile_version<1 or p_expected_identity_hash is null or length(btrim(coalesce(p_reason,');end if;
 execute definition;
end$$;
commit;
