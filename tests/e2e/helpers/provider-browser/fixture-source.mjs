import { createHash, randomUUID } from 'node:crypto';

const identifier = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/iu;
const forbiddenFixtureSql = /\b(?:auth\.(?:users|sessions|mfa_factors)|organizations|organization_identifiers|organization_memberships|organization_member_roles|platform_user_roles|provider_(?:profiles|qualifications|qualification_decisions)|financial_entries|credit_ledger|storage\.objects|create\s+(?:function|procedure|trigger|policy)|alter\s+table|delete\s+from|truncate|session_replication_role|disable\s+trigger|enable\s+trigger)\b/iu;

function section(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  if (start < 0 || end <= start) throw new Error('REVIEWED_PROVIDER_FIXTURE_LAYOUT_CHANGED');
  return source.slice(start, end);
}

/** Historical TEST catalogue only. Never authenticates, qualifies or verifies a party. */
export function historicalProviderCatalogue({ catalogueSource, questionnaireSource, owner, author, reviewer, token, uuid = randomUUID }) {
  for (const value of [owner.organizationId, author.userId, reviewer.userId, token]) {
    if (!identifier.test(value ?? '')) throw new Error('EXACT_NATIVE_PROVIDER_FIXTURE_IDENTITIES_REQUIRED');
  }
  if (author.userId === reviewer.userId) throw new Error('DISTINCT_TEST_CATALOGUE_STAFF_REQUIRED');
  const catalogue = section(catalogueSource, 'insert into public.catalog_libraries(', 'create temporary table mf024_catalog');
  const questionnaire = section(questionnaireSource, 'insert into public.catalog_releases(', 'set constraints all immediate;set constraints all deferred;');
  const mapped = new Map([
    ['fd110000-0000-4000-8000-000000000001', owner.organizationId],
    ['fd100000-0000-4000-8000-000000000001', author.userId],
    ['d0610000-0000-0000-0000-000000000001', owner.organizationId],
    ['d0600000-0000-0000-0000-000000000003', author.userId],
  ]);
  for (const value of new Set((catalogue + questionnaire).match(/[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}/giu))) {
    if (!mapped.has(value)) mapped.set(value, uuid());
  }
  // Both reviewed fixture subsets share one explicit library in this run.
  mapped.set('d0630000-0000-0000-0000-000000000001', mapped.get('fd300000-0000-4000-8000-000000000001'));
  let sql = catalogue + '\n' + questionnaire;
  for (const [from, to] of mapped) {
    if (!identifier.test(to)) throw new Error('FRESH_FIXTURE_UUID_REQUIRED');
    sql = sql.replaceAll(from, to);
  }
  sql = sql.replaceAll(`'APPROVED','${author.userId}'`, `'APPROVED','${reviewer.userId}'`);
  const tag = token.replaceAll('-', '').slice(0, 12).toUpperCase();
  sql = sql.replaceAll('MISSION_CHECK', `TEST_PROVIDER_${tag}`).replaceAll('mission-check', `test-provider-${tag.toLowerCase()}`)
    .replaceAll('MISSION_CAT', `TEST_CAT_${tag}`).replaceAll('mission-cat', `test-cat-${tag.toLowerCase()}`)
    .replaceAll('MISSION_SUB', `TEST_SUB_${tag}`).replaceAll('mission-sub', `test-sub-${tag.toLowerCase()}`)
    .replaceAll('MISSION_A', `TEST_SERVICE_A_${tag}`).replaceAll('mission-a', `test-service-a-${tag.toLowerCase()}`)
    .replaceAll('MISSION_B', `TEST_SERVICE_B_${tag}`).replaceAll('mission-b', `test-service-b-${tag.toLowerCase()}`)
    .replaceAll('P06.SESSIONS.V1', `TEST.PROVIDER.${tag}.V1`);
  if (forbiddenFixtureSql.test(sql)) throw new Error('CATALOGUE_FIXTURE_CANNOT_CHANGE_AUTH_BUSINESS_OR_GUARDS');
  const ids = {
    libraryId: mapped.get('fd300000-0000-4000-8000-000000000001'),
    serviceA: mapped.get('fd300000-0000-4000-8000-000000000007'),
    serviceB: mapped.get('fd300000-0000-4000-8000-000000000008'),
    serviceVersionA: mapped.get('fd300000-0000-4000-8000-000000000009'),
    serviceVersionB: mapped.get('fd300000-0000-4000-8000-000000000010'),
    questionnaireVersion: mapped.get('d0660000-0000-0000-0000-000000000001'),
    booleanQuestion: mapped.get('d0690000-0000-0000-0000-000000000001'),
    detailQuestion: mapped.get('d0690000-0000-0000-0000-000000000002'),
  };
  if (new Set(Object.values(ids)).size !== Object.keys(ids).length) throw new Error('DISTINCT_CANONICAL_TEST_OBJECTS_REQUIRED');
  return {
    sql,
    provenance: {
      scope: 'HISTORICAL_SQL_TEST_PRECONDITION',
      fixture: 'PUBLISHED_TEST_CATALOGUE_AND_PROVIDER_QUESTIONNAIRE_ONLY',
      catalogueSourceSha256: createHash('sha256').update(catalogueSource).digest('hex'),
      questionnaireSourceSha256: createHash('sha256').update(questionnaireSource).digest('hex'),
      appliedSqlSha256: createHash('sha256').update(sql).digest('hex'),
      governedCataloguePublicationCertified: false,
      nativeAuthenticationAltered: false,
      nativeProviderQualificationAltered: false,
      ids,
    },
  };
}
