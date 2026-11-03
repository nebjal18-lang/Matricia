/** Explicit server pages prevent a successful first page from impersonating a complete workspace. */
export async function collectOperationPages<T>(query:(from:number,to:number)=>PromiseLike<{data:T[]|null;error:unknown}>):Promise<{data:T[];error:unknown}> {
  const collected:T[]=[];
  const pageSize=100;
  for(let from=0;;from+=pageSize){
    let page;
    try{page=await query(from,from+pageSize-1);}catch(error){return{data:[],error};}
    if(page.error)return{data:[],error:page.error};
    if(!page.data)return{data:[],error:new Error("FRANCHISE_OPERATIONS_RESPONSE_MISSING")};
    collected.push(...page.data);
    if(page.data.length<pageSize)return{data:collected,error:null};
  }
}
/** Keep PostgREST URL filters bounded even when history spans thousands of parent objects. */
export async function collectOperationIds<T>(ids:string[],query:(ids:string[],from:number,to:number)=>PromiseLike<{data:T[]|null;error:unknown}>):Promise<{data:T[];error:unknown}> {
  const collected:T[]=[];
  for(let start=0;start<ids.length;start+=80){
    const page=await collectOperationPages((from,to)=>query(ids.slice(start,start+80),from,to));
    if(page.error)return{data:[],error:page.error};
    collected.push(...page.data);
  }
  return{data:collected,error:null};
}
