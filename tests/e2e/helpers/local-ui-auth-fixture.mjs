import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import { totp } from '../../../scripts/p05-e2e/totp.mjs';
const { createClient } = createRequire(new URL('../../../apps/web/package.json', import.meta.url))('@supabase/supabase-js');
const execute = promisify(execFile);

export async function provisionLocalUiAuthFixture(fixture, runToken, directory) {
  if (fixture.config.runtimeMode !== 'isolated-local-docker' || !fixture.authSecrets?.centralTotp) throw new Error('LOCAL_UI_AUTH_REQUIRES_REAL_TOTP_FIXTURE');
  const project = fixture.config.projectRef.replace(/^local-/, '');
  const { stdout } = await execute('docker', ['inspect','--format','{{json .State.Running}}|{{index .Config.Labels "com.supabase.cli.project"}}|{{json .NetworkSettings.Ports}}',`supabase_inbucket_${project}`], {timeout:10_000,maxBuffer:16_384});
  const [running,label,ports] = stdout.trim().split('|');
  const bindings = JSON.parse(ports);
  const backend = bindings?.['8025/tcp']?.some(p=>p.HostPort==='54324') ? 'mailpit' : bindings?.['9000/tcp']?.some(p=>p.HostPort==='54324') ? 'inbucket' : null;
  if (running !== 'true' || label !== project || !backend) throw new Error('LOCAL_UI_AUTH_MAIL_SINK_UNVERIFIED');
  const flags = await execute('docker',['inspect','--format','{{range .Config.Env}}{{if eq . "GOTRUE_MAILER_OTP_LENGTH=6"}}6{{end}}{{if eq . "GOTRUE_MAILER_OTP_LENGTH=7"}}7{{end}}{{if eq . "GOTRUE_MAILER_OTP_LENGTH=8"}}8{{end}}{{end}}',`supabase_auth_${project}`],{timeout:10_000,maxBuffer:1_024});
  const otpLength = Number(flags.stdout.trim());
  if (![6,7,8].includes(otpLength)) throw new Error('LOCAL_UI_AUTH_OTP_LENGTH_UNVERIFIED');
  const [central] = await fixture.resources.database`select email from auth.users where id=${fixture.resources.userIds[2]}::uuid`;
  const extraEmail = `p05-e2e-ui-central-ar-${runToken}@example.invalid`;
  const extra = await fixture.resources.admin.auth.admin.createUser({email:extraEmail,email_confirm:true,app_metadata:{p05_e2e_fixture:true}});
  if (extra.error || !extra.data.user) throw new Error('LOCAL_UI_AUTH_ADMIN_CREATE_FAILED');
  fixture.resources.userIds.push(extra.data.user.id);
  const link = await fixture.resources.admin.auth.admin.generateLink({type:'magiclink',email:extraEmail});
  const client = createClient(fixture.config.supabaseUrl,fixture.config.publishableKey,{auth:{persistSession:false,autoRefreshToken:false}});
  const signed = await client.auth.verifyOtp({token_hash:link.data?.properties?.hashed_token ?? '',type:'magiclink'});
  if (link.error || signed.error) throw new Error('LOCAL_UI_AUTH_ADMIN_OTP_FAILED');
  const enrollment = await client.auth.mfa.enroll({factorType:'totp',friendlyName:'Local Arabic acceptance'});
  if (enrollment.error || !enrollment.data?.totp?.secret) throw new Error('LOCAL_UI_AUTH_ADMIN_MFA_FAILED');
  const arTotp = {factorId:enrollment.data.id,secret:enrollment.data.totp.secret};
  let verified = false;
  for (const offset of [-30_000,0,30_000]) {
    const result = await client.auth.mfa.challengeAndVerify({factorId:arTotp.factorId,code:totp(arTotp.secret,Date.now()+offset)});
    if (!result.error) { verified = true; arTotp.verifiedCounter = Math.floor((Date.now()+offset)/30_000); break; }
  }
  if (!verified) throw new Error('LOCAL_UI_AUTH_ADMIN_MFA_VERIFY_FAILED');
  await fixture.resources.database`insert into public.platform_user_roles(user_id,role_code)values(${extra.data.user.id}::uuid,'COMPLIANCE_MANAGER')`;
  const centralEmails = {fr:central.email,ar:extraEmail}, centralTotp = {fr:fixture.authSecrets.centralTotp,ar:arTotp};
  const registrationEmails = Object.fromEntries(['fr','ar'].map(locale=>[locale,`p05-e2e-ui-${locale}-${runToken}@example.invalid`]));
  const value = {schemaVersion:1,runtimeMode:'isolated-local-docker',expiresAt:new Date(Date.now()+10*60_000).toISOString(),mailSink:'http://127.0.0.1:54324',mailBackend:backend,otpLength,registrationEmails,centralEmails,centralTotp};
  fixture.resources.localUiAuth = {mailBackend:backend,allEmails:[...Object.values(registrationEmails),...Object.values(centralEmails)],registrationEmails:Object.values(registrationEmails),otpLength,mailboxes:[...Object.values(registrationEmails),...Object.values(centralEmails)].map(email=>email.split('@')[0]),startedAt:new Date().toISOString(),mailSink:value.mailSink};
  const path = resolve(directory,'local-ui-auth.json');
  await writeFile(path,JSON.stringify(value),{mode:0o600,flag:'wx'});
  return path;
}
export async function verifyLocalUiAuthProof(fixture) {
  const local = fixture.resources.localUiAuth;
  if (!local) throw new Error('LOCAL_UI_AUTH_FIXTURE_MISSING');
  const [proof] = await fixture.resources.database`select count(*)::int as acceptances from public.registration_consent_acceptances a join public.registration_consent_receipts r on r.id=a.receipt_id join auth.users u on u.id=a.user_id where u.email=any(${local.registrationEmails}::text[]) and u.created_at>=${local.startedAt}::timestamptz and u.email_confirmed_at is not null and r.identifier_hash=encode(extensions.digest(lower(u.email),'sha256'),'hex')`;
  if (proof.acceptances !== 2) throw new Error('LOCAL_UI_AUTH_CONSENT_NOT_PERSISTED');
  return {registrationConsentReceipts:2,otpLength:fixture.resources.localUiAuth.otpLength,identityAndConsentVerified:true};
}
export async function neutralizeLocalUiAuthFixture(fixture) {
  const local = fixture.resources.localUiAuth;
  if (!local) return;
  const users = await fixture.resources.database`select id from auth.users where email=any(${local.registrationEmails}::text[]) and created_at>=${local.startedAt}::timestamptz`;
  for (const user of users) {
    if (!fixture.resources.userIds.includes(user.id)) fixture.resources.userIds.push(user.id);
    const marked = await fixture.resources.admin.auth.admin.updateUserById(user.id,{app_metadata:{p05_e2e_fixture:true}});
    if (marked.error) throw new Error('LOCAL_UI_AUTH_FIXTURE_MARK_FAILED');
  }
  if (local.mailBackend === 'mailpit') {
    for (const email of local.allEmails) {
      const response = await fetch(`${local.mailSink}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`,{redirect:'error',signal:AbortSignal.timeout(5_000)});
      if (!response.ok) throw new Error('LOCAL_UI_AUTH_MAILBOX_CLEANUP_FAILED');
      const body = await response.json();
      const ids = (body.messages ?? []).filter(row=>(row.To ?? []).some(to=>String(to.Address).toLowerCase()===email.toLowerCase())).map(row=>row.ID);
      if (!ids.every(id=>typeof id==='string'&&/^[a-zA-Z0-9_.-]+$/.test(id))) throw new Error('LOCAL_UI_AUTH_MAILBOX_SCOPE_INVALID');
      if (ids.length) {
        const deletion = await fetch(`${local.mailSink}/api/v1/messages`,{method:'DELETE',headers:{'content-type':'application/json'},body:JSON.stringify({IDs:ids}),redirect:'error',signal:AbortSignal.timeout(5_000)});
        await deletion.body?.cancel();
        if (!deletion.ok) throw new Error('LOCAL_UI_AUTH_MAILBOX_CLEANUP_FAILED');
      }
    }
  } else for (const mailbox of local.mailboxes) {
    if (!/^p05-e2e-[a-z0-9-]+$/u.test(mailbox)) throw new Error('LOCAL_UI_AUTH_MAILBOX_SCOPE_INVALID');
    const response = await fetch(`${local.mailSink}/api/v1/mailbox/${encodeURIComponent(mailbox)}`,{method:'DELETE',redirect:'error',signal:AbortSignal.timeout(5_000)});
    await response.body?.cancel();
    if (!response.ok && response.status !== 404) throw new Error('LOCAL_UI_AUTH_MAILBOX_CLEANUP_FAILED');
  }
}
