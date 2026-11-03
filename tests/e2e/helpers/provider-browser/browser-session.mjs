import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';

function clientForCookies(state, bag) {
  const { createServerClient } = createRequire(resolve('apps/web/package.json'))('@supabase/ssr');
  return createServerClient(`http://127.0.0.1:${state.gatewayPort}`, state.anonKey, {
    cookies: {
      getAll: () => [...bag.values()],
      setAll: items => items.forEach(item => bag.set(item.name, item)),
    },
  });
}

async function verifiedSession(state, label, client) {
  const file = resolve(state.directory, 'actors.private.json');
  const actors = JSON.parse(await readFile(file));
  const actor = actors.find(value => value.label === label);
  if (!actor) throw new Error('EXACT_NATIVE_PROVIDER_ACTOR_REQUIRED');
  const [user, assurance] = await Promise.all([client.auth.getUser(), client.auth.mfa.getAuthenticatorAssuranceLevel()]);
  if (user.error || user.data.user?.id !== actor.userId || assurance.error || assurance.data?.currentLevel !== 'aal2') {
    throw new Error('GENUINE_PROVIDER_BROWSER_AAL2_IDENTITY_REQUIRED');
  }
  const session = await client.auth.getSession();
  if (session.error || session.data.session?.user.id !== actor.userId) throw new Error('SAME_NATIVE_PROVIDER_SESSION_REQUIRED');
  // Persist any native GoTrue rotation before another helper uses the same actor.
  // Never replace the user, its factors or its session with fabricated claims.
  actor.session = session.data.session;
  await writeFile(file, JSON.stringify(actors), { mode: 0o600 });
  return actor;
}

function browserCookies(state, bag) {
  return [...bag.values()].map(cookie => ({
    name: cookie.name, value: cookie.value, url: `http://127.0.0.1:${state.appPort}`,
    httpOnly: false, secure: false, sameSite: 'Lax',
  }));
}

export async function nativeBrowserActor(state, label) {
  const actors = JSON.parse(await readFile(resolve(state.directory, 'actors.private.json')));
  const actor = actors.find(value => value.label === label);
  if (!actor) throw new Error('EXACT_NATIVE_PROVIDER_ACTOR_REQUIRED');
  const bag = new Map(), client = clientForCookies(state, bag);
  if ((await client.auth.setSession(actor.session)).error) throw new Error('NATIVE_PROVIDER_BROWSER_SESSION_REQUIRED');
  const current = await verifiedSession(state, label, client);
  return { actor: current, client, cookies: browserCookies(state, bag) };
}

export async function preserveBrowserSession(state, label, context) {
  const bag = new Map((await context.cookies(`http://127.0.0.1:${state.appPort}`)).map(cookie => [cookie.name, cookie]));
  const client = clientForCookies(state, bag);
  await verifiedSession(state, label, client);
  await context.addCookies(browserCookies(state, bag));
}

export const safeError = value => String(value)
  .replace(/[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/gu, '[REDACTED]')
  .replace(/[a-f0-9]{64}/giu, '[REDACTED_DIGEST]')
  .slice(0, 600);
