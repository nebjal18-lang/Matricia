import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
/** These utilities never resolve a configured application or remote database. */
export function requireDevelopment() {
    if (process.env.APP_ENV !== 'development')
        throw new Error('EXPLICIT_DEVELOPMENT_REQUIRED');
}
export function docker(args, options = {}) {
    const env = { ...process.env, DOCKER_HOST: 'unix:///var/run/docker.sock' };
    for (const key of ['DOCKER_CONTEXT', 'DOCKER_TLS', 'DOCKER_TLS_VERIFY', 'DOCKER_CERT_PATH'])
        delete env[key];
    return execFileSync('docker', args, { encoding: 'utf8', timeout: 90000, maxBuffer: 128 * 1024 * 1024, ...options, env });
}
export function validateSourceTarget(value) {
    if (!value || typeof value.token !== 'string' || !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/u.test(value.token) || value.name !== `matricia_replay_${value.token.replaceAll('-', '')}` || value.label !== `matricia.isolated-replay=${value.token}` || value.isolated !== true || value.network !== 'none' || value.publicPorts !== 0 || value.database !== 'postgres')
        throw new Error('OWNED_ISOLATED_REPLAY_SOURCE_REQUIRED');
    return value;
}
export function validateOwnState(state, root = process.cwd()) {
    if (!state || !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/u.test(state.token ?? ''))
        throw new Error('OWNED_TEST_STATE_REQUIRED');
    const tag = state.token.replaceAll('-', '').slice(0, 16);
    const names = ['db', 'auth', 'rest', 'storage'].map(kind => `matricia_client_browser_${kind}_${tag}`);
    if (state.label !== `matricia.client-browser-test=${state.token}` || state.network !== `matricia_client_browser_${tag}` || state.database !== names[0] || state.directory !== resolve(root, 'work/client-browser-isolated', state.token) || !Array.isArray(state.children) || state.children.some(name => !names.includes(name)) || !state.children.includes(state.database) || ![state.appPort, state.gatewayPort].every(port => Number.isInteger(port) && port >= 1024 && port <= 65535) || state.appPort === state.gatewayPort)
        throw new Error('OWNED_TEST_STATE_REQUIRED');
    return state;
}
export async function loadOwnState() {
    requireDevelopment();
    const root = process.cwd(), base = resolve(root, 'work/client-browser-isolated');
    const pointer = JSON.parse(await readFile(resolve(base, 'current.private.json'), 'utf8'));
    if (typeof pointer.directory !== 'string' || !pointer.directory.startsWith(base + sep))
        throw new Error('OWNED_TEST_DIRECTORY_REQUIRED');
    const state = validateOwnState(JSON.parse(await readFile(resolve(pointer.directory, 'state.private.json'), 'utf8')), root);
    const network = JSON.parse(docker(['network', 'inspect', state.network]))[0];
    if (network.Internal !== true || network.Labels?.['matricia.client-browser-test'] !== state.token)
        throw new Error('OWNED_INTERNAL_NETWORK_REQUIRED');
    for (const name of state.children) {
        const container = JSON.parse(docker(['inspect', name]))[0];
        const networks = container.NetworkSettings.Networks ?? {};
        if (container.Config.Labels?.['matricia.client-browser-test'] !== state.token || Object.keys(networks).length !== 1 || !networks[state.network] || Object.values(container.NetworkSettings.Ports ?? {}).some(value => value?.length))
            throw new Error('OWNED_TEST_CONTAINER_REQUIRED');
        const kind = name.split('_')[3];
        state[kind === 'db' ? 'dbHost' : `${kind}Host`] = networks[state.network].IPAddress;
    }
    return state;
}

export function validateCanonicalSourceTarget(value, { requireReady = true } = {}) {
    validateSourceTarget(value);
    if (value.purpose !== 'CANONICAL_ACL_SETUP_SOURCE_ONLY' || (requireReady && (value.status !== 'retained-setup-source' || !Number.isInteger(value.migrationCount) || value.migrationCount < 1))) throw new Error('CANONICAL_SETUP_SOURCE_REQUIRED');
    return value;
}
export function requireFreshRestoreState(state) {
    if (state?.status !== 'DATABASE_READY') throw new Error('FRESH_OWNED_TEST_TARGET_REQUIRED');
}
