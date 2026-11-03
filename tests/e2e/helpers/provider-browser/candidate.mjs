import{execFileSync}from'node:child_process';import{readFile,readdir}from'node:fs/promises';import{createHash}from'node:crypto';
export function candidateId(value){if(typeof value!=='string'||!/^[a-f0-9]{40}$/u.test(value))throw Error('EXPLICIT_INTEGRATED_CANDIDATE_SHA_REQUIRED');return value;}
export async function candidateSnapshot(value){
 const commit=candidateId(value),git=args=>execFileSync('git',args,{encoding:'utf8'}).trim();
 if(git(['rev-parse',`${commit}^{commit}`])!==commit||git(['diff','--name-only',commit,'--','apps/web','supabase/migrations','packages'])||git(['status','--porcelain','--','apps/web','supabase/migrations','packages']))throw Error('CLEAN_EXACT_INTEGRATED_PROVIDER_SOURCE_REQUIRED');
 const migrations=[];for(const file of(await readdir('supabase/migrations')).filter(f=>f.endsWith('.sql')).sort())migrations.push({file,sha256:createHash('sha256').update(await readFile('supabase/migrations/'+file)).digest('hex')});
 return{commit,appTree:git(['rev-parse',`${commit}:apps/web`]),packagesTree:git(['rev-parse',`${commit}:packages`]),migrations};
}
