/** Read every authorized row using bounded transport pages; never return a partial success. */
export async function readAllPages<T>(query:(from:number,to:number)=>PromiseLike<{data:T[]|null;error:{code?:string;message?:string}|null}>){
 const data:T[]=[];
 for(let from=0;;from+=500){const result=await Promise.resolve().then(()=>query(from,from+499)).catch(()=>({data:null,error:{code:"UNAVAILABLE",message:"Scoped page read failed"}}));if(result.error)return{data:null,error:result.error};if(!Array.isArray(result.data))return{data:null,error:{code:"INVALID_RESPONSE",message:"Missing scoped page"}};data.push(...result.data);if(result.data.length<500)return{data,error:null};}
}
/** Keep SQL IN lists bounded as well as response pages. */
export async function readRelatedPages<T>(ids:string[],query:(ids:string[],from:number,to:number)=>PromiseLike<{data:T[]|null;error:{code?:string;message?:string}|null}>){
 const data:T[]=[],unique=[...new Set(ids)];
 for(let offset=0;offset<unique.length;offset+=100){const result=await readAllPages((from,to)=>query(unique.slice(offset,offset+100),from,to));if(result.error||!result.data)return{data:null,error:result.error??{code:"INVALID_RESPONSE"}};data.push(...result.data);}
 return{data,error:null};
}
