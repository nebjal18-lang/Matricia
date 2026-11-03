import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { historicalProviderCatalogue } from './fixture-source.mjs';
const catalogueSource = await readFile('supabase/tests/0338_client_native_mission_dispute_acceptance.test.sql', 'utf8');
const questionnaireSource = await readFile('supabase/tests/0345_provider_entry_acceptance.test.sql', 'utf8');
const base = { catalogueSource, questionnaireSource, owner: { organizationId: '00000000-0000-4000-8000-000000000001' }, author: { userId: '00000000-0000-4000-8000-000000000002' }, reviewer: { userId: '00000000-0000-4000-8000-000000000003' }, token: '00000000-0000-4000-8000-000000000004' };
test('historical fixture keeps catalogue facts separate from native Provider and auth state', () => {
  const result = historicalProviderCatalogue(base);
  assert.equal(result.provenance.scope, 'HISTORICAL_SQL_TEST_PRECONDITION');
  assert.equal(result.provenance.governedCataloguePublicationCertified, false);
  assert.equal(Object.keys(result.provenance.ids).length, 8);
  assert.doesNotMatch(result.sql, /auth\.(users|sessions)|provider_(profiles|qualifications|qualification_decisions)|disable\s+trigger|session_replication_role/iu);
  assert.match(result.sql, /'APPROVED','00000000-0000-4000-8000-000000000003'/u);
  assert.match(result.sql, /'PROVIDER'/u);
});
test('fixture extraction refuses a source layout drift rather than importing another block', () => {
  assert.throws(() => historicalProviderCatalogue({ ...base, catalogueSource: catalogueSource.replace('create temporary table mf024_catalog', 'changed_marker') }), /LAYOUT_CHANGED/u);
});
test('fixture cannot silently adopt another staff actor or inject business-state SQL', () => {
  assert.throws(() => historicalProviderCatalogue({ ...base, reviewer: base.author }), /DISTINCT_TEST_CATALOGUE_STAFF_REQUIRED/u);
  assert.throws(() => historicalProviderCatalogue({ ...base, questionnaireSource: questionnaireSource.replace('update public.catalog_libraries set current_release_id=', 'insert into public.provider_qualifications(id)values(1);\nupdate public.catalog_libraries set current_release_id=') }), /CANNOT_CHANGE_AUTH_BUSINESS_OR_GUARDS/u);
});
