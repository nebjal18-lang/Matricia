-- TEST-only governance actors and immutable initial metadata. No ledger balance,
-- financial journal or payout is injected to manufacture an earned right.
begin;set local search_path=public,extensions;select no_plan();grant usage on schema extensions to authenticated;
update private.admin_execution_environment_v1 set environment='DEVELOPMENT',configuration_reference='TEST372_NON_CONTRACTUAL_BOOK_BINDING',configured_at=clock_timestamp()where singleton;
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select('a3720000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','book372-'||n||'@example.invalid','',now()-interval'60 days','{}','{}',now()-interval'60 days',now()from generate_series(1,5)n;
insert into public.organizations(id,legal_name,display_name,status,created_by,created_at)values('b3720000-0000-4000-8000-000000000001','TEST372 Book Basis','TEST372 Book Basis','ACTIVE','a3720000-0000-4000-8000-000000000001',now()-interval'60 days');
insert into public.organization_memberships(id,organization_id,user_id,status,activated_at)values
 ('c3720000-0000-4000-8000-000000000001','b3720000-0000-4000-8000-000000000001','a3720000-0000-4000-8000-000000000001','ACTIVE',now()),
 ('c3720000-0000-4000-8000-000000000005','b3720000-0000-4000-8000-000000000001','a3720000-0000-4000-8000-000000000005','ACTIVE',now());
insert into public.organization_member_roles(membership_id,role_code)values('c3720000-0000-4000-8000-000000000001','CLIENT_OWNER');
insert into public.platform_user_roles(user_id,role_code)values('a3720000-0000-4000-8000-000000000002','FINANCE_MANAGER'),('a3720000-0000-4000-8000-000000000002','MATRICIA_ADMIN'),('a3720000-0000-4000-8000-000000000003','FINANCE_MANAGER'),('a3720000-0000-4000-8000-000000000003','MATRICIA_ADMIN');
insert into public.catalog_libraries(id,code,slug,steward_organization_id,created_by)values
 ('e3720000-0000-4000-8000-000000000001','TEST372_STANDARD','test372-standard','b3720000-0000-4000-8000-000000000001','a3720000-0000-4000-8000-000000000002'),
 ('e3720000-0000-4000-8000-000000000002','TEST372_LEGACY','test372-legacy','b3720000-0000-4000-8000-000000000001','a3720000-0000-4000-8000-000000000002'),
 ('e3720000-0000-4000-8000-000000000003','TEST372_PENDING','test372-pending','b3720000-0000-4000-8000-000000000001','a3720000-0000-4000-8000-000000000002');
insert into public.catalog_libraries(id,code,slug,steward_organization_id,created_by)values('e3720000-0000-4000-8000-000000000004','IT','it','b3720000-0000-4000-8000-000000000001','a3720000-0000-4000-8000-000000000002')on conflict(code)do nothing;
create temporary table basis372(k text primary key,kind text,library uuid,franchise uuid,approved uuid,mandate_hash text,finance_rule uuid,opening jsonb,activation jsonb);
grant select,insert,update on basis372 to authenticated;
create function pg_temp.actor372(n integer,aal text default'aal2')returns void language plpgsql as $$begin
 perform set_config('request.jwt.claims',jsonb_build_object('sub',('a3720000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'role','authenticated','aal',aal)::text,true);
end$$;
-- Proposals and decisions below are actual public governance commands, not a
-- direct ACTIVE status seed or a claim that a legal signature exists.
do $$declare item record;proposal jsonb;preview jsonb;begin
 for item in select*from(values('S1','STANDARD','e3720000-0000-4000-8000-000000000001'::uuid,'TEST372_A'),('S2','STANDARD','e3720000-0000-4000-8000-000000000001'::uuid,'TEST372_B'),('TERMS','STANDARD','e3720000-0000-4000-8000-000000000001'::uuid,'TEST372_E'),('LEGACY','STANDARD','e3720000-0000-4000-8000-000000000002'::uuid,'TEST372_C'),('PENDING','STANDARD','e3720000-0000-4000-8000-000000000003'::uuid,'TEST372_D'),('IT','IT',(select id from public.catalog_libraries where code='IT'),'TEST372_IT'))v(k,kind,library,territory)loop
  perform pg_temp.actor372(2);
  proposal:=public.propose_franchise_governance(item.library,'b3720000-0000-4000-8000-000000000001',case item.kind when'IT'then'HATIM_AHMITECH'else'FRANCHISEE'end,item.territory,'Territoire TEST372','نطاق اختبار372','{}',now()-interval'1 day',now()+interval'1 year',case item.kind when'IT'then 0 else 100000 end,case when item.kind='IT'then'EXEMPT'when item.k='TERMS'then'INSTALLMENT'else'UPFRONT'end,case when item.k='TERMS'then 6 else 0 end,'{}','{}','{}','book372-1@example.invalid',private.canonical_request_hash(to_jsonb(item.k::text)),'fr-MA','{}','TEST372 approved economic basis proposal','TEST372-propose-'||item.k);
  if item.k<>'PENDING'then
   perform pg_temp.actor372(3);
   perform public.decide_franchise_governance((proposal->>'approval_request_id')::uuid,'APPROVE','TEST372 independent approved mandate economics',1,'TEST372-approve-'||item.k);
  end if;
  insert into basis372(k,kind,library,franchise,approved,mandate_hash,finance_rule)values(item.k,item.kind,item.library,(proposal->>'franchise_id')::uuid,(proposal->>'mandate_version_id')::uuid,(select content_hash from public.franchise_mandate_versions where id=(proposal->>'mandate_version_id')::uuid),(select id from public.franchise_finance_rule_versions where franchise_type=item.kind and version=1));
 end loop;
end$$;
set local role authenticated;select pg_temp.actor372(2);
select throws_ok($$select public.open_franchise_pnl_book(library,'b3720000-0000-4000-8000-000000000001','IT','HATIM_AHMITECH','MAD',(select id from public.franchise_finance_rule_versions where franchise_type='IT'and version=1),'TEST372-wrong-type')from basis372 where k='LEGACY'$$,'55000','FRANCHISE_BOOK_ECONOMIC_BASIS_MISMATCH','legacy caller cannot relabel an independently approved STANDARD mandate as IT');
select throws_ok($$select public.open_franchise_pnl_book(library,'b3720000-0000-4000-8000-000000000001','STANDARD','HATIM_AHMITECH','MAD',finance_rule,'TEST372-wrong-operator')from basis372 where k='LEGACY'$$,'55000','FRANCHISE_BOOK_ECONOMIC_BASIS_MISMATCH','operator comes from the approved mandate, not the form');
select throws_ok($$select public.open_franchise_pnl_book(library,'b3720000-0000-4000-8000-000000000001','STANDARD','FRANCHISEE','MAD',finance_rule,'TEST372-ambiguous-legacy')from basis372 where k='S1'$$,'55000','FRANCHISE_BOOK_MANDATE_SELECTION_REQUIRED','two territories sharing an operator and library require an explicit mandate');
select throws_ok($$select public.open_franchise_pnl_book_for_mandate_v1(franchise,approved,mandate_hash,'MAD',finance_rule,'TEST372-unapproved')from basis372 where k='PENDING'$$,'55000','FRANCHISE_APPROVED_ECONOMIC_BASIS_REQUIRED','a proposed but unapproved mandate cannot back an economic book');
select throws_ok($$select public.open_franchise_pnl_book_for_mandate_v1(franchise,approved,repeat('0',64),'MAD',finance_rule,'TEST372-stale-source')from basis372 where k='S1'$$,'40001','FRANCHISE_MANDATE_CHANGED','opening pins the exact independent mandate hash');
select throws_ok($$select public.open_franchise_pnl_book_for_mandate_v1(franchise,approved,mandate_hash,'MAD',(select id from public.franchise_finance_rule_versions where franchise_type='IT'and version=1),'TEST372-rule-mismatch')from basis372 where k='S1'$$,'55000','FRANCHISE_APPROVED_ECONOMIC_BASIS_REQUIRED','a correct-looking book cannot select the IT finance rule for a STANDARD economic mandate');

insert into basis372(k,finance_rule)values('WRONG_SHARES',(public.create_franchise_finance_rule('b3720000-0000-4000-8000-000000000001','STANDARD','FRANCHISEE',true,4000,4000,2000,(select formula_snapshot from public.franchise_finance_rule_versions where franchise_type='STANDARD'and version=1),current_date-2,null,'TEST372 separate finance rule not approved by this mandate','TEST372-wrong-shares-rule')->>'rule_version_id')::uuid);
select throws_ok($$select public.open_franchise_pnl_book_for_mandate_v1(franchise,approved,mandate_hash,'MAD',(select finance_rule from basis372 where k='WRONG_SHARES'),'TEST372-share-mismatch')from basis372 where k='S1'$$,'55000','FRANCHISE_APPROVED_ECONOMIC_BASIS_REQUIRED','a STANDARD rule with different shares cannot replace the approved economic version');

insert into basis372(k,finance_rule)values('EXPIRED_RULE',(public.create_franchise_finance_rule('b3720000-0000-4000-8000-000000000001','STANDARD','FRANCHISEE',true,5000,2500,2500,(select formula_snapshot from public.franchise_finance_rule_versions where franchise_type='STANDARD'and version=1),current_date-10,current_date-9,'TEST372 formally active rule already outside this mandate dates','TEST372-expired-finance-rule')->>'rule_version_id')::uuid);
select throws_ok($$select public.open_franchise_pnl_book_for_mandate_v1(franchise,approved,mandate_hash,'MAD',(select finance_rule from basis372 where k='EXPIRED_RULE'),'TEST372-expired-rule-opening')from basis372 where k='S1'$$,'55000','FRANCHISE_APPROVED_ECONOMIC_BASIS_REQUIRED','an administratively active but already elapsed finance rule cannot back a newer approved mandate');

update basis372 set opening=public.open_franchise_pnl_book_for_mandate_v1(franchise,approved,mandate_hash,'MAD',finance_rule,'TEST372-open-'||k)where k in('S1','S2','IT');
select is((select count(distinct opening->>'book_id')::integer from basis372 where k in('S1','S2')),2,'two authorized territories receive distinct books despite the same organization and library');
select ok((select bool_and(public.open_franchise_pnl_book_for_mandate_v1(franchise,approved,mandate_hash,'MAD',finance_rule,'TEST372-open-'||k)=opening)from basis372 where k in('S1','S2','IT')),'opening retries return the exact stored binding receipts');
select is((select count(*)::integer from public.franchise_pnl_book_bindings_v1 where franchise_id in(select franchise from basis372)),3,'exactly one immutable binding exists for each successful explicit opening');
select throws_ok($$insert into public.franchise_pnl_book_bindings_v1(book_id,franchise_id,approved_mandate_version_id,finance_rule_version_id,currency,basis_snapshot,basis_hash,created_by)select(opening->>'book_id')::uuid,franchise,approved,finance_rule,'MAD','{}',repeat('0',64),auth.uid()from basis372 where k='S1'$$,'42501',null,'runtime Finance cannot write a fabricated binding registry row directly');
select is(public.create_franchise_entry_fee_schedule((select(opening->>'book_id')::uuid from basis372 where k='IT'),'EXEMPT',0,0,null,null,current_date,current_date,'{}','TEST372-it-exemption')->>'principal_minor','0','the approved IT mandate can prepare its actual zero entry fee before activation');
select throws_ok($$select public.create_franchise_entry_fee_schedule((select(opening->>'book_id')::uuid from basis372 where k='S1'),'UPFRONT',200000,200000,null,null,current_date,current_date,'{}','TEST372-wrong-entry-fee')$$,'55000','FRANCHISE_ENTRY_FEE_APPROVED_TERMS_REQUIRED','a valid schedule format cannot replace the fee approved in the mandate');
select is(public.create_franchise_entry_fee_schedule((select(opening->>'book_id')::uuid from basis372 where k='S1'),'UPFRONT',100000,100000,null,null,current_date,current_date,'{}','TEST372-approved-entry-fee')->>'principal_minor','100000','the approved standard amount is linked to its exact book before activation');
reset role;
select is((select execution_mode from public.franchise_entry_fee_schedules where book_id=(select(opening->>'book_id')::uuid from basis372 where k='S1')),'NON_CONTRACTUAL_DEMO','pre-activation TEST fee carries a server-attested non-contractual mode');
update private.admin_execution_environment_v1 set environment='PRODUCTION',configuration_reference='TEST372_NO_PRODUCTION_SIGNATURE',configured_at=clock_timestamp()where singleton;
select pg_temp.actor372(2);set local role authenticated;
select throws_ok($$select public.create_franchise_entry_fee_schedule((select(opening->>'book_id')::uuid from basis372 where k='S2'),'UPFRONT',100000,100000,null,null,current_date,current_date,'{}','TEST372-prod-no-signature')$$,'55000','FRANCHISE_ENTRY_FEE_SIGNED_MANDATE_REQUIRED','central approval alone cannot create a production entry debt without exact signed mandate proof');
reset role;
select is((select count(*)::integer from public.franchise_entry_fee_schedules where book_id=(select(opening->>'book_id')::uuid from basis372 where k='S2')),0,'the production prerequisite failure leaves neither a schedule nor a due entry');
update private.admin_execution_environment_v1 set environment='DEVELOPMENT',configuration_reference='TEST372_NON_CONTRACTUAL_BOOK_BINDING',configured_at=clock_timestamp()where singleton;
set local role authenticated;select pg_temp.actor372(2);
update basis372 set opening=public.open_franchise_pnl_book_for_mandate_v1(franchise,approved,mandate_hash,'MAD',finance_rule,'TEST372-terms-open')where k='TERMS';
select throws_ok($$select public.create_franchise_entry_fee_schedule((select(opening->>'book_id')::uuid from basis372 where k='TERMS'),'INSTALLMENT',100000,0,null,3,current_date,(current_date+interval'3 months')::date,'{}','TEST372-wrong-installment-term')$$,'55000','FRANCHISE_ENTRY_FEE_APPROVED_TERMS_REQUIRED','a three-month schedule cannot replace the exact approved six-month payment terms');
select is(public.create_franchise_entry_fee_schedule((select(opening->>'book_id')::uuid from basis372 where k='TERMS'),'INSTALLMENT',100000,0,null,6,current_date,(current_date+interval'6 months')::date,'{}','TEST372-approved-installment-term')->>'principal_minor','100000','the approved six-month installment schedule is accepted explicitly in non-contractual TEST mode');
select pg_temp.actor372(2,'aal1');
select throws_ok($$select public.open_franchise_pnl_book_for_mandate_v1(franchise,approved,mandate_hash,'MAD',finance_rule,'TEST372-open-'||k)from basis372 where k='S1'$$,'42501','FRANCHISE_BOOK_DENIED','even a stored opening receipt requires current AAL2');
select pg_temp.actor372(2,null);
select throws_ok($$select public.open_franchise_pnl_book_for_mandate_v1(franchise,approved,mandate_hash,'MAD',finance_rule,'TEST372-null-assurance')from basis372 where k='S1'$$,'42501','FRANCHISE_BOOK_DENIED','JSON-null assurance fails closed at the explicit boundary');
select pg_temp.actor372(4);
select throws_ok($$select public.open_franchise_pnl_book_for_mandate_v1(franchise,approved,mandate_hash,'MAD',finance_rule,'TEST372-foreign-actor')from basis372 where k='S1'$$,'42501','FRANCHISE_BOOK_DENIED','an unrelated identity cannot use the public explicit command');
reset role;
-- Historical initial legacy book: no ledger money is seeded. It is deliberately
-- inconsistent, retained unchanged and refused by recovery/financial writes.
insert into public.franchise_pnl_books(id,library_id,franchise_organization_id,franchise_type,operator_code,currency,opened_under_rule_version_id,created_by)
select'f372b000-0000-4000-8000-000000000001',library,'b3720000-0000-4000-8000-000000000001','IT','HATIM_AHMITECH','MAD',(select id from public.franchise_finance_rule_versions where franchise_type='IT'and version=1),'a3720000-0000-4000-8000-000000000002'from basis372 where k='LEGACY';
select throws_ok($$insert into public.franchise_pnl_book_bindings_v1(book_id,franchise_id,approved_mandate_version_id,finance_rule_version_id,currency,basis_snapshot,basis_hash,created_by)select'f372b000-0000-4000-8000-000000000001',franchise,approved,finance_rule,'MAD','{}',repeat('0',64),'a3720000-0000-4000-8000-000000000002'from basis372 where k='LEGACY'$$,'55000','FRANCHISE_BOOK_ECONOMIC_BASIS_MISMATCH','an internal writer also cannot freeze a made-up binding snapshot');
set local role authenticated;select pg_temp.actor372(2);
select throws_ok($$select public.open_franchise_pnl_book_for_mandate_v1(franchise,approved,mandate_hash,'MAD',finance_rule,'TEST372-legacy-bad-basis')from basis372 where k='LEGACY'$$,'55000','FRANCHISE_LEGACY_BOOK_RECONCILIATION_REQUIRED','an inconsistent existing book is not silently rebound or overwritten');
select throws_ok($$select public.close_franchise_profit_period('f372b000-0000-4000-8000-000000000001',current_date-2,current_date-1,(select id from public.franchise_finance_rule_versions where franchise_type='IT'and version=1),clock_timestamp(),'TEST372 no silent earnings from an unbound book','TEST372-close-unbound')$$,'55000','FRANCHISE_BOOK_BINDING_REVIEW_REQUIRED','an old unbound book cannot be certified by closing an otherwise empty period');
reset role;
select throws_ok($$insert into public.franchise_distribution_ledger_entries(book_id,beneficiary_code,entry_type,amount_minor,currency,reference_type,reference_id,correlation_id,created_by)values('f372b000-0000-4000-8000-000000000001','HATIM_AHMITECH','PAYOUT',-1,'MAD','TEST','INVALID_UNBOUND_PAYOUT','f372c000-0000-4000-8000-000000000001','a3720000-0000-4000-8000-000000000002')$$,'55000','FRANCHISE_BOOK_BINDING_REVIEW_REQUIRED','even an internal malformed payout insert cannot bypass an unbound book');
select ok(private.franchise_book_binding_review_required_v1('f372b000-0000-4000-8000-000000000001'),'inconsistent historical book is explicitly marked for reconciliation');
select is((select count(*)::integer from public.franchise_pnl_book_bindings_v1 where book_id='f372b000-0000-4000-8000-000000000001'),0,'failed recovery leaves no manufactured binding');
select throws_ok($$update public.franchise_pnl_book_bindings_v1 set basis_hash=repeat('f',64)where book_id=(select(opening->>'book_id')::uuid from basis372 where k='S1')$$,'55000','IMMUTABLE_RECORD','even maintenance cannot rewrite an accepted immutable book basis');
-- Actual native activation changes the active mandate ID, without changing the
-- approved economic source captured when the entry-fee book was opened.
do $$declare item record;invite uuid;preview jsonb;begin
 perform pg_temp.actor372(1);
 for item in select*from basis372 where k in('S1','S2','IT')loop
  select id into invite from public.franchise_invitations where franchise_id=item.franchise;
  preview:=public.franchise_invitation_activation_preview(invite);
  update basis372 set activation=public.simulate_franchise_invitation_acceptance(invite,private.canonical_request_hash(to_jsonb(item.k::text)),1,item.approved,item.mandate_hash,true,'TEST372-activate-'||item.k)where k=item.k;
 end loop;
end$$;
select ok((select bool_and((activation->>'active_mandate_version_id')::uuid<>approved)from basis372 where k in('S1','S2','IT')),'the activation clone has a distinct identity');
select ok((select bool_and(private.franchise_book_active_basis_v1((opening->>'book_id')::uuid)->>'active_mandate_version_id'=activation->>'active_mandate_version_id')from basis372 where k in('S1','S2','IT')),'the registry follows only the verified approved-to-active clone with matching terms');
select is((select count(*)::integer from public.franchise_pnl_book_bindings_v1 where franchise_id in(select franchise from basis372 where k in('S1','S2','IT'))),3,'activation does not duplicate or rewrite the opening basis');
select pg_temp.actor372(2);set local role authenticated;
select is((public.franchise_governance_dashboard_snapshot((select franchise from basis372 where k='S1'))#>'{bs}')::jsonb->0->>'id',(select opening->>'book_id'from basis372 where k='S1'),'the selected mandate projects its own book, not its sibling territory');
select is(jsonb_array_length(public.franchise_governance_dashboard_snapshot((select franchise from basis372 where k='S1'))->'bs'),1,'the sibling book is excluded even for a Finance actor authorized to both');
reset role;

-- Given an explicitly historical NON_CONTRACTUAL_DEMO mandate, initial metadata
-- can be seeded without inserting or editing any financial entry. This is NOT
-- a claim that legal signature/OTP/approval occurred in a browser in October.
insert into public.catalog_libraries(id,code,slug,steward_organization_id,created_by)values('e3720000-0000-4000-8000-000000000009','TEST372_HISTORY','test372-history','b3720000-0000-4000-8000-000000000001','a3720000-0000-4000-8000-000000000002');
insert into public.franchises(id,library_id,operator_organization_id,franchise_type,operator_code,territory_code,status,activation_mode,created_by,created_at)values('f372a000-0000-4000-8000-000000000001','e3720000-0000-4000-8000-000000000009','b3720000-0000-4000-8000-000000000001','STANDARD','FRANCHISEE','TEST372_HIST','TERMINATED','NON_CONTRACTUAL_DEMO','a3720000-0000-4000-8000-000000000002','2026-10-01T00:00:00Z');
insert into public.franchise_territory_versions(id,franchise_id,version,territory_code,name_fr,name_ar,scope_snapshot,effective_from,effective_until,content_hash,created_by,created_at)values('f372a100-0000-4000-8000-000000000001','f372a000-0000-4000-8000-000000000001',1,'TEST372_HIST','Historique TEST372','تاريخ اختبار372','{}','2026-10-01T00:00:00Z','2026-11-01T00:00:00Z',private.canonical_request_hash('{"fixture":"TEST372_HISTORICAL_TERRITORY"}'::jsonb),'a3720000-0000-4000-8000-000000000002','2026-10-01T00:00:00Z');
insert into public.franchise_mandate_versions(id,franchise_id,territory_version_id,economic_rule_version_id,version,mandate_status,rights_snapshot,obligations_snapshot,contract_snapshot,entry_fee_minor,entry_fee_mode,entry_fee_term_months,franchisee_share_bps,neoxa_share_bps,matricia_share_bps,distribution_basis,effective_from,effective_until,content_hash,created_by,created_at)
select id,'f372a000-0000-4000-8000-000000000001','f372a100-0000-4000-8000-000000000001',(select id from public.franchise_economic_rule_versions where franchise_type='STANDARD'and version=1),version,status,'{}','{}','{"TEST_ONLY":"INITIAL_HISTORICAL_NON_CONTRACTUAL_METADATA"}',100000,'UPFRONT',0,5000,2500,2500,'DISTRIBUTABLE_PROFIT',starts_at,'2026-11-01T00:00:00Z',private.canonical_request_hash('{"fixture":"TEST372_HISTORICAL_MANDATE","no_legal_signature_claim":true}'::jsonb),author,starts_at
from(values('f372a200-0000-4000-8000-000000000001'::uuid,1,'PROPOSED','2026-10-01T00:00:00Z'::timestamptz,'a3720000-0000-4000-8000-000000000002'::uuid),('f372a200-0000-4000-8000-000000000002'::uuid,2,'ACTIVE','2026-10-02T00:00:00Z'::timestamptz,'a3720000-0000-4000-8000-000000000001'::uuid))initial(id,version,status,starts_at,author);
update public.franchises set current_mandate_version_id='f372a200-0000-4000-8000-000000000002'where id='f372a000-0000-4000-8000-000000000001';
insert into public.franchise_approval_requests(id,franchise_id,mandate_version_id,request_type,status,change_reason,requested_by,requested_at,decided_at)values('f372a300-0000-4000-8000-000000000001','f372a000-0000-4000-8000-000000000001','f372a200-0000-4000-8000-000000000001','INITIAL_ACTIVATION','APPROVED','TEST372 initial historical approval metadata','a3720000-0000-4000-8000-000000000002','2026-10-01T00:00:00Z','2026-10-01T01:00:00Z');
insert into public.franchise_approval_decisions(approval_request_id,decision,reason,mandate_content_hash,decided_by,decided_at)values('f372a300-0000-4000-8000-000000000001','APPROVE','TEST372 initial historical independent approval',(select content_hash from public.franchise_mandate_versions where id='f372a200-0000-4000-8000-000000000001'),'a3720000-0000-4000-8000-000000000003','2026-10-01T01:00:00Z');
insert into public.franchise_invitations(id,franchise_id,invited_email,status,expires_at,accepted_by,accepted_at,created_at)values('f372a400-0000-4000-8000-000000000001','f372a000-0000-4000-8000-000000000001','book372-1@example.invalid','ACCEPTED','2026-10-30T00:00:00Z','a3720000-0000-4000-8000-000000000001','2026-10-02T00:00:00Z','2026-10-01T00:00:00Z');
insert into public.franchise_activation_evidence(invitation_id,franchise_id,approved_mandate_version_id,active_mandate_version_id,mandate_hash,activation_mode,environment,actor_user_id,evidence_snapshot,evidence_hash,recorded_at)
select'f372a400-0000-4000-8000-000000000001','f372a000-0000-4000-8000-000000000001','f372a200-0000-4000-8000-000000000001','f372a200-0000-4000-8000-000000000002',(select content_hash from public.franchise_mandate_versions where id='f372a200-0000-4000-8000-000000000001'),'NON_CONTRACTUAL_DEMO','DEVELOPMENT','a3720000-0000-4000-8000-000000000001',snapshot,private.canonical_request_hash(snapshot),'2026-10-02T00:00:00Z'
from(select jsonb_build_object('franchiseId','f372a000-0000-4000-8000-000000000001','approvedMandateVersionId','f372a200-0000-4000-8000-000000000001','activeMandateVersionId','f372a200-0000-4000-8000-000000000002','TEST_ONLY','INITIAL_HISTORICAL_NON_CONTRACTUAL_METADATA')snapshot)initial;
insert into public.franchise_pnl_books(id,library_id,franchise_organization_id,franchise_type,operator_code,currency,opened_under_rule_version_id,created_by,created_at)
select'f372b000-0000-4000-8000-000000000009','e3720000-0000-4000-8000-000000000009','b3720000-0000-4000-8000-000000000001','STANDARD','FRANCHISEE','MAD',id,'a3720000-0000-4000-8000-000000000002','2026-10-02T00:00:00Z'from public.franchise_finance_rule_versions where franchise_type='STANDARD'and version=1;
select pg_temp.actor372(2);set local role authenticated;
insert into basis372(k,opening)select'HISTORY',public.open_franchise_pnl_book_for_mandate_v1('f372a000-0000-4000-8000-000000000001','f372a200-0000-4000-8000-000000000001',(select content_hash from public.franchise_mandate_versions where id='f372a200-0000-4000-8000-000000000001'),'MAD',(select id from public.franchise_finance_rule_versions where franchise_type='STANDARD'and version=1),'TEST372-recover-historical-book');
select is((select opening->>'book_id'from basis372 where k='HISTORY'),'f372b000-0000-4000-8000-000000000009','a coherent existing historical book is bound explicitly without rewriting it');
reset role;
select lives_ok($$select private.assert_franchise_book_period_basis_v1('f372b000-0000-4000-8000-000000000009','2026-10-02','2026-10-31',(select id from public.franchise_finance_rule_versions where franchise_type='STANDARD'and version=1))$$,'expiration and termination do not invalidate the source for an eligible historical period');
select throws_ok($$select private.assert_franchise_book_period_basis_v1('f372b000-0000-4000-8000-000000000009','2026-11-03','2026-11-04',(select id from public.franchise_finance_rule_versions where franchise_type='STANDARD'and version=1))$$,'55000','FRANCHISE_HISTORICAL_BOOK_BASIS_RECONCILIATION_REQUIRED','the historical mandate cannot back operations after its own effective window');
select throws_ok($$insert into public.franchise_distribution_ledger_entries(book_id,beneficiary_code,entry_type,amount_minor,currency,reference_type,reference_id,correlation_id,created_by)values('f372b000-0000-4000-8000-000000000009','FRANCHISEE','PAYOUT',-1,'MAD','TEST','NO_CLOSURE_PAYOUT','f372c000-0000-4000-8000-000000000009','a3720000-0000-4000-8000-000000000002')$$,'55000','FRANCHISE_DISTRIBUTION_APPROVED_BASIS_REQUIRED','a valid historical mandate alone never manufactures an earned distribution without a sourced closure');
select is((select status from public.franchises where id='f372a000-0000-4000-8000-000000000001'),'TERMINATED','historical recovery does not reactivate the franchise');
select ok(not has_table_privilege('service_role','public.franchise_pnl_book_bindings_v1','INSERT')and not has_table_privilege('authenticated','public.franchise_pnl_book_bindings_v1','INSERT'),'no browser or service receives a direct binding write grant');
select pg_temp.actor372(2);set local role authenticated;
select is(jsonb_array_length(public.franchise_book_opening_context_v1((select franchise from basis372 where k='S1'))->'choices'),1,'the native opening selector contains only the selected approved mandate and compatible rule');
select is(public.franchise_book_opening_context_v1((select franchise from basis372 where k='S1'))#>>'{choices,0,boundBookId}',(select opening->>'book_id'from basis372 where k='S1'),'the selector returns the already bound book without exposing a sibling territory');
select pg_temp.actor372(2,'aal1');
select throws_ok($$select public.franchise_book_opening_context_v1()$$,'42501','AAL2_REQUIRED','the purpose-scoped selector requires current AAL2 too');
select pg_temp.actor372(4);
select throws_ok($$select public.franchise_book_opening_context_v1()$$,'42501','FRANCHISE_BOOK_DENIED','the selector is not an unprotected cross-organization discovery endpoint');
reset role;
-- Public read APIs are narrow boolean boundaries, not a definer dashboard or
-- private-schema grant. Exercise both central and assigned franchise readers.
select ok(not(select prosecdef from pg_proc where oid='public.franchise_governance_dashboard_snapshot(uuid)'::regprocedure),'the corrected dashboard remains SECURITY INVOKER');
select ok(not has_schema_privilege('authenticated','private','USAGE'),'dashboard repair adds no private-schema USAGE');
select pg_temp.actor372(1);set local role authenticated;
select is(public.franchise_finance_book_binding_review_v1((select(opening->>'book_id')::uuid from basis372 where k='S1')),false,'a real assigned franchise owner reads their own exact book binding');
select is(public.franchise_finance_book_matches_scope_v1((select(opening->>'book_id')::uuid from basis372 where k='S2'),(select franchise from basis372 where k='S1')),false,'a scoped reader cannot substitute a sibling territory even when assigned to both');
select pg_temp.actor372(4);
select throws_ok($$select public.franchise_finance_book_binding_review_v1((select(opening->>'book_id')::uuid from basis372 where k='S1'))$$,'42501','FRANCHISE_BOOK_SCOPE_DENIED','the public boolean boundary does not expose another organization binding state');
select pg_temp.actor372(2,'aal1');
select throws_ok($$select public.franchise_finance_book_binding_review_v1((select(opening->>'book_id')::uuid from basis372 where k='S1'))$$,'42501','FRANCHISE_FINANCE_MFA_REQUIRED','a central financial reader retains their actual MFA prerequisite');
reset role;
-- Deliberately invalid initial metadata: a second evidence row is not another
-- source to choose silently. The failed check never inserts financial money.
insert into public.franchise_invitations(id,franchise_id,invited_email,status,expires_at)select'f372d000-0000-4000-8000-000000000001',franchise,'book372-1@example.invalid','SENT',clock_timestamp()+interval'1 day'from basis372 where k='S1';
insert into public.franchise_activation_evidence(invitation_id,franchise_id,approved_mandate_version_id,active_mandate_version_id,mandate_hash,activation_mode,environment,actor_user_id,evidence_snapshot,evidence_hash)
select'f372d000-0000-4000-8000-000000000001',original.franchise_id,original.approved_mandate_version_id,original.active_mandate_version_id,original.mandate_hash,original.activation_mode,original.environment,original.actor_user_id,original.evidence_snapshot,original.evidence_hash
from public.franchise_activation_evidence original join basis372 item on item.franchise=original.franchise_id where item.k='S1';
select throws_ok($$select private.franchise_book_active_basis_v1((select(opening->>'book_id')::uuid from basis372 where k='S1'))$$,'55000','FRANCHISE_BOOK_ACTIVATION_CHRONOLOGY_REQUIRED','ambiguous activation evidence cannot select the first row and certify a financial source');
select *from finish();rollback;

