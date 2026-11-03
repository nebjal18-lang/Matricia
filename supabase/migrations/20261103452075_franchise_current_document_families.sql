-- Match the Provider current-family invariant: an older version does not become
-- current again merely because the latest version targets another library.
-- Historical private-document access remains independently authorized.
-- 20261031240920 moved the audited base projection into the private implementation;
-- the public wrapper only appends partner-contract history and must stay intact.
begin;
do $migration$
declare definition text;anchor text:='where d.provider_organization_id=p.provider_organization_id and exists(';
begin
 definition:=pg_get_functiondef('private.franchise_provider_dossiers_v1(uuid)'::regprocedure);
 if(length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 then raise exception 'FRANCHISE_CURRENT_DOCUMENT_SOURCE_MISMATCH';end if;
 definition:=replace(definition,anchor,'where d.provider_organization_id=p.provider_organization_id and not exists(select 1 from public.provider_document_versions newer where newer.family_id=d.family_id and newer.version_number>d.version_number)and exists(');
 execute definition;
end$migration$;
commit;
