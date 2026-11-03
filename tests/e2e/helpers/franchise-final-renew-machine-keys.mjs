import { fixtureState } from './franchise-final-support.mjs';
import { createHmac } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const state = await fixtureState();
const now = Math.floor(Date.now()/1000);
for (const name of ['anonKey','serviceKey']) {
  const old = JSON.parse(Buffer.from(state[name].split('.')[1], 'base64url'));
  const role = name === 'anonKey' ? 'anon' : 'service_role';
  if (old.role !== role || old.iss !== 'supabase-local-browser-test') throw Error('EXACT_LOCAL_MACHINE_KEY_REQUIRED');
  if (old.exp > now + 300) continue;
  const encoded = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const header = encoded({ alg:'HS256',typ:'JWT' }), payload = encoded({ role,iss:'supabase-local-browser-test',iat:now,exp:now+8*3600 });
  state[name] = `${header}.${payload}.${createHmac('sha256',state.jwtSecret).update(`${header}.${payload}`).digest('base64url')}`;
}
await writeFile(resolve(state.directory,'state.private.json'),JSON.stringify(state),{mode:0o600});
console.log(JSON.stringify({status:'OWNED_LOCAL_MACHINE_KEYS_RENEWED',roles:['anon','service_role'],userJwtFabricated:false,externalCredentialsUsed:false}));
