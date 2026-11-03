import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstat,readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export async function sourceIdentity(root) {
  const files=execFileSync('git',['ls-files','-z','--cached','--others','--exclude-standard'],{cwd:root}).toString('utf8').split('\0').filter(path=>/^(?:apps\/|packages\/|supabase\/migrations\/|scripts\/|tests\/e2e\/|package\.json$|pnpm-lock\.yaml$|playwright\.config\.ts$)/u.test(path)&&!/(?:^|\/)\.env(?:\.|$)|(?:^|\/)\.auth\//u.test(path)).sort();
  const digest=createHash('sha256');let count=0;
  for(const path of [...new Set(files)]){
    const absolute=resolve(root,path);let metadata;
    try{metadata=await lstat(absolute);}catch(error){if(error.code==='ENOENT'){digest.update(`DELETED\0${path}\0`);continue;}throw error;}
    if(!metadata.isFile())throw new Error('SOURCE_IDENTITY_REGULAR_FILES_REQUIRED');
    const content=await readFile(absolute);
    digest.update(`${path}\0${metadata.mode&0o111}\0${content.length}\0`);digest.update(content);count++;
  }
  if(count<50)throw new Error('SOURCE_IDENTITY_INCOMPLETE');
  return {gitHead:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),applicationAndRecipeTreeSha256:digest.digest('hex'),files:count};
}

export function validateLocalSuiteEvidence(value,{expectedTests,startedAt,mode,requiredProof={}}){
  const completed=Date.parse(value.completedAt??value.browser?.finishedAt??'');
  if(value.environment!=='development-local-docker'||value.status!=='PASSED'||!Number.isFinite(completed)||completed<startedAt)throw new Error('LOCAL_ACCEPTANCE_EVIDENCE_INVALID');
  if(mode&&value.mode!==mode)throw new Error('LOCAL_ACCEPTANCE_MODE_INVALID');
  if(value.browser?.executed!==expectedTests||value.browser?.passed!==expectedTests||value.browser?.failed!==0||value.browser?.skipped!==0||value.browser?.flaky!==0)throw new Error('LOCAL_ACCEPTANCE_COUNTS_INVALID');
  if(value.cleanupVerified!==true&&!(value.cleanup?.remoteFixturesNeutralized===true&&value.cleanup?.localAuthenticationArtifactsRemoved===true))throw new Error('LOCAL_ACCEPTANCE_CLEANUP_NOT_VERIFIED');
  for(const[key,expected]of Object.entries(requiredProof))if(value.proof?.[key]!==expected)throw new Error('LOCAL_ACCEPTANCE_BUSINESS_PROOF_MISSING');
  return expectedTests;
}
