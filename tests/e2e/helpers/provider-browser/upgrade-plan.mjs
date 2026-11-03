/** Source-only guard. Existing runtime schema may never be reset or rewritten. */
export function planProviderCandidateUpgrade(previous,next,{allowInterleaved=false}={}){
 if(!/^[a-f0-9]{40}$/u.test(previous?.commit??'')||!/^[a-f0-9]{40}$/u.test(next?.commit??'')||previous.commit===next.commit||!Array.isArray(previous.migrations)||!Array.isArray(next.migrations))throw Error('DISTINCT_EXACT_CANDIDATES_REQUIRED');
 const old=new Map(previous.migrations.map(item=>[item.file,item.sha256])),fresh=new Map(next.migrations.map(item=>[item.file,item.sha256]));
 if(old.size!==previous.migrations.length||fresh.size!==next.migrations.length)throw Error('DUPLICATE_MIGRATION_IDENTITY');
 for(const[file,hash]of old)if(fresh.get(file)!==hash)throw Error('PRESERVE_EVERY_APPLIED_MIGRATION_SHA');
 const additions=next.migrations.filter(item=>!old.has(item.file));
 const last=previous.migrations.at(-1)?.file;
 const interleaved=additions.filter(item=>item.file<last);
 if(interleaved.length&&!allowInterleaved)throw Error('EXPLICIT_REVIEWED_INTERLEAVED_DELTA_REQUIRED');
 return {additions,interleaved:interleaved.map(item=>item.file)};
}
