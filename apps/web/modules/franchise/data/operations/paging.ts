/** Explicit server pages prevent a successful first page from impersonating a complete workspace. */
export async function collectOperationPages<T>(query:(from:number,to:number)=>PromiseLike<{data:T[]|null;error:unknown}>):Promise<{data:T[];error:unknown}> {
  return collectWithinBudget(query, { rows: 0, requests: 0 });
}

const limits = { rows: 5000, requests: 120, parents: 5000 } as const;
const exceeded = () => ({ code: "READ_LIMIT_EXCEEDED" });
async function collectWithinBudget<T>(query:(from:number,to:number)=>PromiseLike<{data:T[]|null;error:unknown}>, budget:{rows:number;requests:number}):Promise<{data:T[];error:unknown}> {
  const collected:T[]=[];
  const pageSize=100;
  for(let from=0;;){
    if(budget.requests>=limits.requests)return{data:[],error:exceeded()};
    const size=Math.min(pageSize,limits.rows-budget.rows+1);
    budget.requests++;
    let page;
    try{page=await query(from,from+size-1);}catch(error){return{data:[],error};}
    if(page.error)return{data:[],error:page.error};
    if(!page.data)return{data:[],error:new Error("FRANCHISE_OPERATIONS_RESPONSE_MISSING")};
    if(!Array.isArray(page.data)||page.data.length>size)return{data:[],error:{code:"INVALID_RESPONSE"}};
    budget.rows+=page.data.length;
    if(budget.rows>limits.rows)return{data:[],error:exceeded()};
    collected.push(...page.data);
    if(page.data.length<size)return{data:collected,error:null};
    from+=size;
  }
}
/** Keep PostgREST URL filters bounded even when history spans thousands of parent objects. */
export async function collectOperationIds<T>(ids:string[],query:(ids:string[],from:number,to:number)=>PromiseLike<{data:T[]|null;error:unknown}>):Promise<{data:T[];error:unknown}> {
  const collected:T[]=[];
  const unique=new Set<string>();
  for(const id of ids){unique.add(id);if(unique.size>limits.parents)return{data:[],error:exceeded()};}
  const parents=[...unique],budget={rows:0,requests:0};
  for(let start=0;start<parents.length;start+=80){
    const page=await collectWithinBudget((from,to)=>query(parents.slice(start,start+80),from,to),budget);
    if(page.error)return{data:[],error:page.error};
    collected.push(...page.data);
  }
  return{data:collected,error:null};
}
