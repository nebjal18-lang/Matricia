begin;set local search_path=public,extensions;select plan(20);
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)values
('a2020000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','manager-f1-202@example.invalid','',now(),'{}','{}',now(),now()),
('a2020000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','recipient-f1-202@example.invalid','',now(),'{}','{}',now(),now()),
('a2020000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','manager-f2-202@example.invalid','',now(),'{}','{}',now(),now()),
('a2020000-0000-4000-8000-000000000004','00000000-0000-0000-0000-000000000000','authenticated','authenticated','recipient-f2-202@example.invalid','',now(),'{}','{}',now(),now()),
('a2020000-0000-4000-8000-000000000005','00000000-0000-0000-0000-000000000000','authenticated','authenticated','unscoped-202@example.invalid','',now(),'{}','{}',now(),now()),
('a2020000-0000-4000-8000-000000000006','00000000-0000-0000-0000-000000000000','authenticated','authenticated','admin-202@example.invalid','',now(),'{}','{}',now(),now());
insert into public.organizations(id,legal_name,display_name,status,created_by)values('b2020000-0000-4000-8000-000000000001','Multi Franchise P89 SARL','Multi Franchise P89','ACTIVE','a2020000-0000-4000-8000-000000000001');
insert into public.catalog_libraries(id,code,slug,steward_organization_id,status,created_by)values('f2090000-0000-4000-8000-000000000010','MESSAGE_SEARCH_202','message-search-202','b2020000-0000-4000-8000-000000000001','DRAFT','a2020000-0000-4000-8000-000000000001');
insert into public.organization_memberships(id,organization_id,user_id,status,activated_at)values
('c2020000-0000-4000-8000-000000000001','b2020000-0000-4000-8000-000000000001','a2020000-0000-4000-8000-000000000001','ACTIVE',now()),
('c2020000-0000-4000-8000-000000000002','b2020000-0000-4000-8000-000000000001','a2020000-0000-4000-8000-000000000002','ACTIVE',now()),
('c2020000-0000-4000-8000-000000000003','b2020000-0000-4000-8000-000000000001','a2020000-0000-4000-8000-000000000003','ACTIVE',now()),
('c2020000-0000-4000-8000-000000000004','b2020000-0000-4000-8000-000000000001','a2020000-0000-4000-8000-000000000004','ACTIVE',now()),
('c2020000-0000-4000-8000-000000000005','b2020000-0000-4000-8000-000000000001','a2020000-0000-4000-8000-000000000005','ACTIVE',now());
insert into public.franchises(id,library_id,operator_organization_id,franchise_type,operator_code,territory_code,status,created_by)values
('d2020000-0000-4000-8000-000000000001','f2090000-0000-4000-8000-000000000010','b2020000-0000-4000-8000-000000000001','STANDARD','FRANCHISEE','P89_F1','ACTIVE','a2020000-0000-4000-8000-000000000001'),
('d2020000-0000-4000-8000-000000000002','f2090000-0000-4000-8000-000000000010','b2020000-0000-4000-8000-000000000001','STANDARD','FRANCHISEE','P89_F2','ACTIVE','a2020000-0000-4000-8000-000000000003');
insert into public.organization_member_roles(membership_id,role_code,franchise_id)values
('c2020000-0000-4000-8000-000000000001','FRANCHISE_MANAGER','d2020000-0000-4000-8000-000000000001'),
('c2020000-0000-4000-8000-000000000002','FRANCHISE_VIEWER','d2020000-0000-4000-8000-000000000001'),
('c2020000-0000-4000-8000-000000000003','FRANCHISE_MANAGER','d2020000-0000-4000-8000-000000000002'),
('c2020000-0000-4000-8000-000000000004','FRANCHISE_VIEWER','d2020000-0000-4000-8000-000000000002'),
('c2020000-0000-4000-8000-000000000005','FRANCHISE_VIEWER',null);
insert into public.platform_user_roles(user_id,role_code)values('a2020000-0000-4000-8000-000000000006','MATRICIA_ADMIN');

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
 ('f2020000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','func202-client@example.invalid','',now(),'{}','{}',now(),now()),
 ('f2020000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','func202-provider@example.invalid','',now(),'{}','{}',now(),now()),
 ('f2020000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','func202-outsider@example.invalid','',now(),'{}','{}',now(),now());

insert into public.organizations(id,legal_name,display_name,status,created_by) values
 ('f2021000-0000-4000-8000-000000000001','Client functional 154','Client functional 154','ACTIVE','f2020000-0000-4000-8000-000000000001'),
 ('f2021000-0000-4000-8000-000000000002','Provider A functional 154','Provider A functional 154','ACTIVE','f2020000-0000-4000-8000-000000000002'),
 ('f2021000-0000-4000-8000-000000000003','Provider B functional 154','Provider B functional 154','ACTIVE','f2020000-0000-4000-8000-000000000002'),
 ('f2021000-0000-4000-8000-000000000004','Outsider functional 154','Outsider functional 154','ACTIVE','f2020000-0000-4000-8000-000000000003');

insert into public.organization_memberships(id,organization_id,user_id,status,activated_at) values
 ('f2022000-0000-4000-8000-000000000001','f2021000-0000-4000-8000-000000000001','f2020000-0000-4000-8000-000000000001','ACTIVE',now()),
 ('f2022000-0000-4000-8000-000000000002','f2021000-0000-4000-8000-000000000002','f2020000-0000-4000-8000-000000000002','ACTIVE',now()),
 ('f2022000-0000-4000-8000-000000000003','f2021000-0000-4000-8000-000000000004','f2020000-0000-4000-8000-000000000003','ACTIVE',now());
insert into public.organization_member_roles(membership_id,role_code) values
 ('f2022000-0000-4000-8000-000000000001','CLIENT_OWNER'),
 ('f2022000-0000-4000-8000-000000000002','PROVIDER_SALES'),
 ('f2022000-0000-4000-8000-000000000003','CLIENT_OWNER');

-- Build a coherent RFQ and two frozen submitted quotes without invoking unrelated
-- catalogue/matching workflows. The behavior under test starts at the public RPCs.
grant usage on schema extensions to authenticated;
set local session_replication_role=replica;
insert into public.service_requests(id,client_organization_id,library_id,service_id,status,created_by) values
 ('f2023000-0000-4000-8000-000000000001','f2021000-0000-4000-8000-000000000001','f2023100-0000-4000-8000-000000000001','f2023200-0000-4000-8000-000000000001','RFQ_OPEN','f2020000-0000-4000-8000-000000000001');
insert into public.rfqs(id,request_id,request_version_id,matching_run_id,deadline,status,invited_count,opened_by) values
 ('f2024000-0000-4000-8000-000000000001','f2023000-0000-4000-8000-000000000001','f2023300-0000-4000-8000-000000000001','f2023400-0000-4000-8000-000000000001',now()+interval '7 days','OPEN',2,'f2020000-0000-4000-8000-000000000001');
insert into public.rfq_providers(id,rfq_id,provider_organization_id,matching_candidate_id,status,responded_at) values
 ('f2025000-0000-4000-8000-000000000001','f2024000-0000-4000-8000-000000000001','f2021000-0000-4000-8000-000000000002','f2025100-0000-4000-8000-000000000001','ACCEPTED',now()),
 ('f2025000-0000-4000-8000-000000000002','f2024000-0000-4000-8000-000000000001','f2021000-0000-4000-8000-000000000003','f2025100-0000-4000-8000-000000000002','ACCEPTED',now());
insert into public.quotes(id,rfq_id,rfq_provider_id,provider_organization_id,status,created_by) values
 ('f2026000-0000-4000-8000-000000000001','f2024000-0000-4000-8000-000000000001','f2025000-0000-4000-8000-000000000001','f2021000-0000-4000-8000-000000000002','SUBMITTED','f2020000-0000-4000-8000-000000000002'),
 ('f2026000-0000-4000-8000-000000000002','f2024000-0000-4000-8000-000000000001','f2025000-0000-4000-8000-000000000002','f2021000-0000-4000-8000-000000000003','SUBMITTED','f2020000-0000-4000-8000-000000000002');
insert into public.quote_versions(id,quote_id,rfq_id,provider_organization_id,version_number,lifecycle_status,change_reason,currency,solution_fr,deliverables,warranty_fr,correction_terms_fr,proposed_start_date,duration_days,valid_until,subtotal_minor,tax_minor,total_minor,recurring_subtotal_minor,calculation_basis,content_hash,submitted_at,created_by) values
 ('f2027000-0000-4000-8000-000000000001','f2026000-0000-4000-8000-000000000001','f2024000-0000-4000-8000-000000000001','f2021000-0000-4000-8000-000000000002',1,'SUBMITTED','Offre A soumise','MAD','Solution A',jsonb_build_array('Livrable A'),'Garantie A','Corrections A',current_date+10,10,now()+interval '30 days',10000,2000,12000,0,'{"money":"MINOR_UNITS"}',repeat('a',64),now(),'f2020000-0000-4000-8000-000000000002'),
 ('f2027000-0000-4000-8000-000000000002','f2026000-0000-4000-8000-000000000002','f2024000-0000-4000-8000-000000000001','f2021000-0000-4000-8000-000000000003',1,'SUBMITTED','Offre B soumise','MAD','Solution B',jsonb_build_array('Livrable B','Livrable B2'),'Garantie B','Corrections B',current_date+12,12,now()+interval '30 days',20000,4000,24000,0,'{"money":"MINOR_UNITS"}',repeat('b',64),now(),'f2020000-0000-4000-8000-000000000002');
update public.quotes set current_version_id=case id when 'f2026000-0000-4000-8000-000000000001'::uuid then 'f2027000-0000-4000-8000-000000000001'::uuid else 'f2027000-0000-4000-8000-000000000002'::uuid end;
set local session_replication_role=origin;

create temporary table functional_results(kind text,value jsonb);
create temporary table rls_visibility(kind text,value bigint);
grant select,insert on functional_results,rls_visibility to authenticated;


set local session_replication_role=replica;
update public.service_requests set library_id='f2090000-0000-4000-8000-000000000010'where id='f2023000-0000-4000-8000-000000000001';
insert into public.franchise_mandate_versions(id,franchise_id,territory_version_id,economic_rule_version_id,version,mandate_status,rights_snapshot,obligations_snapshot,contract_snapshot,entry_fee_minor,entry_fee_mode,entry_fee_term_months,franchisee_share_bps,neoxa_share_bps,matricia_share_bps,distribution_basis,effective_from,content_hash,created_by)
select case when territory_code='P89_F1'then 'd2120000-0000-4000-8000-000000000001'::uuid else 'd2120000-0000-4000-8000-000000000002'::uuid end,id,'d2130000-0000-4000-8000-000000000001','d2140000-0000-4000-8000-000000000001',1,'ACTIVE','{}','{}','{}',0,'EXEMPT',0,5000,2500,2500,'DISTRIBUTABLE_PROFIT',now()-interval'1 day',repeat('a',64),created_by from public.franchises where id in('d2020000-0000-4000-8000-000000000001','d2020000-0000-4000-8000-000000000002');
update public.franchises f set current_mandate_version_id=m.id from public.franchise_mandate_versions m where m.franchise_id=f.id and f.id in('d2020000-0000-4000-8000-000000000001','d2020000-0000-4000-8000-000000000002');
set local session_replication_role=origin;
set local session_replication_role=replica;
insert into public.internal_message_threads(id,object_type,object_id,service_request_id,client_organization_id,provider_organization_id,franchise_id,counterparty_organization_id,subject,created_by,created_at)
select('f2029000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'FRANCHISE_RFQ',('f2024000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'f2023000-0000-4000-8000-000000000001','b2020000-0000-4000-8000-000000000001','f2021000-0000-4000-8000-000000000002','d2020000-0000-4000-8000-000000000001','f2021000-0000-4000-8000-000000000002',case when i=1 then'SPECIAL_OLD'else'Other thread '||i end,'a2020000-0000-4000-8000-000000000001',now()-make_interval(days=>102-i)from generate_series(1,251)i;
insert into public.internal_message_participants(id,thread_id,organization_id,participant_kind,display_alias)
select('f2029100-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,('f2029000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'b2020000-0000-4000-8000-000000000001','FRANCHISE','FRANCHISE'from generate_series(1,251)i;
insert into public.internal_message_participants(thread_id,organization_id,participant_kind,display_alias)
select('f2029000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'f2021000-0000-4000-8000-000000000002','PROVIDER','PROVIDER'from generate_series(1,251)i;
insert into public.internal_messages(thread_id,sender_participant_id,sender_organization_id,sender_user_id,body,idempotency_key,created_at)values('f2029000-0000-4000-8000-000000000001','f2029100-0000-4000-8000-000000000001','b2020000-0000-4000-8000-000000000001','a2020000-0000-4000-8000-000000000001','needle_body_only','message-search-fixture',now()-interval'101 days');
set local session_replication_role=origin;

-- The history reader starts with402 durable messages;401 share the same microsecond.
insert into public.internal_messages(id,thread_id,sender_participant_id,sender_organization_id,sender_user_id,body,idempotency_key,created_at)
select('f2070000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'f2029000-0000-4000-8000-000000000001','f2029100-0000-4000-8000-000000000001','b2020000-0000-4000-8000-000000000001','a2020000-0000-4000-8000-000000000001','Message historique '||n,'pagination207-message-'||n,'2026-01-01T00:00:00.123456Z'from generate_series(1,401)n;
insert into public.internal_messages(id,thread_id,sender_participant_id,sender_organization_id,sender_user_id,body,idempotency_key,created_at)values('f2070000-0000-4000-8000-000000000999','f2029000-0000-4000-8000-000000000002','f2029100-0000-4000-8000-000000000002','b2020000-0000-4000-8000-000000000001','a2020000-0000-4000-8000-000000000001','Autre conversation','pagination207-other','2026-01-01T00:00:00.123456Z');
create temporary table history_pages(kind text primary key,value jsonb);create temporary table history_seen(id uuid primary key);grant select,insert on history_pages,history_seen to authenticated;
set local role authenticated;select set_config('request.jwt.claims','{"sub":"a2020000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
select is((public.search_franchise_message_inbox('d2020000-0000-4000-8000-000000000001','SPECIAL_OLD',1)->>'total')::int,1,'dedicated franchise search reaches thread older than200');
select is((public.search_franchise_message_inbox('d2020000-0000-4000-8000-000000000001','needle_body_only',1)->>'total')::int,1,'dedicated franchise search scans authorized message body before pagination');
select is((public.search_franchise_message_inbox('d2020000-0000-4000-8000-000000000001','',1)->>'total')::int,251,'thread denominator is exhaustive');
select is(jsonb_array_length(public.search_franchise_message_inbox('d2020000-0000-4000-8000-000000000001','',1)->'inbox'),25,'franchise inbox first page is bounded25');
select is(jsonb_array_length(public.search_franchise_message_inbox('d2020000-0000-4000-8000-000000000001','',11)->'inbox'),1,'franchise inbox last page reaches beyond former200 cap');
insert into history_pages values('FIRST',public.get_internal_message_thread_page('f2029000-0000-4000-8000-000000000001'));
select is((select(value->>'total')::int from history_pages where kind='FIRST'),402,'thread history reports full denominator beyond300');
select is((select jsonb_array_length(value->'messages')from history_pages where kind='FIRST'),50,'history page is bounded50');
select is((select value->>'hasMore'from history_pages where kind='FIRST'),'true','history indicates older messages explicitly');
insert into history_seen select(x.value->>'id')::uuid from history_pages h cross join lateral jsonb_array_elements(h.value->'messages')x(value)where h.kind='FIRST';
insert into history_pages values('CONCURRENT',public.send_internal_message('f2029000-0000-4000-8000-000000000001','b2020000-0000-4000-8000-000000000001','Message ajouté pendant la lecture.','[]','pagination207-concurrent-send'));
do $$declare page jsonb;cursor jsonb;loops integer:=0;begin
 select value->'nextCursor'into cursor from history_pages where kind='FIRST';
 loop
  exit when cursor is null or cursor='null'::jsonb;
  loops:=loops+1;if loops>100 then raise exception'CURSOR_DID_NOT_TERMINATE';end if;
  page:=public.get_internal_message_thread_page('f2029000-0000-4000-8000-000000000001',(cursor->>'createdAt')::timestamptz,(cursor->>'id')::uuid,50);
  insert into history_seen select(value->>'id')::uuid from jsonb_array_elements(page->'messages')x(value);
  cursor:=page->'nextCursor';
 end loop;
 insert into history_pages values('LAST',page);
end$$;
select is((select count(*)from history_seen),402::bigint,'tuple cursors visit every original message exactly once despite concurrent send');
select is((select value->>'hasMore'from history_pages where kind='LAST'),'false','last page declares history exhaustion');
select is((public.get_internal_message_thread_page('f2029000-0000-4000-8000-000000000001')->>'total')::int,403,'refresh includes the new durable message');
select is((select count(*)from history_seen where id='f2070000-0000-4000-8000-000000000001'),1::bigint,'oldest equal-timestamp message remains reachable');
select throws_ok($$select public.get_internal_message_thread_page('f2029000-0000-4000-8000-000000000001','2026-01-01T00:00:00.123456Z','f2070000-0000-4000-8000-000000000999')$$,'22023','INVALID_MESSAGE_CURSOR','cursor from another thread cannot be substituted');
select throws_ok($$select public.get_internal_message_thread_page('f2029000-0000-4000-8000-000000000001',null,'f2070000-0000-4000-8000-000000000001')$$,'22023','INVALID_MESSAGE_CURSOR','partial cursor is rejected');
select throws_ok($$select public.get_internal_message_thread_page('f2029000-0000-4000-8000-000000000001',null,null,null)$$,'22023','INVALID_PAGE_LIMIT','null page size is rejected');
select set_config('request.jwt.claims','{"sub":"a2020000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}',true);
select throws_ok($$select public.get_internal_message_thread_page('f2029000-0000-4000-8000-000000000001')$$,'42501','MESSAGE_THREAD_SCOPE_DENIED','same-organization sibling mandate cannot read history');
select throws_ok($$select public.search_franchise_message_inbox('d2020000-0000-4000-8000-000000000001','',1)$$,'42501','FRANCHISE_MESSAGE_SCOPE_DENIED','sibling mandate cannot search scoped inbox');
select set_config('request.jwt.claims','{"sub":"f2020000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',true);
select is((public.get_internal_message_thread_page('f2029000-0000-4000-8000-000000000001')->'thread'->>'counterparty_alias'),'FRANCHISE','explicit provider participant retains authorized history');
reset role;
select ok(not has_function_privilege('anon','public.get_internal_message_thread_page(uuid,timestamptz,uuid,integer)','execute'),'anonymous history access denied');
select ok(not has_function_privilege('service_role','public.get_internal_message_thread_page(uuid,timestamptz,uuid,integer)','execute'),'service role cannot bypass history participant authorization');
select *from finish();rollback;
