// Refresh the existing native actors without changing their identity or MFA.
import{requireDevelopment,loadOwnState}from'./safety.mjs';
requireDevelopment();
import{readFile,writeFile}from'node:fs/promises';
import{resolve}from'node:path';
import{createRequire}from'node:module';
const state=await loadOwnState(),path=resolve(state.directory,'actors.private.json'),actors=JSON.parse(await readFile(path)),{createClient}=createRequire(resolve('apps/web/package.json'))('@supabase/supabase-js');
for(const actor of actors){const client=createClient(`http://127.0.0.1:${state.gatewayPort}`,state.anonKey,{auth:{persistSession:false,autoRefreshToken:false}}),session=await client.auth.setSession(actor.session);if(session.error||!session.data.session)throw Error('NATIVE_EXISTING_SESSION_REFRESH_FAILED:'+actor.label);const user=await client.auth.getUser(),assurance=await client.auth.mfa.getAuthenticatorAssuranceLevel();if(user.error||user.data.user?.id!==actor.userId||assurance.error||assurance.data?.currentLevel!=='aal2')throw Error('NATIVE_EXISTING_AAL2_IDENTITY_REQUIRED:'+actor.label);actor.session=session.data.session;await writeFile(path,JSON.stringify(actors),{mode:0o600});console.log(JSON.stringify({label:actor.label,status:'EXISTING_NATIVE_AAL2_SESSION_READY',identityPreserved:true}));}
