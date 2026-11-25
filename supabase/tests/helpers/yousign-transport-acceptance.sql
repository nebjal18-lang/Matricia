-- Appended to the existing canonical-contract/archive241 fixture by the local
-- acceptance runner. All actors, approvals, attestation and provider IDs below
-- are SYNTHETIC inside a rollback. This is not YouSign or legal certification.
create temporary table y391(k text primary key,v jsonb);
create function pg_temp.y391_user(actor uuid) returns void language plpgsql as $$begin
 perform set_config('request.jwt.claim.sub',actor::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated','aal','aal2')::text,true);
end$$;
create function pg_temp.y391_service() returns void language plpgsql as $$begin
 perform set_config('request.jwt.claim.sub','',true);
 perform set_config('request.jwt.claims','{"role":"service_role"}',true);
end$$;
insert into public.organization_member_roles(membership_id,role_code) select id,'PROVIDER_OWNER' from public.organization_memberships where user_id='fa120000-0000-4000-8000-000000000001' and organization_id='fa122000-0000-4000-8000-000000000002' on conflict do nothing;
insert into public.signature_provider_configs(id,provider_code,environment,version,status,supported_levels,endpoint_base_url,valid_from)
values('ab910000-0000-4000-8000-000000000001','YOUSIGN','DEVELOPMENT',1,'ACTIVE',array['SIMPLE'],'https://api-sandbox.yousign.app/v3',clock_timestamp()-interval '1 hour');
insert into private.signature_adapter_attestations_v1(environment,issuer_organization_id,provider_config_id,source_kinds,levels,legal_approval_reference,adapter_registration_reference,verification_reference,verified_by,reviewed_by,verified_at,valid_until)
values('DEVELOPMENT','fa122000-0000-4000-8000-000000000001','ab910000-0000-4000-8000-000000000001',array['CONTRACT'],array['SIMPLE'],'TEST-ONLY-LEGAL-Y391','TEST-ONLY-ADAPTER-Y391','SYNTHETIC-TRANSACTIONAL-ATTESTATION-NOT-EXTERNAL','a2200000-0000-4000-8000-000000000002','f2120000-0000-4000-8000-000000000002',clock_timestamp()-interval '1 hour',clock_timestamp()+interval '2 hours');
select pg_temp.y391_user('a2200000-0000-4000-8000-000000000002');
insert into y391 values('proposal',public.propose_signature_policy_v1('fa122000-0000-4000-8000-000000000001','CONTRACT','ab910000-0000-4000-8000-000000000001','SIMPLE',false,false,'TEST-ONLY-LEGAL-Y391','TEST-ONLY-ADAPTER-Y391',1,'Synthetic native sandbox transport acceptance only','ab910000-0000-4000-8000-000000000002'));
select throws_ok($$select public.decide_signature_policy_v1((select(v->>'proposal_id')::uuid from y391 where k='proposal'),(select v->>'content_hash' from y391 where k='proposal'),true,'Synthetic independent review is required')$$,'42501','FOUR_EYES_REQUIRED','native policy proposer still cannot approve their own scope');
select pg_temp.y391_user('f2120000-0000-4000-8000-000000000002');
select public.decide_signature_policy_v1((select(v->>'proposal_id')::uuid from y391 where k='proposal'),(select v->>'content_hash' from y391 where k='proposal'),true,'Synthetic independent review for this rollback only');
select pg_temp.y391_user('a2200000-0000-4000-8000-000000000001');
insert into y391 values('envelope',public.create_signature_envelope((select(v->>'contract_id')::uuid from contract_results where k='draft'),(select(v->>'contract_version_id')::uuid from archive241 where k='source'),'YOUSIGN','DEVELOPMENT','SIMPLE','contract-source.pdf',(select v->0->>'storage_path' from archive241 where k='pair'),repeat('1',64),'y391-create-envelope'));
insert into y391 values('client-signer',public.add_signature_signer((select(v->>'envelope_id')::uuid from y391 where k='envelope'),'fa122000-0000-4000-8000-000000000001','a2200000-0000-4000-8000-000000000001','CLIENT_OWNER',(select encode(extensions.digest(lower(btrim(email)),'sha256'),'hex') from auth.users where id='a2200000-0000-4000-8000-000000000001'),1,'y391-client-signer'));
insert into y391 values('provider-signer',public.add_signature_signer((select(v->>'envelope_id')::uuid from y391 where k='envelope'),'fa122000-0000-4000-8000-000000000002','fa120000-0000-4000-8000-000000000001','PROVIDER_OWNER',(select encode(extensions.digest(lower(btrim(email)),'sha256'),'hex') from auth.users where id='fa120000-0000-4000-8000-000000000001'),2,'y391-provider-signer'));
select public.authorize_signature_signer((select(v->>'signer_id')::uuid from y391 where k='client-signer'),'LEGAL_REPRESENTATIVE',array['CONTRACT_SIGNATURE'],null,null,current_date-1,current_date+1,'test-only/client-authority.pdf',repeat('a',64),'y391-client-authority');
select public.configure_yousign_signer_v1((select(v->>'signer_id')::uuid from y391 where k='client-signer'),'Client','Fixture','fr',jsonb_build_array(jsonb_build_object('documentSha256',repeat('1',64),'page',1,'x',40,'y',600)));
select throws_ok($$select public.configure_yousign_signer_v1((select(v->>'signer_id')::uuid from y391 where k='provider-signer'),'Foreign','Change','fr',jsonb_build_array(jsonb_build_object('documentSha256',repeat('1',64),'page',1,'x',40,'y',600)))$$,'42501','YOUSIGN_SIGNER_CONFIGURATION_DENIED','client cannot configure the provider identity or stamp');
select pg_temp.y391_user('fa120000-0000-4000-8000-000000000001');
select public.authorize_signature_signer((select(v->>'signer_id')::uuid from y391 where k='provider-signer'),'LEGAL_REPRESENTATIVE',array['CONTRACT_SIGNATURE'],null,null,current_date-1,current_date+1,'test-only/provider-authority.pdf',repeat('b',64),'y391-provider-authority');
select public.configure_yousign_signer_v1((select(v->>'signer_id')::uuid from y391 where k='provider-signer'),'Provider','Fixture','fr',jsonb_build_array(jsonb_build_object('documentSha256',repeat('1',64),'page',1,'x',260,'y',600)));
select pg_temp.y391_user('a2200000-0000-4000-8000-000000000001');
select public.ready_signature_envelope((select(v->>'envelope_id')::uuid from y391 where k='envelope'),1,'y391-ready-envelope');
select pg_temp.y391_service();
select throws_ok($$select public.begin_yousign_dispatch_v1((select(v->>'envelope_id')::uuid from y391 where k='envelope'),'SEND','y391-send-operation')$$,'55000','CONTRACT_SIGNATURE_SUBMISSION_REQUIRED','ready PDF alone does not authorize a remote send before contract submission');
select pg_temp.y391_user('a2200000-0000-4000-8000-000000000001');
select public.submit_contract_for_signature((select(v->>'contract_id')::uuid from contract_results where k='draft'),1,'y391-submit-contract');
select pg_temp.y391_service();
insert into y391 values('claim',public.begin_yousign_dispatch_v1((select(v->>'envelope_id')::uuid from y391 where k='envelope'),'SEND','y391-send-operation'));
select is((select v->>'outcome' from y391 where k='claim'),'CLAIMED','approved current source, two identities and powers produce a real durable claim');
select is((select jsonb_array_length(v->'envelope'->'identities') from y391 where k='claim'),2,'claim resolves both explicit identities and Auth-confirmed emails');
select is(public.begin_yousign_dispatch_v1((select(v->>'envelope_id')::uuid from y391 where k='envelope'),'SEND','y391-send-operation')->>'outcome','RECONCILIATION_REQUIRED','concurrent or abandoned claim cannot repeat a provider write');
select throws_ok($$select public.begin_yousign_dispatch_v1((select(v->>'envelope_id')::uuid from y391 where k='envelope'),'SEND','y391-different-operation')$$,'22000','YOUSIGN_OPERATION_KEY_MISMATCH','another key cannot bypass a claimed send');
select ok(public.record_yousign_reference_v1((select(v->>'envelope_id')::uuid from y391 where k='envelope'),'REQUEST','ab910000-0000-4000-8000-000000000003'),'provider request ID persists before later external steps');
select ok(public.record_yousign_reference_v1((select(v->>'envelope_id')::uuid from y391 where k='envelope'),'REQUEST','ab910000-0000-4000-8000-000000000003'),'same request reference is idempotent');
select throws_ok($$select public.record_yousign_reference_v1((select(v->>'envelope_id')::uuid from y391 where k='envelope'),'REQUEST','ab910000-0000-4000-8000-000000000099')$$,'22000','YOUSIGN_REFERENCE_IMMUTABLE','a remote envelope cannot be silently replaced');
select ok(public.record_yousign_reference_v1((select(v->>'envelope_id')::uuid from y391 where k='envelope'),'DOCUMENT','ab910000-0000-4000-8000-000000000004',repeat('1',64)),'exact original document hash maps to one native PDF');
select ok(public.record_yousign_reference_v1((select(v->>'envelope_id')::uuid from y391 where k='envelope'),'SIGNER','ab910000-0000-4000-8000-000000000005',(select v->>'signer_id' from y391 where k='client-signer'),repeat('a',64)),'first authorized identity fingerprint persists');
select ok(public.record_yousign_reference_v1((select(v->>'envelope_id')::uuid from y391 where k='envelope'),'SIGNER','ab910000-0000-4000-8000-000000000006',(select v->>'signer_id' from y391 where k='provider-signer'),repeat('b',64)),'second authorized identity fingerprint persists');
select is(jsonb_array_length(public.get_yousign_envelope_v1(null,'ab910000-0000-4000-8000-000000000003')->'state'->'signers'),2,'native state loads both stored signer mappings');
select ok(public.finish_yousign_dispatch_v1((select(v->>'envelope_id')::uuid from y391 where k='envelope'),'SEND','y391-send-operation','ACCEPTED'),'provider activation acceptance durably completes the operation');
select is(public.begin_yousign_dispatch_v1((select(v->>'envelope_id')::uuid from y391 where k='envelope'),'SEND','y391-send-operation')->>'outcome','COMPLETED','accepted operation replay cannot send another email');
select is((select status from public.signature_envelopes where id=(select(v->>'envelope_id')::uuid from y391 where k='envelope')),'READY_FOR_SIGNATURE','HTTP activation acceptance alone does not invent a verified SENT or SIGNED fact');
select pg_temp.y391_user('a2200000-0000-4000-8000-000000000001');
select throws_ok($$select public.configure_yousign_signer_v1((select(v->>'signer_id')::uuid from y391 where k='client-signer'),'Changed','Name','fr',jsonb_build_array(jsonb_build_object('documentSha256',repeat('1',64),'page',1,'x',50,'y',600)))$$,'55000','YOUSIGN_SIGNER_CONFIGURATION_FROZEN','claim freezes signer data even before the native SENT callback');
-- Service-attested callback and Storage metadata fixtures, not cryptographic
-- provider or real file receipts. HTTP/HMAC/byte integrity has separate tests.
select pg_temp.y391_service();
insert into y391 values('sent-event',jsonb_build_object('providerEventId','ab910000-0000-4000-8000-000000000007','nonce','ab910000-0000-4000-8000-000000000007','providerEnvelopeId','ab910000-0000-4000-8000-000000000003','type','SENT','occurredAt',clock_timestamp(),'payloadSha256',repeat('c',64),'signatureFingerprint',repeat('d',64)));
select is(public.record_yousign_verified_event_v1((select(v->>'envelope_id')::uuid from y391 where k='envelope'),(select v from y391 where k='sent-event'))->>'outcome','SIGNATURE_ENVELOPE_SENT','service-attested SENT uses the real domain transition after submission');
insert into y391 values('client-event',jsonb_build_object('providerEventId','ab910000-0000-4000-8000-000000000008','nonce','ab910000-0000-4000-8000-000000000008','providerEnvelopeId','ab910000-0000-4000-8000-000000000003','type','SIGNER_SIGNED','signerId',(select v->>'signer_id' from y391 where k='client-signer'),'achievedLevel','SIMPLE','occurredAt',clock_timestamp(),'payloadSha256',repeat('c',64),'signatureFingerprint',repeat('d',64)));
select is(public.record_yousign_verified_event_v1((select(v->>'envelope_id')::uuid from y391 where k='envelope'),(select v from y391 where k='client-event'))->>'outcome','SIGNATURE_ENVELOPE_PARTIALLY_SIGNED','first signer stays partial without final proof');
insert into y391 values('provider-event',jsonb_build_object('providerEventId','ab910000-0000-4000-8000-000000000009','nonce','ab910000-0000-4000-8000-000000000009','providerEnvelopeId','ab910000-0000-4000-8000-000000000003','type','SIGNER_SIGNED','signerId',(select v->>'signer_id' from y391 where k='provider-signer'),'achievedLevel','SIMPLE','occurredAt',clock_timestamp(),'payloadSha256',repeat('c',64),'signatureFingerprint',repeat('d',64)));
select throws_ok($$select public.record_yousign_verified_event_v1((select(v->>'envelope_id')::uuid from y391 where k='envelope'),(select v from y391 where k='provider-event'))$$,'55000','YOUSIGN_NATIVE_EVIDENCE_REQUIRED','last signer cannot finalize without the complete native evidence archive');
insert into y391 values('evidence',jsonb_build_object('providerEnvelopeId','ab910000-0000-4000-8000-000000000003','achievedLevel','SIMPLE','finalHash',repeat('f',64),'documentHashes',jsonb_build_array(repeat('1',64))));
insert into storage.objects(bucket_id,name,metadata) select 'signature-provider-evidence',(select v->>'envelope_id' from y391 where k='envelope')||'/'||kind||'/'||ref||'/'||repeat('e',64)||ext,jsonb_build_object('mimetype',mime,'size',100) from (values('signed_pdf','ab910000-0000-4000-8000-000000000004','.pdf','application/pdf'),('audit_json','ab910000-0000-4000-8000-000000000005','.json','application/json'),('audit_json','ab910000-0000-4000-8000-000000000006','.json','application/json'))a(kind,ref,ext,mime);
select public.record_yousign_native_artifact_v1((select(v->>'envelope_id')::uuid from y391 where k='envelope'),upper(kind),ref::uuid,repeat('e',64),(select v->>'envelope_id' from y391 where k='envelope')||'/'||kind||'/'||ref||'/'||repeat('e',64)||ext) from (values('signed_pdf','ab910000-0000-4000-8000-000000000004','.pdf'),('audit_json','ab910000-0000-4000-8000-000000000005','.json'),('audit_json','ab910000-0000-4000-8000-000000000006','.json'))a(kind,ref,ext);
insert into y391 values('complete',public.record_yousign_verified_event_v1((select(v->>'envelope_id')::uuid from y391 where k='envelope'),(select v from y391 where k='provider-event'),(select v from y391 where k='evidence')));
select is((select v->>'outcome' from y391 where k='complete'),'SIGNATURE_ENVELOPE_SIGNED','complete synthetic native evidence admits the final real SQL transition');
select ok((select v->>'native_artifact_manifest_hash'~'^[a-f0-9]{64}$' from y391 where k='complete'),'final receipt includes immutable native artifact manifest binding');
select is(public.record_yousign_verified_event_v1((select(v->>'envelope_id')::uuid from y391 where k='envelope'),(select v from y391 where k='provider-event'),(select v from y391 where k='evidence'))->>'replayed','true','final event replay retains the original domain evidence package');
select is((select count(*)::integer from private.yousign_native_evidence_bindings_v1),1,'final event replay creates exactly one native evidence binding');
select is((select count(*)::integer from public.audit_events where action='signature.yousign_native_evidence_bound'),1,'final replay creates exactly one native manifest audit fact');
