// Test-only boundary: no product command exists yet for platform-role bootstrap or fixture neutralization.
// This adapter is guarded upstream by the exact development/staging project checks.

export async function bootstrapComplianceRole(database, userId) {
  await database`insert into public.platform_user_roles(user_id,role_code,granted_by)
    values(${userId}::uuid,'COMPLIANCE_MANAGER',null)`;
}

export async function verifyCommandEvidence(database, expected) {
  for (const item of expected) {
    const rows = await database`select
      count(distinct audit.id)::integer as audits,
      count(distinct outbox.id)::integer as outbox_events,
      bool_and(audit.event_hash ~ '^[0-9a-f]{64}$' and audit.event_hash<>repeat('0',64)) as valid_hashes
      from public.audit_events audit
      join public.event_outbox outbox on outbox.correlation_id=audit.correlation_id
      where audit.organization_id=${item.organizationId}::uuid
        and audit.correlation_id=${item.correlationId}::uuid
        and audit.action=${item.action}
        and outbox.event_type=${item.eventType}`;
    if (rows.length !== 1 || rows[0].audits !== 1 || rows[0].outbox_events !== 1 || rows[0].valid_hashes !== true) {
      throw new Error("Real command audit/outbox correlation proof failed");
    }
  }
}

export async function neutralizeFixture(database, fixture) {
  if (fixture.organizationIds.length === 0 && fixture.userIds.length === 0) return { retainedEvidence: 0 };
  let stage = "outbox";
  try {
    return await database.begin(async (transaction) => {
    if (fixture.organizationIds.length > 0) {
      stage = "outbox";
      await transaction`update public.event_outbox set published_at=coalesce(published_at,clock_timestamp()),locked_at=null,locked_by=null
        where organization_id=any(${fixture.organizationIds}::uuid[])`;
      stage = "franchise mandates";
      await transaction`update public.franchises set status='TERMINATED',updated_at=clock_timestamp(),row_version=row_version+1 where operator_organization_id=any(${fixture.organizationIds}::uuid[]) and status<>'TERMINATED'`;
      stage = "organization roles";
      await transaction`update public.organization_member_roles role set revoked_at=coalesce(role.revoked_at,clock_timestamp())
        from public.organization_memberships membership
        where role.membership_id=membership.id and membership.organization_id=any(${fixture.organizationIds}::uuid[])`;
      stage = "memberships";
      await transaction`update public.organization_memberships set status='REVOKED',updated_at=clock_timestamp(),row_version=row_version+1
        where organization_id=any(${fixture.organizationIds}::uuid[]) and status<>'REVOKED'`;
      stage = "organizations";
      await transaction`update public.organizations set status='ARCHIVED',updated_at=clock_timestamp(),row_version=row_version+1
        where id=any(${fixture.organizationIds}::uuid[]) and status<>'ARCHIVED'`;
    }
    if (fixture.userIds.length > 0) {
      stage = "platform roles";
      await transaction`delete from public.platform_user_roles
        where user_id=any(${fixture.userIds}::uuid[]) and role_code='COMPLIANCE_MANAGER'`;
    }
    stage = "retained evidence";
    const retained = fixture.organizationIds.length === 0 ? [{ count: 0 }] : await transaction`select
      (select count(*) from public.audit_events where organization_id=any(${fixture.organizationIds}::uuid[]))
      +(select count(*) from public.event_outbox where organization_id=any(${fixture.organizationIds}::uuid[]))
      +(select count(*) from public.client_compliance_cases where organization_id=any(${fixture.organizationIds}::uuid[])) as count`;
    return { retainedEvidence: Number(retained[0].count) };
    });
  } catch {
    throw new Error(`Privileged fixture neutralization failed during ${stage}`);
  }
}

export async function verifyFixtureNeutralized(database, fixture) {
  const rows = await database`select
    (select count(*) from public.organizations where id=any(${fixture.organizationIds}::uuid[]) and status<>'ARCHIVED')::integer as active_organizations,
    (select count(*) from public.organization_memberships where organization_id=any(${fixture.organizationIds}::uuid[]) and status<>'REVOKED')::integer as active_memberships,
    (select count(*) from public.organization_member_roles role join public.organization_memberships membership on membership.id=role.membership_id
      where membership.organization_id=any(${fixture.organizationIds}::uuid[]) and role.revoked_at is null)::integer as active_organization_roles,
    (select count(*) from public.platform_user_roles where user_id=any(${fixture.userIds}::uuid[]) and revoked_at is null)::integer as active_platform_roles,
    (select count(*) from storage.objects where bucket_id='client-compliance' and name=any(${fixture.storagePaths}::text[]))::integer as storage_objects`;
  const result = rows[0];
  if (Object.values(result).some((value) => value !== 0)) throw new Error("Privileged fixture neutralization verification failed");
}
