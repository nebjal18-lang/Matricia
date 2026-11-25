import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import postgres from "postgres";
import { parseEnv, resolveExpectedDatabaseUrl } from "./p05-e2e/environment.mjs";

/**
 * Parcours démo déterministe pour les comptes déjà provisionnés :
 * diagnostic, demande ouverte, deux devis soumis, comparaison, contrat,
 * mission, livrable, litige, messagerie, conformité client, crédits,
 * file admin, relance franchise et plan qualité.
 * Idempotent. Restreint à development/staging. N'affiche aucun identifiant.
 */
const root = resolve(import.meta.dirname, "..");
const id = (seed) => {
  const chars = createHash("sha256").update(seed).digest("hex").slice(0, 32).split("");
  chars[12] = "4";
  chars[16] = ((Number.parseInt(chars[16], 16) & 3) | 8).toString(16);
  return `${chars.slice(0, 8).join("")}-${chars.slice(8, 12).join("")}-${chars.slice(12, 16).join("")}-${chars.slice(16, 20).join("")}-${chars.slice(20).join("")}`;
};
const digest = (value) => createHash("sha256").update(value).digest("hex");
const required = (value, name) => {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${name} is required`);
  return value.trim();
};

const profile = {
  legal_form: "SARL",
  incorporation_date: "2018-03-12",
  activity: "Conseil et services numériques de démonstration",
  sector: "Services",
  employee_count: 12,
  registered_city: "Agadir",
  registered_address: { line1: "12 rue de la démonstration" },
  contact: { phone: "+212528000000", email: "contact@demo-client.example.ma" },
  representative: {
    first_name: "Sara",
    last_name: "Démo",
    title: "Gérante",
    phone: "+212528000001",
    email: "gerance@demo-client.example.ma",
    power: "Représentation légale de la société de démonstration",
  },
  declarations: { accuracy_confirmed: true, representation_authorized: true },
  if_number: "00000001",
  rc_number: "00001",
};

async function userId(database, email) {
  const rows = await database`select id from auth.users where lower(email)=lower(${email}) limit 1`;
  if (!rows.length) throw new Error("A required demo identity is missing");
  return rows[0].id;
}

async function main() {
  const [source, metadataSource] = await Promise.all([
    readFile(resolve(root, ".env.local"), "utf8"),
    readFile(resolve(root, "supabase", "project-metadata.json"), "utf8"),
  ]);
  const env = { ...parseEnv(source), ...process.env };
  const metadata = JSON.parse(metadataSource);
  if (!new Set(["development", "staging"]).has(metadata.environment) || env.APP_ENV !== metadata.environment) {
    throw new Error("Demo provisioning is restricted to development/staging");
  }
  const projectRef = required(metadata.project_ref, "SUPABASE_PROJECT_REF");
  const url = required(env.NEXT_PUBLIC_SUPABASE_URL, "NEXT_PUBLIC_SUPABASE_URL");
  if (new URL(url).hostname !== `${projectRef}.supabase.co`) throw new Error("Supabase project mismatch");
  const database = postgres(
    resolveExpectedDatabaseUrl({
      databaseUrl: required(env.SUPABASE_DB_POOLER_URL || env.DIRECT_URL, "DIRECT_URL"),
      projectRef,
      region: required(metadata.region, "SUPABASE_REGION"),
    }),
    { max: 1, prepare: false, connect_timeout: 20 },
  );

  try {
    const clientUser = await userId(database, env.MATRICIA_DEMO_CLIENT_EMAIL || "demo.client@matricia.test");
    const providerUser = await userId(database, env.MATRICIA_DEMO_PROVIDER_EMAIL || "demo.prestataire@matricia.test");
    const franchiseUser = await userId(database, env.MATRICIA_DEMO_FRANCHISE_EMAIL || "demo.franchise@matricia.test");
    const adminUser = await userId(database, env.MATRICIA_DEMO_ADMIN_EMAIL || "demo.admin@matricia.test");

    const clientOrg = id(`${projectRef}:demo:IT:client-org`);
    const providerOrg = id(`${projectRef}:demo:IT:provider-org`);
    const compareOrg = id(`${projectRef}:demo:IT:compare-org`);
    const franchise = id(`${projectRef}:demo:franchise:franchise`);
    const operatorOrg = id(`${projectRef}:demo:franchise:operator-org`);
    const prospect = id(`${projectRef}:demo:franchise:prospect:atlas`);

    const library = await database`
      select id from public.catalog_libraries
      where code='IT' and status not in ('RETIRED','ARCHIVED') limit 1`;
    if (!library.length) throw new Error("The IT catalog library is required");
    const requestRows = await database`
      select id, service_id, library_id, client_organization_id, current_version_id, status
      from public.service_requests
      where client_organization_id=${clientOrg}::uuid and library_id=${library[0].id}::uuid
      order by created_at limit 1`;
    if (!requestRows.length || !requestRows[0].current_version_id) throw new Error("The IT demo service request is missing");
    const request = requestRows[0];
    const catalog = await database`
      select qv.id as questionnaire_version_id, qv.catalog_release_id as release_id
      from public.questionnaire_versions qv
      where qv.library_id=${request.library_id}::uuid and qv.catalog_release_id is not null
      order by qv.version desc
      limit 1`;
    if (!catalog.length) throw new Error("The IT library needs a questionnaire version bound to a catalog release");
    const queues = await database`
      select id, queue_key from public.admin_queue_versions where status='ACTIVE'`;
    const category = await database`
      select code from public.notification_preference_categories where status='ACTIVE' order by code limit 1`;
    const orgVersion = await database`select row_version from public.organizations where id=${clientOrg}::uuid`;
    if (!orgVersion.length) throw new Error("The IT demo client organization is missing");

    const requestVersion = id(`${request.id}:version:2`);
    const run = id(`${projectRef}:demo:journey:it:matching-run`);
    const candidateA = id(`${projectRef}:demo:journey:it:candidate:a`);
    const candidateB = id(`${projectRef}:demo:journey:it:candidate:b`);
    const rfq = id(`${projectRef}:demo:journey:it:rfq`);
    const inviteA = id(`${projectRef}:demo:journey:it:invite:a`);
    const inviteB = id(`${projectRef}:demo:journey:it:invite:b`);
    const quoteA = id(`${projectRef}:demo:journey:it:quote:a`);
    const quoteB = id(`${projectRef}:demo:journey:it:quote:b`);
    const versionA = id(`${projectRef}:demo:journey:it:quote-version:a`);
    const versionB = id(`${projectRef}:demo:journey:it:quote-version:b`);
    const snapshot = id(`${projectRef}:demo:journey:it:comparison`);
    const contract = id(`${projectRef}:demo:journey:it:contract`);
    const contractVersion = id(`${projectRef}:demo:journey:it:contract-version`);
    const mission = id(`${projectRef}:demo:journey:it:mission`);
    const milestone = id(`${projectRef}:demo:journey:it:milestone`);
    const deliverable = id(`${projectRef}:demo:journey:it:deliverable`);
    const dispute = id(`${projectRef}:demo:journey:it:dispute`);
    const thread = id(`${projectRef}:demo:journey:it:thread`);
    const participantClient = id(`${projectRef}:demo:journey:it:participant:client`);
    const participantProvider = id(`${projectRef}:demo:journey:it:participant:provider`);
    const messageClient = id(`${projectRef}:demo:journey:it:message:client`);
    const messageProvider = id(`${projectRef}:demo:journey:it:message:provider`);
    const session = id(`${projectRef}:demo:journey:it:questionnaire`);
    const diagnostic = id(`${projectRef}:demo:journey:it:diagnostic`);
    const anomaly = id(`${projectRef}:demo:journey:it:anomaly`);
    const recommendation = id(`${projectRef}:demo:journey:it:recommendation`);
    const opportunity = id(`${projectRef}:demo:journey:it:opportunity`);
    const compliance = id(`${projectRef}:demo:journey:it:compliance`);
    const profileVersion = id(`${projectRef}:demo:journey:it:profile`);
    const policy = id(`${projectRef}:demo:journey:franchise:followup-policy`);
    const preference = id(`${projectRef}:demo:journey:franchise:followup-preference`);
    const job = id(`${projectRef}:demo:journey:franchise:followup-job`);
    const plan = id(`${projectRef}:demo:journey:franchise:quality-plan`);
    const disputePolicy = {
      version: "DISPUTE-DEMO-V1",
      content_hash: digest(`${projectRef}:demo:dispute-policy`),
      response_hours: 48,
      urgent_response_hours: 8,
      correction_business_days: 5,
      review_business_days: 5,
      appeal_hours: 72,
    };
    const scorePolicy = {
      version: "DIAGNOSTIC-DEMO-V1",
      content_hash: digest(`${projectRef}:demo:diagnostic-policy`),
      thresholds: { good: 80, attention: 60, important: 40 },
    };

    await database.begin(async (tx) => {
      await tx`insert into public.organizations(id,legal_name,display_name,country_code,status,created_by)
        values(${compareOrg}::uuid,'Comparatif Démo IT','Comparatif Démo IT','MA','ACTIVE',${providerUser}::uuid)
        on conflict(id) do update set status='ACTIVE'`;
      await tx`insert into public.provider_profiles(provider_organization_id,company_status,overall_status,activity_summary,team_size,years_experience,partner_contract_status,partner_contract_expires_at,created_by)
        values(${compareOrg}::uuid,'VERIFIED','ACTIVE','Prestataire comparatif de démonstration pour la bibliothèque IT.',4,3,'SIGNED',clock_timestamp()+interval '1 year',${providerUser}::uuid)
        on conflict(provider_organization_id) do update set company_status='VERIFIED',overall_status='ACTIVE',partner_contract_status='SIGNED',partner_contract_expires_at=excluded.partner_contract_expires_at`;
      await tx`update public.provider_profiles set company_status='VERIFIED',overall_status='ACTIVE',partner_contract_status='SIGNED',partner_contract_expires_at=clock_timestamp()+interval '1 year',updated_at=clock_timestamp()
        where provider_organization_id=${providerOrg}::uuid`;
      await tx`insert into public.provider_services(id,provider_organization_id,service_id,request_status,requested_by,requested_at)
        values(${id(`${compareOrg}:${request.service_id}:service`)}::uuid,${compareOrg}::uuid,${request.service_id}::uuid,'DECIDED',${providerUser}::uuid,clock_timestamp())
        on conflict(provider_organization_id,service_id) do update set request_status='DECIDED',requested_at=coalesce(public.provider_services.requested_at,clock_timestamp())`;
      await tx`update public.provider_services set request_status='DECIDED',requested_at=coalesce(requested_at,clock_timestamp()),updated_at=clock_timestamp(),row_version=row_version+1
        where provider_organization_id=${providerOrg}::uuid and service_id=${request.service_id}::uuid and request_status<>'DECIDED'`;
      const services = await tx`
        select id, provider_organization_id from public.provider_services
        where service_id=${request.service_id}::uuid and provider_organization_id in (${providerOrg}::uuid, ${compareOrg}::uuid)`;
      if (services.length !== 2) throw new Error("Both demo provider services are required");
      for (const service of services) {
        const org = service.provider_organization_id;
        const actor = providerUser;
        await tx`insert into public.provider_company_decisions(id,provider_organization_id,decision_version,company_status,partner_contract_status,partner_contract_expires_at,reason,rule_version,decided_by,correlation_id)
          values(${id(`${org}:company:v1`)}::uuid,${org}::uuid,1,'VERIFIED','SIGNED',clock_timestamp()+interval '1 year','Société de démonstration vérifiée','DEMO-QUAL-V1',${adminUser}::uuid,${id(`${org}:company:correlation`)}::uuid)
          on conflict(provider_organization_id,decision_version) do nothing`;
        await tx`insert into public.provider_match_profiles(provider_organization_id,company_verified,documents_valid,financial_status,quality_status,capacity_status,region_codes,partner_contract_signed)
          values(${org}::uuid,true,true,'OK','OK','AVAILABLE',${tx.array(["CASABLANCA_SETTAT"])}::text[],true)
          on conflict(provider_organization_id) do update set company_verified=true,documents_valid=true,financial_status='OK',quality_status='OK',capacity_status='AVAILABLE',region_codes=excluded.region_codes,partner_contract_signed=true`;
        await tx`insert into public.provider_service_match_profiles(id,provider_organization_id,service_id,qualification_status,required_certifications_valid,service_fit_score,quality_score,historical_delay_score,experience_score,satisfaction_score)
          values(${id(`${org}:service-match`)}::uuid,${org}::uuid,${request.service_id}::uuid,'APPROVED',true,80,80,80,80,80)
          on conflict(provider_organization_id,service_id) do update set qualification_status='APPROVED',required_certifications_valid=true`;
        await tx`insert into public.provider_capacity_versions(id,provider_organization_id,service_id,version_number,capacity_status,available_units,lead_time_days,effective_from,reason,declared_by)
          values(${id(`${org}:capacity:v1`)}::uuid,${org}::uuid,${request.service_id}::uuid,1,'AVAILABLE',5,2,clock_timestamp()-interval '1 day','Capacité de démonstration',${actor}::uuid)
          on conflict(provider_organization_id,service_id,version_number) do nothing`;
        const providerSession = id(`${org}:qualification-session`);
        await tx`insert into public.questionnaire_sessions(id,organization_id,actor_user_id,library_id,catalog_release_id,questionnaire_version_id,audience,locale,status,submitted_at,answer_manifest,answer_manifest_hash)
          values(${providerSession}::uuid,${org}::uuid,${actor}::uuid,${request.library_id}::uuid,${catalog[0].release_id}::uuid,${catalog[0].questionnaire_version_id}::uuid,'PROVIDER','fr-MA','SUBMITTED',clock_timestamp(),'{}'::jsonb,${digest(`${providerSession}:answers`)})
          on conflict(id) do nothing`;
        const qualification = id(`${org}:qualification`);
        const decision = id(`${org}:qualification-decision`);
        await tx`insert into public.provider_qualifications(id,provider_service_id,provider_organization_id,service_id)
          values(${qualification}::uuid,${service.id}::uuid,${org}::uuid,${request.service_id}::uuid)
          on conflict(provider_service_id) do nothing`;
        await tx`insert into public.provider_qualification_decisions(id,qualification_id,provider_organization_id,service_id,decision_version,status,questionnaire_version_id,questionnaire_session_id,score_basis_points,mandatory_checks,blocking_conditions,rationale,rule_version,effective_from,expires_at,decided_by,correlation_id)
          values(${decision}::uuid,${qualification}::uuid,${org}::uuid,${request.service_id}::uuid,1,'APPROVED',${catalog[0].questionnaire_version_id}::uuid,${providerSession}::uuid,8000,'["IDENTITY"]'::jsonb,'[]'::jsonb,'Qualification de démonstration approuvée','DEMO-QUAL-V1',clock_timestamp()-interval '1 day',clock_timestamp()+interval '1 year',${adminUser}::uuid,${id(`${decision}:correlation`)}::uuid)
          on conflict(qualification_id,decision_version) do nothing`;
        await tx`update public.provider_qualifications set current_decision_id=${decision}::uuid where provider_service_id=${service.id}::uuid and current_decision_id is null`;
        for (const kind of ["LEGAL", "FISCAL", "INSURANCE"]) {
          const family = id(`${org}:doc:${kind}`);
          const version = id(`${org}:doc:${kind}:v1`);
          const scanResult = id(`${org}:doc:${kind}:scan-result`);
          const path = `demo/${org}/${kind}/qualification-evidence.pdf`;
          const contentHash = digest(`${version}:file`);
          await tx`insert into public.provider_document_families(id,provider_organization_id,document_kind,code,created_by)
            values(${family}::uuid,${org}::uuid,${kind},${`DEMO_${kind}`},${actor}::uuid)
            on conflict(provider_organization_id,code) do nothing`;
          await tx`insert into storage.objects(id,bucket_id,name,owner_id,metadata)
            values(${version}::uuid,'provider-qualification',${path},${actor}::uuid,${tx.json({ mimetype: "application/pdf", size: "128" })})
            on conflict do nothing`;
          await tx`insert into public.provider_document_upload_reservations(id,provider_organization_id,actor_user_id,storage_object_path,declared_mime_type,declared_size_bytes,expires_at)
            values(${id(`${version}:reservation`)}::uuid,${org}::uuid,${actor}::uuid,${path},'application/pdf',128,clock_timestamp()+interval '30 minutes')
            on conflict(storage_object_path) do nothing`;
          await tx`insert into public.provider_document_versions(id,family_id,provider_organization_id,version_number,status,issued_on,expires_on,storage_object_path,content_hash,metadata,change_reason,submitted_by)
            values(${version}::uuid,${family}::uuid,${org}::uuid,1,'SUBMITTED',current_date-30,current_date+365,${path},${contentHash},${tx.json({ declared_mime_type: "application/pdf", declared_size_bytes: 128 })},'Justificatif de démonstration',${actor}::uuid)
            on conflict(id) do nothing`;
          await tx`insert into public.provider_document_scan_jobs(document_version_id,provider_organization_id,storage_object_path,declared_sha256,declared_mime_type)
            values(${version}::uuid,${org}::uuid,${path},${contentHash},'application/pdf')
            on conflict(storage_object_path) do nothing`;
          const jobs = await tx`select id from public.provider_document_scan_jobs where storage_object_path=${path} and provider_organization_id=${org}::uuid limit 1`;
          if (jobs.length) {
            await tx`insert into private.provider_document_scan_results(id,upload_id,sequence,result,engine_code,engine_version,computed_sha256,correlation_id)
              values(${scanResult}::uuid,${jobs[0].id}::uuid,1,'CLEAN','DEMO_SCANNER','1.0',${contentHash},${id(`${scanResult}:correlation`)}::uuid)
              on conflict do nothing`;
            await tx`update public.provider_document_scan_jobs
              set scan_status='CLEAN', scanned_at=clock_timestamp(), current_scan_result_id=${scanResult}::uuid
              where id=${jobs[0].id}::uuid and scan_status='PENDING'`;
          }
          await tx`update public.provider_document_versions
            set status='VERIFIED', reviewed_by=${adminUser}::uuid, reviewed_at=clock_timestamp()
            where id=${version}::uuid and status='SUBMITTED'`;
        }
      }
      await tx`insert into public.service_request_versions(id,request_id,client_organization_id,library_id,version_number,description,urgency,currency_code,required_quote_data,required_fields_complete,catalog_snapshot_hash,questionnaire_snapshot_hash,change_reason,content_hash,created_by)
        values(${requestVersion}::uuid,${request.id}::uuid,${request.client_organization_id}::uuid,${request.library_id}::uuid,2,'Demande de démonstration IT ouverte aux prestataires de Casablanca.','NORMAL','MAD',${tx.json({ region_code: "CASABLANCA_SETTAT" })},true,${digest(`${request.id}:catalog:v2`)},${digest(`${request.id}:questionnaire:v2`)},'Ouverture de la démonstration',${digest(`${requestVersion}:content`)},${clientUser}::uuid)
        on conflict(request_id,version_number) do nothing`;
      await tx`update public.service_requests set current_version_id=${requestVersion}::uuid, updated_at=clock_timestamp(), row_version=row_version+1
        where id=${request.id}::uuid and current_version_id is distinct from ${requestVersion}::uuid`;
      await tx`insert into public.matching_runs(id,request_id,request_version_id,policy_version,status,target_panel_size,started_by,completed_at)
        values(${run}::uuid,${request.id}::uuid,${requestVersion}::uuid,'MATCH-V1','COMPLETED',2,${clientUser}::uuid,clock_timestamp())
        on conflict(id) do nothing`;
      await tx`insert into public.matching_candidates(id,matching_run_id,provider_organization_id,eligible,score_basis_points,score_explanation,rotation_component)
        values(${candidateA}::uuid,${run}::uuid,${providerOrg}::uuid,true,9200,'{}'::jsonb,40)
        on conflict(id) do nothing`;
      await tx`insert into public.matching_candidates(id,matching_run_id,provider_organization_id,eligible,score_basis_points,score_explanation,rotation_component)
        values(${candidateB}::uuid,${run}::uuid,${compareOrg}::uuid,true,8100,'{}'::jsonb,60)
        on conflict(id) do nothing`;
      await tx`insert into public.rfqs(id,request_id,request_version_id,matching_run_id,deadline,status,invited_count,opened_by)
        values(${rfq}::uuid,${request.id}::uuid,${requestVersion}::uuid,${run}::uuid,clock_timestamp()+interval '14 days','OPEN',2,${clientUser}::uuid)
        on conflict(id) do nothing`;
      await tx`insert into public.rfq_providers(id,rfq_id,provider_organization_id,matching_candidate_id,status,responded_at)
        values(${inviteA}::uuid,${rfq}::uuid,${providerOrg}::uuid,${candidateA}::uuid,'ACCEPTED',clock_timestamp())
        on conflict(id) do nothing`;
      await tx`insert into public.rfq_providers(id,rfq_id,provider_organization_id,matching_candidate_id,status,responded_at)
        values(${inviteB}::uuid,${rfq}::uuid,${compareOrg}::uuid,${candidateB}::uuid,'ACCEPTED',clock_timestamp())
        on conflict(id) do nothing`;
      await tx`insert into public.quotes(id,rfq_id,rfq_provider_id,provider_organization_id,status,created_by)
        values(${quoteA}::uuid,${rfq}::uuid,${inviteA}::uuid,${providerOrg}::uuid,'SUBMITTED',${providerUser}::uuid)
        on conflict(id) do nothing`;
      await tx`insert into public.quotes(id,rfq_id,rfq_provider_id,provider_organization_id,status,created_by)
        values(${quoteB}::uuid,${rfq}::uuid,${inviteB}::uuid,${compareOrg}::uuid,'SUBMITTED',${providerUser}::uuid)
        on conflict(id) do nothing`;
      await tx`insert into public.quote_versions(id,quote_id,rfq_id,provider_organization_id,version_number,lifecycle_status,change_reason,currency,solution_fr,deliverables,warranty_fr,correction_terms_fr,proposed_start_date,duration_days,valid_until,subtotal_minor,tax_minor,total_minor,recurring_subtotal_minor,calculation_basis,content_hash,submitted_at,created_by)
        values(${versionA}::uuid,${quoteA}::uuid,${rfq}::uuid,${providerOrg}::uuid,1,'SUBMITTED','Offre de démonstration soumise','MAD','Audit et mise en service du périmètre IT de démonstration.',${tx.json(["Rapport d'audit", "Plan de mise en œuvre"])},'Garantie corrective de 30 jours','Corrections incluses pendant 10 jours ouvrés',current_date+14,21,clock_timestamp()+interval '30 days',1000000,200000,1200000,0,'{"money":"MINOR_UNITS"}'::jsonb,${digest(`${versionA}:content`)},clock_timestamp(),${providerUser}::uuid)
        on conflict(id) do nothing`;
      await tx`insert into public.quote_versions(id,quote_id,rfq_id,provider_organization_id,version_number,lifecycle_status,change_reason,currency,solution_fr,deliverables,warranty_fr,correction_terms_fr,proposed_start_date,duration_days,valid_until,subtotal_minor,tax_minor,total_minor,recurring_subtotal_minor,calculation_basis,content_hash,submitted_at,created_by)
        values(${versionB}::uuid,${quoteB}::uuid,${rfq}::uuid,${compareOrg}::uuid,1,'SUBMITTED','Offre comparative de démonstration soumise','MAD','Accompagnement IT comparatif, plus long et plus cher.',${tx.json(["Diagnostic", "Accompagnement", "Restitution"])},'Garantie corrective de 15 jours','Corrections incluses pendant 5 jours ouvrés',current_date+21,35,clock_timestamp()+interval '30 days',1800000,360000,2160000,0,'{"money":"MINOR_UNITS"}'::jsonb,${digest(`${versionB}:content`)},clock_timestamp(),${providerUser}::uuid)
        on conflict(id) do nothing`;
      await tx`update public.quotes set current_version_id=${versionA}::uuid where id=${quoteA}::uuid and current_version_id is null`;
      await tx`update public.quotes set current_version_id=${versionB}::uuid where id=${quoteB}::uuid and current_version_id is null`;
      await tx`update public.service_requests set status='QUOTES_RECEIVED', updated_at=clock_timestamp(), row_version=row_version+1
        where id=${request.id}::uuid and status='DRAFT'`;

      const comparison = {
        criteria: ["total_minor", "duration_days", "deliverables_count"],
        tax_basis: "VERSIONED_MA_RULE_PER_LINE",
        rows: [
          {
            quote_id: quoteA,
            quote_version_id: versionA,
            provider_organization_id: providerOrg,
            version_number: 1,
            currency: "MAD",
            subtotal_minor: 1000000,
            tax_minor: 200000,
            total_minor: 1200000,
            recurring_subtotal_minor: 0,
            duration_days: 21,
            deliverables_count: 2,
            valid_until: new Date(Date.now() + 30 * 86400000).toISOString(),
            price_rank: 1,
            explanation: ["Montant le plus bas en centimes"],
          },
          {
            quote_id: quoteB,
            quote_version_id: versionB,
            provider_organization_id: compareOrg,
            version_number: 1,
            currency: "MAD",
            subtotal_minor: 1800000,
            tax_minor: 360000,
            total_minor: 2160000,
            recurring_subtotal_minor: 0,
            duration_days: 35,
            deliverables_count: 3,
            valid_until: new Date(Date.now() + 30 * 86400000).toISOString(),
            price_rank: 2,
            explanation: ["Montant plus élevé en centimes"],
          },
        ],
      };
      await tx`insert into public.quote_comparison_snapshots(id,rfq_id,client_organization_id,normalization_version,quote_version_ids,currency,comparison,input_hash,created_by)
        values(${snapshot}::uuid,${rfq}::uuid,${clientOrg}::uuid,'QUOTE_COMPARE_V1',${tx.array([versionA, versionB])}::uuid[],'MAD',${tx.json(comparison)},${digest(`${rfq}:comparison`)},${clientUser}::uuid)
        on conflict(id) do nothing`;

      await tx`insert into public.contracts(id,client_organization_id,provider_organization_id,status,current_version,created_by)
        values(${contract}::uuid,${clientOrg}::uuid,${providerOrg}::uuid,'ACTIVE',1,${clientUser}::uuid)
        on conflict(id) do nothing`;
      await tx`alter table public.contract_versions disable trigger contract_versions_bind_selected_quote`;
      await tx`insert into public.contract_versions(id,contract_id,version,selected_quote_version_id,request_snapshot,quote_snapshot,clauses,price_minor,currency,commission_rule_snapshot,content_hash,change_reason,created_by)
        values(${contractVersion}::uuid,${contract}::uuid,1,${versionA}::uuid,'{}'::jsonb,${tx.json({ quote_version_id: versionA })},'{}'::jsonb,1200000,'MAD',${tx.json({ commission_basis_points: 1000 })},${digest(`${contractVersion}:content`)},'Contrat de démonstration',${clientUser}::uuid)
        on conflict(id) do nothing`;
      await tx`alter table public.contract_versions enable trigger contract_versions_bind_selected_quote`;
      await tx`insert into public.missions(id,contract_id,contract_version_id,client_organization_id,provider_organization_id,status,started_at,created_by)
        values(${mission}::uuid,${contract}::uuid,${contractVersion}::uuid,${clientOrg}::uuid,${providerOrg}::uuid,'ACTIVE',clock_timestamp(),${clientUser}::uuid)
        on conflict(id) do nothing`;
      await tx`insert into public.mission_milestones(id,mission_id,milestone_key,title_fr,title_ar,sort_order,owner_organization_id)
        values(${milestone}::uuid,${mission}::uuid,'M1','Jalon de démonstration','مرحلة تجريبية',1,${providerOrg}::uuid)
        on conflict(id) do nothing`;
      await tx`insert into public.deliverables(id,mission_id,milestone_id,deliverable_key,label_fr,label_ar,proof_required,current_version,status)
        values(${deliverable}::uuid,${mission}::uuid,${milestone}::uuid,'D1','Livrable de démonstration','تسليم تجريبي',true,1,'SUBMITTED')
        on conflict(id) do nothing`;
      await tx`insert into public.dispute_cases(id,mission_id,contract_id,contract_version_id,client_organization_id,provider_organization_id,obligation_key,description,urgency,status,policy_snapshot,response_due_at,opened_by)
        values(${dispute}::uuid,${mission}::uuid,${contract}::uuid,${contractVersion}::uuid,${clientOrg}::uuid,${providerOrg}::uuid,'DEMO_DELAY','Le jalon de démonstration dépasse le délai annoncé au client.', 'STANDARD','WARNING_LEVEL_1',${tx.json(disputePolicy)},clock_timestamp()+interval '2 days',${clientUser}::uuid)
        on conflict(id) do nothing`;

      await tx`insert into public.internal_message_threads(id,object_type,object_id,service_request_id,client_organization_id,provider_organization_id,subject,created_by)
        values(${thread}::uuid,'RFQ',${rfq}::uuid,${request.id}::uuid,${clientOrg}::uuid,${providerOrg}::uuid,'Clarification du périmètre IT',${clientUser}::uuid)
        on conflict(id) do nothing`;
      await tx`insert into public.internal_message_participants(id,thread_id,organization_id,participant_kind,display_alias)
        values(${participantClient}::uuid,${thread}::uuid,${clientOrg}::uuid,'CLIENT','CLIENT')
        on conflict(id) do nothing`;
      await tx`insert into public.internal_message_participants(id,thread_id,organization_id,participant_kind,display_alias)
        values(${participantProvider}::uuid,${thread}::uuid,${providerOrg}::uuid,'PROVIDER','PROVIDER')
        on conflict(id) do nothing`;
      await tx`insert into public.internal_messages(id,thread_id,sender_participant_id,sender_organization_id,sender_user_id,body,idempotency_key)
        values(${messageClient}::uuid,${thread}::uuid,${participantClient}::uuid,${clientOrg}::uuid,${clientUser}::uuid,'Pouvez-vous confirmer le délai de 21 jours ?','demo-journey-client-message')
        on conflict(id) do nothing`;
      await tx`insert into public.internal_messages(id,thread_id,sender_participant_id,sender_organization_id,sender_user_id,body,idempotency_key)
        values(${messageProvider}::uuid,${thread}::uuid,${participantProvider}::uuid,${providerOrg}::uuid,${providerUser}::uuid,'Le délai de 21 jours est confirmé pour le périmètre décrit.','demo-journey-provider-message')
        on conflict(id) do nothing`;

      if (catalog.length) {
        await tx`insert into public.questionnaire_sessions(id,organization_id,actor_user_id,library_id,catalog_release_id,questionnaire_version_id,audience,locale,status,submitted_at,answer_manifest,answer_manifest_hash)
          values(${session}::uuid,${clientOrg}::uuid,${clientUser}::uuid,${request.library_id}::uuid,${catalog[0].release_id}::uuid,${catalog[0].questionnaire_version_id}::uuid,'CLIENT','fr-MA','SUBMITTED',clock_timestamp(),'{}'::jsonb,${digest(`${session}:answers`)})
          on conflict(id) do nothing`;
        await tx`insert into public.diagnostic_runs(id,organization_id,questionnaire_session_id,library_id,status,input_manifest_hash,scoring_policy_snapshot,overall_score,rating,explanation,completed_by,correlation_id)
          values(${diagnostic}::uuid,${clientOrg}::uuid,${session}::uuid,${request.library_id}::uuid,'COMPLETED',${digest(`${session}:answers`)},${tx.json(scorePolicy)},55.00,'IMPORTANT','{}'::jsonb,${clientUser}::uuid,${id(`${diagnostic}:correlation`)}::uuid)
          on conflict(id) do nothing`;
        await tx`insert into public.diagnostic_anomalies(id,diagnostic_run_id,organization_id,anomaly_code,severity,blocking,title_fr,title_ar,explanation,rule_snapshot)
          values(${anomaly}::uuid,${diagnostic}::uuid,${clientOrg}::uuid,'HEALTH_SCORE_IMPORTANT','HIGH',false,'Score de santé à traiter','درجة الصحة تحتاج معالجة',${tx.json({ score: 55 })},${tx.json({ version: "DIAGNOSTIC-DEMO-V1" })})
          on conflict(id) do nothing`;
        await tx`insert into public.diagnostic_recommendations(id,diagnostic_run_id,organization_id,anomaly_id,recommendation_key,priority,title_fr,title_ar,client_text_fr,client_text_ar,service_id,solution_level,rule_snapshot)
          values(${recommendation}::uuid,${diagnostic}::uuid,${clientOrg}::uuid,${anomaly}::uuid,'DEMO_IT_ACTION',40,'Renforcer le socle IT','تعزيز الأساس التقني','Un accompagnement IT est recommandé sur le service de démonstration.','يوصى بمرافقة تقنية على خدمة التجربة.',${request.service_id}::uuid,'ASSISTED','{}'::jsonb)
          on conflict(id) do nothing`;
        await tx`insert into public.diagnostic_opportunities(id,organization_id,diagnostic_run_id,anomaly_id,recommendation_id,service_id,solution_level,priority,known_data,missing_fields)
          values(${opportunity}::uuid,${clientOrg}::uuid,${diagnostic}::uuid,${anomaly}::uuid,${recommendation}::uuid,${request.service_id}::uuid,'ASSISTED',40,${tx.json({ diagnostic_score: 55, rating: "IMPORTANT" })},'[]'::jsonb)
          on conflict(id) do nothing`;
      }

      await tx`insert into public.client_compliance_cases(id,organization_id,status,created_by)
        values(${compliance}::uuid,${clientOrg}::uuid,'PROFILE_IN_PROGRESS',${clientUser}::uuid)
        on conflict(id) do nothing`;
      await tx`insert into public.client_profile_versions(id,compliance_case_id,organization_id,version,profile_data,organization_snapshot,source_organization_row_version,created_by)
        values(${profileVersion}::uuid,${compliance}::uuid,${clientOrg}::uuid,1,${tx.json(profile)},${tx.json({ display_name: "Client · IT" })},${orgVersion[0].row_version},${clientUser}::uuid)
        on conflict(id) do nothing`;
      await tx`update public.client_compliance_cases set current_profile_version=1
        where id=${compliance}::uuid and current_profile_version is null`;

      await tx`insert into public.credit_wallets(id,organization_id,wallet_type)
        values(${id(`${clientOrg}:wallet`)}::uuid,${clientOrg}::uuid,'CLIENT')
        on conflict(organization_id, wallet_type) do nothing`;
      await tx`insert into public.credit_wallets(id,organization_id,wallet_type)
        values(${id(`${providerOrg}:wallet`)}::uuid,${providerOrg}::uuid,'PROVIDER')
        on conflict(organization_id, wallet_type) do nothing`;
      await tx`insert into public.credit_wallets(id,organization_id,wallet_type)
        values(${id(`${operatorOrg}:wallet`)}::uuid,${operatorOrg}::uuid,'FRANCHISE')
        on conflict(organization_id, wallet_type) do nothing`;
      const wallets = await tx`select id, organization_id, wallet_type from public.credit_wallets
        where organization_id in (${clientOrg}::uuid, ${providerOrg}::uuid, ${operatorOrg}::uuid)`;
      for (const wallet of wallets) {
        const actor = wallet.wallet_type === "PROVIDER" ? providerUser : wallet.wallet_type === "FRANCHISE" ? franchiseUser : clientUser;
        await tx`insert into public.credit_ledger_entries(organization_id,wallet_id,entry_type,quantity,idempotency_scope,idempotency_key,correlation_id,reference_type,reference_id,created_by)
          values(${wallet.organization_id}::uuid,${wallet.id}::uuid,'GRANT',500,'demo-journey','initial-grant',${id(`${wallet.id}:grant`)}::uuid,'demo_wallet',${wallet.id}, ${actor}::uuid)
          on conflict(organization_id, idempotency_scope, idempotency_key) do nothing`;
      }

      if (category.length) {
        const preferences = [
          [clientUser, clientOrg],
          [providerUser, providerOrg],
          [franchiseUser, operatorOrg],
        ];
        for (const [user, organization] of preferences) {
          await tx`insert into public.user_notification_preferences(id,user_id,organization_id,category_code,channel,delivery_mode,locale)
            values(${id(`${user}:${organization}:${category[0].code}`)}::uuid,${user}::uuid,${organization}::uuid,${category[0].code},'IN_APP','IMMEDIATE','fr-MA')
            on conflict(user_id, organization_id, category_code, channel) do nothing`;
        }
      }

      const work = [
        ["EXECUTIVE_TODAY", "DISPUTE", "dispute_case", dispute, "Litige client à instruire", "نزاع عميل للمعالجة", "HIGH"],
        ["CENTRAL_APPROVALS", "APPROVAL", "provider_service", providerOrg, "Qualification prestataire à décider", "تأهيل مقاول للقرار", "MEDIUM"],
        ["EXCEPTIONS", "EXCEPTION", "service_request", request.id, "Demande IT avec devis à comparer", "طلب تقني مع عروض للمقارنة", "MEDIUM"],
        ["RISK_FLAGS", "RISK_FLAG", "diagnostic_run", diagnostic, "Score diagnostic IT sous le seuil", "درجة التشخيص تحت الحد", "HIGH"],
      ];
      for (const [queueKey, source, resourceType, resourceId, titleFr, titleAr, priority] of work) {
        const queue = queues.find((item) => item.queue_key === queueKey);
        if (!queue) continue;
        await tx`insert into public.admin_work_items(id,queue_version_id,organization_id,source_kind,resource_type,resource_id,title_fr,title_ar,priority,due_at,created_by)
          values(${id(`${projectRef}:demo:journey:work:${queueKey}`)}::uuid,${queue.id}::uuid,${clientOrg}::uuid,${source},${resourceType},${resourceId},${titleFr},${titleAr},${priority},clock_timestamp()+interval '2 days',${adminUser}::uuid)
          on conflict(id) do update set
            title_fr = excluded.title_fr,
            title_ar = excluded.title_ar,
            priority = excluded.priority,
            due_at = excluded.due_at,
            row_version = public.admin_work_items.row_version + 1
          where public.admin_work_items.status in ('OPEN', 'CLAIMED', 'WAITING_INFORMATION')`;
      }

      await tx`insert into public.franchise_followup_policy_versions(id,franchise_id,version,status,eligible_stages,reminder_delays_minutes,retry_delays_minutes,maximum_attempts,maximum_reminders_per_7_days,lease_seconds,effective_from,change_reason,content_hash,proposed_by)
        values(${policy}::uuid,${franchise}::uuid,1,'PENDING_APPROVAL',${tx.array(["REGISTERED", "VERIFIED"])}::text[],${tx.array([1440, 4320])}::int[],${tx.array([60, 180])}::int[],3,2,120,clock_timestamp()-interval '7 days','Politique de relance de démonstration',${digest(`${policy}:content`)},${franchiseUser}::uuid)
        on conflict(id) do nothing`;
      await tx`update public.franchise_followup_policy_versions
        set status='ACTIVE', approved_by=${adminUser}::uuid, approved_at=clock_timestamp()
        where id=${policy}::uuid and status='PENDING_APPROVAL'`;
      await tx`insert into public.franchise_followup_preference_versions(id,franchise_id,prospect_id,version,contact_allowed,email_allowed,locale,time_zone,quiet_hours_start,quiet_hours_end,maximum_reminders_per_7_days,change_reason,content_hash,created_by)
        values(${preference}::uuid,${franchise}::uuid,${prospect}::uuid,1,true,true,'fr','Africa/Casablanca','22:00','08:00',2,'Préférence de contact de démonstration',${digest(`${preference}:content`)},${franchiseUser}::uuid)
        on conflict(id) do nothing`;
      await tx`insert into public.franchise_followup_jobs(id,franchise_id,prospect_id,policy_version_id,preference_version_id,followup_anchor_at,reminder_ordinal,channel,locale,next_attempt_at,maximum_attempts_snapshot,retry_delays_minutes_snapshot,lease_seconds_snapshot,correlation_id)
        values(${job}::uuid,${franchise}::uuid,${prospect}::uuid,${policy}::uuid,${preference}::uuid,clock_timestamp()-interval '1 day',1,'EMAIL','fr',clock_timestamp()+interval '1 day',3,${tx.array([60, 180])}::int[],120,${id(`${job}:correlation`)}::uuid)
        on conflict(id) do nothing`;
      await tx`insert into public.franchise_corrective_plan_versions(id,franchise_id,plan_key,version,status,objectives,actions,due_on,content_hash,created_by)
        values(${plan}::uuid,${franchise}::uuid,'DEMO_QUALITY',1,'PROPOSED',${tx.json([{ key: "RESPONSE_TIME", title_fr: "Réduire le délai de réponse" }])},${tx.json([{ key: "CALL_PROSPECTS", title_fr: "Relancer les prospects en retard" }])},current_date+30,${digest(`${plan}:content`)},${franchiseUser}::uuid)
        on conflict(id) do nothing`;
    });

    const counts = await database`
      select
        (select count(*) from public.rfqs where id=${rfq}::uuid) as rfqs,
        (select count(*) from public.quotes where rfq_id=${rfq}::uuid and status='SUBMITTED') as quotes,
        (select count(*) from public.missions where id=${mission}::uuid) as missions,
        (select count(*) from public.dispute_cases where id=${dispute}::uuid) as disputes,
        (select count(*) from public.diagnostic_runs where id=${diagnostic}::uuid) as diagnostics,
        (select count(*) from public.admin_work_items where created_by=${adminUser}::uuid and resource_id in (${dispute}, ${request.id}, ${diagnostic}, ${providerOrg})) as work_items,
        (select count(*) from public.franchise_followup_jobs where id=${job}::uuid) as followups,
        (select count(*) from public.franchise_corrective_plan_versions where id=${plan}::uuid) as quality_plans`;
    console.log(`PASS demo journey seeded ${JSON.stringify(counts[0])}`);
  } finally {
    await database.end({ timeout: 2 });
  }
}

try {
  await main();
} catch (error) {
  console.error(`FAIL ${error instanceof Error ? error.message : "demo journey provisioning failed"}; no credential was printed`);
  process.exitCode = 1;
}
