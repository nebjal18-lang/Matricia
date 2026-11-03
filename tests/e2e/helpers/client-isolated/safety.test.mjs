import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { requireDevelopment, validateSourceTarget, validateOwnState, validateCanonicalSourceTarget, requireFreshRestoreState } from './safety.mjs';
const token = 'a1234567-1234-4123-8123-123456789012', source = { token, name: `matricia_replay_${token.replaceAll('-', '')}`, label: `matricia.isolated-replay=${token}`, database: 'postgres', network: 'none', publicPorts: 0, isolated: true };
test('only the exact labelled no-network replay may be the read-only source', () => { assert.equal(validateSourceTarget(source), source); for (const mutation of [{ name: 'supabase_db_Matricia' }, { network: 'bridge' }, { publicPorts: 54322 }, { isolated: false }, { label: 'other' }, { database: 'production' }])
    assert.throws(() => validateSourceTarget({ ...source, ...mutation })); });
test('production and undeclared environments are refused before setup', () => { const previous = process.env.APP_ENV; try {
    for (const v of ['production', 'staging', '']) {
        process.env.APP_ENV = v;
        assert.throws(requireDevelopment);
    }
    process.env.APP_ENV = 'development';
    assert.doesNotThrow(requireDevelopment);
}
finally {
    if (previous === undefined)
        delete process.env.APP_ENV;
    else
        process.env.APP_ENV = previous;
} });
test('fixture writes and cleanup reject shared containers and paths', () => { const tag = token.replaceAll('-', '').slice(0, 16), state = { token, label: `matricia.client-browser-test=${token}`, network: `matricia_client_browser_${tag}`, database: `matricia_client_browser_db_${tag}`, directory: `/tmp/example/work/client-browser-isolated/${token}`, children: [`matricia_client_browser_db_${tag}`], appPort: 19173, gatewayPort: 19174 }; assert.equal(validateOwnState(state, '/tmp/example'), state); for (const mutation of [{ database: 'supabase_db_Matricia' }, { children: ['supabase_db_Matricia'] }, { directory: '/workspace/production' }, { network: 'bridge' }, { label: 'another-run' }, { gatewayPort: 19173 }])
    assert.throws(() => validateOwnState({ ...state, ...mutation }, '/tmp/example')); });

test('canonical ACL references cannot be old debug targets or green receipt substitutes',()=>{const valid={...source,purpose:'CANONICAL_ACL_SETUP_SOURCE_ONLY',status:'retained-setup-source',migrationCount:457};assert.equal(validateCanonicalSourceTarget(valid),valid);for(const change of[{purpose:'STAGING'},{status:'passed'},{status:'failed'},{migrationCount:0},{migrationCount:1.5},{network:'bridge'}])assert.throws(()=>validateCanonicalSourceTarget({...valid,...change}));});
test('restore never resets a populated or unclassified owned database',()=>{for(const status of['ACTORS_READY','FIXTURE_READY','RESTORED','SERVICES_STARTED','CLEANED',undefined])assert.throws(()=>requireFreshRestoreState({status}));assert.doesNotThrow(()=>requireFreshRestoreState({status:'DATABASE_READY'}));});
