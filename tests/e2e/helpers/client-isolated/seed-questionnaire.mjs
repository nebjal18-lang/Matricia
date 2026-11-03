import { requireDevelopment, loadOwnState } from './safety.mjs';
requireDevelopment();
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import postgres from 'postgres';
const state = await loadOwnState();
const actors = JSON.parse(await readFile(resolve(state.directory, 'actors.private.json')));
const owner = actors.find(actor => actor.label === 'owner');
const foreign = actors.find(actor => actor.label === 'foreign');
const reviewer = actors.find(actor => actor.label === 'reviewer');
if (!owner?.organizationId || !reviewer?.userId || state.status !== 'ACTORS_READY')
    throw new Error('NATIVE_ACTORS_REQUIRED');
const sourcePath = 'supabase/tests/0301_client_questionnaire_presentation.test.sql';
const source = await readFile(sourcePath, 'utf8');
function section(startMarker, endMarker) {
    const start = source.indexOf(startMarker), end = source.indexOf(endMarker, start);
    if (start < 0 || end <= start)
        throw new Error('REVIEWED_FIXTURE_LAYOUT_CHANGED');
    return source.slice(start, end);
}
// Historical dossier and published questionnaire ONLY. No auth.users/sessions,
// fabricated user JWT, disabled trigger, or role escalation from the SQL test.
let fixture = section('insert into public.organization_identifiers(', 'insert into public.platform_user_roles')
    + section('insert into public.catalog_libraries(', 'insert into auth.sessions(');
const identifiers = new Map([
    ['d0610000-0000-4000-8000-000000000001', owner.organizationId],
    ['d0610000-0000-4000-8000-000000000002', foreign.organizationId],
    ['d0600000-0000-4000-8000-000000000001', owner.userId],
    ['d0600000-0000-4000-8000-000000000002', foreign.userId],
    ['d0600000-0000-4000-8000-000000000003', reviewer.userId],
]);
for (const id of new Set(fixture.match(/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}/gu))) {
    if (!identifiers.has(id))
        identifiers.set(id, randomUUID());
}
for (const [from, to] of identifiers)
    fixture = fixture.replaceAll(from, to);
fixture = fixture.replaceAll('997245000000001', owner.ice).replaceAll('Payment 245 SARL', `TEST Client owner ${state.token}`);
// Native create_or_request_organization already recorded ICE. Preserve it.
fixture = fixture.replace(`('${owner.organizationId}','ICE','${owner.ice}','VERIFIED'),`, '');
const tag = randomUUID().slice(0, 8).toUpperCase();
fixture = fixture.replaceAll('TEST_0301_DIAGNOSTICS', `TEST_BROWSER_DIAG_${tag}`).replaceAll('TEST_0301_SITES', `TEST_BROWSER_SITES_${tag}`)
    .replaceAll('P06_SESSIONS', `TEST_BROWSER_${tag}`).replaceAll('P06.SESSIONS.V1', `TEST.BROWSER.${tag}.V1`).replaceAll('p06-sessions', `test-browser-${tag.toLowerCase()}`);
const db = postgres({ host: state.dbHost, port: state.dbPort, username: 'supabase_admin', password: state.dbSecret, database: 'postgres', max: 1, prepare: false, onnotice: () => { } });
try {
    await db.begin(async (sql) => {
        await sql `update public.organizations set status='ACTIVE' where id=${owner.organizationId}::uuid`;
        await sql `update public.organization_identifiers set verification_status='VERIFIED' where organization_id=${owner.organizationId}::uuid and identifier_type='ICE' and normalized_value=${owner.ice}`;
        await sql.unsafe(fixture);
        // Explicit TEST-only portfolio quota, no commercial plan or tariff.
        await sql`insert into public.trial_entitlement_versions(entitlement_code,version,status,enabled,quota_value,configuration,effective_from,content_hash,created_by) values(${`TEST_BROWSER_PROJECTS_${tag}`},1,'ACTIVE',true,5,'{"resource":"PROJECTS"}'::jsonb,clock_timestamp()-interval '1 day',repeat('7',64),${reviewer.userId}::uuid)`;
    });
    const proof = { scope: 'LOCAL_HISTORICAL_SQL_FIXTURE_ONLY', source: sourcePath, sourceSha256: createHash('sha256').update(source).digest('hex'), nativeOnboardingCertified: false, physicalDocumentScanningCertified: false, governedCataloguePublicationCertified: false, organizationId: owner.organizationId, questionnaireVersion: identifiers.get('d0660000-0000-4000-8000-000000000001'), booleanQuestion: identifiers.get('d0690000-0000-4000-8000-000000000001'), detailQuestion: identifiers.get('d0690000-0000-4000-8000-000000000002') };
    await writeFile(resolve(state.directory, 'questionnaire-fixture-provenance.json'), JSON.stringify(proof, null, 2));
    state.status = 'FIXTURE_READY';
    await writeFile(resolve(state.directory, 'state.private.json'), JSON.stringify(state), { mode: 0o600 });
    console.log(JSON.stringify({ status: state.status, nativeOnboardingCertified: false, physicalScanningCertified: false }));
}
finally {
    await db.end();
}
