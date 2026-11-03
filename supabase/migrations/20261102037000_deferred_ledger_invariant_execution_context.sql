begin;
-- Deferred checks run after their canonical SECURITY DEFINER command has
-- returned. They must validate the whole committed journal/wallet under the
-- trusted invariant owner, independent of the final service/Buyer caller's RLS.
-- Bodies, object/organization predicates, constraints and ledger ACLs remain
-- unchanged; these trigger-only functions never create or mutate ledger facts.
alter function private.assert_financial_journal_has_entries() security definer;
alter function private.assert_financial_journal_has_entries() set search_path=pg_catalog;
alter function private.assert_financial_journal_balanced() security definer;
alter function private.assert_financial_journal_balanced() set search_path=pg_catalog;
alter function private.assert_credit_wallet_nonnegative() security definer;
alter function private.assert_credit_wallet_nonnegative() set search_path=pg_catalog;
revoke all on function private.assert_financial_journal_has_entries(),private.assert_financial_journal_balanced(),private.assert_credit_wallet_nonnegative() from public,anon,authenticated,service_role;
commit;
