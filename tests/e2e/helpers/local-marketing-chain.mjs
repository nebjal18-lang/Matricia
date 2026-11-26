import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import postgres from "postgres";
import { loadSafeConfiguration, resolveExpectedDatabaseUrl } from "../../../scripts/p05-e2e/environment.mjs";

const root = resolve(import.meta.dirname, "../../..");
const { createServerClient } = createRequire(resolve(root, "apps/web/package.json"))("@supabase/ssr");

/** Local prerequisites only; generation, approval and scheduling use guarded application RPCs. */
export async function openLocalMarketingChain(fixture, language) {
  const config = await loadSafeConfiguration(root);
  assert.equal(config.runtimeMode, "isolated-local-docker");
  assert.equal(config.localDockerVerified, true);
  const db = postgres(resolveExpectedDatabaseUrl(config), { max: 1, prepare: false });
  const organizationId = fixture.content.organizationId;
  const campaignId = randomUUID(), accountId = randomUUID(), ruleId = randomUUID();
  let connectionId = randomUUID();
  const state = JSON.parse(await readFile(process.env.E2E_ADMIN_STORAGE_STATE, "utf8"));
  const actor = createServerClient(config.supabaseUrl, config.publishableKey, { cookies: { getAll: () => state.cookies, setAll: () => {} } });
  try {
    const identity = await actor.auth.getUser();
    assert.ok(identity.data.user && !identity.error, "MARKETING_ACTOR_REQUIRED");
    const actorId = identity.data.user.id;
    const [owned] = await db`select c.brand_kit_version_id,c.created_by from public.marketing_campaigns c join public.organizations o on o.id=c.organization_id join auth.users u on u.id=o.created_by where c.id=${fixture.content.campaignId}::uuid and c.organization_id=${organizationId}::uuid and u.raw_app_meta_data @> '{"p05_e2e_fixture":true}'::jsonb`;
    assert.ok(owned, "MARKETING_FIXTURE_OWNERSHIP_REQUIRED");
    const [existingConnection] = await db`select id from public.social_connections where organization_id=${organizationId}::uuid and provider='LINKEDIN'`;
    if (existingConnection) connectionId = existingConnection.id;
    const [pending] = await db`select count(*)::int as count from public.marketing_campaigns c where c.status in('DRAFT','GENERATED') and nullif(c.source_snapshot->>'service_id','') is not null and not exists(select 1 from private.marketing_content_generation_claims g where g.campaign_id=c.id and g.status in('COMPLETED','DEAD_LETTER'))`;
    assert.equal(pending.count, 0, "LOCAL_MARKETING_FOREIGN_GENERATION_QUEUE_NOT_EMPTY");
    const [publications] = await db`select count(*)::int as count from public.social_publication_jobs where status in('QUEUED','CLAIMED')`;
    assert.equal(publications.count, 0, "LOCAL_MARKETING_FOREIGN_PUBLICATION_QUEUE_NOT_EMPTY");
    await db.begin(async tx => {
      await tx`insert into public.marketing_campaigns(id,organization_id,brand_kit_version_id,mode,title_fr,title_ar,status,audience_snapshot,source_snapshot,created_by) values(${campaignId}::uuid,${organizationId}::uuid,${owned.brand_kit_version_id}::uuid,'ASSISTED','Chaîne E2E','اختبار متكامل','DRAFT','{}'::jsonb,${tx.json({service_id:fixture.content.serviceId,library_id:fixture.content.libraryId,template_key:"PROBLEM_SOLUTION",language})},${owned.created_by}::uuid)`;
      if (!existingConnection) {
      await tx`insert into public.marketing_consents(organization_id,purpose,decision,policy_version,evidence_hash,decided_by) values(${organizationId}::uuid,'SOCIAL_PUBLISHING','GRANTED','E2E-LOCAL',repeat('a',64),${actorId}::uuid)`;
      await tx`insert into public.marketing_brand_authorizations(organization_id,decision,authorization_scope,policy_version,evidence_hash,effective_from,decided_by) values(${organizationId}::uuid,'GRANTED',array['SOCIAL_PUBLISHING'],'E2E-LOCAL',repeat('b',64),clock_timestamp(),${actorId}::uuid)`;
      await tx`insert into public.social_connections(id,organization_id,provider,status,scopes,credential_reference,connected_by) values(${connectionId}::uuid,${organizationId}::uuid,'LINKEDIN','ACTIVE',array['w_member_social'],'vault://E2E_LOCAL_SANDBOX',${actorId}::uuid)`;
      await tx`insert into public.social_connection_security_versions(organization_id,social_connection_id,version,provider,status,vault_credential_reference,ciphertext_fingerprint,approved_scopes,created_by) values(${organizationId}::uuid,${connectionId}::uuid,1,'LINKEDIN','ACTIVE','vault://E2E_LOCAL_SANDBOX',repeat('c',64),array['w_member_social'],${actorId}::uuid)`;
      await tx`insert into public.social_accounts(id,organization_id,connection_id,provider_account_reference,display_name,status) values(${accountId}::uuid,${organizationId}::uuid,${connectionId}::uuid,${accountId},'Compte E2E local','ACTIVE')`;
      await tx`insert into public.marketing_schedule_rules(id,organization_id,social_account_id,version,status,timezone,allowed_slots,content_hash,created_by) values(${ruleId}::uuid,${organizationId}::uuid,${accountId}::uuid,1,'ACTIVE','Africa/Casablanca','[]',repeat('d',64),${actorId}::uuid)`;
      await tx`insert into public.marketing_schedule_rule_heads(organization_id,social_account_id,current_rule_id,updated_by) values(${organizationId}::uuid,${accountId}::uuid,${ruleId}::uuid,${actorId}::uuid)`;
      }
    });
    return {
      campaignId,
      async approveAndSchedule() {
        const [campaign] = await db`select status,row_version from public.marketing_campaigns where id=${campaignId}::uuid`;
        const contents = await db`select c.channel,v.id,v.status from public.marketing_content c join public.marketing_content_versions v on v.id=c.current_version_id where c.campaign_id=${campaignId}::uuid`;
        assert.equal(contents.length, 3, "GENERATED_CONTENT_NOT_PERSISTED");
        assert.equal(campaign.status, "VALIDATED_BY_RULES");
        const approval = await actor.rpc("approve_marketing_campaign", {p_campaign_id:campaignId,p_expected_row_version:campaign.row_version,p_idempotency_key:randomUUID()});
        assert.equal(approval.error?.code ?? null, null, "MARKETING_APPROVAL_FAILED");
        assert.equal(approval.data?.outcome, "MARKETING_CAMPAIGN_APPROVED");
        const content = contents.find(row => row.channel === "LINKEDIN");
        assert.ok(content);
        const scheduleAt = new Date(Date.now() + 2500).toISOString();
        const scheduled = await actor.rpc("schedule_marketing_campaign", {p_campaign_id:campaignId,p_items:[{content_version_id:content.id,social_connection_id:connectionId,scheduled_at:scheduleAt}],p_expected_row_version:campaign.row_version+1,p_idempotency_key:randomUUID()});
        assert.equal(scheduled.error?.code ?? null, null, "MARKETING_SCHEDULE_FAILED");
        assert.equal(scheduled.data?.scheduled_count, 1);
        return Date.parse(scheduleAt);
      },
      async verifyPublication() {
        const rows = await db`select r.outcome from public.social_publication_results r join public.social_publication_jobs j on j.id=r.job_id join public.marketing_calendar_items i on i.id=j.calendar_item_id where i.campaign_id=${campaignId}::uuid`;
        assert.deepEqual(rows.map(row => row.outcome), ["SANDBOXED"]);
      },
      async verifyAttribution() {
        const [row] = await db`select count(*)::int as count from public.marketing_attribution_events where campaign_id=${campaignId}::uuid and event_type='CTA_CLICKED'`;
        assert.equal(row.count, 1);
      },
      close: () => db.end({timeout:2}),
    };
  } catch (error) { await db.end({timeout:2}); throw error; }
}
