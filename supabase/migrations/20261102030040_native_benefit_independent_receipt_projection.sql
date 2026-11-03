begin;
-- Native activation is an execution fact, not a Client receipt. Once the effect
-- exists the staff report UI must expose the same independently received path
-- already enforced by propose_benefit_delivery_v1 and consume_benefit_credits.
do $$declare d text;needle text;replacement text;begin
 d:=pg_get_functiondef('public.list_benefit_fulfillment_v1(uuid,integer)'::regprocedure);
 needle:='b.fulfillment_mode<>''AUTOMATED_PLATFORM''';
 if strpos(d,needle)=0 then raise exception'NATIVE_RECEIPT_PROJECTION_SOURCE_MISMATCH';end if;
 replacement:='(b.fulfillment_mode<>''AUTOMATED_PLATFORM''or exists(select 1 from public.benefit_native_execution_facts_v1 native where native.redemption_id=d.id and native.executor=''PLATFORM_ENTITLEMENT''))';
 d:=replace(d,needle,replacement);
 needle:='''execution_requires_native'',b.fulfillment_mode=''AUTOMATED_PLATFORM''';
 if strpos(d,needle)=0 then raise exception'NATIVE_ACTIVATION_PROJECTION_SOURCE_MISMATCH';end if;
 d:=replace(d,needle,needle||'and not exists(select 1 from public.benefit_native_execution_facts_v1 native where native.redemption_id=d.id and native.executor=''PLATFORM_ENTITLEMENT'')');execute d;
end$$;
notify pgrst,'reload schema';
commit;
