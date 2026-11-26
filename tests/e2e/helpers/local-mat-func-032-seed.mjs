import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { localFixturePdf } from "./local-fixture-pdf.mjs";

const hash = (value) => createHash("sha256").update(value).digest("hex");

async function rpc(client, name, input) {
  const result = await client.rpc(name, input);
  assert.equal(result.error, null, `LOT2_${name.toUpperCase()}_FAILED`);
  return result.data;
}

function trackRole(fixture, userId, roleCode) {
  fixture.resources.localCommercialExtraRoles ??= [];
  if (!fixture.resources.localCommercialExtraRoles.some((row) => row.userId === userId && row.roleCode === roleCode)) {
    fixture.resources.localCommercialExtraRoles.push({ userId, roleCode });
  }
}

/**
 * Light DEVELOPMENT-only seed: one open provider invoice (scheduler-emitted) +
 * one independently reviewed provider payment. Never inserts allocations/batches.
 */
export async function seedMatFunc032Reconciliation(fixture) {
  assert.equal(fixture.config.runtimeMode, "isolated-local-docker");
  assert.equal(fixture.config.localDockerVerified, true);

  const db = fixture.resources.database;
  const admin = fixture.resources.admin;
  const run = fixture.manifest.runId;
  const suffix = run.replaceAll("-", "").slice(0, 12).toUpperCase();
  const providerUserId = fixture.resources.userIds[1];
  const clientUserId = fixture.resources.userIds[0];
  const financeAuthorId = fixture.resources.userIds[2];
  const financeReviewerId = fixture.resources.userIds[3];
  const providerSession = fixture.sessions.clientB;
  const financeAuthor = fixture.sessions.central.client;
  const financeReviewer = fixture.sessions.noRole.client;

  await db`insert into public.platform_user_roles(user_id, role_code, granted_by)
    values (${financeAuthorId}::uuid, 'FINANCE_MANAGER', null), (${financeReviewerId}::uuid, 'FINANCE_MANAGER', null)
    on conflict do nothing`;
  trackRole(fixture, financeAuthorId, "FINANCE_MANAGER");
  trackRole(fixture, financeReviewerId, "FINANCE_MANAGER");

  const ids = Object.fromEntries([
    "clientOrg", "providerOrg", "clientMembership", "providerMembership",
    "library", "libraryVersion", "category", "categoryVersion", "subcategory", "subcategoryVersion",
    "service", "serviceVersion", "providerService", "request", "requestVersion", "matchingRun", "candidate",
    "rfq", "rfqProvider", "quote", "quoteVersion", "contract", "contractVersion", "mission",
    "taxRule", "payable", "period", "receivable", "revenue", "tax", "cash", "closingPolicy",
  ].map((key) => [key, randomUUID()]));
  fixture.resources.organizationIds.push(ids.clientOrg, ids.providerOrg);
  fixture.resources.localMatFunc032 = { ids, suffix };

  const categoryCode = `LOT2_TAX_${suffix}`;
  const commissionMinor = 1000n;
  const taxMinor = 0n;
  const amountMinor = String(commissionMinor + taxMinor);
  const contractHash = hash(`lot2-contract:${run}`);
  const iceDigits = createHash("sha256").update(`ice:${run}`).digest("hex").replace(/\D/g, "").padEnd(12, "0");
  const ifDigits = createHash("sha256").update(`if:${run}`).digest("hex").replace(/\D/g, "").padEnd(7, "0");
  const ice = `997${iceDigits}`.slice(0, 15);
  const ifNumber = `9${ifDigits}`.slice(0, 8);
  const rcNumber = `LOT2-${suffix}`;

  await db.begin(async (tx) => {
    await tx.unsafe("set local session_replication_role='replica'");
    await tx`insert into public.organizations(id, legal_name, display_name, status, created_by) values
      (${ids.clientOrg}::uuid, ${`Lot2 Client ${suffix}`}, ${`Lot2 Client ${suffix}`}, 'ACTIVE', ${clientUserId}::uuid),
      (${ids.providerOrg}::uuid, ${`Lot2 Provider ${suffix}`}, ${`Lot2 Provider ${suffix}`}, 'ACTIVE', ${providerUserId}::uuid)`;
    await tx`insert into public.organization_memberships(id, organization_id, user_id, status, activated_at) values
      (${ids.clientMembership}::uuid, ${ids.clientOrg}::uuid, ${clientUserId}::uuid, 'ACTIVE', clock_timestamp()),
      (${ids.providerMembership}::uuid, ${ids.providerOrg}::uuid, ${providerUserId}::uuid, 'ACTIVE', clock_timestamp())`;
    await tx`insert into public.organization_member_roles(membership_id, role_code, granted_by) values
      (${ids.clientMembership}::uuid, 'CLIENT_OWNER', ${clientUserId}::uuid),
      (${ids.providerMembership}::uuid, 'PROVIDER_OWNER', ${providerUserId}::uuid),
      (${ids.providerMembership}::uuid, 'PROVIDER_ACCOUNTING', ${providerUserId}::uuid)`;
    await tx`insert into public.organization_identifiers(organization_id, identifier_type, normalized_value, verification_status) values
      (${ids.providerOrg}::uuid, 'ICE', ${ice}, 'VERIFIED'),
      (${ids.providerOrg}::uuid, 'IF', ${ifNumber}, 'VERIFIED'),
      (${ids.providerOrg}::uuid, 'RC', ${rcNumber}, 'VERIFIED')`;
    await tx`insert into public.provider_profiles(provider_organization_id, company_status, overall_status, activity_summary, team_size, years_experience, partner_contract_status, created_by)
      values (${ids.providerOrg}::uuid, 'VERIFIED', 'ACTIVE', 'Lot2 historical provider fixture', 1, 1, 'SIGNED', ${providerUserId}::uuid)`;
    await tx`insert into public.tax_categories(code, name_fr, name_ar, description_fr, description_ar, category_kind, status)
      values (${categoryCode}, 'Lot2 tax', 'Lot2 tax', 'Synthetic local Lot2 tax', 'Synthetic local Lot2 tax', 'SERVICE', 'ACTIVE')`;
    await tx`insert into public.tax_rule_versions(id, jurisdiction_code, category_code, version, rate_basis_points, effective_from, effective_to, status, professional_validation_status, rule_type, priority, conditions, legal_reference, rounding_strategy, approved_by, approved_at, validation_reference, content_hash, change_reason)
      values (${ids.taxRule}::uuid, 'MA', ${categoryCode}, 1, 0, current_date - 120, current_date + 30, 'ACTIVE', 'VALIDATED', 'EXEMPT', 100, '{}', 'LOCAL-LOT2-NOT-FISCAL-APPROVAL', 'HALF_AWAY_FROM_ZERO_TO_MINOR_UNIT', ${financeAuthorId}::uuid, clock_timestamp(), ${`LOT2-${run}`}, ${hash(`lot2-tax:${run}`)}, 'Synthetic Lot2 tax precondition')`;

    await tx`insert into public.catalog_libraries(id, code, slug, steward_organization_id, status, created_by)
      values (${ids.library}::uuid, ${`LOT2_LIB_${suffix}`}, ${`lot2-lib-${suffix.toLowerCase()}`}, ${ids.clientOrg}::uuid, 'PUBLISHED', ${clientUserId}::uuid)`;
    await tx`insert into public.catalog_library_versions(id, library_id, version, status, code, slug, name_fr, name_ar, description_fr, description_ar, icon_key, sort_order, change_reason, content_hash, translation_review_status, translation_reviewer_user_id, translation_reviewed_at, translation_review_proof_hash, translation_review_version, created_by, published_at)
      values (${ids.libraryVersion}::uuid, ${ids.library}::uuid, 1, 'PUBLISHED', ${`LOT2_LIB_${suffix}`}, ${`lot2-lib-${suffix.toLowerCase()}`}, 'Lot2 library', 'Lot2 library', 'Lot2', 'Lot2', 'check-square', 1, 'Lot2 fixture', ${hash(`lib:${run}`)}, 'APPROVED', ${clientUserId}::uuid, clock_timestamp(), ${hash(`lib-review:${run}`)}, 1, ${clientUserId}::uuid, clock_timestamp())`;
    await tx`update public.catalog_libraries set current_published_version_id = ${ids.libraryVersion}::uuid where id = ${ids.library}::uuid`;
    await tx`insert into public.catalog_categories(id, library_id, code, slug, status, created_by)
      values (${ids.category}::uuid, ${ids.library}::uuid, ${`LOT2_CAT_${suffix}`}, ${`lot2-cat-${suffix.toLowerCase()}`}, 'PUBLISHED', ${clientUserId}::uuid)`;
    await tx`insert into public.catalog_category_versions(id, category_id, library_id, version, status, code, slug, name_fr, name_ar, description_fr, description_ar, sort_order, change_reason, content_hash, translation_review_status, translation_reviewer_user_id, translation_reviewed_at, translation_review_proof_hash, translation_review_version, created_by, published_at)
      values (${ids.categoryVersion}::uuid, ${ids.category}::uuid, ${ids.library}::uuid, 1, 'PUBLISHED', ${`LOT2_CAT_${suffix}`}, ${`lot2-cat-${suffix.toLowerCase()}`}, 'Lot2 cat', 'Lot2 cat', 'Lot2', 'Lot2', 1, 'Lot2 fixture', ${hash(`cat:${run}`)}, 'APPROVED', ${clientUserId}::uuid, clock_timestamp(), ${hash(`cat-review:${run}`)}, 1, ${clientUserId}::uuid, clock_timestamp())`;
    await tx`update public.catalog_categories set current_published_version_id = ${ids.categoryVersion}::uuid where id = ${ids.category}::uuid`;
    await tx`insert into public.catalog_subcategories(id, library_id, category_id, code, slug, status, created_by)
      values (${ids.subcategory}::uuid, ${ids.library}::uuid, ${ids.category}::uuid, ${`LOT2_SUB_${suffix}`}, ${`lot2-sub-${suffix.toLowerCase()}`}, 'PUBLISHED', ${clientUserId}::uuid)`;
    await tx`insert into public.catalog_subcategory_versions(id, subcategory_id, library_id, version, status, category_id, code, slug, name_fr, name_ar, description_fr, description_ar, sort_order, change_reason, content_hash, translation_review_status, translation_reviewer_user_id, translation_reviewed_at, translation_review_proof_hash, translation_review_version, created_by, published_at)
      values (${ids.subcategoryVersion}::uuid, ${ids.subcategory}::uuid, ${ids.library}::uuid, 1, 'PUBLISHED', ${ids.category}::uuid, ${`LOT2_SUB_${suffix}`}, ${`lot2-sub-${suffix.toLowerCase()}`}, 'Lot2 sub', 'Lot2 sub', 'Lot2', 'Lot2', 1, 'Lot2 fixture', ${hash(`sub:${run}`)}, 'APPROVED', ${clientUserId}::uuid, clock_timestamp(), ${hash(`sub-review:${run}`)}, 1, ${clientUserId}::uuid, clock_timestamp())`;
    await tx`update public.catalog_subcategories set current_published_version_id = ${ids.subcategoryVersion}::uuid where id = ${ids.subcategory}::uuid`;
    await tx`insert into public.catalog_services(id, library_id, primary_subcategory_id, code, slug, status, created_by)
      values (${ids.service}::uuid, ${ids.library}::uuid, ${ids.subcategory}::uuid, ${`LOT2_SVC_${suffix}`}, ${`lot2-svc-${suffix.toLowerCase()}`}, 'PUBLISHED', ${clientUserId}::uuid)`;
    await tx`insert into public.catalog_service_versions(id, service_id, library_id, version, status, primary_subcategory_id, code, slug, name_fr, name_ar, short_description_fr, short_description_ar, long_description_fr, long_description_ar, service_type, unit_label_fr, unit_label_ar, sort_order, change_reason, content_hash, translation_review_status, translation_reviewer_user_id, translation_reviewed_at, translation_review_proof_hash, translation_review_version, created_by, published_at)
      values (${ids.serviceVersion}::uuid, ${ids.service}::uuid, ${ids.library}::uuid, 1, 'PUBLISHED', ${ids.subcategory}::uuid, ${`LOT2_SVC_${suffix}`}, ${`lot2-svc-${suffix.toLowerCase()}`}, 'Lot2 service', 'Lot2 service', 'Lot2', 'Lot2', 'Lot2', 'Lot2', 'CONSULTING', 'jour', 'يوم', 1, 'Lot2 fixture', ${hash(`svc:${run}`)}, 'APPROVED', ${clientUserId}::uuid, clock_timestamp(), ${hash(`svc-review:${run}`)}, 1, ${clientUserId}::uuid, clock_timestamp())`;
    await tx`update public.catalog_services set current_published_version_id = ${ids.serviceVersion}::uuid where id = ${ids.service}::uuid`;
    await tx`insert into public.provider_services(id, provider_organization_id, service_id, request_status, requested_by, requested_at)
      values (${ids.providerService}::uuid, ${ids.providerOrg}::uuid, ${ids.service}::uuid, 'DECIDED', ${providerUserId}::uuid, clock_timestamp())`;

    await tx`insert into public.service_requests(id, client_organization_id, library_id, service_id, status, created_by)
      values (${ids.request}::uuid, ${ids.clientOrg}::uuid, ${ids.library}::uuid, ${ids.service}::uuid, 'CONTRACTED', ${clientUserId}::uuid)`;
    await tx`insert into public.service_request_versions(id, request_id, client_organization_id, library_id, version_number, description, urgency, currency_code, required_quote_data, required_fields_complete, catalog_snapshot_hash, questionnaire_snapshot_hash, change_reason, content_hash, created_by)
      values (${ids.requestVersion}::uuid, ${ids.request}::uuid, ${ids.clientOrg}::uuid, ${ids.library}::uuid, 1, 'Lot2 historical request', 'NORMAL', 'MAD', '{}', true, ${hash(`req-cat:${run}`)}, ${hash(`req-q:${run}`)}, 'Lot2 fixture', ${hash(`req:${run}`)}, ${clientUserId}::uuid)`;
    await tx`update public.service_requests set current_version_id = ${ids.requestVersion}::uuid where id = ${ids.request}::uuid`;
    await tx`insert into public.matching_runs(id, request_id, request_version_id, policy_version, status, target_panel_size, started_by, completed_at)
      values (${ids.matchingRun}::uuid, ${ids.request}::uuid, ${ids.requestVersion}::uuid, 'MATCH-V1', 'COMPLETED', 1, ${clientUserId}::uuid, clock_timestamp())`;
    await tx`insert into public.matching_candidates(id, matching_run_id, provider_organization_id, eligible, score_basis_points, score_explanation, rotation_component)
      values (${ids.candidate}::uuid, ${ids.matchingRun}::uuid, ${ids.providerOrg}::uuid, true, 9000, '{}', 0)`;
    await tx`insert into public.rfqs(id, request_id, request_version_id, matching_run_id, status, deadline, confidentiality_settings, invited_count, opened_by)
      values (${ids.rfq}::uuid, ${ids.request}::uuid, ${ids.requestVersion}::uuid, ${ids.matchingRun}::uuid, 'OPEN', clock_timestamp() + interval '30 days', '{"mask_direct_contacts":true}', 1, ${clientUserId}::uuid)`;
    await tx`insert into public.rfq_providers(id, rfq_id, provider_organization_id, matching_candidate_id, status, responded_at)
      values (${ids.rfqProvider}::uuid, ${ids.rfq}::uuid, ${ids.providerOrg}::uuid, ${ids.candidate}::uuid, 'ACCEPTED', clock_timestamp())`;
    await tx`insert into public.quotes(id, rfq_id, rfq_provider_id, provider_organization_id, status, current_version_id, selected_version_id, created_by)
      values (${ids.quote}::uuid, ${ids.rfq}::uuid, ${ids.rfqProvider}::uuid, ${ids.providerOrg}::uuid, 'SELECTED', ${ids.quoteVersion}::uuid, ${ids.quoteVersion}::uuid, ${providerUserId}::uuid)`;
    await tx`insert into public.quote_versions(id, quote_id, rfq_id, provider_organization_id, version_number, lifecycle_status, change_reason, currency, solution_fr, deliverables, warranty_fr, correction_terms_fr, proposed_start_date, duration_days, valid_until, subtotal_minor, tax_minor, total_minor, recurring_subtotal_minor, calculation_basis, content_hash, submitted_at, created_by)
      values (${ids.quoteVersion}::uuid, ${ids.quote}::uuid, ${ids.rfq}::uuid, ${ids.providerOrg}::uuid, 1, 'SUBMITTED', 'Lot2 fixture', 'MAD', 'Lot2', ${tx.json([{ key: "D1" }])}, 'Lot2', 'Lot2', current_date, 7, clock_timestamp() + interval '30 days', 10000, 0, 10000, 0, '{}', ${hash(`quote:${run}`)}, clock_timestamp(), ${providerUserId}::uuid)`;
    await tx`insert into public.contracts(id, client_organization_id, provider_organization_id, status, current_version, created_by)
      values (${ids.contract}::uuid, ${ids.clientOrg}::uuid, ${ids.providerOrg}::uuid, 'ACTIVE', 1, ${clientUserId}::uuid)`;
    await tx`insert into public.contract_versions(id, contract_id, version, selected_quote_version_id, request_snapshot, quote_snapshot, clauses, price_minor, currency, commission_rule_snapshot, content_hash, change_reason, created_by)
      values (${ids.contractVersion}::uuid, ${ids.contract}::uuid, 1, ${ids.quoteVersion}::uuid, '{}', '{}', '{}', 10000, 'MAD', '{"commission_basis_points":1000}', ${contractHash}, 'Lot2 historical contract', ${clientUserId}::uuid)`;
    await tx`insert into public.missions(id, contract_id, contract_version_id, client_organization_id, provider_organization_id, status, started_at, created_by)
      values (${ids.mission}::uuid, ${ids.contract}::uuid, ${ids.contractVersion}::uuid, ${ids.clientOrg}::uuid, ${ids.providerOrg}::uuid, 'COMPLETED', clock_timestamp() - interval '90 days', ${clientUserId}::uuid)`;
    await tx`insert into public.provider_payable_events(id, provider_organization_id, client_organization_id, mission_id, contract_version_id, event_type, occurred_on, currency, gross_amount_minor, commission_basis_points, commission_amount_minor, tax_rule_version_id, tax_rate_basis_points, tax_amount_minor, commission_rule_snapshot, client_receipt_reference, proof_hash, correlation_id, created_by)
      values (${ids.payable}::uuid, ${ids.providerOrg}::uuid, ${ids.clientOrg}::uuid, ${ids.mission}::uuid, ${ids.contractVersion}::uuid, 'COMMISSION_ACCRUAL', (date_trunc('month', current_date)::date - interval '4 months')::date + 1, 'MAD', 10000, 1000, ${Number(commissionMinor)}, ${ids.taxRule}::uuid, 0, ${Number(taxMinor)}, '{"lot2":true}', ${`LOT2_RECEIPT_${suffix}`}, ${hash(`payable-proof:${run}`)}, ${randomUUID()}::uuid, ${providerUserId}::uuid)`;
    await tx`insert into public.financial_accounts(id, organization_id, code, name, account_type, currency) values
      (${ids.receivable}::uuid, ${ids.providerOrg}::uuid, 'LOT2_AR', 'Lot2 receivable', 'ASSET', 'MAD'),
      (${ids.revenue}::uuid, ${ids.providerOrg}::uuid, 'LOT2_REV', 'Lot2 revenue', 'REVENUE', 'MAD'),
      (${ids.tax}::uuid, ${ids.providerOrg}::uuid, 'LOT2_TAX', 'Lot2 tax', 'LIABILITY', 'MAD'),
      (${ids.cash}::uuid, ${ids.providerOrg}::uuid, 'LOT2_CASH', 'Lot2 cash', 'ASSET', 'MAD')`;
  });

  const [{ today }] = await db`select (clock_timestamp() at time zone 'Africa/Casablanca')::date::text as today`;

  const policy = await rpc(financeAuthor, "create_client_billing_policy_v1", {
    p_payload: {
      series_key: `LOT2_ISSUER_${suffix}`,
      version: 1,
      currency: "MAD",
      tax_rate_bps: 0,
      tax_label_fr: "TVA synthétique Lot2",
      tax_label_ar: "ضريبة Lot2",
      jurisdiction: "TEST_ONLY",
      issuer: {
        legal_name: "Lot2 Issuer TEST ONLY",
        legal_form: "SARL",
        address: "Adresse synthétique Lot2",
        ice: "997320000000032",
        if_number: "99732032",
        rc_number: `LOT2-ISS-${suffix}`,
        contact_email: "lot2-issuer@example.invalid",
      },
      invoice_prefix: `L2${suffix.slice(0, 4)}`,
      credit_prefix: `C2${suffix.slice(0, 4)}`,
      invoice_start_number: "1",
      credit_start_number: "1",
      valid_from: today,
      service_label_fr: "Commission Lot2",
      service_label_ar: "عمولة Lot2",
      approval_reference: "TEST ONLY NOT REAL LEGAL APPROVAL",
    },
    p_idempotency_key: `lot2-issuer-${run}`,
  });
  await rpc(financeReviewer, "approve_client_billing_policy_v1", {
    p_policy_id: policy.policy_id,
    p_approve: true,
    p_reason: "TEST ONLY independent Lot2 issuer approval",
    p_idempotency_key: `lot2-issuer-approve-${run}`,
  });

  const closingPolicyId = await rpc(financeAuthor, "propose_provider_closing_policy_v1", {
    p_org: ids.providerOrg,
    p_currency: "MAD",
    p_receivable: ids.receivable,
    p_revenue: ids.revenue,
    p_tax: ids.tax,
    p_due_days: 7,
    p_dispute_days: 3,
    p_effective_from: today,
    p_reference: "TEST ONLY Lot2 approved monthly closing rule",
  });
  ids.closingPolicy = closingPolicyId;
  await rpc(financeReviewer, "decide_provider_closing_policy_v1", {
    p_policy_id: closingPolicyId,
    p_approved: true,
    p_reason: "TEST ONLY independent Lot2 closing policy approval",
  });

  const legalBytes = localFixturePdf(["TEST ONLY - LOT2 LEGAL EVIDENCE", run]);
  const legalSha = hash(legalBytes);
  const uploadDoc = await rpc(providerSession.client, "begin_provider_document_upload", {
    p_provider_organization_id: ids.providerOrg,
    p_declared_mime_type: "application/pdf",
    p_declared_size_bytes: legalBytes.length,
  });
  const storedDoc = await providerSession.client.storage.from("provider-qualification").upload(uploadDoc.storage_object_path, legalBytes, { contentType: "application/pdf" });
  assert.equal(storedDoc.error, null, "LOT2_LEGAL_UPLOAD_FAILED");
  fixture.resources.localMatFunc032.legalPath = uploadDoc.storage_object_path;
  const docVersion = await rpc(providerSession.client, "record_provider_document_version", {
    p_provider_organization_id: ids.providerOrg,
    p_document_kind: "LEGAL",
    p_code: `LOT2_LEGAL_${suffix}`,
    p_document: {
      issued_on: today,
      expires_on: "2099-12-31",
      storage_object_path: uploadDoc.storage_object_path,
      content_hash: legalSha,
      metadata: { declared_mime_type: "application/pdf", declared_size_bytes: legalBytes.length },
    },
    p_provider_service_ids: [],
    p_change_reason: "Synthetic Lot2 recipient evidence",
    p_idempotency_key: `lot2-legal-${run}`,
  });
  const [scanJob] = await db`select id from public.provider_document_scan_jobs where document_version_id = ${docVersion.document_version_id}::uuid`;
  assert.ok(scanJob?.id, "LOT2_LEGAL_SCAN_JOB_REQUIRED");
  await rpc(admin, "record_provider_document_scan_result", {
    p_upload_id: scanJob.id,
    p_result: "CLEAN",
    p_engine_code: "LOCAL_KNOWN_FIXTURE_PDF",
    p_engine_version: "1.0.0",
    p_computed_sha256: legalSha,
    p_idempotency_key: `lot2-legal-scan-${run}`,
  });
  const reviewedDoc = await rpc(financeAuthor, "review_provider_document", {
    p_document_version_id: docVersion.document_version_id,
    p_status: "VERIFIED",
    p_rationale: "TEST ONLY independent Lot2 legal evidence review",
    p_rule_version: "LOT2-TEST",
    p_idempotency_key: `lot2-legal-review-${run}`,
  });
  assert.ok(reviewedDoc.document_version_id, "LOT2_VERIFIED_DOCUMENT_REQUIRED");

  const recipientReview = await rpc(financeAuthor, "request_provider_billing_recipient_review_v1", {
    p_contract_version_id: ids.contractVersion,
    p_expected_contract_hash: contractHash,
    p_recipient_snapshot: {
      legal_name: `Lot2 Provider ${suffix}`,
      country_code: "MA",
      registered_address: "Adresse contractuelle synthétique Lot2",
      identifiers: { ICE: ice, IF: ifNumber, RC: rcNumber },
    },
    p_evidence_document_version_id: reviewedDoc.document_version_id,
    p_reason: "TEST ONLY historical Lot2 recipient attestation",
    p_idempotency_key: randomUUID(),
  });
  const [reviewRow] = await db`select content_hash from public.provider_billing_contract_recipient_reviews where id = ${recipientReview.review_id}::uuid`;
  await rpc(financeReviewer, "decide_provider_billing_recipient_review_v1", {
    p_review_id: recipientReview.review_id,
    p_expected_review_hash: reviewRow.content_hash,
    p_approve: true,
    p_reason: "TEST ONLY independent Lot2 recipient approval",
  });

  const [payableRow] = await db`select to_jsonb(e) || jsonb_build_object(
      'gross_amount_minor', e.gross_amount_minor::text,
      'commission_amount_minor', e.commission_amount_minor::text,
      'tax_amount_minor', e.tax_amount_minor::text,
      'total_due_minor', e.total_due_minor::text
    ) as snapshot
    from public.provider_payable_events e where e.id = ${ids.payable}::uuid`;
  await db`
    insert into public.provider_billing_periods_v1(id, policy_id, provider_organization_id, currency, period_end, generated_at, dispute_until)
    values (
      ${ids.period}::uuid,
      ${closingPolicyId}::uuid,
      ${ids.providerOrg}::uuid,
      'MAD',
      (date_trunc('month', current_date)::date - interval '3 months')::date - 1,
      clock_timestamp() - interval '10 days',
      clock_timestamp() - interval '7 days'
    )`;
  await db`
    insert into public.provider_pre_statement_lines_v1(period_id, payable_event_id, source_snapshot)
    values (${ids.period}::uuid, ${ids.payable}::uuid, ${db.json(payableRow.snapshot)})`;

  await rpc(admin, "run_provider_billing_scheduler_v1", { p_limit: 100 });
  await rpc(admin, "run_provider_billing_scheduler_v1", { p_limit: 100 });

  const [invoice] = await db`
    select i.id::text, i.total_minor::text, i.invoice_number,
      (i.total_minor - coalesce((select sum(a.amount_minor) from public.provider_payment_allocations a where a.invoice_id = i.id), 0)
        - coalesce((select sum(c.total_minor) from public.provider_credit_notes c where c.invoice_id = i.id), 0))::text as outstanding_minor
    from public.provider_invoices i
    where i.provider_organization_id = ${ids.providerOrg}::uuid
    order by i.created_at desc
    limit 1`;
  assert.ok(invoice?.id, "LOT2_SCHEDULER_INVOICE_REQUIRED");
  assert.equal(invoice.outstanding_minor, amountMinor);

  const proofBytes = localFixturePdf(["TEST ONLY - LOT2 PAYMENT PROOF", "No actual bank transfer.", run]);
  const proofSha = hash(proofBytes);
  const paymentReference = `LOT2-PAY-${suffix}`;
  const proofUpload = await rpc(providerSession.client, "begin_provider_payment_proof_upload", {
    p_provider_organization_id: ids.providerOrg,
    p_original_file_name: "lot2-payment-proof.pdf",
    p_declared_mime_type: "application/pdf",
    p_declared_size_bytes: proofBytes.length,
    p_declared_sha256: proofSha,
    p_idempotency_key: randomUUID(),
  });
  const storedProof = await providerSession.client.storage.from(proofUpload.storage_bucket).upload(proofUpload.storage_object_path, proofBytes, { contentType: "application/pdf" });
  assert.equal(storedProof.error, null, "LOT2_PAYMENT_PROOF_UPLOAD_FAILED");
  fixture.resources.localMatFunc032.paymentProof = proofUpload;
  await rpc(admin, "record_provider_payment_proof_scan_result", {
    p_upload_id: proofUpload.upload_id,
    p_result: "CLEAN",
    p_engine_code: "LOCAL_KNOWN_FIXTURE_PDF",
    p_engine_version: "1.0.0",
    p_computed_sha256: proofSha,
    p_idempotency_key: randomUUID(),
  });
  const declaration = await rpc(providerSession.client, "record_provider_payment", {
    p_provider_organization_id: ids.providerOrg,
    p_payment_reference: paymentReference,
    p_paid_on: today,
    p_payment_method: "BANK_TRANSFER",
    p_currency: "MAD",
    p_amount_minor: Number(amountMinor),
    p_proof_hash: proofSha,
    p_cash_account_id: ids.cash,
    p_receivable_account_id: ids.receivable,
    p_idempotency_key: `lot2-payment-${run}`,
  });
  const selfReview = await providerSession.client.rpc("review_provider_financial_declaration_v1", {
    p_declaration_id: declaration.declaration_id,
    p_approved: true,
    p_reason: "Provider cannot approve own Lot2 settlement",
  });
  assert.equal(selfReview.error?.code, "42501");
  const reviewed = await rpc(financeAuthor, "review_provider_financial_declaration_v1", {
    p_declaration_id: declaration.declaration_id,
    p_approved: true,
    p_reason: "TEST ONLY independent Lot2 payment review before UI reconciliation",
  });
  assert.ok(reviewed.payment_id, "LOT2_PAYMENT_ID_REQUIRED");

  const [payment] = await db`
    select p.id::text, p.amount_minor::text, p.payment_reference,
      coalesce((select sum(a.amount_minor) from public.provider_payment_allocations a where a.payment_id = p.id), 0)::text as allocated_minor
    from public.provider_payments p
    where p.id = ${reviewed.payment_id}::uuid`;
  assert.equal(payment.allocated_minor, "0");
  assert.equal(payment.amount_minor, amountMinor);

  const [allocCount] = await db`select count(*)::int as count from public.provider_payment_allocations where payment_id = ${payment.id}::uuid`;
  assert.equal(allocCount.count, 0);

  return {
    paymentId: payment.id,
    invoiceId: invoice.id,
    amountMinor,
    paymentReference: payment.payment_reference,
    invoiceNumber: invoice.invoice_number,
    providerOrganizationId: ids.providerOrg,
    outstandingBefore: invoice.outstanding_minor,
    unallocatedBefore: payment.amount_minor,
    financeReviewerUserId: financeReviewerId,
    paymentDeclaredByUserId: providerUserId,
    paymentReviewedByUserId: financeAuthorId,
  };
}

export async function cleanMatFunc032Seed(fixture) {
  const state = fixture.resources.localMatFunc032;
  if (!state) return;
  const db = fixture.resources.database;
  if (state.legalPath) {
    await fixture.resources.admin.storage.from("provider-qualification").remove([state.legalPath]).catch(() => {});
  }
  if (state.paymentProof) {
    const [row] = await db`select status from public.provider_payment_proof_uploads where id = ${state.paymentProof.upload_id}::uuid`;
    if (row?.status !== "BOUND") {
      await fixture.resources.admin.storage.from(state.paymentProof.storage_bucket).remove([state.paymentProof.storage_object_path]).catch(() => {});
    }
  }
  await db.begin(async (tx) => {
    await tx.unsafe("set local session_replication_role='replica'");
    await tx`update public.tax_rule_versions set status = 'RETIRED' where id = ${state.ids.taxRule}::uuid`;
    await tx`update public.tax_categories set status = 'RETIRED' where code = ${`LOT2_TAX_${state.suffix}`}`;
  }).catch(() => {});
  for (const { userId, roleCode } of fixture.resources.localCommercialExtraRoles ?? []) {
    await db`delete from public.platform_user_roles where user_id = ${userId}::uuid and role_code = ${roleCode}`.catch(() => {});
  }
}
