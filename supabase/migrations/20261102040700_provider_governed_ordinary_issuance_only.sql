begin;
-- All ordinary period documents pass through the durable contradictory closing.
-- The worker inserts the governed locked-period documents directly; these old
-- manufacturer ABIs are no longer an alternate authenticated issuance path.
-- Source objects and historical idempotency receipts remain intact.
revoke all on function public.issue_provider_statement(uuid,text,date,date,char,text,uuid),public.issue_provider_invoice(uuid,text,date,date,uuid,uuid,uuid,text,uuid)from public,anon,authenticated,service_role;
notify pgrst,'reload schema';
commit;
