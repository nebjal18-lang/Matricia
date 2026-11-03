import { createHash, randomUUID } from 'node:crypto';

/** Isolated fixture setup only. Product transactions in the browser keep all normal guards. */
export async function provisionLocalSecondaryMandate(fixture, primary) {
  if (fixture.config.runtimeMode !== 'isolated-local-docker' || !fixture.config.localDockerVerified) throw new Error('Secondary local mandate requires Docker verification');
  const database = fixture.resources.database;
  const organizationId = randomUUID(), membershipId = randomUUID(), franchiseId = randomUUID(), territoryId = randomUUID(), mandateId = randomUUID();
  const territory = `E2E_${randomUUID().replaceAll('-', '').slice(0, 20).toUpperCase()}`;
  const hash = createHash('sha256').update(franchiseId).digest('hex');
  fixture.resources.organizationIds.push(organizationId);
  // Record before committing so the normal finally-cleanup includes partial setup.
  primary.secondary = { organizationId, franchiseId };
  await database.begin(async tx => {
    await tx`insert into public.organizations(id,legal_name,display_name,status,created_by) values(${organizationId}::uuid,'P05 E2E second mandate','P05 E2E second mandate','ACTIVE',${primary.providerFranchiseUserId}::uuid)`;
    await tx`insert into public.organization_memberships(id,organization_id,user_id,status,activated_at) values(${membershipId}::uuid,${organizationId}::uuid,${primary.providerFranchiseUserId}::uuid,'ACTIVE',clock_timestamp())`;
    await tx`insert into public.franchises(id,library_id,operator_organization_id,franchise_type,operator_code,territory_code,status,created_by)
      select ${franchiseId}::uuid,library_id,${organizationId}::uuid,franchise_type,operator_code,${territory},'CONTRACT_PENDING',created_by from public.franchises where id=${primary.franchiseId}::uuid`;
    await tx`insert into public.franchise_territory_versions(id,franchise_id,version,territory_code,name_fr,name_ar,scope_snapshot,effective_from,content_hash,created_by)
      values(${territoryId}::uuid,${franchiseId}::uuid,1,${territory},'Deuxième mandat local','تفويض محلي ثان','{"fixture":"LOCAL_DUAL_MANDATE"}'::jsonb,clock_timestamp(),${hash},${primary.providerFranchiseUserId}::uuid)`;
    await tx`insert into public.franchise_mandate_versions(id,franchise_id,territory_version_id,economic_rule_version_id,version,mandate_status,rights_snapshot,obligations_snapshot,contract_snapshot,entry_fee_minor,entry_fee_mode,entry_fee_term_months,franchisee_share_bps,neoxa_share_bps,matricia_share_bps,distribution_basis,effective_from,content_hash,created_by)
      select ${mandateId}::uuid,${franchiseId}::uuid,${territoryId}::uuid,economic_rule_version_id,1,'ACTIVE',rights_snapshot,obligations_snapshot,contract_snapshot,entry_fee_minor,entry_fee_mode,entry_fee_term_months,franchisee_share_bps,neoxa_share_bps,matricia_share_bps,distribution_basis,clock_timestamp(),${hash},created_by from public.franchise_mandate_versions where id=(select current_mandate_version_id from public.franchises where id=${primary.franchiseId}::uuid)`;
    await tx`update public.franchises set status='ACTIVE',current_mandate_version_id=${mandateId}::uuid,row_version=row_version+1 where id=${franchiseId}::uuid`;
    await tx`insert into public.organization_member_roles(membership_id,role_code,franchise_id,granted_by) values(${membershipId}::uuid,'FRANCHISE_OWNER',${franchiseId}::uuid,${primary.providerFranchiseUserId}::uuid)`;
    await tx`insert into public.catalog_library_mandates(library_id,organization_id,status,valid_from,policy_version,created_by) select library_id,${organizationId}::uuid,'ACTIVE',clock_timestamp(),1,${primary.providerFranchiseUserId}::uuid from public.franchises where id=${franchiseId}::uuid`;
  });
  const ids = [primary.franchiseId, franchiseId];
  const allowed = await fixture.sessions.noRole.client.from('franchises').select('id,operator_organization_id,current_mandate_version_id').in('id', ids);
  const denied = await fixture.sessions.clientB.client.from('franchises').select('id').in('id', ids);
  const catalog = await fixture.sessions.noRole.client.from('catalog_library_mandates').select('organization_id').in('organization_id',[primary.organizationId,organizationId]).eq('status','ACTIVE');
  const foreignCatalog = await fixture.sessions.clientB.client.from('catalog_library_mandates').select('organization_id').in('organization_id',[primary.organizationId,organizationId]);
  const [admin] = await database`select count(*)::integer as memberships from public.organization_memberships where user_id=${fixture.resources.userIds[2]}::uuid`;
  if (allowed.error || allowed.data?.length !== 2 || new Set(allowed.data.map(x => x.operator_organization_id)).size !== 2 || allowed.data.some(x => !x.current_mandate_version_id) || denied.error || denied.data?.length !== 0 || admin?.memberships !== 0 || catalog.error || catalog.data?.length !== 2 || foreignCatalog.error || foreignCatalog.data?.length !== 0) throw new Error('Real local dual-mandate/session isolation proof failed');
  primary.localProof = { authentication: 'REAL_GOTRUE_OTP_AND_TOTP', authorizedOrganizations: 2, activeMandates: 2, activeCatalogMandates: 2, foreignSessionDenied: true, adminWithoutOrganization: true };
}
