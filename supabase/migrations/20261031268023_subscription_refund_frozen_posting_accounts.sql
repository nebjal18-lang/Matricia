begin;
-- The original capture's approved account IDs remain the source for a native
-- refund. No fixed account code, arbitrary expense or inferred tax is allowed.
create function private.subscription_adjustment_posting_accounts_v1(p_payment_event_id bigint)
returns table(cash_account_id uuid,suspense_account_id uuid)language sql stable security definer set search_path=pg_catalog as $$
 select context.cash_account_id,context.suspense_account_id
 from public.subscription_payment_events payment
 join public.subscription_payment_intents intent on intent.id=payment.payment_intent_id and intent.organization_id=payment.organization_id
 join private.payment_suspense_journal_sources_v1 source on source.source_kind='SUBSCRIPTION'and source.source_id=payment.gateway||':'||payment.provider_environment||':'||payment.payment_reference and source.financial_journal_id=(payment.activation_result->>'financial_journal_id')::uuid
 join private.payment_posting_contexts_v1 context on context.id=source.posting_context_id and context.organization_id=payment.organization_id and context.source_kind='SUBSCRIPTION'and context.source_version_id=intent.plan_version_id and context.currency=payment.currency and context.gateway=payment.gateway and context.provider_environment=payment.provider_environment
 join public.financial_accounts cash on cash.id=context.cash_account_id and cash.organization_id=payment.organization_id and cash.currency=payment.currency and cash.account_type='ASSET'
 join public.financial_accounts suspense on suspense.id=context.suspense_account_id and suspense.organization_id=payment.organization_id and suspense.currency=payment.currency and suspense.account_type='LIABILITY'
 join public.financial_journals journal on journal.id=source.financial_journal_id and journal.organization_id=payment.organization_id and journal.currency=payment.currency and journal.journal_type='SUBSCRIPTION_PAYMENT'and journal.status='POSTED'and journal.effective_at=payment.paid_at and journal.correlation_id=payment.correlation_id
 where payment.id=p_payment_event_id and context.cash_account_id<>context.suspense_account_id and context.context_hash=private.canonical_request_hash(context.context_snapshot)
 and(select count(*)=2 and count(*)filter(where account_id=context.cash_account_id and direction='DEBIT'and amount_minor=payment.amount_minor)=1 and count(*)filter(where account_id=context.suspense_account_id and direction='CREDIT'and amount_minor=payment.amount_minor)=1 from public.financial_entries where journal_id=journal.id and organization_id=payment.organization_id and currency=payment.currency)
$$;
revoke all on function private.subscription_adjustment_posting_accounts_v1(bigint)from public,anon,authenticated,service_role;
do $$declare definition text;opening text:='  select id into cash from public.financial_accounts where organization_id=pay.organization_id and code=''PAYMENT_CASH_''';closing text:='  j:=extensions.gen_random_uuid();';a integer;b integer;old_block text;replacement text;begin
 select pg_get_functiondef('private.apply_subscription_adjustment_v1(text,text,text,text,bigint,character,timestamp with time zone,text,text,uuid,uuid,text)'::regprocedure)into definition;
 if(length(definition)-length(replace(definition,opening,'')))/length(opening)<>1 or(length(definition)-length(replace(definition,closing,'')))/length(closing)<>1 then raise exception'SUBSCRIPTION_REFUND_ACCOUNT_SOURCE_CONTRACT_MISMATCH';end if;
 a:=strpos(definition,opening);b:=strpos(definition,closing);old_block:=substring(definition from a for b-a);
 if b<=a or strpos(old_block,'SUBSCRIPTION_ADJUSTMENT_')=0 or strpos(old_block,'''EXPENSE''')=0 or strpos(old_block,'PAYMENT_LEDGER_ACCOUNTS_INVALID')=0 then raise exception'SUBSCRIPTION_REFUND_ACCOUNT_SOURCE_CONTRACT_MISMATCH';end if;
 replacement:='  select accounts.cash_account_id,accounts.suspense_account_id into cash,counter from private.subscription_adjustment_posting_accounts_v1(pay.id)accounts;'||chr(10)||
 '  if cash is null or counter is null then raise exception''PAYMENT_ADJUSTMENT_POSTING_CONFIGURATION_REQUIRED''using errcode=''55000'';end if;'||chr(10);
 execute substring(definition from 1 for a-1)||replacement||substring(definition from b);
end$$;
create function private.observe_subscription_economic_adjustment_v1()returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare payment public.subscription_payment_events%rowtype;funding uuid;begin
 select*into payment from public.subscription_payment_events where id=new.payment_event_id;
 select id into funding from public.credit_economic_funding_sources_v1 where source_kind='SUBSCRIPTION'and source_id=payment.gateway||':'||payment.provider_environment||':'||payment.payment_reference;
 if funding is not null then
  perform private.credit_economic_pending_v1(funding,null,'SOURCE_REVIEW_REQUIRED',case when new.event_type in('REFUND_SUCCEEDED','PAYMENT_REVERSED')then'NATIVE_REFUND_REQUIRES_FISCAL_REVERSAL'else'NATIVE_DISPUTE_REQUIRES_REVIEW'end,jsonb_build_object('subscription_adjustment_id',new.id,'event_type',new.event_type,'amount_minor',new.amount_minor::text,'currency',new.currency,'financial_journal_id',new.financial_journal_id,'native_capture_retained',true),new.correlation_id);
 end if;return new;
end$$;
revoke all on function private.observe_subscription_economic_adjustment_v1()from public,anon,authenticated,service_role;
create trigger subscription_economic_adjustment_observer after insert on public.subscription_payment_adjustments for each row execute function private.observe_subscription_economic_adjustment_v1();
commit;
