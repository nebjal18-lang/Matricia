begin;
-- One immutable decision per proposal/declaration. A retry returns its persisted
-- decision without a second audit; a contradictory choice is a real conflict.
do $migration$
declare definition text;needle text;
begin
 definition:=pg_get_functiondef('public.decide_provider_closing_policy_v1(uuid,boolean,text)'::regprocedure);
 needle:=' insert into public.provider_closing_policy_decisions_v1';
 if strpos(definition,needle)=0 then raise exception'CLOSING_DECISION_REPLAY_PATCH_MISSING';end if;
 execute replace(definition,needle,$patch$
 if exists(select 1 from public.provider_closing_policy_decisions_v1 d where d.policy_id=p.id)then
  if exists(select 1 from public.provider_closing_policy_decisions_v1 d where d.policy_id=p.id and d.approved is distinct from p_approved)then raise exception'DECISION_ALREADY_RECORDED'using errcode='22000';end if;
  return jsonb_build_object('outcome','PROVIDER_CLOSING_POLICY_REVIEWED');
 end if;
$patch$||needle);
 definition:=pg_get_functiondef('public.resolve_provider_billing_line_v1(uuid,boolean,text)'::regprocedure);
 needle:=' insert into public.provider_billing_dispute_resolutions_v1';
 if strpos(definition,needle)=0 then raise exception'BILLING_LINE_RESOLUTION_REPLAY_PATCH_MISSING';end if;
 -- Serialize decisions using the immutable dispute row, before inspecting its result.
 definition:=replace(definition,'where id=p_dispute_id;','where id=p_dispute_id for update;');
 execute replace(definition,needle,$patch$
 if exists(select 1 from public.provider_billing_dispute_resolutions_v1 r where r.dispute_id=d.id)then
  if exists(select 1 from public.provider_billing_dispute_resolutions_v1 r where r.dispute_id=d.id and r.release_line is distinct from p_release)then raise exception'DECISION_ALREADY_RECORDED'using errcode='22000';end if;
  return jsonb_build_object('outcome','PROVIDER_BILLING_DISPUTE_RESOLVED');
 end if;
$patch$||needle);
 definition:=pg_get_functiondef('public.confirm_provider_receipt_declaration_v1(uuid,boolean,text)'::regprocedure);
 needle:='if found then return r;end if;';
 if strpos(definition,needle)=0 then raise exception'RECEIPT_DECISION_REPLAY_PATCH_MISSING';end if;
 execute replace(definition,needle,$patch$if found then if (r->>'outcome')is distinct from(case when p_confirmed then'CLIENT_RECEIPT_CONFIRMED'else'CLIENT_RECEIPT_CONTESTED'end)then raise exception'DECISION_ALREADY_RECORDED'using errcode='22000';end if;return r;end if;$patch$);
 definition:=pg_get_functiondef('public.review_provider_financial_declaration_v1(uuid,boolean,text)'::regprocedure);
 if strpos(definition,needle)=0 then raise exception'FINANCIAL_DECISION_REPLAY_PATCH_MISSING';end if;
 execute replace(definition,needle,$patch$if found then if exists(select 1 from public.provider_financial_declaration_decisions_v1 prior where prior.declaration_id=d.id and prior.decision in('APPROVED','REJECTED')and prior.decision is distinct from(case when p_approved then'APPROVED'else'REJECTED'end))then raise exception'DECISION_ALREADY_RECORDED'using errcode='22000';end if;return r;end if;$patch$);
end $migration$;
notify pgrst,'reload schema';
commit;
