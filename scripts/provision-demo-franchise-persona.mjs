import { createHash, randomBytes } from "node:crypto";
import { createRequire } from "node:module";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import postgres from "postgres";
import { parseEnv, resolveExpectedDatabaseUrl } from "./p05-e2e/environment.mjs";

/**
 * Persona démo Franchisé : compte, organisation opérateur, franchise ACTIVE,
 * territoire versionné, prospects avec relances réelles, alertes ouvertes et
 * objectif actif. Déterministe et idempotent ; restreint development/staging ;
 * les identifiants ne sont jamais affichés (stockés dans .env.local ignoré par Git).
 */
const root = resolve(import.meta.dirname, "..");
const requireFromWeb = createRequire(resolve(root, "apps", "web", "package.json"));
const { createClient } = requireFromWeb("@supabase/supabase-js");

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
const secret = () => `${randomBytes(24).toString("base64url")}aA7!`;

async function saveLocalEnvironment(source, values) {
  let result = source;
  for (const [key, value] of Object.entries(values)) {
    const line = `${key}=${value}`;
    const pattern = new RegExp(`^${key}=.*$`, "m");
    result = pattern.test(result) ? result.replace(pattern, line) : `${result.trimEnd()}\n${line}\n`;
  }
  await writeFile(resolve(root, ".env.local"), result, { encoding: "utf8", mode: 0o600 });
}

async function upsertUser(admin, database, userId, email, password, label) {
  const rows = await database`select id from auth.users where lower(email)=lower(${email}) limit 1`;
  const attributes = {
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: label, preferred_locale: "fr-MA" },
    app_metadata: { matricia_demo: true, demo_persona: "franchise" },
  };
  if (rows.length) {
    const { data, error } = await admin.auth.admin.updateUserById(rows[0].id, attributes);
    if (error) throw new Error("Demo franchise identity update failed");
    return data.user;
  }
  const { data, error } = await admin.auth.admin.createUser({ id: userId, ...attributes });
  if (error) throw new Error("Demo franchise identity creation failed");
  return data.user;
}

async function main() {
  const envPath = resolve(root, ".env.local");
  const [source, metadataSource] = await Promise.all([
    readFile(envPath, "utf8"),
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
    { max: 1, prepare: false, connect_timeout: 15 },
  );
  const admin = createClient(url, required(env.SUPABASE_SERVICE_ROLE_KEY, "SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const credentials = {
    MATRICIA_DEMO_ACCESS_ENABLED: "true",
    MATRICIA_DEMO_FRANCHISE_EMAIL: env.MATRICIA_DEMO_FRANCHISE_EMAIL || "demo.franchise@matricia.test",
    MATRICIA_DEMO_FRANCHISE_PASSWORD: env.MATRICIA_DEMO_FRANCHISE_PASSWORD || secret(),
  };

  try {
    const user = await upsertUser(admin, database, id(`${projectRef}:demo:franchise-user`), credentials.MATRICIA_DEMO_FRANCHISE_EMAIL, credentials.MATRICIA_DEMO_FRANCHISE_PASSWORD, "Franchisé Démo Matricia");

    const libraries = await database`
      select id, code from public.catalog_libraries
      where code in ('COM', 'ACC', 'SALES') and status not in ('RETIRED', 'ARCHIVED')
      order by case code when 'COM' then 0 when 'ACC' then 1 else 2 end
      limit 1`;
    if (libraries.length !== 1) throw new Error("A domain catalog library (COM/ACC/SALES) is required for the demo franchise");
    const library = libraries[0];

    const operatorOrg = id(`${projectRef}:demo:franchise:operator-org`);
    const membership = id(`${operatorOrg}:membership`);
    const franchise = id(`${projectRef}:demo:franchise:franchise`);
    const territory = id(`${projectRef}:demo:franchise:territory:v1`);
    const mandate = id(`${projectRef}:demo:franchise:mandate:v1`);
    const snapshot = id(`${projectRef}:demo:franchise:snapshot:2026-08`);
    const now = Date.now();
    const dayMs = 86_400_000;
    const economicRules = await database`
      select id from public.franchise_economic_rule_versions
      where franchise_type = 'STANDARD' and status = 'ACTIVE'
      order by version desc
      limit 1`;
    if (economicRules.length !== 1) throw new Error("An ACTIVE STANDARD franchise economic rule is required for the demo franchise mandate");
    const economicRuleId = economicRules[0].id;
    const mandateHash = digest(`${franchise}:mandate:v1:${territory}:${economicRuleId}`);

    await database.begin(async (tx) => {
      await tx`insert into public.organizations(id,legal_name,display_name,country_code,status,created_by)
        values(${operatorOrg}::uuid,'Franchisé Démo Matricia','Franchisé · Démo Matricia','MA','ACTIVE',${user.id}::uuid)
        on conflict(id) do update set legal_name=excluded.legal_name,display_name=excluded.display_name,status='ACTIVE'`;
      await tx`insert into public.organization_memberships(id,organization_id,user_id,status,activated_at)
        values(${membership}::uuid,${operatorOrg}::uuid,${user.id}::uuid,'ACTIVE',clock_timestamp())
        on conflict(id) do update set user_id=excluded.user_id,status='ACTIVE',activated_at=coalesce(public.organization_memberships.activated_at,clock_timestamp())`;
      await tx`insert into public.franchises(id,library_id,operator_organization_id,franchise_type,operator_code,territory_code,status,created_by)
        values(${franchise}::uuid,${library.id}::uuid,${operatorOrg}::uuid,'STANDARD','FRANCHISEE','SOUSS','ACTIVE',${user.id}::uuid)
        on conflict(id) do update set status='ACTIVE',library_id=excluded.library_id,operator_organization_id=excluded.operator_organization_id`;
      await tx`insert into public.organization_member_roles(membership_id,role_code,franchise_id,granted_by,revoked_at)
        values(${membership}::uuid,'FRANCHISE_OWNER',${franchise}::uuid,${user.id}::uuid,null)
        on conflict(membership_id,role_code) do update set franchise_id=excluded.franchise_id,granted_by=excluded.granted_by,revoked_at=null`;
      await tx`insert into public.franchise_territory_versions(id,franchise_id,version,territory_code,name_fr,name_ar,scope_snapshot,effective_from,content_hash,created_by)
        values(${territory}::uuid,${franchise}::uuid,1,'SOUSS','Souss-Massa (démo)','سوس ماسة (تجريبي)',${tx.json({ regions: ["Souss-Massa"], origin: "demo" })},${new Date(now - 30 * dayMs).toISOString()},${digest(`${franchise}:territory:v1`)},${user.id}::uuid)
        on conflict(id) do nothing`;
      await tx`insert into public.franchise_mandate_versions(
          id,franchise_id,territory_version_id,economic_rule_version_id,version,mandate_status,
          rights_snapshot,obligations_snapshot,contract_snapshot,entry_fee_minor,entry_fee_mode,entry_fee_term_months,
          franchisee_share_bps,neoxa_share_bps,matricia_share_bps,distribution_basis,effective_from,content_hash,created_by
        ) values(
          ${mandate}::uuid,${franchise}::uuid,${territory}::uuid,${economicRuleId}::uuid,1,'ACTIVE',
          ${tx.json({ origin: "demo", libraryCode: library.code })},
          ${tx.json({ origin: "demo", obligations: ["catalog_quality", "network_followup"] })},
          ${tx.json({ origin: "demo", mode: "CONTRACTUAL" })},
          0,'EXEMPT',0,5000,2500,2500,'DISTRIBUTABLE_PROFIT',${new Date(now - 30 * dayMs).toISOString()},${mandateHash},${user.id}::uuid
        )
        on conflict(id) do update set mandate_status='ACTIVE',effective_from=excluded.effective_from,content_hash=excluded.content_hash`;
      await tx`update public.franchises
        set current_mandate_version_id=${mandate}::uuid,
            status='ACTIVE',
            updated_at=clock_timestamp()
        where id=${franchise}::uuid`;
    });

    const prospects = [
      { key: "atlas", name: "Coopérative Argane Tassila", email: "contact@argane-tassila.example.ma", type: "CLIENT", stage: "REGISTERED", followup: new Date(now - 2 * dayMs).toISOString() },
      { key: "logistique", name: "Atlas Logistique Souk", email: "contact@atlas-logistique.example.ma", type: "PROVIDER", stage: "VERIFIED", followup: new Date(now + 3 * dayMs).toISOString() },
      { key: "traiteur", name: "Médina Traiteur Collectif", email: "contact@medina-traiteur.example.ma", type: "CLIENT", stage: "CONTRACT_SIGNED", followup: null },
    ];
    for (const prospect of prospects) {
      await database`insert into public.franchise_crm_prospects(id,franchise_id,territory_version_id,prospect_type,display_name,contact_email,organization_name,source_code,pipeline_stage,next_followup_at,owner_user_id,created_by)
        values(${id(`${projectRef}:demo:franchise:prospect:${prospect.key}`)}::uuid,${franchise}::uuid,${territory}::uuid,${prospect.type},${prospect.name},${prospect.email},${prospect.name},'TERRAIN',${prospect.stage},${prospect.followup},${user.id}::uuid,${user.id}::uuid)
        on conflict(id) do nothing`;
    }

    await database`insert into public.franchise_performance_objective_versions(id,franchise_id,objective_code,version,title_fr,title_ar,target_value,current_value,unit_code,status,owner_user_id,starts_on,due_on,rule_version,evidence_refs,created_by)
      values(${id(`${projectRef}:demo:franchise:objective:prospects:v1`)}::uuid,${franchise}::uuid,'PROSPECTS_QUALIFIES',1,'Qualifier 20 prospects territoriaux','تأهيل 20 عميلاً محتملاً في المجال',20,7,'COUNT','ACTIVE',${user.id}::uuid,'2026-09-01','2026-12-31','demo-v1','[]'::jsonb,${user.id}::uuid)
      on conflict(id) do nothing`;

    const demoMetric = id(`${projectRef}:demo:franchise:metric:client-network:v1`);
    await database`insert into public.franchise_performance_metric_versions(id,metric_code,version,axis_code,label_fr,label_ar,weight_basis_points,warning_below_basis_points,status,source_contract,effective_from,content_hash,created_by)
      values(${demoMetric}::uuid,'DEMO_CLIENT_NETWORK',1,'CLIENT_NETWORK','Réseau clients (démo)','شبكة العملاء (تجريبي)',10000,7000,'ACTIVE',${database.json({ origin: "demo", note: "Seeded demo metric for the franchise persona smoke" })},${new Date(now - 30 * dayMs).toISOString()},${digest(`${projectRef}:demo:metric:client-network:v1`)},${user.id}::uuid)
      on conflict(id) do nothing`;
    const metrics = await database`select id, metric_code from public.franchise_performance_metric_versions where status='ACTIVE' order by metric_code limit 2`;
    let alertsSeeded = 0;
    if (metrics.length > 0) {
      const measurements = metrics.map((metric) => ({ metric_version_id: metric.id, numerator: "62", denominator: "100", evidence_refs: [] }));
      await database`insert into public.franchise_performance_score_snapshots(id,franchise_id,period_start,period_end,model_version,global_score_basis_points,library_quality_score_basis_points,axis_scores,measurements_snapshot,source_evidence_hash,health_suggestion,created_by)
        values(${snapshot}::uuid,${franchise}::uuid,'2026-08-01','2026-08-31','demo-v1',6200,7100,${database.json({ CLIENT_NETWORK: 5800 })},${database.json(measurements)},${digest(`${franchise}:snapshot:2026-08`)},'ATTENTION',${user.id}::uuid)
        on conflict(id) do nothing`;
      const alerts = [
        { key: "critical", type: "KPI_THRESHOLD", severity: "CRITICAL", fr: "Score réseau clients sous le seuil d’alerte sur la période 2026-08.", ar: "درجة شبكة العملاء تحت حد التنبيه لفترة 2026-08.", metric: metrics[0].metric_code },
        { key: "warning", type: "SLA", severity: "WARNING", fr: "Délai moyen de relance supérieur à 72 h sur la période 2026-08.", ar: "متوسط مهلة المتابعة تجاوز 72 ساعة لفترة 2026-08.", metric: null },
      ];
      for (const alert of alerts) {
        const result = await database`insert into public.franchise_performance_alerts(id,franchise_id,snapshot_id,alert_type,severity,status,metric_code,explanation_fr,explanation_ar,evidence_refs,rule_version)
          values(${id(`${projectRef}:demo:franchise:alert:${alert.key}`)}::uuid,${franchise}::uuid,${snapshot}::uuid,${alert.type},${alert.severity},'OPEN',${alert.metric},${alert.fr},${alert.ar},'[]'::jsonb,'demo-v1')
          on conflict(id) do nothing`;
        alertsSeeded += result.count;
      }
    }

    await saveLocalEnvironment(source, credentials);
    console.log(`PASS demo Franchise persona provisioned (library ${library.code}, active mandate, 3 prospects, 1 objective, ${alertsSeeded} alerts${metrics.length === 0 ? " — no ACTIVE metric, snapshot/alerts skipped" : ""}); credentials stored only in ignored .env.local`);
  } finally {
    await database.end({ timeout: 2 });
  }
}

try {
  await main();
} catch (error) {
  console.error(`FAIL ${error instanceof Error ? error.message : "demo franchise provisioning failed"}; no credential was printed`);
  process.exitCode = 1;
}
