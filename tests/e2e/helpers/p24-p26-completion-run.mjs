import { createHash, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { access, copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { summarizeBrowserReport, validateBrowserReport } from "../../../scripts/release/browser-report.mjs";
import { provisionLocalCatalogReference, neutralizeLocalCatalogReference } from "./local-catalog-reference.mjs";
import { provisionLocalUiAuthFixture, verifyLocalUiAuthProof, neutralizeLocalUiAuthFixture } from "./local-ui-auth-fixture.mjs";
import { provisionLocalSecondaryMandate } from "./local-secondary-mandate.mjs";
import { loadSafeConfiguration, resolveExpectedDatabaseUrl } from "../../../scripts/p05-e2e/environment.mjs";
import { cleanupRemote, provision } from "../../../scripts/p05-e2e/provision.mjs";
import {
  buildChildEnvironment,
  secureLocalPaths,
  sha256File,
  validateFreshManifest,
} from "../../../scripts/p05-e2e/security.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const requireFromWeb = createRequire(resolve(root, "apps", "web", "package.json"));
const { createClient } = requireFromWeb("@supabase/supabase-js");
const runToken = randomUUID();
const outputDirectory = resolve(root, "artifacts", "test-results", `p24-p26-completion-${runToken}`);
const authDirectory = resolve(root, "artifacts", "test-results", `.p24-p26-auth-${runToken}`);
const smokeOnly = process.argv.includes("--authenticated-route-smoke-only");
const localAuthOnly = process.argv.includes("--local-auth-ui-only");
const fixtureProofsOnly = process.argv.includes("--local-fixture-proofs-only");
const expectedTests = fixtureProofsOnly ? 0 : localAuthOnly ? 4 : smokeOnly ? 16 : 64;
const smokeEvidencePath = resolve(root, "artifacts", "test-results", "authenticated-route-smoke-summary.json");

const hash = (value) => createHash("sha256").update(value).digest("hex");

function combineFailure(current, next, message) {
  return current ? new AggregateError([current, next], message, { cause: current }) : next;
}

function sanitizedFailureCode(error) {
  const candidate = error?.code ?? error?.message;
  const sqlState = /^[0-9A-Z_-]{2,80}$/u.test(candidate ?? "") ? candidate : "UNKNOWN";
  const constraint = /^[a-z0-9_]{1,120}$/u.test(error?.constraint_name ?? "") ? error.constraint_name : "UNAVAILABLE";
  return `${sqlState}:${constraint}`;
}

function sanitizedPlaywrightDiagnostic(output, exitCode) {
  const clean = output
    .replace(/\u001b\[[0-9;]*m/gu, "")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/giu, "[email-redacted]")
    .replace(/[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}/giu, "[uuid-redacted]")
    .replace(/(?:Bearer\s+)?[A-Za-z0-9_-]{40,}/gu, "[token-redacted]")
    .replace(/([?&](?:token|key|secret|code|session|state)=)[^\s&]+/giu, "$1[redacted]");
  const relevant = clean.split(/\r?\n/u).map((line) => line.trim()).filter((line) =>
    /error:|failed|cannot|timeout|timed out|no tests found|browsertype|enoent|eaddrinuse/iu.test(line),
  ).slice(0, 8);
  return relevant.length > 0 ? `exit=${exitCode}; ${relevant.join(" | ").slice(0, 1_500)}` : `exit=${exitCode}; no diagnostic line emitted`;
}

async function provisionProviderAndFranchise(fixture, onStage = () => {}) {
  const database = fixture.resources.database;
  const providerFranchiseUserId = fixture.resources.userIds[3];
  const foreignUserId = fixture.resources.userIds[1];
  if (!providerFranchiseUserId || !foreignUserId) throw new Error("P24-P26 fixture identities are incomplete");

  onStage("role-fixture-reference-data");
  const localCatalog = fixture.config.runtimeMode === "isolated-local-docker" ? await provisionLocalCatalogReference(fixture) : null;
  const [library] = localCatalog ? [{ id: localCatalog.library }] : await database`select id from public.catalog_libraries order by code limit 1`;
  const [catalogSource]=await database`select s.id service_id,s.library_id,v.content_hash,v.name_fr from public.catalog_services s join public.catalog_service_versions v on v.id=s.current_published_version_id where s.status='PUBLISHED' and (${localCatalog?.library ?? null}::uuid is null or s.library_id=${localCatalog?.library ?? null}::uuid) order by s.created_at limit 1`;
  const [activeTemplate]=await database`select t.id template_id,v.id template_version_id from public.marketing_templates t join public.marketing_template_versions v on v.id=t.current_version_id where t.template_key='PROBLEM_SOLUTION' and t.status='ACTIVE' limit 1`;
  const [economicRule] = await database`select id,entry_fee_minor,franchisee_share_bps,neoxa_share_bps,matricia_share_bps,distribution_basis
    from public.franchise_economic_rule_versions
    where franchise_type='STANDARD' and status='ACTIVE' and effective_from<=current_date
      and (effective_to is null or effective_to>=current_date)
    order by version desc limit 1`;
  if (!library || !economicRule || !catalogSource) throw new Error("P24-P26 reference data is incomplete");

  const organizationId = randomUUID();
  const membershipId = randomUUID();
  const franchiseId = randomUUID();
  const territoryVersionId = randomUUID();
  const mandateVersionId = randomUUID();
  const workflows=[0,1].map(()=>({contractId:randomUUID(),contractVersionId:randomUUID(),missionId:randomUUID(),milestoneId:randomUUID(),deliverableId:randomUUID()}));
  const marketing={brandKitId:randomUUID(),brandKitVersionId:randomUUID(),campaignId:randomUUID(),consentId:randomUUID(),templateId:activeTemplate?.template_id??randomUUID(),templateVersionId:activeTemplate?.template_version_id??randomUUID(),ownsTemplate:!activeTemplate,serviceId:catalogSource.service_id,libraryId:catalogSource.library_id,sourceHash:catalogSource.content_hash,serviceName:catalogSource.name_fr};
  const territoryCode = `E2E_${runToken.replaceAll("-", "").slice(0, 20).toUpperCase()}`;
  const organizationName = `P05 E2E rôles P24-P26 ${runToken}`;
  const contentHash = hash(`${runToken}:franchise-mandate`);
  const entryFeeMode = BigInt(economicRule.entry_fee_minor) === 0n ? "EXEMPT" : "UPFRONT";
  const roleFixture = { organizationId, franchiseId, providerFranchiseUserId, foreignUserId, workflows, marketing };

  // Register the identifier before the transaction so base cleanup remains safe
  // even if a connection failure makes the transaction result ambiguous.
  fixture.resources.organizationIds.push(organizationId);
  onStage("role-fixture-organization");
  await database.begin(async (transaction) => {
    await transaction`insert into public.organizations(id,legal_name,display_name,status,created_by)
      values(${organizationId}::uuid,${organizationName},${organizationName},'ACTIVE',${providerFranchiseUserId}::uuid)`;
    await transaction`insert into public.organization_memberships(id,organization_id,user_id,status,activated_at)
      values(${membershipId}::uuid,${organizationId}::uuid,${providerFranchiseUserId}::uuid,'ACTIVE',clock_timestamp())`;
    onStage("role-fixture-franchise");
    await transaction`insert into public.franchises(id,library_id,operator_organization_id,franchise_type,operator_code,territory_code,status,created_by)
      values(${franchiseId}::uuid,${library.id}::uuid,${organizationId}::uuid,'STANDARD','FRANCHISEE',${territoryCode},'CONTRACT_PENDING',${providerFranchiseUserId}::uuid)`;
    await transaction`insert into public.franchise_territory_versions(id,franchise_id,version,territory_code,name_fr,name_ar,scope_snapshot,effective_from,content_hash,created_by)
      values(${territoryVersionId}::uuid,${franchiseId}::uuid,1,${territoryCode},'Territoire E2E isolé','نطاق اختبار معزول','{"fixture":"P24_P26"}'::jsonb,clock_timestamp(),${contentHash},${providerFranchiseUserId}::uuid)`;
    await transaction`insert into public.franchise_mandate_versions(
        id,franchise_id,territory_version_id,economic_rule_version_id,version,mandate_status,
        rights_snapshot,obligations_snapshot,contract_snapshot,entry_fee_minor,entry_fee_mode,
        entry_fee_term_months,franchisee_share_bps,neoxa_share_bps,matricia_share_bps,
        distribution_basis,effective_from,content_hash,created_by)
      values(
        ${mandateVersionId}::uuid,${franchiseId}::uuid,${territoryVersionId}::uuid,${economicRule.id}::uuid,1,'ACTIVE',
        '{"fixture":"P24_P26","scope":"E2E"}'::jsonb,'{"fixture":"P24_P26"}'::jsonb,
        '{"classification":"NON_CONTRACTUAL_DEMO","fixture":"P24_P26"}'::jsonb,
        ${economicRule.entry_fee_minor},${entryFeeMode},0,${economicRule.franchisee_share_bps},
        ${economicRule.neoxa_share_bps},${economicRule.matricia_share_bps},${economicRule.distribution_basis},
        clock_timestamp(),${contentHash},${providerFranchiseUserId}::uuid)`;
    await transaction`update public.franchises
      set status='ACTIVE',current_mandate_version_id=${mandateVersionId}::uuid,updated_at=clock_timestamp(),row_version=row_version+1
      where id=${franchiseId}::uuid`;
    await transaction`insert into public.organization_member_roles(membership_id,role_code,franchise_id,granted_by)
      values
        (${membershipId}::uuid,'PROVIDER_OWNER',null,${providerFranchiseUserId}::uuid),
        (${membershipId}::uuid,'FRANCHISE_OWNER',${franchiseId}::uuid,${providerFranchiseUserId}::uuid)`;
    if (localCatalog) {
      await transaction`insert into public.catalog_library_mandates(library_id,organization_id,status,valid_from,policy_version,created_by) values(${library.id}::uuid,${organizationId}::uuid,'ACTIVE',clock_timestamp(),1,${providerFranchiseUserId}::uuid)`;
    }
    onStage("role-fixture-workflows");
    await transaction.unsafe("set local session_replication_role='replica'");
    for(const [index,workflow] of workflows.entries()){
      await transaction`insert into public.contracts(id,client_organization_id,provider_organization_id,status,current_version,created_by) values(${workflow.contractId}::uuid,${fixture.manifest.fixtures.organizationA.id}::uuid,${organizationId}::uuid,'ACTIVE',1,${fixture.resources.userIds[0]}::uuid)`;
      await transaction`insert into public.contract_versions(id,contract_id,version,selected_quote_version_id,request_snapshot,quote_snapshot,clauses,price_minor,currency,commission_rule_snapshot,content_hash,change_reason,created_by) values(${workflow.contractVersionId}::uuid,${workflow.contractId}::uuid,1,${randomUUID()}::uuid,'{"fixture":"P25"}'::jsonb,jsonb_build_object('quote_version_id',${randomUUID()}::text),'{}'::jsonb,${12500+index},'MAD','{}'::jsonb,${hash(`${runToken}:contract:${index}`)},'Fixture E2E P25',${fixture.resources.userIds[0]}::uuid)`;
      await transaction`insert into public.missions(id,contract_id,contract_version_id,client_organization_id,provider_organization_id,status,started_at,created_by) values(${workflow.missionId}::uuid,${workflow.contractId}::uuid,${workflow.contractVersionId}::uuid,${fixture.manifest.fixtures.organizationA.id}::uuid,${organizationId}::uuid,'ACTIVE',clock_timestamp(),${fixture.resources.userIds[0]}::uuid)`;
      await transaction`insert into public.mission_milestones(id,mission_id,milestone_key,title_fr,title_ar,sort_order,owner_organization_id) values(${workflow.milestoneId}::uuid,${workflow.missionId}::uuid,${`E2E_M${index+1}`},${`Jalon P25 ${index+1}`},${`مرحلة P25 ${index+1}`},1,${organizationId}::uuid)`;
      await transaction`insert into public.deliverables(id,mission_id,milestone_id,deliverable_key,label_fr,label_ar,proof_required) values(${workflow.deliverableId}::uuid,${workflow.missionId}::uuid,${workflow.milestoneId}::uuid,${`E2E_D${index+1}`},${`Livrable P25 ${index+1}`},${`تسليم P25 ${index+1}`},true)`;
      await transaction`insert into public.acceptance_checklists(mission_id,deliverable_id,criterion_key) values(${workflow.missionId}::uuid,${workflow.deliverableId}::uuid,'QUALITY')`;
    }
    onStage("role-fixture-marketing");
    if(marketing.ownsTemplate){
      onStage("role-fixture-marketing-template");
      await transaction`insert into public.marketing_templates(id,template_key,status,created_by) values(${marketing.templateId}::uuid,'PROBLEM_SOLUTION','DRAFT',${providerFranchiseUserId}::uuid)`;
      await transaction`insert into public.marketing_template_versions(id,template_id,version,structure,frequency_max_weekly,content_hash,created_by) values(${marketing.templateVersionId}::uuid,${marketing.templateId}::uuid,1,'{"hook":"problem","body":"solution","target_characters":600,"required_media":[],"allowed_ctas":["DIAGNOSTIC"],"forbidden_claims":[],"translation_rules":{"required":true},"repetition_rules":{"maximum":2}}'::jsonb,2,${hash(`${runToken}:template`)},${providerFranchiseUserId}::uuid)`;
      await transaction`update public.marketing_templates set status='ACTIVE',current_version_id=${marketing.templateVersionId}::uuid where id=${marketing.templateId}::uuid`;
    }
    onStage("role-fixture-marketing-brand");
    await transaction`insert into public.brand_kits(id,organization_id,status,created_by) values(${marketing.brandKitId}::uuid,${organizationId}::uuid,'DRAFT',${providerFranchiseUserId}::uuid)`;
    onStage("role-fixture-marketing-brand-version");
    await transaction`insert into public.brand_kit_versions(id,brand_kit_id,version,payload,claims,certifications,content_hash,change_reason,created_by) values(${marketing.brandKitVersionId}::uuid,${marketing.brandKitId}::uuid,1,jsonb_build_object('legal_name',${organizationName}::text,'trade_name',${organizationName}::text,'primary_colors',jsonb_build_array('#123B5D'),'tone',jsonb_build_array('PROFESSIONAL'),'languages',jsonb_build_array('FR','AR'),'primary_cta','DIAGNOSTIC','tracked_url','https://matricia.ma/diagnostic','required_mentions','[]'::jsonb,'forbidden_terms','[]'::jsonb,'approved_hashtags',jsonb_build_array('#Matricia')),'[]'::jsonb,'[]'::jsonb,${hash(`${runToken}:brand`)},'Fixture E2E P24',${providerFranchiseUserId}::uuid)`;
    onStage("role-fixture-marketing-brand-activate");
    await transaction`update public.brand_kits set status='READY',current_version_id=${marketing.brandKitVersionId}::uuid,row_version=row_version+1 where id=${marketing.brandKitId}::uuid`;
    onStage("role-fixture-marketing-consent");
    await transaction`insert into public.marketing_consents(id,organization_id,purpose,decision,policy_version,evidence_hash,decided_by) values(${marketing.consentId}::uuid,${organizationId}::uuid,'MARKETING_ANALYTICS','GRANTED','P24-E2E',${hash(`${runToken}:consent`)},${providerFranchiseUserId}::uuid)`;
    onStage("role-fixture-marketing-campaign");
    await transaction`insert into public.marketing_campaigns(id,organization_id,brand_kit_version_id,mode,title_fr,title_ar,status,audience_snapshot,source_snapshot,created_by) values(${marketing.campaignId}::uuid,${organizationId}::uuid,${marketing.brandKitVersionId}::uuid,'ASSISTED','Campagne P24','حملة P24','DRAFT','{"fixture":"P24"}'::jsonb,'{"fixture":"P24"}'::jsonb,${providerFranchiseUserId}::uuid)`;
  });

  return roleFixture;
}

async function proveRoleIsolation(fixture, roleFixture) {
  const client = fixture.sessions.noRole.client, foreign = fixture.sessions.clientB.client;
  const [organizations, franchises, membership] = await Promise.all([
    client.from("organizations").select("id").eq("id",roleFixture.organizationId),
    client.from("franchises").select("id").eq("id",roleFixture.franchiseId),
    client.from("organization_memberships").select("id").eq("organization_id",roleFixture.organizationId).eq("user_id",roleFixture.providerFranchiseUserId),
  ]);
  if(organizations.error||franchises.error||membership.error||organizations.data?.length!==1||franchises.data?.length!==1||membership.data?.length!==1)throw new Error("P24-P26 real-session role ALLOW proof failed");
  const roles=await client.from("organization_member_roles").select("role_code").eq("membership_id",membership.data[0].id).is("revoked_at",null).order("role_code");
  if(roles.error||roles.data?.map(row=>row.role_code).join(",")!=="FRANCHISE_OWNER,PROVIDER_OWNER")throw new Error("P24-P26 real-session role projection failed");
  const [deniedOrganizations,deniedFranchises]=await Promise.all([
    foreign.from("organizations").select("id").eq("id",roleFixture.organizationId),
    foreign.from("franchises").select("id").eq("id",roleFixture.franchiseId),
  ]);
  if(deniedOrganizations.error||deniedFranchises.error||deniedOrganizations.data?.length!==0||deniedFranchises.data?.length!==0)throw new Error("P24-P26 real-session cross-tenant DENY proof failed");
}

async function proveP25StorageIsolation(fixture,roleFixture){
  const deliverableIds=roleFixture.workflows.map(item=>item.deliverableId);
  const files=await fixture.resources.database`select name from storage.objects where bucket_id='delivery-proofs'and split_part(name,'/',2)=any(${deliverableIds}::text[])`;
  if(files.length!==deliverableIds.length)throw new Error("P25 persisted proof file count invalid");
  for(const file of files){
    const denied=await fixture.sessions.clientB.client.storage.from('delivery-proofs').download(file.name);
    const allowed=await fixture.sessions.noRole.client.storage.from('delivery-proofs').download(file.name);
    if(!denied.error||allowed.error||!allowed.data||allowed.data.size===0)throw new Error("P25 real-session Storage ALLOW/DENY proof failed");
  }
}

async function neutralizeRoleFixture(database, roleFixture, admin) {
  const deliverableIds=roleFixture.workflows.map(item=>item.deliverableId),milestoneIds=roleFixture.workflows.map(item=>item.milestoneId),missionIds=roleFixture.workflows.map(item=>item.missionId),contractVersionIds=roleFixture.workflows.map(item=>item.contractVersionId),contractIds=roleFixture.workflows.map(item=>item.contractId);
  const storageObjects = await database`select name from storage.objects where bucket_id='delivery-proofs' and split_part(name,'/',2)=any(${deliverableIds}::text[])`;
  if (storageObjects.length) {
    const removal = await admin.storage.from('delivery-proofs').remove(storageObjects.map(row => row.name));
    if (removal.error) throw new Error('Unable to remove isolated delivery proof bytes');
  }
  await database.begin(async(transaction)=>{
    await transaction.unsafe("set local session_replication_role='replica'");
    await transaction`delete from public.service_checklist_templates template using public.audit_events audit where audit.resource_type='service_checklist_template' and audit.resource_id=template.id::text and audit.metadata->>'change_reason' like ${`E2E ${runToken}%`}`;
    await transaction`delete from storage.objects where bucket_id='delivery-proofs' and split_part(name,'/',2)=any(${deliverableIds}::text[])`;
    await transaction`delete from private.delivery_proof_scan_claims where proof_id in(select p.id from public.delivery_proofs p join public.delivery_versions v on v.id=p.delivery_version_id where v.deliverable_id=any(${deliverableIds}::uuid[]))`;
    await transaction`delete from private.delivery_proof_scan_idempotency where proof_id in(select p.id from public.delivery_proofs p join public.delivery_versions v on v.id=p.delivery_version_id where v.deliverable_id=any(${deliverableIds}::uuid[]))`;
    await transaction`delete from private.delivery_proof_scan_results where proof_id in(select p.id from public.delivery_proofs p join public.delivery_versions v on v.id=p.delivery_version_id where v.deliverable_id=any(${deliverableIds}::uuid[]))`;
    await transaction`delete from public.delivery_proofs where delivery_version_id in(select id from public.delivery_versions where deliverable_id=any(${deliverableIds}::uuid[]))`;
    await transaction`delete from public.delivery_versions where deliverable_id=any(${deliverableIds}::uuid[])`;
    await transaction`delete from public.acceptance_checklists where deliverable_id=any(${deliverableIds}::uuid[])`;
    await transaction`delete from public.deliverables where id=any(${deliverableIds}::uuid[])`;
    await transaction`delete from public.mission_milestones where id=any(${milestoneIds}::uuid[])`;
    await transaction`delete from public.missions where id=any(${missionIds}::uuid[])`;
    await transaction`delete from public.contract_versions where id=any(${contractVersionIds}::uuid[])`;
    await transaction`delete from public.contracts where id=any(${contractIds}::uuid[])`;
    await transaction`delete from public.marketing_conversion_paths where organization_id=${roleFixture.organizationId}::uuid`;
    await transaction`delete from public.marketing_leads where organization_id=${roleFixture.organizationId}::uuid`;
    await transaction`delete from public.marketing_attribution_events where organization_id=${roleFixture.organizationId}::uuid`;
    await transaction`delete from public.marketing_metric_events where organization_id=${roleFixture.organizationId}::uuid`;
    await transaction`delete from public.marketing_content_sources where content_version_id in(select v.id from public.marketing_content_versions v join public.marketing_content c on c.id=v.content_id where c.campaign_id=${roleFixture.marketing.campaignId}::uuid)`;
    await transaction`delete from public.marketing_content_versions where content_id in(select id from public.marketing_content where campaign_id=${roleFixture.marketing.campaignId}::uuid)`;
    await transaction`delete from public.marketing_content where campaign_id=${roleFixture.marketing.campaignId}::uuid`;
    await transaction`delete from public.marketing_campaigns where id=${roleFixture.marketing.campaignId}::uuid`;
    await transaction`delete from public.marketing_consents where id=${roleFixture.marketing.consentId}::uuid`;
    await transaction`update public.brand_kits set current_version_id=null,status='SUSPENDED',row_version=row_version+1 where id=${roleFixture.marketing.brandKitId}::uuid`;
    await transaction`delete from public.brand_kit_versions where id=${roleFixture.marketing.brandKitVersionId}::uuid`;
    await transaction`delete from public.brand_kits where id=${roleFixture.marketing.brandKitId}::uuid`;
    if(roleFixture.marketing.ownsTemplate){await transaction`update public.marketing_templates set current_version_id=null,status='RETIRED' where id=${roleFixture.marketing.templateId}::uuid`;await transaction`delete from public.marketing_template_versions where id=${roleFixture.marketing.templateVersionId}::uuid`;await transaction`delete from public.marketing_templates where id=${roleFixture.marketing.templateId}::uuid`;}
  });
  await database`update public.franchises
    set status='TERMINATED',updated_at=clock_timestamp(),row_version=row_version+1
    where id=any(${[roleFixture.franchiseId, roleFixture.secondary?.franchiseId].filter(Boolean)}::uuid[]) and status<>'TERMINATED'`;
  const [remaining] = await database`select count(*)::integer as active
    from public.franchises where id=any(${[roleFixture.franchiseId, roleFixture.secondary?.franchiseId].filter(Boolean)}::uuid[]) and status='ACTIVE'`;
  if (remaining?.active !== 0) throw new Error("P24-P26 franchise fixture remains active");
}

async function copyAndVerifyStates(fixture) {
  await mkdir(authDirectory, { recursive: false, mode: 0o700 });
  await secureLocalPaths(authDirectory, []);
  const definitions = {
    client: fixture.manifest.states.clientA,
    provider: fixture.manifest.states.noRole,
    franchise: fixture.manifest.states.noRole,
    admin: fixture.manifest.states.centralAal2,
  };
  const paths = {};
  for (const [name, state] of Object.entries(definitions)) {
    const path = resolve(authDirectory, `${name}.json`);
    await copyFile(state.path, path);
    paths[name] = path;
  }
  await secureLocalPaths(authDirectory, Object.values(paths));
  for (const [name, state] of Object.entries(definitions)) {
    if (await sha256File(paths[name]) !== state.sha256) throw new Error("P24-P26 authentication snapshot integrity failed");
  }
  return paths;
}

async function runPlaywright(config, fixture, roleFixture, statePaths) {
  await mkdir(outputDirectory, { recursive: false, mode: 0o700 });
  const uiAuthManifest = localAuthOnly ? await provisionLocalUiAuthFixture(fixture, runToken, authDirectory) : null;
  const environment = buildChildEnvironment(process.env, {
    ...(uiAuthManifest ? { E2E_LOCAL_UI_AUTH_MANIFEST: uiAuthManifest } : {}),
    PLAYWRIGHT_JSON_OUTPUT_FILE: resolve(outputDirectory, "browser-report.json"),
    E2E_BASE_URL: config.baseUrl,
    E2E_LOCAL_ISOLATED: config.runtimeMode === "isolated-local-docker" ? "1" : "0",
    E2E_CLIENT_STORAGE_STATE: statePaths.client,
    E2E_CLIENT_B_STORAGE_STATE: fixture.manifest.states.clientB.path,
    E2E_PROVIDER_STORAGE_STATE: statePaths.provider,
    E2E_FRANCHISE_STORAGE_STATE: statePaths.franchise,
    E2E_ADMIN_STORAGE_STATE: statePaths.admin,
    E2E_FOREIGN_ORGANIZATION_NAME: fixture.manifest.fixtures.organizationB.name,
    E2E_P25_WORKFLOWS: JSON.stringify(roleFixture.workflows),
    E2E_P28_RUN_TOKEN: runToken,
    E2E_CRON_SECRET: hash(`${runToken}:cron`),
    E2E_DELIVERY_PROOF_SCANNER_MODE: "SANDBOX",
    E2E_MARKETING_CHAIN_FIXTURE: JSON.stringify({content:{organizationId:roleFixture.organizationId,campaignId:roleFixture.marketing.campaignId,serviceId:roleFixture.marketing.serviceId,libraryId:roleFixture.marketing.libraryId,language:"FR",serviceName:roleFixture.marketing.serviceName,valueProposition:"Une valeur structurée et vérifiable.",primaryCta:"Diagnostiquer",trackedUrl:"https://matricia.ma/diagnostic",approvedHashtags:["#Matricia"],templateKey:"PROBLEM_SOLUTION",sourceHash:roleFixture.marketing.sourceHash,idempotencyKey:randomUUID()},attribution:{organizationId:roleFixture.organizationId,campaignId:roleFixture.marketing.campaignId,contentId:null,eventType:"CTA_CLICKED",source:"linkedin",medium:"social",visitorHash:hash(`${runToken}:visitor`),economicValueMinor:null,occurredAt:new Date().toISOString(),metadata:{utm_campaign:"p24-e2e"},idempotencyKey:randomUUID()}}),
  });
  const specifications = localAuthOnly ? ["tests/e2e/local-auth-consent.spec.ts"] : smokeOnly ? [
    "tests/e2e/authenticated-route-smoke.spec.ts",
  ] : [
    "tests/e2e/p24-marketing-completion.spec.ts",
    "tests/e2e/p29-marketing-workspaces.spec.ts",
    "tests/e2e/p25-client-provider-completion.spec.ts",
    "tests/e2e/p26-transversal-completion.spec.ts",
    "tests/e2e/p28-reputation-checklists.spec.ts",
    "tests/e2e/authenticated-route-smoke.spec.ts",
  ];
  const child = spawn(process.execPath, [
    resolve(root, "node_modules", "@playwright", "test", "cli.js"),
    "test",
    ...specifications,
    ...(localAuthOnly ? ["--project=chromium-desktop"] : []),
    "--workers=1",
    "--retries=0",
    "--reporter=line,json",
    "--output", outputDirectory,
  ], { cwd: root, env: environment, stdio: ["ignore", "pipe", "pipe"], shell: false });
  let playwrightOutput = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => { playwrightOutput += chunk; });
  child.stderr.on("data", (chunk) => { playwrightOutput += chunk; });
  const exitCode = await new Promise((resolveExit, reject) => {
    child.once("error", (cause) => {
      const error = new Error("P24-P26 Playwright process could not start", { cause });
      error.code = typeof cause?.code === "string" ? cause.code : undefined;
      error.playwrightDiagnostic = sanitizedPlaywrightDiagnostic(`${playwrightOutput}\n${cause?.message ?? "process start failed"}`, "spawn-error");
      reject(error);
    });
    child.once("exit", (value, signal) => {
      if (!signal) return resolveExit(value ?? 1);
      const error = new Error("P24-P26 Playwright run was interrupted");
      error.code = signal;
      error.playwrightDiagnostic = sanitizedPlaywrightDiagnostic(playwrightOutput, signal);
      reject(error);
    });
  });
  let report;
  try { report = JSON.parse(await readFile(resolve(outputDirectory, "browser-report.json"), "utf8")); }
  catch { const error = new Error("P24-P26 Playwright report unavailable"); error.code = "BROWSER_REPORT_MISSING"; error.playwrightDiagnostic = sanitizedPlaywrightDiagnostic(playwrightOutput, exitCode); throw error; }
  const summary = summarizeBrowserReport(report);
  try {
    if (exitCode !== 0 || validateBrowserReport(report) !== expectedTests || summary.executed !== expectedTests) throw new Error("Browser suite incomplete or failed");
  } catch {
    const error = new Error("P24-P26 Playwright suite did not complete cleanly");
    error.code = "BROWSER_SUITE_FAILED";
    error.browserSummary = summary;
    error.playwrightDiagnostic = summary.failures.map(row => `${row.title} (${row.project}): ${row.error}`).join(" | ").slice(0, 2_000) || sanitizedPlaywrightDiagnostic(playwrightOutput, exitCode);
    throw error;
  }
  return { executed: summary.executed, total: expectedTests, browserSummary: summary, diagnostic: sanitizedPlaywrightDiagnostic(playwrightOutput, exitCode) };
}

async function main() {
  let fixture;
  let roleFixture;
  let failure;
  let failureCode = "UNKNOWN:UNAVAILABLE";
  let playwrightResult;
  let browserSummary;
  let failureDiagnostic = null;
  let remoteCleanupPassed = false;
  let localCleanupPassed = false;
  let sharedAuthCleanupPassed = false;
  let stage = "base-fixture";
  try {
    stage = "configuration";
    const config = await loadSafeConfiguration(root);
    if ((fixtureProofsOnly || localAuthOnly) && config.runtimeMode !== "isolated-local-docker") throw new Error("Local fixture proofs require verified local Docker");
    stage = "base-fixture";
    fixture = await provision();
    await validateFreshManifest(fixture.manifest, config);
    stage = "role-fixture";
    roleFixture = await provisionProviderAndFranchise(fixture, (value) => { stage = value; });
    if (config.runtimeMode === "isolated-local-docker") {
      stage = "local-secondary-mandate";
      await provisionLocalSecondaryMandate(fixture, roleFixture);
    }
    stage = "role-isolation";
    await proveRoleIsolation(fixture, roleFixture);
    if (!fixtureProofsOnly) {
      stage = "authentication-states";
      const statePaths = await copyAndVerifyStates(fixture);
      stage = "playwright";
      playwrightResult = await runPlaywright(config, fixture, roleFixture, statePaths);
      if (localAuthOnly) {
        stage = "local-ui-consent-proof";
        roleFixture.localUiAuthProof = await verifyLocalUiAuthProof(fixture);
      }
      if (!smokeOnly && !localAuthOnly) {
        stage = "storage-isolation";
        await proveP25StorageIsolation(fixture, roleFixture);
      }
    }
    stage = "complete";
    console.log(fixtureProofsOnly ? "PASS local fixture authentication/authorization proofs; browser suite not executed" : `PASS P24-P26 authenticated E2E suite (${expectedTests} tests, zero skipped)`);
  } catch (error) {
    failure = error;
    if (/^[a-zA-Z0-9 -]{1,100}$/.test(error?.provisionStage ?? "")) stage = `base-fixture:${error.provisionStage}`;
    failureCode = sanitizedFailureCode(error);
    browserSummary = error?.browserSummary ?? null;
    failureDiagnostic = typeof error?.playwrightDiagnostic === "string" ? error.playwrightDiagnostic : null;
  } finally {
    if (fixture && roleFixture) {
      try {
        await neutralizeRoleFixture(fixture.resources.database, roleFixture, fixture.resources.admin);
      } catch (error) {
        failure = combineFailure(failure, error, "P24-P26 run and role-fixture neutralization failed");
      }
    }
    if (fixture) {
      try { await neutralizeLocalUiAuthFixture(fixture); }
      catch (error) { failure = combineFailure(failure, error, "Local UI authentication cleanup failed"); }
      try { await neutralizeLocalCatalogReference(fixture); }
      catch (error) { failure = combineFailure(failure, error, "Local reference catalogue cleanup failed"); }
      try {
        await fixture.cleanup();
        if (fixture.resources.retainedEvidence <= 0) throw new Error("Immutable fixture evidence was not retained");
        remoteCleanupPassed = true;
        console.log("PASS P24-P26 remote fixtures neutralized");
      } catch (error) {
        failure = combineFailure(failure, error, "P24-P26 run and base-fixture cleanup failed");
      }
      try {
        const sharedAuth = resolve(dirname(fixture.manifestPath));
        const expectedSharedAuth = resolve(root, "scripts", "p05-e2e", ".auth");
        if (sharedAuth !== expectedSharedAuth) throw new Error("Refusing unverified P24-P26 shared-auth cleanup");
        await rm(sharedAuth, { recursive: true, force: true });
        sharedAuthCleanupPassed = true;
      } catch (error) {
        failure = combineFailure(failure, error, "P24-P26 shared authentication cleanup failed");
      }
    }
    let localCleanupError = false;
    for (const path of [authDirectory, outputDirectory]) {
      try {
        await rm(path, { recursive: true, force: true });
      } catch (error) {
        localCleanupError = true;
        failure = combineFailure(failure, error, "P24-P26 local evidence cleanup failed");
      }
    }
    localCleanupPassed = !localCleanupError && sharedAuthCleanupPassed;
  }
  await mkdir(dirname(smokeEvidencePath), { recursive: true });
  await writeFile(smokeEvidencePath, `${JSON.stringify({
    schemaVersion: 1,
    completedAt: new Date().toISOString(),
    environment: fixture?.config?.runtimeMode === "isolated-local-docker" ? "development-local-docker" : "SANDBOX",
    localProof: roleFixture?.localProof ?? null,
    localUiAuthProof: roleFixture?.localUiAuthProof ?? null,
    mode: fixtureProofsOnly ? "LOCAL_FIXTURE_PROOFS_ONLY_NO_BROWSER_ACCEPTANCE" : localAuthOnly ? "LOCAL_UI_OTP_CONSENT_AND_MFA" : smokeOnly ? "AUTHENTICATED_ROUTE_SMOKE_ONLY" : "FULL_P24_P26",
    status: failure ? "FAILED" : "PASSED",
    expectedTests,
    executedTests: playwrightResult?.executed ?? browserSummary?.executed ?? 0,
    browser: playwrightResult?.browserSummary ?? browserSummary ?? null,
    stage,
    failureCode: failure ? failureCode : null,
    diagnostic: failureDiagnostic,
    cleanup: { remoteFixturesNeutralized: remoteCleanupPassed, localAuthenticationArtifactsRemoved: localCleanupPassed },
  }, null, 2)}\n`, { mode: 0o600 });
  if (failure) {
    if (failureDiagnostic) console.error(`DIAGNOSTIC ${failureDiagnostic}`);
    console.error(`FAIL P24-P26 authenticated E2E execution failed at ${stage} (${failureCode}); no credential or private fixture detail was printed`);
    process.exitCode = 1;
  }
}

async function cleanupInterruptedRun(localRunToken) {
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(localRunToken ?? "")) {
    throw new Error("P24-P26 cleanup requires the exact local run token");
  }
  const sharedAuth = resolve(root, "scripts", "p05-e2e", ".auth");
  const localAuth = resolve(root, "artifacts", "test-results", `.p24-p26-auth-${localRunToken}`);
  const localOutput = resolve(root, "artifacts", "test-results", `p24-p26-completion-${localRunToken}`);
  let cleanupFailure;
  let database;
  let cleanupStage = "configuration";
  try {
    const config = await loadSafeConfiguration(root);
    cleanupStage = "database-connection";
    const admin = createClient(config.supabaseUrl, config.serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
    database = postgres(resolveExpectedDatabaseUrl(config), { max: 1, prepare: false, connect_timeout: 15 });
    cleanupStage = "fixture-discovery";
    const [roleOrganization] = await database`select organization.created_by,user_account.email
      from public.organizations organization
      join auth.users user_account on user_account.id=organization.created_by
      where organization.display_name=${`P05 E2E rôles P24-P26 ${localRunToken}`}
        and organization.status<>'ARCHIVED'
        and user_account.raw_app_meta_data @> '{"p05_e2e_fixture":true}'::jsonb
      order by organization.created_at desc limit 1`;
    const runId = /^p05-e2e-norole-([a-z0-9-]{8,64})@example\.invalid$/.exec(roleOrganization?.email ?? "")?.[1];
    if (!runId) throw new Error("P24-P26 interrupted fixture cannot be identified safely");
    const expectedEmails = ["clienta", "clientb", "central", "norole"]
      .map((identity) => `p05-e2e-${identity}-${runId}@example.invalid`);
    const users = await database`select id from auth.users
      where email=any(${expectedEmails}::text[]) and raw_app_meta_data @> '{"p05_e2e_fixture":true}'::jsonb`;
    if (users.length !== expectedEmails.length) throw new Error("P24-P26 interrupted identity set is incomplete");
    const userIds = users.map((row) => row.id);
    const organizations = userIds.length === 0 ? [] : await database`select id from public.organizations
      where created_by=any(${userIds}::uuid[]) and display_name like 'P05 E2E %'`;
    const organizationIds = organizations.map((row) => row.id);
    const documents = organizationIds.length === 0 ? [] : await database`select storage_object_path from public.client_compliance_documents
      where organization_id=any(${organizationIds}::uuid[])`;
    const storagePaths = documents.map((row) => row.storage_object_path);
    cleanupStage = "delivery-storage-neutralization";
    const deliveryFiles = userIds.length === 0 ? [] : await database`select name from storage.objects where bucket_id='delivery-proofs' and split_part(name,'/',1)=any(${userIds}::text[])`;
    if (deliveryFiles.length) {
      const removal = await admin.storage.from('delivery-proofs').remove(deliveryFiles.map(row => row.name));
      if (removal.error) throw new Error('Interrupted delivery Storage cleanup failed');
    }
    cleanupStage = "franchise-neutralization";
    if (organizationIds.length > 0) {
      await database`update public.franchises set status='TERMINATED',updated_at=clock_timestamp(),row_version=row_version+1
        where operator_organization_id=any(${organizationIds}::uuid[]) and status<>'TERMINATED'`;
    }
    cleanupStage = "base-neutralization";
    await cleanupRemote({ admin, database, organizationIds, userIds, storagePaths, retainedEvidence: 0 });
  } catch (error) {
    cleanupFailure = new Error(`P24-P26 interrupted cleanup stopped during ${cleanupStage}`, { cause: error });
  } finally {
    try { await database?.end({ timeout: 2 }); }
    catch (error) { cleanupFailure = combineFailure(cleanupFailure, error, "Interrupted cleanup database close failed"); }
    for (const path of [localAuth, localOutput, sharedAuth]) {
      try {
        await rm(path, { recursive: true, force: true });
      } catch (error) {
        cleanupFailure = combineFailure(cleanupFailure, error, "P24-P26 interrupted local cleanup failed");
      }
    }
  }
  if (cleanupFailure) throw cleanupFailure;
  console.log("PASS P24-P26 interrupted run fixtures and local authentication artifacts neutralized");
}

async function verifyNoActiveCompletionFixtures(localRunToken) {
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(localRunToken ?? "")) {
    throw new Error("P24-P26 verification requires the exact local run token");
  }
  const config = await loadSafeConfiguration(root);
  const database = postgres(resolveExpectedDatabaseUrl(config), { max: 1, prepare: false, connect_timeout: 15 });
  try {
    const [active] = await database`select
      (select count(*)::integer from public.organizations organization
        where organization.display_name=${`P05 E2E rôles P24-P26 ${localRunToken}`} and organization.status<>'ARCHIVED') as organizations,
      (select count(*)::integer from public.organization_memberships membership
        join public.organizations organization on organization.id=membership.organization_id
        where organization.display_name=${`P05 E2E rôles P24-P26 ${localRunToken}`} and membership.status<>'REVOKED') as memberships,
      (select count(*)::integer from public.organization_member_roles role
        join public.organization_memberships membership on membership.id=role.membership_id
        join public.organizations organization on organization.id=membership.organization_id
        where organization.display_name=${`P05 E2E rôles P24-P26 ${localRunToken}`} and role.revoked_at is null) as roles,
      (select count(*)::integer from public.franchises franchise
        join public.organizations organization on organization.id=franchise.operator_organization_id
        where organization.display_name=${`P05 E2E rôles P24-P26 ${localRunToken}`} and franchise.status='ACTIVE') as franchises`;
    if (!active || Object.values(active).some((value) => value !== 0)) {
      throw new Error("P24-P26 active remote fixture remains");
    }
  } finally {
    await database.end({ timeout: 2 });
  }
  const localPaths = [
    resolve(root, "scripts", "p05-e2e", ".auth"),
    resolve(root, "artifacts", "test-results", `.p24-p26-auth-${localRunToken}`),
    resolve(root, "artifacts", "test-results", `p24-p26-completion-${localRunToken}`),
  ];
  for (const path of localPaths) {
    try {
      await access(path);
      throw new Error("P24-P26 local authentication or trace artifact remains");
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
  console.log("PASS P24-P26 zero active remote fixture and zero local authentication artifact");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv[2] === "--configuration-only") {
    try {
      const config = await loadSafeConfiguration(root);
      console.log(JSON.stringify({ status: "CONFIGURATION_VERIFIED", environment: config.environment, runtimeMode: config.runtimeMode ?? "hosted-nonproduction", projectRef: config.projectRef, noFixturesCreated: true }));
    } catch (error) { console.error(error?.message?.startsWith("LOCAL_TOTP_DISABLED:") ? "FAIL LOCAL_TOTP_DISABLED: enable local TOTP enrollment and verification; no fixtures created" : "FAIL safe E2E configuration verification; no credentials printed"); process.exitCode = 1; }
  } else if (process.argv[2] === "--cleanup-only") {
    try {
      await cleanupInterruptedRun(process.argv[3]);
    } catch (error) {
      console.error(`FAIL ${error.message}; no credential or private fixture detail was printed`);
      process.exitCode = 1;
    }
  } else if (process.argv[2] === "--verify-clean") {
    try {
      await verifyNoActiveCompletionFixtures(process.argv[3]);
    } catch (error) {
      console.error(`FAIL ${error.message}; no credential or private fixture detail was printed`);
      process.exitCode = 1;
    }
  } else {
    await main();
  }
}
