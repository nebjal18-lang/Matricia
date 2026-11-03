import { resolve } from 'node:path';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { loadOwnState, requireDevelopment, docker } from './provider-browser/safety.mjs';
import { candidateSnapshot } from './provider-browser/candidate.mjs';
import { nativeBrowserActor } from './provider-browser/browser-session.mjs';
import { createRequire } from 'node:module';

export const fixtureRoot = '/workspace/provider-browser';
export async function fixtureState() {
  requireDevelopment();
  if (!process.argv.includes('--coordinated')) throw Error('COORDINATED_FRANCHISE_RECIPE_REQUIRED');
  const previous = process.cwd();
  try { process.chdir(fixtureRoot); return await loadOwnState(); }
  finally { process.chdir(previous); }
}
export function sourceCandidate() {
  return candidateSnapshot(process.argv.find(arg => arg.startsWith('--candidate='))?.slice(12));
}
export async function privateDirectory(state) {
  const dir = resolve('work/franchise-final', state.token);
  await mkdir(dir, { recursive: true, mode: 0o700 });
  return dir;
}
export async function persistPrivate(path, value) {
  await writeFile(path, JSON.stringify(value), { mode: 0o600 });
}
export function sdk(state, key = state.anonKey) {
  const { createClient } = createRequire(resolve('apps/web/package.json'))('@supabase/supabase-js');
  return createClient(`http://127.0.0.1:${state.gatewayPort}`, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
export async function staffActor(state, label) { return nativeBrowserActor(state, label); }
export function sql(state, input) {
  return docker(['exec', '-i', state.database, 'psql', '-X', '-U', 'supabase_admin', '-d', 'postgres', '-Atq', '-v', 'ON_ERROR_STOP=1'], { input });
}
export async function actorSession(state, actor, file, all) {
  const { createServerClient } = createRequire(resolve('apps/web/package.json'))('@supabase/ssr');
  const bag = new Map();
  const client = createServerClient(`http://127.0.0.1:${state.gatewayPort}`, state.anonKey, {
    cookies: { getAll: () => [...bag.values()], setAll: values => values.forEach(value => bag.set(value.name, value)) },
  });
  const session = await client.auth.setSession(actor.session);
  const user = await client.auth.getUser(), assurance = await client.auth.mfa.getAuthenticatorAssuranceLevel();
  if (session.error || user.error || user.data.user?.id !== actor.userId || assurance.error || assurance.data?.currentLevel !== 'aal2') throw Error('GENUINE_FRANCHISE_AAL2_REQUIRED');
  actor.session = (await client.auth.getSession()).data.session;
  await persistPrivate(file, all);
  return { actor, client, cookies: [...bag.values()].map(({ name, value }) => ({ name, value, url: `http://127.0.0.1:${state.appPort}`, httpOnly: false, secure: false, sameSite: 'Lax' })) };
}
