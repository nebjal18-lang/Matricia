import { createHash, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { access, copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { summarizeBrowserReport, validateBrowserReport } from "../../../scripts/release/browser-report.mjs";
import { provisionLocalCatalogReference, neutralizeLocalCatalogReference } from "./local-catalog-reference.mjs";
import { localFixturePdf } from "./local-fixture-pdf.mjs";
import { provisionLocalUiAuthFixture, verifyLocalUiAuthProof, neutralizeLocalUiAuthFixture } from "./local-ui-auth-fixture.mjs";
import { provisionLocalSecondaryMandate } from "./local-secondary-mandate.mjs";
import { ownedLocalHttpServer } from "./owned-local-http-server.mjs";
import { verifyFunctionalControls } from "./local-functional-controls-proof.mjs";
import { loadSafeConfiguration, resolveExpectedDatabaseUrl } from "../../../scripts/p05-e2e/environment.mjs";
import { cleanupRemote, provision, elevateToAal2, toPlaywrightState } from "../../../scripts/p05-e2e/provision.mjs";
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
const visualOnly = process.argv.includes("--visual-route-matrix-only");
const visualDynamicOnly = process.argv.includes("--visual-dynamic-matrix-only");
const localAuthOnly = process.argv.includes("--local-auth-ui-only");
const fixtureProofsOnly = process.argv.includes("--local-fixture-proofs-only");
const marketingOnly = process.argv.includes("--marketing-only");
const marketingSpacesOnly = process.argv.includes("--marketing-spaces-only");
const businessSpacesOnly = process.argv.includes("--business-spaces-only");
const functionalControlsOnly = process.argv.includes("--functional-controls-only");
const visualSpaceCount = (process.env.VISUAL_MATRIX_SPACES ?? "public,shared,client,provider,franchise,admin").split(",").filter(Boolean).length;
const visualLocaleCount = (process.env.VISUAL_MATRIX_LOCALES ?? "fr,ar").split(",").filter(Boolean).length;
const visualProjectCount = process.env.VISUAL_MATRIX_PROJECT ? 1 : 2;
const expectedTests = visualDynamicOnly ? visualSpaceCount : visualOnly ? visualSpaceCount * visualLocaleCount * visualProjectCount : functionalControlsOnly ? 20 : fixtureProofsOnly ? 0 : localAuthOnly ? 4 : smokeOnly ? 16 : marketingOnly ? 8 : marketingSpacesOnly ? 24 : businessSpacesOnly ? 40 : 64;
const smokeEvidencePath = resolve(root, "artifacts", "test-results", visualDynamicOnly ? "visual-dynamic-matrix-summary.json" : visualOnly ? "visual-route-matrix-summary.json" : "authenticated-route-smoke-summary.json");

const hash = (value) => createHash("sha256").update(value).digest("hex");

function combineFailure(current, next, message) {
  return current ? new AggregateError([current, next], message, { cause: current }) : next;
}

function sanitizedFailureCode(error) {
  const assertionLabel = error?.code === "ERR_ASSERTION" ? /^[A-Z][A-Z0-9_]{2,100}(?=\r?\n|$)/u.exec(error.message ?? "")?.[0] : null;
  const candidate = assertionLabel ?? error?.code ?? error?.message;
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
  const organizationName = `P05 E2E rôles P24-P26 ${runToken.replaceAll("-", "")}`;
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
      await transaction`update public.catalog_libraries set steward_organization_id=${organizationId}::uuid where id=${localCatalog.library}::uuid`;
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
    await transaction`insert into public.brand_kit_versions(id,brand_kit_id,version,payload,claims,certifications,content_hash,change_reason,created_by) values(${marketing.brandKitVersionId}::uuid,${marketing.brandKitId}::uuid,1,jsonb_build_object('legal_name',${organizationName}::text,'trade_name',${organizationName}::text,'primary_colors',jsonb_build_array('#123B5D'),'tone',jsonb_build_array('PROFESSIONAL'),'languages',jsonb_build_array('FR','AR'),'primary_cta','DIAGNOSTIC','tracked_url','https://matricia.ma/diagnostic','allowed_url_hosts',jsonb_build_array('matricia.ma'),'logo_assets','[]'::jsonb,'asset_restrictions','[]'::jsonb,'required_mentions','[]'::jsonb,'forbidden_terms','[]'::jsonb,'approved_hashtags',jsonb_build_array('#Matricia')),'[]'::jsonb,'[]'::jsonb,${hash(`${runToken}:brand`)},'Fixture E2E P24',${providerFranchiseUserId}::uuid)`;
    onStage("role-fixture-marketing-brand-activate");
    await transaction`update public.brand_kits set status='READY',current_version_id=${marketing.brandKitVersionId}::uuid,row_version=row_version+1 where id=${marketing.brandKitId}::uuid`;
    onStage("role-fixture-marketing-consent");
    await transaction`insert into public.marketing_consents(id,organization_id,purpose,decision,policy_version,evidence_hash,decided_by) values(${marketing.consentId}::uuid,${organizationId}::uuid,'MARKETING_ANALYTICS','GRANTED','P24-E2E',${hash(`${runToken}:consent`)},${providerFranchiseUserId}::uuid)`;
    onStage("role-fixture-marketing-campaign");
    await transaction`insert into public.marketing_campaigns(id,organization_id,brand_kit_version_id,mode,title_fr,title_ar,status,audience_snapshot,source_snapshot,created_by) values(${marketing.campaignId}::uuid,${organizationId}::uuid,${marketing.brandKitVersionId}::uuid,'ASSISTED','Campagne P24','حملة P24','DRAFT','{"fixture":"P24"}'::jsonb,'{"fixture":"P24"}'::jsonb,${providerFranchiseUserId}::uuid)`;
  });

  return roleFixture;
}

async function provisionVisualDynamicBusinessRecords(fixture, roleFixture) {
  if (fixture.config.runtimeMode !== "isolated-local-docker" || !fixture.config.localDockerVerified) {
    throw new Error("Visual business records require a verified isolated local Docker fixture");
  }
  const ids = Object.fromEntries(["request", "requestVersion", "matchingRun", "candidate", "rfq", "invitation", "quote", "quoteVersion", "dispute", "thread", "clientParticipant", "providerParticipant", "message", "questionnaire", "questionnaireVersion", "questionnaireSession", "diagnostic", "question", "questionVersion", "providerDocumentFamily", "providerDocumentVersion", "franchiseInvitation", "providerService", "providerCompanyDecision", "providerScanJob"].map((name) => [name, randomUUID()]));
  const clientOrganizationId = fixture.manifest.fixtures.organizationA.id;
  const clientUserId = fixture.resources.userIds[0];
  const providerOrganizationId = roleFixture.organizationId;
  const providerUserId = roleFixture.providerFranchiseUserId;
  const database = fixture.resources.database;
  const [providerIdentity] = await database`select email from auth.users where id=${providerUserId}::uuid`;
  if (!providerIdentity?.email) throw new Error("Visual franchise invitation requires its local recipient");
  const centralIdentity = await fixture.sessions.central.client.auth.getUser();
  if (centralIdentity.error || !centralIdentity.data.user) throw new Error("Visual provider decision requires its local admin actor");
  const [existingTaxRule] = await database`select id,rate_basis_points from public.tax_rule_versions where jurisdiction_code='MA' and status='ACTIVE' and professional_validation_status='VALIDATED' and effective_from<=current_date and (effective_to is null or effective_to>=current_date) order by priority desc,id limit 1`;
  const localTaxCategory = existingTaxRule ? null : `E2E_VISUAL_${runToken.replaceAll("-", "").slice(0, 16).toUpperCase()}`;
  const taxRule = existingTaxRule ?? { id: randomUUID(), rate_basis_points: 0 };
  roleFixture.visualBusiness = ids;
  roleFixture.visualTaxCategory = localTaxCategory;
  const subtotalMinor = 100000n;
  const taxMinor = (subtotalMinor * BigInt(taxRule.rate_basis_points) + 5000n) / 10000n;
  const totalMinor = subtotalMinor + taxMinor;
  const documentBytes = localFixturePdf(["SYNTHETIC LOCAL VISUAL FIXTURE", "NOT AN OFFICIAL PROVIDER DOCUMENT"]);
  const documentHash = createHash("sha256").update(documentBytes).digest("hex");
  const documentPath = `test-only/${providerOrganizationId}/visual-${ids.providerDocumentVersion}.pdf`;
  roleFixture.visualProviderStoragePaths = [documentPath];
  const upload = await fixture.resources.admin.storage.from("provider-qualification").upload(documentPath, documentBytes, { contentType: "application/pdf", upsert: false });
  if (upload.error) throw new Error("VISUAL_PROVIDER_DOCUMENT_UPLOAD_FAILED");
  await database.begin(async (tx) => {
    // Historical display preconditions in a disposable local database; no workflow approval is implied.
    await tx.unsafe("set local session_replication_role='replica'");
    if (localTaxCategory) {
      await tx`insert into public.tax_categories(code,name_fr,name_ar,description_fr,description_ar,category_kind,status) values(${localTaxCategory},'Exemption de recette locale','إعفاء اختبار محلي','Fixture visuelle sans valeur fiscale','بيانات اختبار بصري غير ضريبية','SERVICE','ACTIVE')`;
      await tx`insert into public.tax_rule_versions(id,jurisdiction_code,category_code,version,rate_basis_points,effective_from,status,professional_validation_status,rule_type,priority,conditions,legal_reference,rounding_strategy,approved_by,approved_at,validation_reference,content_hash,change_reason) values(${taxRule.id}::uuid,'MA',${localTaxCategory},1,0,current_date,'ACTIVE','VALIDATED','EXEMPT',100,'{}'::jsonb,'NON_PRODUCTION_VISUAL_FIXTURE_ONLY','HALF_AWAY_FROM_ZERO_TO_MINOR_UNIT',${clientUserId}::uuid,clock_timestamp(),'LOCAL_VISUAL_ONLY',${hash(`${runToken}:visual-tax-rule`)},'Exemption synthétique réservée à la recette visuelle locale')`;
    }
    await tx`insert into public.provider_profiles(provider_organization_id,activity_summary,team_size,years_experience,created_by) values(${providerOrganizationId}::uuid,'Profil fournisseur synthétique de recette visuelle',2,1,${providerUserId}::uuid) on conflict(provider_organization_id) do nothing`;
    await tx`insert into public.provider_services(id,provider_organization_id,service_id,request_status,requested_by) values(${ids.providerService}::uuid,${providerOrganizationId}::uuid,${roleFixture.marketing.serviceId}::uuid,'DRAFT',${providerUserId}::uuid)`;
    await tx`insert into public.provider_company_decisions(id,provider_organization_id,decision_version,company_status,partner_contract_status,reason,rule_version,decided_by,correlation_id) values(${ids.providerCompanyDecision}::uuid,${providerOrganizationId}::uuid,1,'UNDER_REVIEW','PENDING','Décision historique synthétique de recette visuelle','E2E_VISUAL_1',${centralIdentity.data.user.id}::uuid,${randomUUID()}::uuid)`;
    await tx`insert into public.provider_document_families(id,provider_organization_id,document_kind,code,created_by) values(${ids.providerDocumentFamily}::uuid,${providerOrganizationId}::uuid,'LEGAL','VISUAL_LEGAL',${providerUserId}::uuid)`;
    await tx`insert into public.provider_document_versions(id,family_id,provider_organization_id,version_number,status,storage_object_path,content_hash,change_reason,submitted_by) values(${ids.providerDocumentVersion}::uuid,${ids.providerDocumentFamily}::uuid,${providerOrganizationId}::uuid,1,'SUBMITTED',${documentPath},${documentHash},'Document synthétique de recette visuelle',${providerUserId}::uuid)`;
    await tx`insert into public.provider_document_service_links(document_version_id,provider_service_id,provider_organization_id) values(${ids.providerDocumentVersion}::uuid,${ids.providerService}::uuid,${providerOrganizationId}::uuid)`;
    await tx`insert into public.provider_document_upload_reservations(provider_organization_id,actor_user_id,storage_object_path,declared_mime_type,declared_size_bytes,status,document_version_id,bound_at) values(${providerOrganizationId}::uuid,${providerUserId}::uuid,${documentPath},'application/pdf',${documentBytes.length},'BOUND',${ids.providerDocumentVersion}::uuid,clock_timestamp())`;
    await tx`insert into public.provider_document_scan_jobs(id,document_version_id,provider_organization_id,storage_object_path,declared_sha256,declared_mime_type) values(${ids.providerScanJob}::uuid,${ids.providerDocumentVersion}::uuid,${providerOrganizationId}::uuid,${documentPath},${documentHash},'application/pdf')`;
    await tx`insert into public.franchise_invitations(id,franchise_id,invited_email,status,expires_at) values(${ids.franchiseInvitation}::uuid,${roleFixture.franchiseId}::uuid,${providerIdentity.email},'SENT',clock_timestamp()+interval'7 days')`;
    await tx`insert into private.franchise_invitation_tokens(invitation_id,token_hash) values(${ids.franchiseInvitation}::uuid,${hash(`${runToken}:visual-franchise-invitation`)})`;
    await tx`insert into public.service_requests(id,client_organization_id,library_id,service_id,status,created_by) values(${ids.request}::uuid,${clientOrganizationId}::uuid,${roleFixture.marketing.libraryId}::uuid,${roleFixture.marketing.serviceId}::uuid,'MATCHING',${clientUserId}::uuid)`;
    await tx`insert into public.service_request_versions(id,request_id,client_organization_id,library_id,version_number,description,urgency,currency_code,required_quote_data,required_fields_complete,catalog_snapshot_hash,questionnaire_snapshot_hash,change_reason,content_hash,created_by) values(${ids.requestVersion}::uuid,${ids.request}::uuid,${clientOrganizationId}::uuid,${roleFixture.marketing.libraryId}::uuid,1,'Besoin synthétique de recette visuelle','NORMAL','MAD','{}'::jsonb,true,${roleFixture.marketing.sourceHash},${hash(`${runToken}:visual-questionnaire`)},'Fixture visuelle locale',${hash(`${runToken}:visual-request`)},${clientUserId}::uuid)`;
    await tx`update public.service_requests set current_version_id=${ids.requestVersion}::uuid where id=${ids.request}::uuid`;
    await tx`insert into public.matching_runs(id,request_id,request_version_id,policy_version,status,target_panel_size,started_by,completed_at) values(${ids.matchingRun}::uuid,${ids.request}::uuid,${ids.requestVersion}::uuid,'MATCH-V1','COMPLETED',1,${clientUserId}::uuid,clock_timestamp())`;
    await tx`insert into public.matching_candidates(id,matching_run_id,provider_organization_id,eligible,score_basis_points,score_explanation,rotation_component) values(${ids.candidate}::uuid,${ids.matchingRun}::uuid,${providerOrganizationId}::uuid,true,9000,'{}'::jsonb,0)`;
    await tx`insert into public.rfqs(id,request_id,request_version_id,matching_run_id,status,deadline,confidentiality_settings,invited_count,opened_by) values(${ids.rfq}::uuid,${ids.request}::uuid,${ids.requestVersion}::uuid,${ids.matchingRun}::uuid,'OPEN',clock_timestamp()+interval'30 days','{"mask_direct_contacts":true,"competitor_offers_visible":false}'::jsonb,1,${clientUserId}::uuid)`;
    await tx`insert into public.rfq_providers(id,rfq_id,provider_organization_id,matching_candidate_id,status,responded_at) values(${ids.invitation}::uuid,${ids.rfq}::uuid,${providerOrganizationId}::uuid,${ids.candidate}::uuid,'ACCEPTED',clock_timestamp())`;
    await tx`insert into public.quotes(id,rfq_id,rfq_provider_id,provider_organization_id,status,created_by) values(${ids.quote}::uuid,${ids.rfq}::uuid,${ids.invitation}::uuid,${providerOrganizationId}::uuid,'SUBMITTED',${providerUserId}::uuid)`;
    await tx`insert into public.quote_versions(id,quote_id,rfq_id,provider_organization_id,version_number,lifecycle_status,change_reason,currency,solution_fr,deliverables,warranty_fr,correction_terms_fr,proposed_start_date,duration_days,valid_until,subtotal_minor,tax_minor,total_minor,recurring_subtotal_minor,calculation_basis,content_hash,submitted_at,created_by) values(${ids.quoteVersion}::uuid,${ids.quote}::uuid,${ids.rfq}::uuid,${providerOrganizationId}::uuid,1,'SUBMITTED','Fixture visuelle locale','MAD','Solution synthétique de recette',jsonb_build_array('Livrable de test'),'Garantie de test','Corrections de test',current_date+interval'7 days',10,clock_timestamp()+interval'30 days',${subtotalMinor},${taxMinor},${totalMinor},0,${tx.json({fixture:"visual-only",tax_rule_version_id:taxRule.id,tax_proof:false})},${hash(`${runToken}:visual-quote`)},clock_timestamp(),${providerUserId}::uuid)`;
    await tx`insert into public.quote_items(quote_version_id,line_number,item_kind,label_fr,quantity,unit_code,unit_price_minor,subtotal_minor,tax_rule_version_id,tax_rate_basis_points,tax_minor,total_minor) values(${ids.quoteVersion}::uuid,1,'ONE_TIME','Prestation de test',1.0000,'UNIT',${subtotalMinor},${subtotalMinor},${taxRule.id}::uuid,${taxRule.rate_basis_points},${taxMinor},${totalMinor})`;
    await tx`update public.quotes set current_version_id=${ids.quoteVersion}::uuid where id=${ids.quote}::uuid`;
    const workflow = roleFixture.workflows[0];
    await tx`insert into public.dispute_cases(id,mission_id,contract_id,contract_version_id,client_organization_id,provider_organization_id,obligation_key,description,urgency,status,policy_snapshot,response_due_at,opened_by) values(${ids.dispute}::uuid,${workflow.missionId}::uuid,${workflow.contractId}::uuid,${workflow.contractVersionId}::uuid,${clientOrganizationId}::uuid,${providerOrganizationId}::uuid,'VISUAL_DELAY','Signalement synthétique pour la recette visuelle','STANDARD','WARNING_LEVEL_1',${tx.json({version:"DISPUTE-VISUAL-ONLY",content_hash:hash(`${runToken}:visual-dispute-policy`),response_hours:48,urgent_response_hours:8,correction_business_days:5,review_business_days:5,appeal_hours:72})},clock_timestamp()+interval'2 days',${clientUserId}::uuid)`;
    await tx`insert into public.internal_message_threads(id,object_type,object_id,service_request_id,client_organization_id,provider_organization_id,subject,created_by) values(${ids.thread}::uuid,'RFQ',${ids.rfq}::uuid,${ids.request}::uuid,${clientOrganizationId}::uuid,${providerOrganizationId}::uuid,'Clarification de test',${clientUserId}::uuid)`;
    await tx`insert into public.internal_message_participants(id,thread_id,organization_id,participant_kind,display_alias) values(${ids.clientParticipant}::uuid,${ids.thread}::uuid,${clientOrganizationId}::uuid,'CLIENT','CLIENT'),(${ids.providerParticipant}::uuid,${ids.thread}::uuid,${providerOrganizationId}::uuid,'PROVIDER','PROVIDER')`;
    await tx`insert into public.internal_messages(id,thread_id,sender_participant_id,sender_organization_id,sender_user_id,body,idempotency_key) values(${ids.message}::uuid,${ids.thread}::uuid,${ids.clientParticipant}::uuid,${clientOrganizationId}::uuid,${clientUserId}::uuid,'Message synthétique de recette visuelle',${`visual-${runToken}`})`;
    const catalogReleaseId = fixture.resources.localCatalog?.release;
    if (!catalogReleaseId) throw new Error("Local catalog release is required for the visual diagnostic");
    await tx`insert into public.questionnaires(id,library_id,code,status,created_by) values(${ids.questionnaire}::uuid,${roleFixture.marketing.libraryId}::uuid,${`E2E_VISUAL_${runToken.replaceAll("-", "").slice(0, 12).toUpperCase()}`},'DRAFT',${clientUserId}::uuid)`;
    await tx`insert into public.questionnaire_versions(id,questionnaire_id,library_id,catalog_release_id,version,status,title_fr,title_ar,description_fr,description_ar,audience,engine_version,policy_version,snapshot_hash,sensitive,change_reason,created_by) values(${ids.questionnaireVersion}::uuid,${ids.questionnaire}::uuid,${roleFixture.marketing.libraryId}::uuid,${catalogReleaseId}::uuid,1,'DRAFT','Diagnostic de recette','تشخيص تجريبي','Données synthétiques locales','بيانات تجريبية محلية','CLIENT','E2E-1','E2E-1',${hash(`${runToken}:visual-questionnaire-version`)},false,'Fixture visuelle locale',${clientUserId}::uuid)`;
    await tx`update public.questionnaires set current_draft_version_id=${ids.questionnaireVersion}::uuid where id=${ids.questionnaire}::uuid`;
    await tx`insert into public.question_bank_questions(id,library_id,question_key,scope,status,created_by) values(${ids.question}::uuid,${roleFixture.marketing.libraryId}::uuid,'E2E_VISUAL_QUESTION','LIBRARY','DRAFT',${providerUserId}::uuid)`;
    await tx`insert into public.question_versions(id,question_id,library_id,version,status,label_fr,label_ar,answer_type,data_key,content_hash,change_reason,created_by) values(${ids.questionVersion}::uuid,${ids.question}::uuid,${roleFixture.marketing.libraryId}::uuid,1,'DRAFT','Question de recette visuelle','سؤال اختبار بصري','YES_NO','visualQuestion',${hash(`${runToken}:visual-question`)},'Fixture visuelle locale',${providerUserId}::uuid)`;
    await tx`update public.question_bank_questions set current_draft_version_id=${ids.questionVersion}::uuid where id=${ids.question}::uuid`;
    await tx`insert into public.questionnaire_sessions(id,organization_id,actor_user_id,library_id,catalog_release_id,questionnaire_version_id,audience,locale,status,submitted_at,answer_manifest,answer_manifest_hash) values(${ids.questionnaireSession}::uuid,${clientOrganizationId}::uuid,${clientUserId}::uuid,${roleFixture.marketing.libraryId}::uuid,${catalogReleaseId}::uuid,${ids.questionnaireVersion}::uuid,'CLIENT','fr-MA','SUBMITTED',clock_timestamp(),'{}'::jsonb,${hash(`${runToken}:visual-answers`)})`;
    await tx`insert into public.diagnostic_runs(id,organization_id,questionnaire_session_id,library_id,status,input_manifest_hash,scoring_policy_snapshot,overall_score,rating,explanation,completed_by,correlation_id) values(${ids.diagnostic}::uuid,${clientOrganizationId}::uuid,${ids.questionnaireSession}::uuid,${roleFixture.marketing.libraryId}::uuid,'COMPLETED',${hash(`${runToken}:visual-answers`)},${tx.json({version:"DIAGNOSTIC-VISUAL-ONLY",content_hash:hash(`${runToken}:visual-scoring-policy`),thresholds:{good:80,attention:60,important:40}})},55.00,'IMPORTANT','{}'::jsonb,${clientUserId}::uuid,${randomUUID()}::uuid)`;
  });
  const scan = await fixture.resources.admin.rpc("record_provider_document_scan_result", {
    p_upload_id: ids.providerScanJob,
    p_result: "CLEAN",
    p_engine_code: "LOCAL_VISUAL_KNOWN_PDF",
    p_engine_version: "1",
    p_computed_sha256: documentHash,
    p_idempotency_key: `visual-scan:${ids.providerScanJob}`,
  });
  if (scan.error || scan.data?.result !== "CLEAN") throw new Error("VISUAL_PROVIDER_DOCUMENT_SCAN_PRECONDITION_FAILED");
  const assistance = await fixture.sessions.clientA.client.rpc("save_client_assistance", {
    p_request_id: null,
    p_organization_id: clientOrganizationId,
    p_subject: "Assistance de recette visuelle",
    p_body: "Demande synthétique de test pour vérifier la fiche d'assistance administrateur.",
    p_document_ids: [],
    p_submit: true,
    p_consent: true,
    p_expected_version: 0,
    p_idempotency_key: `visual-assistance-${runToken}`,
    p_correlation_id: randomUUID(),
  });
  if (assistance.error || !assistance.data?.id) throw new Error("VISUAL_ASSISTANCE_COMMAND_FAILED");
  roleFixture.visualAssistanceId = assistance.data.id;
  // Generate a real, source-derived local control report. Its trigger captures
  // governance facts; neither step records a human decision or approval.
  const [control] = await database`select private.generate_franchise_control_report_v1(${roleFixture.franchiseId}::uuid,'DAILY',current_date-1,current_date-1) as report_id`;
  const [plan] = await database`select id from public.franchise_control_plan_proposals_v1 where report_id=${control.report_id}::uuid`;
  if (plan) roleFixture.visualControlPlanId = plan.id;
  const [snapshot] = await database`select id from public.franchise_governance_signal_snapshots_v1 where report_id=${control.report_id}::uuid`;
  if (!snapshot) throw new Error("VISUAL_GOVERNANCE_SNAPSHOT_MISSING");
  const review = await fixture.sessions.central.client.rpc("request_franchise_governance_review_v1", {
    p_snapshot_id: snapshot.id,
    p_reason: "Examen de faits synthétiques locaux pour la recette visuelle, sans présomption de faute.",
    p_idempotency_key: `visual-governance-${runToken}`,
  });
  if (review.error || !review.data?.requestId) throw new Error("VISUAL_GOVERNANCE_REVIEW_REQUEST_FAILED");
  roleFixture.visualGovernanceRequestId = review.data.requestId;
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

// Retain immutable native proofs and their mission/contract history after archival.
export async function retainBoundDeliveryObjects(database,admin,objects){
  const disposable=[];
  for(const {name} of objects){
    const proofs=await database`select p.evidence_hash from private.delivery_storage_object_bindings_v1 b join storage.objects o on o.id=b.object_id join public.delivery_proofs p on p.id=b.proof_id where o.bucket_id='delivery-proofs' and o.name=${name}`;
    if(!proofs.length){disposable.push(name);continue;}
    const result=await admin.storage.from('delivery-proofs').download(name);
    if(result.error||!result.data)throw new Error('RETAINED_DELIVERY_READ_FAILED');
    const digest=createHash('sha256').update(Buffer.from(await result.data.arrayBuffer())).digest('hex');
    if(proofs.some(proof=>proof.evidence_hash!==digest))throw new Error('RETAINED_DELIVERY_HASH_MISMATCH');
  }
  if(disposable.length){const result=await admin.storage.from('delivery-proofs').remove(disposable);if(result.error)throw new Error('UNBOUND_DELIVERY_CLEANUP_FAILED');}
}

async function neutralizeRoleFixture(database,roleFixture,admin){
  if (roleFixture.visualBusiness?.franchiseInvitation) {
    await database`update public.franchise_invitations set status='REVOKED',row_version=row_version+1 where id=${roleFixture.visualBusiness.franchiseInvitation}::uuid and status='SENT'`;
  }
  if (roleFixture.visualProviderStoragePaths?.length) {
    const removal = await admin.storage.from("provider-qualification").remove(roleFixture.visualProviderStoragePaths);
    if (removal.error) throw new Error("VISUAL_PROVIDER_DOCUMENT_CLEANUP_FAILED");
  }
  if (roleFixture.visualTaxCategory) {
    await database.begin(async (tx) => {
      await tx.unsafe("set local session_replication_role='replica'");
      await tx`update public.tax_rule_versions set status='RETIRED',effective_to=current_date where category_code=${roleFixture.visualTaxCategory} and status='ACTIVE'`;
      await tx`update public.tax_categories set status='RETIRED' where code=${roleFixture.visualTaxCategory} and status='ACTIVE'`;
    });
  }
  const deliverableIds=roleFixture.workflows.map(item=>item.deliverableId);
  const storageObjects = await database`select name from storage.objects where bucket_id='delivery-proofs' and split_part(name,'/',2)=any(${deliverableIds}::text[])`;
  await retainBoundDeliveryObjects(database,admin,storageObjects);
  await database.begin(async(transaction)=>{
    await transaction.unsafe("set local session_replication_role='replica'");
    await transaction`delete from public.service_checklist_templates template using public.audit_events audit where audit.resource_type='service_checklist_template' and audit.resource_id=template.id::text and audit.metadata->>'change_reason' like ${`E2E ${runToken}%`}`;
    await transaction`delete from public.marketing_conversion_paths where organization_id=${roleFixture.organizationId}::uuid`;
    await transaction`delete from public.marketing_leads where organization_id=${roleFixture.organizationId}::uuid`;
    await transaction`delete from public.marketing_attribution_events where organization_id=${roleFixture.organizationId}::uuid`;
    await transaction`delete from public.marketing_metric_events where organization_id=${roleFixture.organizationId}::uuid`;
    await transaction`delete from public.social_publication_attempt_events where organization_id=${roleFixture.organizationId}::uuid`;
    await transaction`delete from public.social_publication_results where job_id in(select id from public.social_publication_jobs where organization_id=${roleFixture.organizationId}::uuid)`;
    await transaction`delete from public.social_publication_jobs where organization_id=${roleFixture.organizationId}::uuid`;
    await transaction`delete from public.marketing_calendar_items where campaign_id in(select id from public.marketing_campaigns where organization_id=${roleFixture.organizationId}::uuid)`;
    await transaction`delete from public.marketing_calendars where organization_id=${roleFixture.organizationId}::uuid`;
    await transaction`delete from public.marketing_schedule_rule_heads where organization_id=${roleFixture.organizationId}::uuid`;
    await transaction`delete from public.marketing_schedule_rules where organization_id=${roleFixture.organizationId}::uuid`;
    await transaction`delete from public.social_accounts where organization_id=${roleFixture.organizationId}::uuid`;
    await transaction`delete from public.social_connection_security_versions where organization_id=${roleFixture.organizationId}::uuid`;
    await transaction`delete from public.social_connections where organization_id=${roleFixture.organizationId}::uuid`;
    await transaction`delete from public.marketing_brand_authorizations where organization_id=${roleFixture.organizationId}::uuid`;
    await transaction`delete from private.marketing_cta_visits where token_hash in(select token_hash from private.marketing_cta_tokens where organization_id=${roleFixture.organizationId}::uuid)`;
    await transaction`delete from private.marketing_cta_tokens where organization_id=${roleFixture.organizationId}::uuid`;
    await transaction`delete from private.marketing_content_generation_claims where campaign_id in(select id from public.marketing_campaigns where organization_id=${roleFixture.organizationId}::uuid)`;
    await transaction`delete from public.marketing_exceptions where organization_id=${roleFixture.organizationId}::uuid`;
    await transaction`delete from public.marketing_content_sources where content_version_id in(select v.id from public.marketing_content_versions v join public.marketing_content c on c.id=v.content_id where c.campaign_id in(select id from public.marketing_campaigns where organization_id=${roleFixture.organizationId}::uuid))`;
    await transaction`delete from public.marketing_content_versions where content_id in(select id from public.marketing_content where campaign_id in(select id from public.marketing_campaigns where organization_id=${roleFixture.organizationId}::uuid))`;
    await transaction`delete from public.marketing_content where campaign_id in(select id from public.marketing_campaigns where organization_id=${roleFixture.organizationId}::uuid)`;
    await transaction`delete from public.marketing_campaigns where organization_id=${roleFixture.organizationId}::uuid`;
    await transaction`delete from public.marketing_consents where organization_id=${roleFixture.organizationId}::uuid`;
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
  if (!smokeOnly && !localAuthOnly) {
    for (const [session, names] of [[fixture.sessions.clientA, ["client"]], [fixture.sessions.noRole, ["provider", "franchise"]]]) {
      await elevateToAal2(session);
      for (const name of names) await writeFile(paths[name], JSON.stringify(toPlaywrightState(session.cookies, fixture.config.baseUrl)), {mode:0o600});
    }
    await secureLocalPaths(authDirectory, Object.values(paths));
  }
  return paths;
}

async function runPlaywright(config, fixture, roleFixture, statePaths) {
  await mkdir(outputDirectory, { recursive: false, mode: 0o700 });
  const uiAuthManifest = localAuthOnly ? await provisionLocalUiAuthFixture(fixture, runToken, authDirectory) : null;
  const visualSeedPaths = visualDynamicOnly ? await (async () => {
    if (config.runtimeMode !== "isolated-local-docker" || !config.localDockerVerified) {
      throw new Error("Dynamic visual seed paths require a verified isolated local Docker fixture");
    }
    const services = JSON.parse(await readFile(resolve(root, "apps/web/modules/public/data/catalogue/services.json"), "utf8"));
    const serviceCode = services.find((service) => typeof service.code === "string")?.code;
    const catalog = fixture.resources.localCatalog;
    const clientOrganizationId = fixture.manifest.fixtures.organizationA.id;
    const clientCaseId = fixture.manifest.fixtures.organizationA.caseId;
    const providerOrganizationId = roleFixture.organizationId;
    const visual = roleFixture.visualBusiness;
    return {
      public: ["invitation/E2EVISUAL01", ...(serviceCode ? [`services/${encodeURIComponent(serviceCode)}`] : [])],
      shared: catalog ? [`catalogue/e2e-local-${catalog.library.replaceAll("-", "").slice(0, 16)}/local-service?release=${catalog.release}`] : [],
      client: visual ? [
        `client/demandes/${visual.request}`,
        `client/demandes/${visual.request}/comparaison?rfq=${visual.rfq}&organizationId=${clientOrganizationId}`,
        `client/demandes/${visual.request}/offres?rfq=${visual.rfq}&organizationId=${clientOrganizationId}`,
        `client/demandes/${visual.request}/offres/${visual.quote}?organizationId=${clientOrganizationId}`,
        `client/litiges/${visual.dispute}?organizationId=${clientOrganizationId}`,
        `client/diagnostics/${visual.diagnostic}?organizationId=${clientOrganizationId}`,
      ] : [],
      provider: visual ? [
        `sous-traitant/consultations/${visual.invitation}?organizationId=${providerOrganizationId}`,
        `sous-traitant/devis/${visual.quote}?organizationId=${providerOrganizationId}`,
        `sous-traitant/devis/${visual.quote}/apercu?organizationId=${providerOrganizationId}`,
        `sous-traitant/devis/${visual.quote}/revision?organizationId=${providerOrganizationId}`,
        `sous-traitant/litiges/${visual.dispute}?organizationId=${providerOrganizationId}`,
        `sous-traitant/messages/${visual.thread}?organizationId=${providerOrganizationId}`,
        `sous-traitant/documents/${visual.providerDocumentVersion}?organizationId=${providerOrganizationId}`,
      ] : [],
      franchise: visual ? [
        `franchise/documents/${visual.providerDocumentVersion}?organizationId=${providerOrganizationId}&franchiseId=${roleFixture.franchiseId}`,
        `franchise/invitations/${visual.franchiseInvitation}?organizationId=${providerOrganizationId}&franchiseId=${roleFixture.franchiseId}`,
        `franchise/fournisseurs/contrats/${visual.providerCompanyDecision}?organizationId=${providerOrganizationId}&franchiseId=${roleFixture.franchiseId}`,
        `franchise/questionnaires/${visual.questionnaire}?organizationId=${providerOrganizationId}&franchiseId=${roleFixture.franchiseId}`,
        `franchise/questionnaires/${visual.questionnaire}/apercu?organizationId=${providerOrganizationId}&franchiseId=${roleFixture.franchiseId}`,
        `franchise/questions/${visual.question}?organizationId=${providerOrganizationId}&franchiseId=${roleFixture.franchiseId}`,
      ] : [],
      admin: [
        ...(roleFixture.visualAssistanceId ? [`administration/assistance/${roleFixture.visualAssistanceId}`] : []),
        ...(roleFixture.visualControlPlanId ? [`administration/gouvernance-franchise/plans/${roleFixture.visualControlPlanId}/responsable`] : []),
        ...(roleFixture.visualGovernanceRequestId ? [`administration/gouvernance-franchise/signalements/${roleFixture.visualGovernanceRequestId}`] : []),
        `administration/clients/${clientOrganizationId}`,
        `administration/entreprises/${clientOrganizationId}`,
        `administration/conformite-clients/${clientCaseId}`,
        `administration/providers/${providerOrganizationId}`,
        `administration/providers/${providerOrganizationId}/identite`,
        `administration/utilisateurs/${fixture.resources.userIds[0]}/roles`,
        "administration/v4-1/procurement",
      ],
    };
  })() : null;
  const environment = buildChildEnvironment(process.env, {
    ...(uiAuthManifest ? { E2E_LOCAL_UI_AUTH_MANIFEST: uiAuthManifest } : {}),
    PLAYWRIGHT_JSON_OUTPUT_FILE: resolve(outputDirectory, "browser-report.json"),
    E2E_BASE_URL: config.baseUrl,
    ...(visualOnly || visualDynamicOnly ? {
      E2E_VISUAL_MATRIX_SPACES: process.env.VISUAL_MATRIX_SPACES ?? "public,shared,client,provider,franchise,admin",
      E2E_VISUAL_MATRIX_LOCALES: process.env.VISUAL_MATRIX_LOCALES ?? "fr,ar",
      E2E_VISUAL_MATRIX_AXE: process.env.VISUAL_MATRIX_AXE ?? "0",
      E2E_VISUAL_MATRIX_RUN_ID: runToken,
      E2E_VISUAL_MATRIX_ROUTES: process.env.VISUAL_MATRIX_ROUTES ?? "",
      ...(visualSeedPaths ? { E2E_VISUAL_SEED_PATHS: JSON.stringify(visualSeedPaths) } : {}),
    } : {}),
    E2E_LOCAL_ISOLATED: config.runtimeMode === "isolated-local-docker" ? "1" : "0",
    ...(config.runtimeMode === "isolated-local-docker" ? { E2E_EXTERNAL_SERVER: "1" } : {}),
    E2E_CLIENT_STORAGE_STATE: statePaths.client,
    E2E_CLIENT_B_STORAGE_STATE: fixture.manifest.states.clientB.path,
    E2E_PROVIDER_STORAGE_STATE: statePaths.provider,
    E2E_FRANCHISE_STORAGE_STATE: statePaths.franchise,
    E2E_ADMIN_STORAGE_STATE: statePaths.admin,
    E2E_ROLE_ORGANIZATION_ID: roleFixture.organizationId,
    E2E_FRANCHISE_ID: roleFixture.franchiseId,
    E2E_FOREIGN_ORGANIZATION_NAME: fixture.manifest.fixtures.organizationB.name,
    E2E_P25_WORKFLOWS: JSON.stringify(roleFixture.workflows),
    E2E_P28_RUN_TOKEN: runToken,
    ...(fixture.resources.localCatalog ? {E2E_P28_SERVICE_VERSION_ID:fixture.resources.localCatalog.serviceVersion} : {}),
    E2E_CRON_SECRET: hash(`${runToken}:cron`),
    E2E_DELIVERY_PROOF_SCANNER_MODE: "SANDBOX",
    E2E_MARKETING_CHAIN_FIXTURE: JSON.stringify({content:{organizationId:roleFixture.organizationId,campaignId:roleFixture.marketing.campaignId,serviceId:roleFixture.marketing.serviceId,libraryId:roleFixture.marketing.libraryId,language:"FR",serviceName:roleFixture.marketing.serviceName,valueProposition:"Une valeur structurée et vérifiable.",primaryCta:"Diagnostiquer",trackedUrl:"https://matricia.ma/diagnostic",approvedHashtags:["#Matricia"],templateKey:"PROBLEM_SOLUTION",sourceHash:roleFixture.marketing.sourceHash,idempotencyKey:randomUUID()},attribution:{organizationId:roleFixture.organizationId,campaignId:roleFixture.marketing.campaignId,contentId:null,eventType:"CTA_CLICKED",source:"linkedin",medium:"social",visitorHash:hash(`${runToken}:visitor`),economicValueMinor:null,occurredAt:new Date().toISOString(),metadata:{utm_campaign:"p24-e2e"},idempotencyKey:randomUUID()}}),
  });
  const specifications = visualDynamicOnly ? ["tests/e2e/visual-dynamic-matrix.spec.ts"] : visualOnly ? ["tests/e2e/visual-route-matrix.spec.ts"] : functionalControlsOnly ? ["tests/e2e/local-functional-controls.spec.ts", "tests/e2e/local-notification-preferences.spec.ts", "tests/e2e/local-assisted-intelligence.spec.ts", "tests/e2e/local-profile-reassessment.spec.ts"] : localAuthOnly ? ["tests/e2e/local-auth-consent.spec.ts"] : marketingSpacesOnly ? ["tests/e2e/p24-marketing-completion.spec.ts","tests/e2e/authenticated-route-smoke.spec.ts"] : marketingOnly ? ["tests/e2e/p24-marketing-completion.spec.ts"] : businessSpacesOnly ? [
    "tests/e2e/p29-marketing-workspaces.spec.ts", "tests/e2e/p25-client-provider-completion.spec.ts",
    "tests/e2e/p26-transversal-completion.spec.ts", "tests/e2e/p28-reputation-checklists.spec.ts",
  ] : smokeOnly ? [
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
    ...(localAuthOnly || visualDynamicOnly ? ["--project=chromium-desktop"] : visualOnly && process.env.VISUAL_MATRIX_PROJECT ? [`--project=${process.env.VISUAL_MATRIX_PROJECT}`] : []),
    "--workers=1",
    "--retries=0",
    ...(process.env.E2E_FAIL_FAST === "1" ? ["--max-failures=1"] : []),
    "--reporter=line,json",
    "--output", outputDirectory,
  ], { cwd: root, env: environment, stdio: ["ignore", "pipe", "pipe"], shell: false });
  let playwrightOutput = "";
  let lastProgress = 0;
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    playwrightOutput += chunk;
    for (const match of chunk.matchAll(/\[(\d+)\/(\d+)\]/gu)) {
      const current = Number(match[1]), total = Number(match[2]);
      if (total === expectedTests && current > lastProgress && current <= total && (current % 8 === 0 || current === total)) {
        lastProgress = current;
        console.log(`E2E started ${current}/${total}; final result pending`);
      }
    }
  });
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
  let roleCleanupPassed = false;
  let localCleanupPassed = false;
  let sharedAuthCleanupPassed = false;
  let stage = "base-fixture";
  let localServer;
  try {
    stage = "configuration";
    const config = await loadSafeConfiguration(root);
    if ((fixtureProofsOnly || localAuthOnly) && config.runtimeMode !== "isolated-local-docker") throw new Error("Local fixture proofs require verified local Docker");
    stage = "base-fixture";
    fixture = await provision();
    await validateFreshManifest(fixture.manifest, config);
    if (config.runtimeMode === "isolated-local-docker") {
      stage = "local-deployment-binding";
      await fixture.resources.database.begin(async transaction => {
        const [binding] = await transaction`select environment from private.admin_execution_environment_v1 where singleton for update`;
        if (!binding || (binding.environment !== null && binding.environment !== "DEVELOPMENT")) throw new Error("LOCAL_DEPLOYMENT_BINDING_INVALID");
        if (binding.environment === null) {
          const [existing] = await transaction`select count(*)::int as count from private.admin_configuration_revisions_v1`;
          if (existing.count !== 0) throw new Error("LOCAL_DEPLOYMENT_CONFIGURATION_REQUIRES_REVIEW");
          // Infrastructure bootstrap for the verified local database only.
          // Retain the binding across runs; never overwrite an established environment.
          await transaction`update private.admin_execution_environment_v1 set environment='DEVELOPMENT',configured_at=clock_timestamp(),configuration_reference='verified-local-docker-e2e-bootstrap' where singleton and environment is null`;
        }
      });
    }
    stage = "role-fixture";
    roleFixture = await provisionProviderAndFranchise(fixture, (value) => { stage = value; });
    // The base fixture is a Compliance officer. Marketing administration needs
    // its own explicit platform permission; never broaden product authorization.
    stage = "admin-platform-role";
    const central = await fixture.sessions.central.client.auth.getUser();
    if (central.error || !central.data.user || !fixture.resources.userIds.includes(central.data.user.id)) throw new Error("FIXTURE_ADMIN_IDENTITY_INVALID");
    await fixture.resources.database`insert into public.platform_user_roles(user_id,role_code,granted_by) values(${central.data.user.id}::uuid,'MATRICIA_ADMIN',null)`;
    if (config.runtimeMode === "isolated-local-docker") {
      stage = "local-secondary-mandate";
      await provisionLocalSecondaryMandate(fixture, roleFixture);
    }
    stage = "role-isolation";
    await proveRoleIsolation(fixture, roleFixture);
    if (visualDynamicOnly) {
      stage = "visual-dynamic-business-records";
      await provisionVisualDynamicBusinessRecords(fixture, roleFixture);
    }
    if (functionalControlsOnly) {
      const [baseline] = await fixture.resources.database`select count(*)::integer as count from public.service_requests where client_organization_id=${fixture.manifest.fixtures.organizationA.id}::uuid`;
      roleFixture.assistanceBusinessRequestCount = baseline.count;
    }
    if (!fixtureProofsOnly) {
      stage = "authentication-states";
      const statePaths = await copyAndVerifyStates(fixture);
      stage = "playwright";
      if (config.runtimeMode === "isolated-local-docker") {
        localServer = ownedLocalHttpServer(root, config, {cronSecret: hash(`${runToken}:cron`)});
        await localServer.start();
      }
      let browserFailure;
      try { playwrightResult = await runPlaywright(config, fixture, roleFixture, statePaths); }
      catch (error) { browserFailure = error; throw error; }
      finally {
        if (localServer) {
          try { await localServer.stop(); localServer = undefined; }
          catch (cleanupError) {
            if (!browserFailure) throw cleanupError;
            const combined = new AggregateError([browserFailure, cleanupError], "Browser and owned server cleanup failed");
            combined.code = "BROWSER_AND_SERVER_CLEANUP_FAILED";
            combined.browserSummary = browserFailure.browserSummary;
            combined.playwrightDiagnostic = browserFailure.playwrightDiagnostic;
            throw combined;
          }
        }
      }
      if (localAuthOnly) {
        stage = "local-ui-consent-proof";
        roleFixture.localUiAuthProof = await verifyLocalUiAuthProof(fixture);
      }
      if (functionalControlsOnly) {
        stage = "functional-controls-proof";
        roleFixture.functionalControlsProof = await verifyFunctionalControls(fixture, roleFixture, runToken);
      }
      if (!functionalControlsOnly && !smokeOnly && !visualOnly && !visualDynamicOnly && !localAuthOnly && !marketingOnly && !marketingSpacesOnly) {
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
    if (localServer) {
      try { await localServer.stop(); }
      catch (error) { failure = combineFailure(failure, error, "Local HTTP server cleanup failed"); }
    }
    if (fixture && roleFixture) {
      try {
        await neutralizeRoleFixture(fixture.resources.database, roleFixture, fixture.resources.admin);
        roleCleanupPassed = true;
      } catch (error) {
        failure = combineFailure(failure, error, "P24-P26 run and role-fixture neutralization failed");
        stage = "role-fixture-neutralization";
        failureCode = sanitizedFailureCode(error);
      }
    }
    if (fixture) {
      try { await neutralizeLocalUiAuthFixture(fixture); }
      catch (error) { failure = combineFailure(failure, error, "Local UI authentication cleanup failed"); }
      try { await neutralizeLocalCatalogReference(fixture); }
      catch (error) { failure = combineFailure(failure, error, "Local reference catalogue cleanup failed"); stage = "local-catalog-neutralization"; failureCode = sanitizedFailureCode(error); }
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
    functionalControlsProof: roleFixture?.functionalControlsProof ?? null,
    mode: visualDynamicOnly ? "VISUAL_DYNAMIC_MATRIX_ONLY" : visualOnly ? "VISUAL_ROUTE_MATRIX_ONLY" : functionalControlsOnly ? "LOCAL_FUNCTIONAL_CONTROLS" : fixtureProofsOnly ? "LOCAL_FIXTURE_PROOFS_ONLY_NO_BROWSER_ACCEPTANCE" : localAuthOnly ? "LOCAL_UI_OTP_CONSENT_AND_MFA" : smokeOnly ? "AUTHENTICATED_ROUTE_SMOKE_ONLY" : marketingOnly ? "MARKETING_ONLY" : marketingSpacesOnly ? "MARKETING_AND_SPACES" : businessSpacesOnly ? "BUSINESS_SPACES_ONLY" : "FULL_P24_P26",
    status: failure ? "FAILED" : "PASSED",
    expectedTests,
    executedTests: playwrightResult?.executed ?? browserSummary?.executed ?? 0,
    browser: playwrightResult?.browserSummary ?? browserSummary ?? null,
    stage,
    failureCode: failure ? failureCode : null,
    diagnostic: failureDiagnostic,
    cleanup: { remoteFixturesNeutralized: remoteCleanupPassed && roleCleanupPassed, localAuthenticationArtifactsRemoved: localCleanupPassed },
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
      where organization.display_name=any(${[`P05 E2E rôles P24-P26 ${localRunToken}`, `P05 E2E rôles P24-P26 ${localRunToken.replaceAll("-", "")}`]}::text[])
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
    await retainBoundDeliveryObjects(database,admin,deliveryFiles);
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
        where organization.display_name=any(${[`P05 E2E rôles P24-P26 ${localRunToken}`, `P05 E2E rôles P24-P26 ${localRunToken.replaceAll("-", "")}`]}::text[]) and organization.status<>'ARCHIVED') as organizations,
      (select count(*)::integer from public.organization_memberships membership
        join public.organizations organization on organization.id=membership.organization_id
        where organization.display_name=any(${[`P05 E2E rôles P24-P26 ${localRunToken}`, `P05 E2E rôles P24-P26 ${localRunToken.replaceAll("-", "")}`]}::text[]) and membership.status<>'REVOKED') as memberships,
      (select count(*)::integer from public.organization_member_roles role
        join public.organization_memberships membership on membership.id=role.membership_id
        join public.organizations organization on organization.id=membership.organization_id
        where organization.display_name=any(${[`P05 E2E rôles P24-P26 ${localRunToken}`, `P05 E2E rôles P24-P26 ${localRunToken.replaceAll("-", "")}`]}::text[]) and role.revoked_at is null) as roles,
      (select count(*)::integer from public.franchises franchise
        join public.organizations organization on organization.id=franchise.operator_organization_id
        where organization.display_name=any(${[`P05 E2E rôles P24-P26 ${localRunToken}`, `P05 E2E rôles P24-P26 ${localRunToken.replaceAll("-", "")}`]}::text[]) and franchise.status='ACTIVE') as franchises`;
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
