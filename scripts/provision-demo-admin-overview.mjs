import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import postgres from "postgres";
import { parseEnv, resolveExpectedDatabaseUrl } from "./p05-e2e/environment.mjs";

/**
 * Peuplement déterministe des files Administration (Acteurs + Parcours + files
 * sensibles) pour le persona démo admin. Complète provision-demo-journey.
 * Idempotent. Restreint à development/staging. N'affiche aucun secret.
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
    const franchise = id(`${projectRef}:demo:franchise:franchise`);
    const contract = id(`${projectRef}:demo:journey:it:contract`);
    const contractVersion = id(`${projectRef}:demo:journey:it:contract-version`);

    const capabilityAction = id(`${projectRef}:demo:admin:capability-action`);
    const capabilityWork = id(`${projectRef}:demo:admin:capability-work`);
    const franchiseApplication = id(`${projectRef}:demo:admin:franchise-application`);
    const dsr = id(`${projectRef}:demo:admin:dsr-access`);
    const processing = id(`${projectRef}:demo:admin:processing`);
    const category = id(`${projectRef}:demo:admin:data-category`);
    const retentionPolicy = id(`${projectRef}:demo:admin:retention-policy`);
    const retentionAction = id(`${projectRef}:demo:admin:retention-action`);
    const privacyWork = id(`${projectRef}:demo:admin:privacy-work`);
    const changeRequest = id(`${projectRef}:demo:admin:change-request`);
    const amendment = id(`${projectRef}:demo:admin:amendment`);
    const invitation = id(`${projectRef}:demo:admin:invitation`);
    const subjectHash = digest(`${clientOrg}:${clientUser}:demo-dsr`);

    const membership = await database`
      select id from public.organization_memberships
      where organization_id=${clientOrg}::uuid and user_id=${clientUser}::uuid and status='ACTIVE' limit 1`;
    if (!membership.length) throw new Error("The IT demo client membership is missing — run demo:provision and demo:journey first");

    const contractRow = await database`select id from public.contracts where id=${contract}::uuid`;
    if (!contractRow.length) throw new Error("The IT demo contract is missing — run demo:journey first");

    const queues = await database`select id, queue_key from public.admin_queue_versions where status='ACTIVE'`;
    const queueId = (key) => queues.find((item) => item.queue_key === key)?.id;

    await database.begin(async (tx) => {
      await tx`update private.admin_execution_environment_v1 set environment='DEVELOPMENT' where singleton and environment is distinct from 'DEVELOPMENT'`;

      // Revues de capacités
      await tx`
        insert into public.admin_operational_action_requests(
          id, organization_id, action_type, target_environment, resource_type, resource_id,
          request_payload_hash, redacted_summary, reason, approvals_required, status, requested_by, authorized_at, executed_at
        ) values (
          ${capabilityAction}::uuid, ${clientOrg}::uuid, 'CHANGE_CONFIGURATION', 'DEVELOPMENT', 'MEMBERSHIP', ${clientUser},
          ${digest(`${capabilityAction}:payload`)},
          ${tx.json({
            currentRole: "CLIENT_OWNER",
            newRole: "CLIENT_ADMIN",
            capabilities: ["seeUsers", "sendInvites", "accessDocs"],
            userId: clientUser,
          })},
          'Demande de capacités supplémentaires pour le parcours démo Administration',
          1, 'EXECUTED', ${adminUser}::uuid, clock_timestamp(), clock_timestamp()
        )
        on conflict (id) do nothing`;
      await tx`
        insert into public.admin_membership_capability_reviews_v1(action_request_id, membership_id, requested_capabilities, status)
        values (${capabilityAction}::uuid, ${membership[0].id}::uuid, ${tx.array(["seeUsers", "sendInvites", "accessDocs"])}::text[], 'PENDING_POLICY_REVIEW')
        on conflict (action_request_id) do nothing`;
      if (queueId("CENTRAL_APPROVALS")) {
        await tx`
          insert into public.admin_work_items(
            id, queue_version_id, organization_id, source_kind, resource_type, resource_id,
            title_fr, title_ar, priority, due_at, redacted_context, created_by
          ) values (
            ${capabilityWork}::uuid, ${queueId("CENTRAL_APPROVALS")}::uuid, ${clientOrg}::uuid, 'MANUAL_REVIEW',
            'membership_capability_review', ${capabilityAction},
            'Revoir les capacités demandées pour ce rôle', 'مراجعة القدرات المطلوبة لهذا الدور',
            'MEDIUM', clock_timestamp() + interval '2 days',
            ${tx.json({ membership_id: membership[0].id, action_request_id: capabilityAction, effective_access: "ROLE_RLS" })},
            ${adminUser}::uuid
          )
          on conflict (id) do update set
            due_at = excluded.due_at,
            row_version = public.admin_work_items.row_version + 1
          where public.admin_work_items.status in ('OPEN', 'CLAIMED', 'WAITING_INFORMATION')`;
      }

      // Candidatures franchise
      await tx`
        insert into public.franchise_applications(
          id, applicant_name, reply_email, territory_code, professional_profile, domain_label,
          availability_label, motivation, locale, status, ip_hash
        ) values (
          ${franchiseApplication}::uuid,
          'Candidat Démo Matricia',
          'demo.candidat.franchise@matricia.test',
          'CASABLANCA_SETTAT',
          'Directeur commercial',
          'Communication et services digitaux',
          'Disponible sous 30 jours',
          'Je souhaite rejoindre le réseau Matricia pour développer la bibliothèque Communication sur Casablanca-Settat avec un accompagnement structuré.',
          'fr',
          'REGISTERED',
          ${digest(`${franchiseApplication}:ip`)}
        )
        on conflict (id) do nothing`;
      await tx`
        update public.franchise_applications
        set status = 'COMPANY_REVIEW', updated_at = clock_timestamp(), row_version = row_version + 1
        where id = ${franchiseApplication}::uuid and status = 'REGISTERED'`;
      await tx`
        insert into public.franchise_application_events(application_id, from_status, to_status, reason, actor_user_id, idempotency_key)
        values (
          ${franchiseApplication}::uuid, 'REGISTERED', 'COMPANY_REVIEW',
          'Passage en revue société pour peuplement démo Administration',
          ${adminUser}::uuid, 'demo-admin-overview:franchise-application:review'
        )
        on conflict (application_id, idempotency_key) do nothing`;

      // Confidentialité & droits
      await tx`
        insert into public.processing_activities(
          id, organization_id, activity_key, name_fr, name_ar, controller_role, systems, countries_regions, cndp_formality_status, created_by
        ) values (
          ${processing}::uuid, ${clientOrg}::uuid, 'demo-admin-privacy',
          'Traitement démo Administration', 'معالجة تجريبية للإدارة',
          'CONTROLLER', ${tx.array(["SUPABASE"])}::text[], ${tx.array(["MA"])}::text[], 'NOT_REQUIRED', ${adminUser}::uuid
        )
        on conflict (id) do nothing`;
      await tx`
        insert into public.data_categories(
          id, organization_id, processing_activity_id, category_key, label_fr, label_ar, data_subject_types, sensitivity, created_by
        ) values (
          ${category}::uuid, ${clientOrg}::uuid, ${processing}::uuid, 'demo-client-contacts',
          'Contacts client démo', 'جهات اتصال العميل التجريبية', ${tx.array(["USER"])}::text[], 'PERSONAL', ${adminUser}::uuid
        )
        on conflict (id) do nothing`;
      await tx`
        insert into public.retention_policies(
          id, organization_id, data_category_id, version, status, retention_days, trigger_event, disposition, legal_basis_reference, effective_from, created_by
        ) values (
          ${retentionPolicy}::uuid, ${clientOrg}::uuid, ${category}::uuid, 1, 'ACTIVE', 365, 'ACCOUNT_CLOSED', 'ANONYMIZE',
          'demo-admin-retention-policy', current_date - 7, ${adminUser}::uuid
        )
        on conflict (id) do nothing`;
      await tx`
        insert into public.data_subject_requests(
          id, organization_id, request_type, subject_reference_hash, identity_verification_level, locale, status, due_at, verified_at, correlation_id, created_by
        ) values (
          ${dsr}::uuid, ${clientOrg}::uuid, 'ACCESS', ${subjectHash}, 'ENHANCED', 'fr-MA', 'IN_REVIEW',
          clock_timestamp() + interval '5 days', clock_timestamp() - interval '1 hour', ${id(`${dsr}:correlation`)}::uuid, ${adminUser}::uuid
        )
        on conflict (id) do nothing`;
      await tx`
        insert into public.privacy_retention_actions(
          id, organization_id, retention_policy_id, subject_reference_hash, action_type, idempotency_key, correlation_id, requested_by
        ) values (
          ${retentionAction}::uuid, ${clientOrg}::uuid, ${retentionPolicy}::uuid, ${subjectHash}, 'ANONYMIZE',
          'demo-admin-overview-retention', ${id(`${retentionAction}:correlation`)}::uuid, ${adminUser}::uuid
        )
        on conflict (id) do nothing`;
      if (queueId("EXCEPTIONS")) {
        await tx`
          insert into public.admin_work_items(
            id, queue_version_id, organization_id, source_kind, resource_type, resource_id,
            title_fr, title_ar, priority, due_at, redacted_context, created_by
          ) values (
            ${privacyWork}::uuid, ${queueId("EXCEPTIONS")}::uuid, ${clientOrg}::uuid, 'MANUAL_REVIEW',
            'privacy_retention_action', ${retentionAction},
            'Demande d’accès données personnelles à instruire', 'طلب وصول إلى البيانات الشخصية للمعالجة',
            'HIGH', clock_timestamp() + interval '3 days',
            ${tx.json({ dsr_id: dsr, retention_action_id: retentionAction })},
            ${adminUser}::uuid
          )
          on conflict (id) do update set
            due_at = excluded.due_at,
            row_version = public.admin_work_items.row_version + 1
          where public.admin_work_items.status in ('OPEN', 'CLAIMED', 'WAITING_INFORMATION')`;
      }

      // Avenants
      await tx`
        insert into public.change_requests(id, contract_id, requested_by, status, reason, scope_delta)
        values (
          ${changeRequest}::uuid, ${contract}::uuid, ${clientUser}::uuid, 'ACCEPTED',
          'Avenant de démonstration pour prolonger le délai de livraison IT.',
          ${tx.json({ deadline_delta_days: 7, note: "demo-admin-overview" })}
        )
        on conflict (id) do nothing`;
      await tx`
        insert into public.contract_amendments(
          id, contract_id, change_request_id, base_contract_version_id, amendment_number, status,
          price_delta_minor, deadline_delta_days, deliverables_delta, commission_rule_snapshot, content_hash, created_by
        ) values (
          ${amendment}::uuid, ${contract}::uuid, ${changeRequest}::uuid, ${contractVersion}::uuid, 1, 'DRAFT',
          0, 7, '[]'::jsonb, ${tx.json({ commission_basis_points: 1000 })}, ${digest(`${amendment}:content`)}, ${clientUser}::uuid
        )
        on conflict (id) do nothing`;

      // Utilisateurs / invitations (franchise user invited into client org as viewer — pending)
      const inviteEmail = await tx`select lower(email)::text as email from auth.users where id=${franchiseUser}::uuid`;
      const alreadyMember = await tx`
        select 1 from public.organization_memberships
        where organization_id=${clientOrg}::uuid and user_id=${franchiseUser}::uuid limit 1`;
      if (!alreadyMember.length && inviteEmail.length) {
        await tx`
          insert into public.organization_invitations(id, organization_id, invited_user_id, invited_email, invited_by, status, expires_at)
          values (${invitation}::uuid, ${clientOrg}::uuid, ${franchiseUser}::uuid, ${inviteEmail[0].email}, ${adminUser}::uuid, 'PENDING', clock_timestamp() + interval '7 days')
          on conflict (id) do nothing`;
        await tx`
          insert into public.organization_invitation_roles(invitation_id, role_code)
          values (${invitation}::uuid, 'CLIENT_VIEWER')
          on conflict do nothing`;
      }

      // Files command center supplémentaires
      const extraWork = [
        ["CENTRAL_APPROVALS", "APPROVAL", "franchise_application", franchiseApplication, "Candidature franchise à instruire", "ترشيح امتياز للمعالجة", "MEDIUM"],
        ["EXCEPTIONS", "FINANCE", "contract_amendment", amendment, "Avenant contractuel à suivre", "ملحق عقد للمتابعة", "MEDIUM"],
        ["RISK_FLAGS", "CATALOG", "franchise", franchise, "Mandat et territoire franchise à superviser", "تفويض وإقليم الامتياز للإشراف", "LOW"],
      ];
      for (const [queueKey, source, resourceType, resourceId, titleFr, titleAr, priority] of extraWork) {
        const queue = queueId(queueKey);
        if (!queue) continue;
        await tx`
          insert into public.admin_work_items(
            id, queue_version_id, organization_id, source_kind, resource_type, resource_id,
            title_fr, title_ar, priority, due_at, created_by
          ) values (
            ${id(`${projectRef}:demo:admin:work:${queueKey}:${resourceType}`)}::uuid,
            ${queue}::uuid, ${clientOrg}::uuid, ${source}, ${resourceType}, ${resourceId},
            ${titleFr}, ${titleAr}, ${priority}, clock_timestamp() + interval '2 days', ${adminUser}::uuid
          )
          on conflict (id) do update set
            title_fr = excluded.title_fr,
            title_ar = excluded.title_ar,
            due_at = excluded.due_at,
            row_version = public.admin_work_items.row_version + 1
          where public.admin_work_items.status in ('OPEN', 'CLAIMED', 'WAITING_INFORMATION')`;
      }

      // Conformité client : rester sur un statut listable sans forcer le circuit de soumission
      await tx`
        update public.client_compliance_cases
        set status = 'DOCUMENTS_REQUIRED',
            updated_at = clock_timestamp()
        where organization_id = ${clientOrg}::uuid
          and status = 'PROFILE_IN_PROGRESS'`;
    });

    const counts = await database`
      select
        (select count(*) from public.admin_membership_capability_reviews_v1 where action_request_id=${capabilityAction}::uuid) as capability_reviews,
        (select count(*) from public.franchise_applications where id=${franchiseApplication}::uuid) as franchise_applications,
        (select count(*) from public.data_subject_requests where id=${dsr}::uuid) as privacy_requests,
        (select count(*) from public.contract_amendments where id=${amendment}::uuid) as amendments,
        (select count(*) from public.organization_invitations where id=${invitation}::uuid) as invitations,
        (select count(*) from public.admin_work_items where created_by=${adminUser}::uuid and id in (
          ${capabilityWork}::uuid, ${privacyWork}::uuid
        )) as work_items`;
    console.log(`PASS demo admin overview seeded ${JSON.stringify(counts[0])}`);
  } finally {
    await database.end({ timeout: 2 });
  }
}

try {
  await main();
} catch (error) {
  console.error(`FAIL ${error instanceof Error ? error.message : "demo admin overview provisioning failed"}; no credential was printed`);
  process.exitCode = 1;
}
