import { requireDevelopment, loadOwnState, docker } from './safety.mjs';
import { nativeBrowserActor } from './browser-session.mjs';
import { historicalProviderCatalogue } from './fixture-source.mjs';
import { readFile, writeFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';
requireDevelopment();
const state = await loadOwnState();
if (state.status !== 'ACTORS_READY' || !state.candidate) throw new Error('PINNED_NATIVE_PROVIDER_ACTORS_REQUIRED');
const path = resolve(state.directory, 'catalogue-fixture-provenance.json');
try { await access(path); throw new Error('PRESERVE_EXISTING_CATALOGUE_FIXTURE_AND_RECEIPTS'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const reviewed = JSON.parse(await readFile(resolve(state.directory, 'identity-reviewed.json'), 'utf8'));
if (reviewed.status !== 'PASSED') throw new Error('NATIVE_PROVIDER_IDENTITY_REVIEW_FIRST');
const owner = await nativeBrowserActor(state, 'provider-owner');
const current = await owner.client.rpc('get_my_provider_legal_identity_v1', { p_organization_id: owner.actor.organizationId });
if (current.error || current.data?.currently_verified !== true) throw new Error('CURRENT_NATIVE_PROVIDER_IDENTITY_REQUIRED');
const actors = JSON.parse(await readFile(resolve(state.directory, 'actors.private.json'), 'utf8'));
const fixture = historicalProviderCatalogue({
  catalogueSource: await readFile('supabase/tests/0338_client_native_mission_dispute_acceptance.test.sql', 'utf8'),
  questionnaireSource: await readFile('supabase/tests/0345_provider_entry_acceptance.test.sql', 'utf8'),
  owner: owner.actor,
  author: actors.find(actor => actor.label === 'governance-author'),
  reviewer: actors.find(actor => actor.label === 'governance-reviewer'),
  token: state.token,
});
docker(['exec', '-i', state.database, 'psql', '-X', '-U', 'supabase_admin', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'], {
  input: `begin;\ndo $$begin if not exists(select 1 from private.admin_execution_environment_v1 where singleton and environment='DEVELOPMENT')then raise exception 'OWNED_DEVELOPMENT_FIXTURE_REQUIRED';end if;end$$;\n${fixture.sql}\nset constraints all immediate;\ncommit;`,
});
await writeFile(path, JSON.stringify({ ...fixture.provenance, candidate: state.candidate.commit, appTree: state.candidate.appTree }, null, 2));
console.log(JSON.stringify({ status: 'HISTORICAL_TEST_CATALOGUE_READY', nativeCataloguePublicationCertified: false, providerDecisionsWritten: false }));
