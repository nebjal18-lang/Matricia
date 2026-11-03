begin;
set local search_path=public,extensions;
select plan(18);
-- The provider submits a declaration; only independent Finance creates money.
create temporary view tested_payment_declaration_sources as
 select pg_get_functiondef('public.record_provider_payment(uuid,text,date,text,character,bigint,text,uuid,uuid,text,uuid)'::regprocedure) as public_source,
 pg_get_functiondef('private.declare_provider_finance_v1(uuid,uuid,text,jsonb,text,uuid)'::regprocedure) as declaration_source,
 pg_get_functiondef('public.review_provider_financial_declaration_v1(uuid,boolean,text)'::regprocedure) as review_source;


select ok(to_regclass('public.provider_payment_proof_uploads')is not null and to_regclass('public.provider_payment_proofs')is not null,'payment proof reservation and immutable evidence tables exist');
select ok((select bool_and(relrowsecurity)from pg_class where oid=any(array['public.provider_payment_proof_uploads'::regclass,'public.provider_payment_proofs'::regclass])),'payment proof tables enforce RLS');
select ok(has_table_privilege('authenticated','public.provider_payment_proofs','SELECT')and not has_table_privilege('authenticated','public.provider_payment_proofs','INSERT,UPDATE,DELETE'),'authenticated users can only read proof metadata through RLS');
select ok(not has_table_privilege('authenticated','public.provider_payment_proof_uploads','INSERT,UPDATE,DELETE'),'reservation rows cannot be mutated directly');
select ok((select not public and file_size_limit=10485760 and allowed_mime_types@>array['application/pdf','image/jpeg','image/png']from storage.buckets where id='provider-qualification'),'existing provider vault remains private and bounded');
select ok((select count(*)=2 from pg_policies where schemaname='public'and tablename=any(array['provider_payment_proof_uploads','provider_payment_proofs'])),'both metadata tables have explicit scoped read policies');
select ok((select qual like '%provider_billing_access%'from pg_policies where schemaname='public'and tablename='provider_payment_proofs'),'proof read policy is tenant scoped through provider billing authorization');
select ok((select count(*)=3 from pg_policies where schemaname='storage'and policyname like'provider_payment_proof_storage_%'),'storage has reserved insert, orphan delete and scoped read policies');
select ok((select count(*)=2 from pg_constraint where conrelid='public.provider_payment_proofs'::regclass and contype='f'and pg_get_constraintdef(oid)like'%provider_organization_id%'),'proof-to-payment and proof-to-upload references are tenant bound');
select ok((select count(*)=1 from pg_trigger where tgrelid='public.provider_payment_proofs'::regclass and tgname='provider_payment_proofs_immutable'and not tgisinternal),'bound payment proofs are immutable');
select ok(not exists(select 1 from information_schema.columns where table_schema='public'and table_name in('provider_payment_proof_uploads','provider_payment_proofs')and data_type in('real','double precision')),'proof metadata contains no floating-point values');
select ok((select prosecdef and proconfig::text like'%search_path=%'from pg_proc where oid='public.begin_provider_payment_proof_upload(uuid,text,text,bigint,text,text,uuid)'::regprocedure),'reservation command is security definer with fixed search path');
select ok(has_function_privilege('authenticated','public.begin_provider_payment_proof_upload(uuid,text,text,bigint,text,text,uuid)','EXECUTE')and not has_function_privilege('anon','public.begin_provider_payment_proof_upload(uuid,text,text,bigint,text,text,uuid)','EXECUTE')and not has_function_privilege('service_role','public.begin_provider_payment_proof_upload(uuid,text,text,bigint,text,text,uuid)','EXECUTE'),'only authenticated actors can invoke the guarded reservation command');
select ok((select pg_get_functiondef(oid)like'%provider.payment.proof.reserve.v1%'and pg_get_functiondef(oid)like'%begin_provider_billing_command%'from pg_proc where oid='public.begin_provider_payment_proof_upload(uuid,text,text,bigint,text,text,uuid)'::regprocedure),'proof reservation is idempotent and payload-bound');
select ok((select public_source like '%private.declare_provider_finance_v1(%' and declaration_source like '%provider_payment_proof_uploads%' and declaration_source like '%PROOF_STORAGE_MISMATCH%' and declaration_source like '%storage.objects%' and public_source not like '%insert into public.provider_payments%' and declaration_source not like '%insert into public.financial_journals%' from tested_payment_declaration_sources),'payment declaration requires reserved matching storage and cannot itself record money');
select ok((select review_source like '%INDEPENDENT_FINANCE_REVIEW_REQUIRED%' and review_source like '%insert into public.provider_payment_proofs%' and review_source like '%status=''BOUND''%' and review_source like '%payment_id=p%' from tested_payment_declaration_sources),'independent Finance review binds one immutable proof in the financial transaction');
select ok((select declaration_source like '%upload_id%' and review_source like '%provider.financial.reviewed%' and review_source like '%ProviderFinancialDeclarationReviewedV1%' and review_source like '%''declaration_id'',d.id%' and review_source like '%''payment_id'',p%' and review_source like '%upload_id,storage_object_path%' from tested_payment_declaration_sources),'review audit and Outbox identify the immutable declaration and payment linked to archived proof');
select ok((select qual like'%provider_payment_proofs%'and qual like'%provider_billing_access%'from pg_policies where schemaname='storage'and policyname='provider_payment_proof_storage_scoped_read'),'storage read requires a bound proof and tenant billing access');

select * from finish();
rollback;
