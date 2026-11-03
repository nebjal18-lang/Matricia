begin;
-- Grouped issuance used to manufacture ordinary statements directly too. A
-- readonly preview remains available; only the locked-period scheduler issues.
revoke all on function public.issue_provider_grouped_statements_v1(uuid,text,date,date,character,text,uuid,uuid) from public,anon,authenticated,service_role;
notify pgrst,'reload schema';
commit;
