import { createHash, randomBytes, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { loadSafeConfiguration, resolveExpectedDatabaseUrl } from "./environment.mjs";
import { bootstrapComplianceRole, neutralizeFixture, verifyCommandEvidence, verifyFixtureNeutralized } from "./privileged-fixture-adapter.mjs";
import { secureLocalPaths, sha256File, validateFreshManifest } from "./security.mjs";
import { totp } from "./totp.mjs";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const root = resolve(scriptDirectory, "..", "..");
const authDirectory = resolve(scriptDirectory, ".auth");
const requireFromWeb = createRequire(resolve(root, "apps", "web", "package.json"));
const { createClient } = requireFromWeb("@supabase/supabase-js");
const { createServerClient } = requireFromWeb("@supabase/ssr");
const PDF_BYTES = Buffer.from("%PDF-1.4\n% Matricia P05 E2E\n1 0 obj\n<<>>\nendobj\n%%EOF\n", "utf8");

function deterministicUuid(seed) {
  const value = createHash("sha256").update(seed).digest("hex").slice(0, 32).split("");
  value[12] = "4";
  value[16] = ((Number.parseInt(value[16], 16) & 3) | 8).toString(16);
  return `${value.slice(0, 8).join("")}-${value.slice(8, 12).join("")}-${value.slice(12, 16).join("")}-${value.slice(16, 20).join("")}-${value.slice(20).join("")}`;
}

function safeRunId(value) {
  const runId = value || randomUUID();
  if (!/^[a-zA-Z0-9-]{8,64}$/.test(runId)) throw new Error("P05_E2E_RUN_ID must contain 8 to 64 letters, digits, or hyphens");
  return runId.toLowerCase();
}

function randomPassword() { return `${randomBytes(24).toString("base64url")}aA7!`; }

function proofFailure(operation, results = []) {
  const responses = results.map(result => {
    const status = Number(result?.status ?? result?.error?.status ?? result?.error?.statusCode);
    const code = result?.error?.code;
    return { status: Number.isInteger(status) && status >= 0 && status <= 599 ? status : null,
      code: typeof code === "string" && /^[A-Za-z0-9_.:-]{1,64}$/u.test(code) ? code : null };
  });
  return Object.assign(new Error("P05_PROOF_FAILED"), { code: "P05_PROOF_FAILED", proofDiagnostic: { operation, responses } });
}

export function combineProvisionAndCleanupErrors(stage, provisionError, cleanupError) {
  if (!cleanupError) {
    const failure = new Error(`P05 E2E setup stopped during ${stage}`, { cause: provisionError });
    return Object.assign(failure, { code: "P05_PROVISION_FAILED", provisionStage: stage });
  }
  return Object.assign(new AggregateError(
    [provisionError, cleanupError],
    `P05 E2E setup stopped during ${stage} and remote fixture neutralization also failed`,
    { cause: provisionError },
  ), { code: "P05_PROVISION_FAILED", provisionStage: stage });
}

async function createTestUser(admin, email, password, displayName) {
  const result = await admin.auth.admin.createUser({ email, password, email_confirm: true,
    app_metadata: { p05_e2e_fixture: true }, user_metadata: { full_name: displayName, preferred_locale: "fr-MA" } });
  if (result.error || !result.data.user) throw proofFailure("CREATE_IDENTITY", [result]);
  return result.data.user;
}

function cookieStateClient(config) {
  const cookies = new Map();
  const client = createServerClient(config.supabaseUrl, config.publishableKey, {
    cookies: { getAll: () => [...cookies.values()], setAll: (changes) => {
      for (const change of changes) {
        if (change.value === "" || change.options?.maxAge === 0) cookies.delete(change.name);
        else cookies.set(change.name, change);
      }
    } },
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: true },
  });
  return { client, cookies };
}

async function authenticate(config, email, password, admin) {
  const context = cookieStateClient(config);
  let signedIn;
  if (config.runtimeMode === "isolated-local-docker") {
    const link = await admin.auth.admin.generateLink({ type: "magiclink", email });
    const token = link.data?.properties?.hashed_token;
    if (link.error || !token) throw proofFailure("AUTH_OTP_CHALLENGE", [link]);
    signedIn = await context.client.auth.verifyOtp({ token_hash: token, type: "magiclink" });
  } else signedIn = await context.client.auth.signInWithPassword({ email, password });
  if (signedIn.error || !signedIn.data.session) throw proofFailure("AUTH_SESSION", [signedIn]);
  return context;
}

async function elevateToAal2(context) {
  const enrollment = await context.client.auth.mfa.enroll({ factorType: "totp", friendlyName: `p05-e2e-${randomUUID()}` });
  const secret = enrollment.data?.totp?.secret;
  const factorId = enrollment.data?.id;
  if (enrollment.error || !secret || !factorId) throw proofFailure("MFA_ENROLL", [enrollment]);
  let verified = false;
  let verifiedCounter;
  for (const offset of [-30_000, 0, 30_000]) {
    const result = await context.client.auth.mfa.challengeAndVerify({ factorId, code: totp(secret, Date.now() + offset) });
    if (!result.error) { verified = true; verifiedCounter = Math.floor((Date.now() + offset) / 30_000); break; }
  }
  const assurance = await context.client.auth.mfa.getAuthenticatorAssuranceLevel();
  if (!verified || assurance.error || assurance.data.currentLevel !== "aal2") throw proofFailure("MFA_VERIFY", [assurance]);
  return { factorId, secret, verifiedCounter };
}

function toPlaywrightState(cookies, baseUrl) {
  const origin = new URL(baseUrl);
  return { cookies: [...cookies.values()].map(({ name, value, options = {} }) => ({
    name, value, domain: origin.hostname, path: options.path || "/",
    expires: typeof options.maxAge === "number" ? Math.floor(Date.now() / 1000) + options.maxAge : -1,
    httpOnly: options.httpOnly ?? false, secure: false,
    sameSite: options.sameSite === "strict" ? "Strict" : options.sameSite === "none" ? "None" : "Lax",
  })), origins: [] };
}

async function createOrganizationAndCase(client, runId, suffix) {
  const organizationCorrelation = deterministicUuid(`${runId}:${suffix}:organization:correlation`);
  const profileCorrelation = deterministicUuid(`${runId}:${suffix}:profile:correlation`);
  const businessIdentifier = createHash("sha256").update(`${runId}:${suffix}`).digest("hex").slice(0, 16).toUpperCase();
  const organizationName = `P05 E2E ${suffix.toUpperCase()} ${runId}`;
  const organization = await client.rpc("create_or_request_organization", {
    p_legal_name: `Matricia ${organizationName}`, p_display_name: organizationName, p_ice: businessIdentifier,
    p_owner_role: "CLIENT_OWNER", p_idempotency_key: deterministicUuid(`${runId}:${suffix}:organization`), p_correlation_id: organizationCorrelation,
  });
  if (organization.error || organization.data?.outcome !== "ORGANIZATION_CREATED") throw proofFailure("CREATE_ORGANIZATION", [organization]);
  const organizationId = organization.data.organization_id;
  const profile = await client.rpc("save_client_profile_draft", {
    p_organization_id: organizationId,
    p_profile: { legal_form: "SARL", incorporation_date: "2024-01-15", activity: "Services de test logiciel",
      sector: "Technologies", employee_count: 3, registered_city: "Casablanca",
      registered_address: { line1: "1 Rue E2E", postal_code: "20000", country_code: "MA" },
      contact: { phone: "+212600000000", email: `contact-${suffix}-${runId}@example.invalid` },
      representative: { first_name: "Client", last_name: `Tenant ${suffix.toUpperCase()}`, title: "Gérant", email: `representative-${suffix}-${runId}@example.invalid`, phone: "+212600000001", power: "Représentation légale" },
      declarations: { accuracy_confirmed: true, representation_authorized: true }, if_number: `IF${businessIdentifier}`, rc_number: `RC${businessIdentifier}` },
    p_idempotency_key: deterministicUuid(`${runId}:${suffix}:profile`), p_correlation_id: profileCorrelation,
  });
  if (profile.error || profile.data?.outcome !== "CLIENT_PROFILE_VERSION_CREATED") throw proofFailure("CREATE_PROFILE", [profile]);
  return { organizationId, organizationName, complianceCaseId: profile.data.compliance_case_id, evidence: [
    { organizationId, correlationId: organizationCorrelation, action: "organization.created", eventType: "OrganizationCreatedV1" },
    { organizationId, correlationId: profileCorrelation, action: "client.profile.version.created", eventType: "ClientProfileVersionCreatedV1" },
  ] };
}

async function createAndProveDocument(clientA, clientB, organizationA, organizationB, runId, resources) {
  const reserveCorrelation = deterministicUuid(`${runId}:document:reserve:correlation`);
  const finalizeCorrelation = deterministicUuid(`${runId}:document:finalize:correlation`);
  const sha256 = createHash("sha256").update(PDF_BYTES).digest("hex");
  const reserved = await clientA.rpc("begin_client_compliance_document_upload", {
    p_compliance_case_id: organizationA.complianceCaseId, p_document_type: "REGISTRATION_DOCUMENT",
    p_document_number: "RC-E2E", p_issuer: "Tribunal E2E", p_issued_on: "2024-01-15", p_expires_on: null,
    p_original_file_name: "preuve-e2e.pdf", p_mime_type: "application/pdf", p_size_bytes: PDF_BYTES.length,
    p_sha256: sha256, p_idempotency_key: deterministicUuid(`${runId}:document:reserve`), p_correlation_id: reserveCorrelation,
  });
  if (reserved.error || reserved.data?.outcome !== "DOCUMENT_UPLOAD_RESERVED") throw proofFailure("DOCUMENT_RESERVE", [reserved]);
  const expectedPath = `${organizationA.organizationId}/${organizationA.complianceCaseId}/${reserved.data.document_id}.pdf`;
  if (reserved.data.bucket !== "client-compliance" || reserved.data.object_path !== expectedPath || reserved.data.status !== "UPLOAD_PENDING") throw new Error("Document storage path proof failed");
  const upload = await clientA.storage.from("client-compliance").upload(expectedPath, PDF_BYTES, { contentType: "application/pdf", upsert: false });
  if (upload.error) throw proofFailure("DOCUMENT_UPLOAD", [upload]);
  resources.storagePaths.push(expectedPath);
  const forbiddenPath = `${organizationB.organizationId}/${organizationB.complianceCaseId}/${randomUUID()}.pdf`;
  const forbiddenUpload = await clientA.storage.from("client-compliance").upload(forbiddenPath, PDF_BYTES, { contentType: "application/pdf", upsert: false });
  if (!forbiddenUpload.error) throw new Error("Cross-tenant storage upload was not denied");
  const forbiddenDownload = await clientB.storage.from("client-compliance").download(expectedPath);
  if (!forbiddenDownload.error) throw new Error("Cross-tenant storage read was not denied");
  const forbiddenFinalize = await clientB.rpc("finalize_client_compliance_document_upload", {
    p_document_id: reserved.data.document_id, p_idempotency_key: deterministicUuid(`${runId}:document:forbidden`), p_correlation_id: randomUUID(),
  });
  if (!forbiddenFinalize.error) throw new Error("Cross-tenant document transition was not denied");
  const finalizeKey = deterministicUuid(`${runId}:document:finalize`);
  const finalized = await clientA.rpc("finalize_client_compliance_document_upload", { p_document_id: reserved.data.document_id, p_idempotency_key: finalizeKey, p_correlation_id: finalizeCorrelation });
  const retried = await clientA.rpc("finalize_client_compliance_document_upload", { p_document_id: reserved.data.document_id, p_idempotency_key: finalizeKey, p_correlation_id: finalizeCorrelation });
  if (finalized.error || retried.error || finalized.data?.status !== "PENDING_REVIEW" || JSON.stringify(finalized.data) !== JSON.stringify(retried.data)) throw proofFailure("DOCUMENT_FINALIZE", [finalized, retried]);
  const overwrite = await clientA.storage.from("client-compliance").upload(expectedPath, PDF_BYTES, { contentType: "application/pdf", upsert: true });
  if (!overwrite.error) throw new Error("Finalized document overwrite was not denied");
  return { documentId: reserved.data.document_id, storagePath: expectedPath, evidence: [
    { organizationId: organizationA.organizationId, correlationId: reserveCorrelation, action: "client.document.upload.reserved", eventType: "ClientDocumentUploadReservedV1" },
    { organizationId: organizationA.organizationId, correlationId: finalizeCorrelation, action: "client.document.upload.finalized", eventType: "DocumentUploadedV1" },
  ] };
}

async function proveAuthorization(contexts, organizations) {
  const ownA = await contexts.clientA.client.from("client_compliance_cases").select("organization_id");
  const ownB = await contexts.clientB.client.from("client_compliance_cases").select("organization_id");
  if (ownA.error || ownB.error || ownA.data.length !== 1 || ownA.data[0].organization_id !== organizations.a.organizationId
      || ownB.data.length !== 1 || ownB.data[0].organization_id !== organizations.b.organizationId) throw proofFailure("TENANT_READ", [ownA, ownB]);
  const aal2Requirement = await contexts.central.client.rpc("get_my_account_security_requirement");
  const centralCases = await contexts.central.client.from("client_compliance_cases").select("organization_id").in("organization_id", [organizations.a.organizationId, organizations.b.organizationId]);
  if (aal2Requirement.error || aal2Requirement.data?.[0]?.requirement_satisfied !== true || !aal2Requirement.data[0].matched_role_codes.includes("COMPLIANCE_MANAGER")
      || centralCases.error || centralCases.data.length !== 2) throw proofFailure("CENTRAL_AAL2_ALLOW", [aal2Requirement, centralCases]);
  const aal1Requirement = await contexts.centralAal1.client.rpc("get_my_account_security_requirement");
  const aal1Cases = await contexts.centralAal1.client.from("client_compliance_cases").select("id").in("organization_id", [organizations.a.organizationId, organizations.b.organizationId]);
  if (aal1Requirement.error || aal1Requirement.data?.[0]?.requirement_satisfied !== false || aal1Requirement.data[0].current_aal !== "aal1"
      || aal1Cases.error || aal1Cases.data.length !== 0) throw proofFailure("CENTRAL_AAL1_DENY", [aal1Requirement, aal1Cases]);
  const noRoleRequirement = await contexts.noRole.client.rpc("get_my_account_security_requirement");
  const noRoleCases = await contexts.noRole.client.from("client_compliance_cases").select("id");
  if (noRoleRequirement.error || noRoleRequirement.data?.[0]?.matched_role_codes.length !== 0 || noRoleCases.error || noRoleCases.data.length !== 0) throw proofFailure("NO_ROLE_DENY", [noRoleRequirement, noRoleCases]);
}

function cleanupFailure(stage, cause) {
  return new Error(`P05 E2E cleanup failed during ${stage}`, { cause });
}

export async function cleanupRemote(resources, dependencies = {}) {
  const operations = {
    removeStorage: dependencies.removeStorage ?? ((paths) => resources.admin.storage.from("client-compliance").remove(paths)),
    neutralizeFixture: dependencies.neutralizeFixture ?? (() => neutralizeFixture(resources.database, resources)),
    listFactors: dependencies.listFactors ?? ((userId) => resources.admin.auth.admin.mfa.listFactors({ userId })),
    deleteFactor: dependencies.deleteFactor ?? ((userId, factorId) => resources.admin.auth.admin.mfa.deleteFactor({ userId, id: factorId })),
    disableUser: dependencies.disableUser ?? ((userId) => resources.admin.auth.admin.updateUserById(userId, { ban_duration: "876000h", app_metadata: { p05_e2e_fixture: true, p05_e2e_neutralized: true } })),
    getUser: dependencies.getUser ?? ((userId) => resources.admin.auth.admin.getUserById(userId)),
    verifyNeutralized: dependencies.verifyNeutralized ?? (() => verifyFixtureNeutralized(resources.database, resources)),
    closeDatabase: dependencies.closeDatabase ?? (() => resources.database.end({ timeout: 2 })),
  };
  const failures = [];
  const attempt = async (stage, operation) => {
    try { return await operation(); }
    catch (error) { failures.push(cleanupFailure(stage, error)); return undefined; }
  };

  try {
    if (resources.storagePaths.length > 0) {
      const removal = await attempt("storage", () => operations.removeStorage(resources.storagePaths));
      if (removal?.error) failures.push(cleanupFailure("storage", removal.error));
    }
    const neutralized = await attempt("database-neutralization", operations.neutralizeFixture);
    if (neutralized) resources.retainedEvidence = neutralized.retainedEvidence;

    for (const userId of resources.userIds) {
      const factors = await attempt("mfa-list", () => operations.listFactors(userId));
      if (factors?.error || (factors && !Array.isArray(factors.data?.factors))) {
        failures.push(cleanupFailure("mfa-list", factors?.error ?? new Error("Invalid MFA factor response")));
      } else for (const factor of factors?.data?.factors ?? []) {
        const deletion = await attempt("mfa-delete", () => operations.deleteFactor(userId, factor.id));
        if (deletion?.error) failures.push(cleanupFailure("mfa-delete", deletion.error));
      }
      const deactivated = await attempt("user-disable", () => operations.disableUser(userId));
      if (deactivated?.error) failures.push(cleanupFailure("user-disable", deactivated.error));
      const remainingFactors = await attempt("mfa-verify", () => operations.listFactors(userId));
      if (remainingFactors?.error || (remainingFactors && (!Array.isArray(remainingFactors.data?.factors) || remainingFactors.data.factors.length !== 0))) {
        failures.push(cleanupFailure("mfa-verify", remainingFactors?.error ?? new Error("MFA factors remain active")));
      }
      const currentUser = await attempt("user-disable-verify", () => operations.getUser(userId));
      const bannedUntil = currentUser?.data?.user?.banned_until;
      if (currentUser?.error || (currentUser && (!bannedUntil || Date.parse(bannedUntil) <= Date.now()))) {
        failures.push(cleanupFailure("user-disable-verify", currentUser?.error ?? new Error("Fixture identity remains active")));
      }
    }
    await attempt("database-verify", operations.verifyNeutralized);
  } catch (error) {
    failures.push(cleanupFailure("cleanup-orchestration", error));
  } finally {
    await attempt("database-close", operations.closeDatabase);
  }
  if (failures.length > 0) throw new AggregateError(failures, "P05 E2E cleanup did not complete safely");
}

export async function cleanupFailedProvision(stage, provisionError, resources, dependencies = {}) {
  const failures = [provisionError];
  const removeAuthDirectory = dependencies.removeAuthDirectory
    ?? (() => rm(authDirectory, { recursive: true, force: true }));
  const cleanupResources = dependencies.cleanupResources ?? (() => cleanupRemote(resources));
  try { await removeAuthDirectory(); }
  catch (error) { failures.push(cleanupFailure("local-auth-remove", error)); }
  try { await cleanupResources(); }
  catch (error) {
    if (error instanceof AggregateError) failures.push(...error.errors);
    else failures.push(error);
  }
  if (failures.length === 1) return combineProvisionAndCleanupErrors(stage, provisionError);
  return Object.assign(new AggregateError(
    failures,
    `P05 E2E setup stopped during ${stage} and cleanup also failed`,
    { cause: provisionError },
  ), { code: "P05_PROVISION_FAILED", provisionStage: stage });
}

async function neutralizeStaleFixtures(admin, database) {
  const users = await database`select id from auth.users
    where email like 'p05-e2e-%@example.invalid'
      and raw_app_meta_data @> '{"p05_e2e_fixture":true}'::jsonb`;
  if (users.length === 0) return;
  const userIds = users.map((row) => row.id);
  const organizations = await database`select id from public.organizations
    where created_by=any(${userIds}::uuid[]) and display_name like 'P05 E2E %'`;
  const organizationIds = organizations.map((row) => row.id);
  const documents = organizationIds.length === 0 ? [] : await database`select storage_object_path from public.client_compliance_documents
    where organization_id=any(${organizationIds}::uuid[])`;
  const storagePaths = documents.map((row) => row.storage_object_path);
  if (storagePaths.length > 0) {
    const removal = await admin.storage.from("client-compliance").remove(storagePaths);
    if (removal.error) throw new Error("Unable to remove stale P05 E2E storage objects");
  }
  await neutralizeFixture(database, { organizationIds, userIds });
  for (const userId of userIds) {
    const factors = await admin.auth.admin.mfa.listFactors({ userId });
    if (factors.error) throw new Error("Unable to inspect stale P05 E2E MFA factors");
    for (const factor of factors.data.factors) {
      const deletion = await admin.auth.admin.mfa.deleteFactor({ userId, id: factor.id });
      if (deletion.error) throw new Error("Unable to remove a stale P05 E2E MFA factor");
    }
    const deactivated = await admin.auth.admin.updateUserById(userId, { ban_duration: "876000h", app_metadata: { p05_e2e_fixture: true, p05_e2e_neutralized: true } });
    if (deactivated.error) throw new Error("Unable to deactivate a stale P05 E2E identity");
  }
}

export async function provision() {
  const config = await loadSafeConfiguration(root);
  const runId = safeRunId(process.env.P05_E2E_RUN_ID);
  const admin = createClient(config.supabaseUrl, config.serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const database = postgres(resolveExpectedDatabaseUrl(config), { max: 1, prepare: false, connect_timeout: 15 });
  const resources = { admin, database, organizationIds: [], userIds: [], storagePaths: [], retainedEvidence: 0 };
  let stage = "stale fixture neutralization";
  try {
    await neutralizeStaleFixtures(admin, database);
    stage = "secure local directory";
    await rm(authDirectory, { recursive: true, force: true });
    await mkdir(authDirectory, { recursive: true });
    await secureLocalPaths(authDirectory, []);
    stage = "identity creation";
    const identities = {};
    for (const [key, label] of [["clientA", "Client A"], ["clientB", "Client B"], ["central", "Conformité"], ["noRole", "Sans rôle"]]) {
      const password = randomPassword();
      const email = `p05-e2e-${key.toLowerCase()}-${runId}@example.invalid`;
      const user = await createTestUser(admin, email, password, `${label} E2E`);
      resources.userIds.push(user.id);
      identities[key] = { email, password, userId: user.id };
    }
    stage = "authentication contexts";
    const contexts = { clientA: await authenticate(config, identities.clientA.email, identities.clientA.password, admin),
      clientB: await authenticate(config, identities.clientB.email, identities.clientB.password, admin),
      central: await authenticate(config, identities.central.email, identities.central.password, admin),
      noRole: await authenticate(config, identities.noRole.email, identities.noRole.password, admin) };
    stage = "organization and compliance cases";
    const organizationA = await createOrganizationAndCase(contexts.clientA.client, runId, "a");
    resources.organizationIds.push(organizationA.organizationId);
    const organizationB = await createOrganizationAndCase(contexts.clientB.client, runId, "b");
    resources.organizationIds.push(organizationB.organizationId);
    const organizations = { a: organizationA, b: organizationB };
    stage = "test-only central role bootstrap";
    await bootstrapComplianceRole(database, identities.central.userId);
    stage = "central AAL2 authentication";
    const centralTotp = await elevateToAal2(contexts.central);
    // GoTrue may invalidate earlier AAL1 sessions when a factor is verified.
    // Obtain a new native session afterwards; a revoked JWT is not an AAL1 fixture.
    stage = "fresh central AAL1 authentication";
    contexts.centralAal1 = await authenticate(config, identities.central.email, identities.central.password, admin);
    const freshAal1User = await contexts.centralAal1.client.auth.getUser();
    const freshAal1Assurance = await contexts.centralAal1.client.auth.mfa.getAuthenticatorAssuranceLevel();
    const retainedAal2User = await contexts.central.client.auth.getUser();
    if (freshAal1User.error || freshAal1User.data.user?.id !== identities.central.userId
      || freshAal1Assurance.error || freshAal1Assurance.data.currentLevel !== "aal1"
      || retainedAal2User.error || retainedAal2User.data.user?.id !== identities.central.userId) {
      throw proofFailure("CENTRAL_FRESH_NATIVE_SESSIONS", [freshAal1User, freshAal1Assurance, retainedAal2User]);
    }
    const centralAal1State = toPlaywrightState(contexts.centralAal1.cookies, config.baseUrl);
    stage = "authorization proofs";
    await proveAuthorization(contexts, organizations);
    stage = "storage and transition proofs";
    const document = await createAndProveDocument(contexts.clientA.client, contexts.clientB.client, organizations.a, organizations.b, runId, resources);
    stage = "audit and outbox proof";
    await verifyCommandEvidence(database, [...organizations.a.evidence, ...organizations.b.evidence, ...document.evidence]);
    stage = "local states";
    const stateValues = { clientA: toPlaywrightState(contexts.clientA.cookies, config.baseUrl), clientB: toPlaywrightState(contexts.clientB.cookies, config.baseUrl),
      centralAal1: centralAal1State, centralAal2: toPlaywrightState(contexts.central.cookies, config.baseUrl), noRole: toPlaywrightState(contexts.noRole.cookies, config.baseUrl) };
    const states = {};
    const files = [];
    for (const [key, value] of Object.entries(stateValues)) {
      const path = resolve(authDirectory, `${key}.json`);
      await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
      files.push(path);
      states[key] = { path, sha256: await sha256File(path) };
    }
    const createdAt = new Date();
    const manifestPath = resolve(authDirectory, "manifest.json");
    const manifest = { schemaVersion: 1, environment: config.environment, projectRef: config.projectRef, baseUrl: config.baseUrl, runId,
      createdAt: createdAt.toISOString(), expiresAt: new Date(createdAt.getTime() + 10 * 60_000).toISOString(), states,
      fixtures: { organizationA: { id: organizations.a.organizationId, name: organizations.a.organizationName, caseId: organizations.a.complianceCaseId },
        organizationB: { id: organizations.b.organizationId, name: organizations.b.organizationName, caseId: organizations.b.complianceCaseId },
        document: { id: document.documentId, status: "PENDING_REVIEW" } },
      proof: { authentication: config.runtimeMode === "isolated-local-docker" ? "REAL_GOTRUE_OTP_AND_TOTP" : "REAL_GOTRUE_PASSWORD_AND_TOTP", runtimeMode: config.runtimeMode ?? "hosted-nonproduction", bootstrap: "PRIVILEGED_TEST_FIXTURE_WITHOUT_SYNTHETIC_AUDIT", realCommandAuditOutbox: true, tenantIsolation: true, storageIsolation: true, centralAal2: true } };
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
    files.push(manifestPath);
    await secureLocalPaths(authDirectory, files);
    await validateFreshManifest(JSON.parse(await readFile(manifestPath, "utf8")), config);
    let cleanupPromise;
    return { config, manifest, manifestPath, resources, sessions: contexts, authSecrets: { centralTotp }, cleanup: () => {
      cleanupPromise ??= cleanupRemote(resources);
      return cleanupPromise;
    } };
  } catch (error) {
    throw await cleanupFailedProvision(stage, error, resources);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let fixture;
  try { fixture = await provision(); console.log("PASS P05 authenticated fixture proofs completed"); }
  catch (error) { console.error(`FAIL ${error.message}; no credential or remote detail was printed`); process.exitCode = 1; }
  finally {
    if (fixture) {
      try { await fixture.cleanup(); }
      catch { console.error("FAIL P05 remote fixture neutralization failed"); process.exitCode = 1; }
    }
    await rm(authDirectory, { recursive: true, force: true });
  }
}
