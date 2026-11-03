import { runSecuredBrowserSuite, writeLocalSuiteEvidence } from "./secured-browser-runner.mjs";
import { prepareLocalQuoteIdentity,cleanLocalQuoteIdentityFiles,closePendingLocalProviderScans } from './local-provider-identity-fixture.mjs';
import { provisionLocalCatalogReference, neutralizeLocalCatalogReference } from "./local-catalog-reference.mjs";
import { createHash, randomUUID } from "node:crypto";
import { copyFile, mkdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadSafeConfiguration } from "../../../scripts/p05-e2e/environment.mjs";
import { provision } from "../../../scripts/p05-e2e/provision.mjs";
import { buildChildEnvironment, secureLocalPaths, sha256File, validateFreshManifest } from "../../../scripts/p05-e2e/security.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const runToken = randomUUID();
const output = resolve(root, "artifacts", "test-results", `p23-provider-quotes-${runToken}`);
const authDirectory = resolve(root, "artifacts", "test-results", `.p23-provider-auth-${runToken}`);
const authState = resolve(authDirectory, "provider.json");
const digest = (value) => createHash("sha256").update(value).digest("hex");

async function createProviderFixture(fixture) {
  const database = fixture.resources.database;
  const runId = fixture.manifest.runId;
  const users = await database`select id,email from auth.users where email in (
    ${`p05-e2e-clienta-${runId}@example.invalid`},${`p05-e2e-clientb-${runId}@example.invalid`},${`p05-e2e-norole-${runId}@example.invalid`})`;
  const userByEmail = new Map(users.map((row) => [row.email, row.id]));
  const clientUserId = userByEmail.get(`p05-e2e-clienta-${runId}@example.invalid`);
  const foreignUserId = userByEmail.get(`p05-e2e-clientb-${runId}@example.invalid`);
  const providerUserId = userByEmail.get(`p05-e2e-norole-${runId}@example.invalid`);
  if (!clientUserId || !foreignUserId || !providerUserId) throw new Error("P23 isolated identities are incomplete");
  const catalog = await database`select service.id as service_id,service.library_id
    from public.catalog_services service where service.status='PUBLISHED' and (${fixture.resources.localCatalog?.service ?? null}::uuid is null or service.id=${fixture.resources.localCatalog?.service ?? null}::uuid) order by service.id limit 1`;
  if (catalog.length !== 1) throw new Error("P23 requires one existing catalog service");

  const targetOrganizationId = randomUUID();
  const decoyOrganizationId = randomUUID();
  const targetOrganizationName = `P23 Provider cible ${runId}`;
  const decoyOrganizationName = `P23 Provider secondaire ${runId}`;
  const categoryCode = `P23_${runToken.replaceAll("-", "").slice(0, 20).toUpperCase()}`;
  const taxRuleId = randomUUID();
  const cases = {};
  for (const locale of ["fr", "ar"]) for (const viewport of ["mobile", "desktop"]) {
    const key = `${locale}-${viewport}`;
    cases[key] = {
      description: `P23 ${locale.toUpperCase()} ${viewport} ${runToken.slice(0, 8)}`,
      requestId: randomUUID(), requestVersionId: randomUUID(), matchingRunId: randomUUID(),
      candidateId: randomUUID(), rfqId: randomUUID(), invitationId: randomUUID(),
    };
  }

  fixture.resources.organizationIds.push(targetOrganizationId, decoyOrganizationId);
  await database.begin(async (transaction) => {
    await transaction`insert into public.organizations(id,legal_name,display_name,status,created_by) values
      (${targetOrganizationId}::uuid,${targetOrganizationName},${targetOrganizationName},'ACTIVE',${providerUserId}::uuid),
      (${decoyOrganizationId}::uuid,${decoyOrganizationName},${decoyOrganizationName},'ACTIVE',${providerUserId}::uuid)`;
    const targetMembership = randomUUID(); const decoyMembership = randomUUID();
    await transaction`insert into public.organization_memberships(id,organization_id,user_id,status) values
      (${targetMembership}::uuid,${targetOrganizationId}::uuid,${providerUserId}::uuid,'ACTIVE'),
      (${decoyMembership}::uuid,${decoyOrganizationId}::uuid,${providerUserId}::uuid,'ACTIVE')`;
    await transaction`insert into public.organization_member_roles(membership_id,role_code) values
      (${targetMembership}::uuid,'PROVIDER_SALES'),(${decoyMembership}::uuid,'PROVIDER_SALES')`;
    await transaction`insert into public.tax_categories(code,name_fr,name_ar,description_fr,description_ar,category_kind,status)
      values(${categoryCode},'Service E2E Provider','خدمة اختبار مقدم الخدمة','Catégorie isolée P23','فئة اختبار معزولة','SERVICE','ACTIVE')`;
    await transaction`insert into public.tax_rule_versions(id,jurisdiction_code,category_code,version,rate_basis_points,effective_from,effective_to,status,professional_validation_status,rule_type,priority,conditions,legal_reference,rounding_strategy,approved_by,approved_at,validation_reference,content_hash,change_reason)
      values(${taxRuleId}::uuid,'MA',${categoryCode},1,2000,'2026-01-01',null,'ACTIVE','VALIDATED','VAT',100,'{}','Validation fiscale E2E isolée P23','HALF_AWAY_FROM_ZERO_TO_MINOR_UNIT',${clientUserId}::uuid,clock_timestamp(),'P23-E2E',${digest(`${runToken}:tax`)},'Règle temporaire pour parcours E2E Provider')`;
    for (const item of Object.values(cases)) {
      await transaction`insert into public.service_requests(id,client_organization_id,library_id,service_id,status,created_by)
        values(${item.requestId}::uuid,${fixture.manifest.fixtures.organizationA.id}::uuid,${catalog[0].library_id}::uuid,${catalog[0].service_id}::uuid,'MATCHING',${clientUserId}::uuid)`;
      await transaction`insert into public.service_request_versions(id,request_id,client_organization_id,library_id,version_number,description,urgency,currency_code,required_quote_data,required_fields_complete,catalog_snapshot_hash,questionnaire_snapshot_hash,change_reason,content_hash,created_by)
        values(${item.requestVersionId}::uuid,${item.requestId}::uuid,${fixture.manifest.fixtures.organizationA.id}::uuid,${catalog[0].library_id}::uuid,1,${item.description},'NORMAL','MAD',jsonb_build_object('region_code','CASABLANCA','tax_category_code',${categoryCode}::text),true,${digest(`${item.requestId}:catalog`)},${digest(`${item.requestId}:questionnaire`)},'Fixture Provider P23',${digest(`${item.requestId}:content`)},${clientUserId}::uuid)`;
      await transaction`update public.service_requests set current_version_id=${item.requestVersionId}::uuid where id=${item.requestId}::uuid`;
      await transaction`insert into public.matching_runs(id,request_id,request_version_id,policy_version,status,target_panel_size,started_by,completed_at)
        values(${item.matchingRunId}::uuid,${item.requestId}::uuid,${item.requestVersionId}::uuid,'MATCH-V1','COMPLETED',1,${clientUserId}::uuid,clock_timestamp())`;
      await transaction`insert into public.matching_candidates(id,matching_run_id,provider_organization_id,eligible,score_basis_points,score_explanation,rotation_component)
        values(${item.candidateId}::uuid,${item.matchingRunId}::uuid,${targetOrganizationId}::uuid,true,9000,'{}',50)`;
      await transaction`insert into public.rfqs(id,request_id,request_version_id,matching_run_id,status,deadline,confidentiality_settings,invited_count,opened_by)
        values(${item.rfqId}::uuid,${item.requestId}::uuid,${item.requestVersionId}::uuid,${item.matchingRunId}::uuid,'OPEN',clock_timestamp()+interval'45 days','{"mask_direct_contacts":true,"competitor_offers_visible":false}',1,${clientUserId}::uuid)`;
      await transaction.unsafe("set local session_replication_role=replica");
      await transaction`insert into public.rfq_providers(id,rfq_id,provider_organization_id,matching_candidate_id,status)
        values(${item.invitationId}::uuid,${item.rfqId}::uuid,${targetOrganizationId}::uuid,${item.candidateId}::uuid,'INVITED')`;
      await transaction.unsafe("set local session_replication_role=origin");
    }
  });
  return { targetOrganizationId, decoyOrganizationId, targetOrganizationName, decoyOrganizationName, categoryCode, taxRuleId, providerUserId, foreignUserId, cases };
}

async function proveForeignTenantDenied(fixture, providerFixture) {
  const client=fixture.sessions.noRole.client,foreign=fixture.sessions.clientB.client;
  const [invitations,versions,rules,denied]=await Promise.all([
    client.from('rfq_providers').select('id').eq('provider_organization_id',providerFixture.targetOrganizationId),
    client.from('service_request_versions').select('id').in('id',Object.values(providerFixture.cases).map(item=>item.requestVersionId)),
    client.from('tax_rule_versions').select('id').eq('id',providerFixture.taxRuleId).eq('status','ACTIVE').eq('professional_validation_status','VALIDATED'),
    foreign.from('rfq_providers').select('id').eq('provider_organization_id',providerFixture.targetOrganizationId),
  ]);
  if(invitations.error||versions.error||rules.error||denied.error||invitations.data?.length!==4||versions.data?.length!==4||rules.data?.length!==1||denied.data?.length!==0)throw new Error('P23 real-session cross-tenant ALLOW/DENY proof failed');
}

async function verifyProviderResults(database, providerFixture, mobileOnly) {
  const selectedCases = Object.entries(providerFixture.cases)
    .filter(([key]) => !mobileOnly || key.endsWith("-mobile"))
    .map(([, value]) => value);
  const invitationIds = selectedCases.map((item) => item.invitationId);
  const expectedCount = selectedCases.length;
  const result = await database`select count(distinct quote.id)::integer as quotes,
    count(distinct version.id)::integer as versions,count(distinct item.id)::integer as items,
    bool_and(quote.status='SUBMITTED' and version.lifecycle_status='SUBMITTED'
      and version.currency='MAD' and item.quantity=1.2500::numeric
      and item.unit_price_minor=900719925474099300::bigint
      and item.subtotal_minor=1125899906842624125::bigint
      and item.tax_minor=225179981368524825::bigint
      and item.total_minor=1351079888211148950::bigint
      and item.tax_rule_version_id=${providerFixture.taxRuleId}::uuid) as exact
    from public.quotes quote join public.quote_versions version on version.id=quote.current_version_id
    join public.quote_items item on item.quote_version_id=version.id
    where quote.rfq_provider_id=any(${invitationIds}::uuid[])`;
  const evidence = await database`select
    (select count(*)::integer from public.audit_events where organization_id=${providerFixture.targetOrganizationId}::uuid and action in('rfq.invitation.accepted','quote.revision.created','quote.submitted')) as audits,
    (select count(*)::integer from public.event_outbox where organization_id=${providerFixture.targetOrganizationId}::uuid and event_type in('RFQ_INVITATION_ACCEPTED','QuoteRevisionCreatedV1','QuoteSubmittedV1')) as outbox`;
  if (result[0]?.quotes !== expectedCount || result[0]?.versions !== expectedCount || result[0]?.items !== expectedCount || result[0]?.exact !== true
      || evidence[0]?.audits !== expectedCount*3 || evidence[0]?.outbox !== expectedCount*3) throw new Error("P23 exact quote or audit/outbox evidence is incomplete");
  const[identity]=await database`select count(*)::int as count,bool_and((${providerFixture.identity?.identityHash??null}::text is null or anchor.identity_hash=${providerFixture.identity?.identityHash??null}) and anchor.identity_snapshot->>'registered_address'='Adresse de recette locale du prestataire'and anchor.identity_snapshot->>'legal_name'=${providerFixture.identity?.legalName??providerFixture.targetOrganizationName})as exact from public.provider_quote_identity_snapshots anchor join public.quotes quote on quote.current_version_id=anchor.quote_version_id where quote.rfq_provider_id=any(${invitationIds}::uuid[])`;
  if(identity?.count!==expectedCount||identity?.exact!==true)throw new Error('P23_CURRENT_IDENTITY_ANCHORS_INCOMPLETE');
}

async function neutralizeProviderFixture(database, providerFixture) {
  const invitationIds = Object.values(providerFixture.cases).map((item) => item.invitationId);
  const rfqIds = Object.values(providerFixture.cases).map((item) => item.rfqId);
  const requestIds = Object.values(providerFixture.cases).map((item) => item.requestId);
  await database.begin(async (transaction) => {
    await transaction.unsafe("set local session_replication_role=replica");
    await transaction`update public.quotes set status='WITHDRAWN' where rfq_provider_id=any(${invitationIds}::uuid[])`;
    await transaction`update public.rfq_providers set status='SUSPENDED',responded_at=null,decline_reason=null where id=any(${invitationIds}::uuid[])`;
    await transaction`update public.rfqs set status='CANCELLED',closed_at=null where id=any(${rfqIds}::uuid[])`;
    await transaction`update public.service_requests set status='CANCELLED' where id=any(${requestIds}::uuid[])`;
    await transaction`update public.tax_rule_versions set status='RETIRED' where id=${providerFixture.taxRuleId}::uuid`;
    await transaction`update public.tax_categories set status='RETIRED' where code=${providerFixture.categoryCode}`;
    await transaction`update public.event_outbox set published_at=coalesce(published_at,clock_timestamp()),locked_at=null,locked_by=null where organization_id=${providerFixture.targetOrganizationId}::uuid`;
    await transaction.unsafe("set local session_replication_role=origin");
  });
  const active = await database`select
    (select count(*)::integer from public.rfqs where id=any(${rfqIds}::uuid[]) and status='OPEN') as open_rfqs,
    (select count(*)::integer from public.tax_rule_versions where id=${providerFixture.taxRuleId}::uuid and status='ACTIVE') as active_rules,
    (select count(*)::integer from public.tax_categories where code=${providerFixture.categoryCode} and status='ACTIVE') as active_categories`;
  if (Object.values(active[0]).some((value) => value !== 0)) throw new Error("P23 provider fixture remains active");
}

let fixture; let providerFixture; let failure; let config; let suiteSummary; let cleanupFailed=false;
let stage='base-fixture';
try {
  fixture = await provision();
  config = await loadSafeConfiguration(root);
  stage='published-reference';if (config.runtimeMode === "isolated-local-docker") await provisionLocalCatalogReference(fixture);
  await validateFreshManifest(fixture.manifest, config);
  stage='provider-fixture';providerFixture = await createProviderFixture(fixture);
  stage='current-identity-review';if(config.runtimeMode==='isolated-local-docker')providerFixture.identity=await prepareLocalQuoteIdentity(fixture,providerFixture.targetOrganizationId,providerFixture.providerUserId);
  stage='real-session-isolation';
  await proveForeignTenantDenied(fixture, providerFixture);
  await mkdir(authDirectory, { recursive: false, mode: 0o700 });
  await secureLocalPaths(authDirectory, []);
  await copyFile(fixture.manifest.states.noRole.path, authState);
  await secureLocalPaths(authDirectory, [authState]);
  if (await sha256File(authState) !== fixture.manifest.states.noRole.sha256) throw new Error("P23 provider auth snapshot integrity failed");
  await mkdir(output, { recursive: false, mode: 0o700 });
  await secureLocalPaths(output, []);
  const environment = buildChildEnvironment(process.env, {
    E2E_BASE_URL: config.baseUrl,
    E2E_PROVIDER_STORAGE_STATE: authState,
    E2E_CLIENT_B_STORAGE_STATE: fixture.manifest.states.clientB.path,
    E2E_P23_TARGET_ORGANIZATION_ID: providerFixture.targetOrganizationId,
    E2E_P23_DECOY_ORGANIZATION_ID: providerFixture.decoyOrganizationId,
    E2E_P23_TARGET_ORGANIZATION_NAME: providerFixture.targetOrganizationName,
    E2E_P23_FOREIGN_ORGANIZATION_NAME: fixture.manifest.fixtures.organizationB.name,
    E2E_P23_CASES: JSON.stringify(providerFixture.cases),
  });
  const mobileOnly = process.env.P23_SINGLE === "1";
  stage='browser';suiteSummary = await runSecuredBrowserSuite({root,config,environment,specifications:["tests/e2e/p23-provider-quotes.spec.ts"],output,expectedTests:mobileOnly?2:4,projects:mobileOnly?["chromium-mobile-360"]:[]});
  stage='exact-money-audit-and-identity-anchors';
  await verifyProviderResults(fixture.resources.database, providerFixture, mobileOnly);
  console.log("PASS P23 Provider quotes E2E and exact financial evidence");
} catch (error) { failure = error; suiteSummary ??= error.browserSummary; }
finally {
  if(fixture)try{await closePendingLocalProviderScans(fixture,fixture.resources.localQuoteIdentityPaths);}catch(error){cleanupFailed=true;failure??=error;}
  if(fixture)try{await cleanLocalQuoteIdentityFiles(fixture);}catch(error){cleanupFailed=true;failure??=error;}
  if (fixture && providerFixture) try { await neutralizeProviderFixture(fixture.resources.database, providerFixture); console.log("PASS P23 Provider fixture neutralized"); } catch (error) { cleanupFailed=true; failure = failure ? new AggregateError([failure, error], "P23 run and provider cleanup failed") : error; }
  if (fixture) try { await neutralizeLocalCatalogReference(fixture); } catch (error) { cleanupFailed=true; failure ??=error; }
  if (fixture) try { await fixture.cleanup(); if (fixture.resources.retainedEvidence <= 0) throw new Error("Immutable fixture evidence was not retained"); console.log("PASS P23 base fixture neutralized"); } catch (error) { cleanupFailed=true; failure = failure ? new AggregateError([failure, error], "P23 run and base cleanup failed") : error; }
  try { await rm(output, { recursive: true, force: true }); } catch (error) { cleanupFailed=true; failure ??= error; }
  try { await rm(authDirectory, { recursive: true, force: true }); } catch (error) { cleanupFailed=true; failure ??= error; }
  if (fixture) try { const sharedAuth=resolve(dirname(fixture.manifestPath)),expected=resolve(root,"scripts","p05-e2e",".auth");if(sharedAuth!==expected)throw new Error("Refusing unverified P23 auth cleanup");await rm(sharedAuth,{recursive:true,force:true}); } catch (error) { cleanupFailed=true; failure ??= error; }
}
await writeLocalSuiteEvidence({root,suite:"p23-quotes",config,summary:suiteSummary,failure,cleanupVerified:!cleanupFailed,proof:{stage,quoteFinancialAndAuditVerified:!failure}});
if (failure) {
  const diagnostic = [failure.code, failure.constraint_name, failure.table_name].filter((value) => typeof value === "string" && /^[A-Za-z0-9_.-]{1,100}$/u.test(value)).join(":");
  console.error(`FAIL P23 Provider quotes E2E execution failed${diagnostic ? ` (${diagnostic})` : ""}; no credential or remote detail was printed`);
  process.exitCode = 1;
}
