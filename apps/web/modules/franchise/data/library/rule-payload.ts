import { z } from "zod";
const id=z.string().uuid();
const operators=["EQ","NEQ","GT","GTE","LT","LTE","IN","CONTAINS","EMPTY","NOT_EMPTY","REGEX","DATE_BEFORE","DATE_AFTER","CHANGED"] as const;
type Condition={group:"AND"|"OR";conditions:Condition[]}|{operator:typeof operators[number];question_version_id:string;value?:unknown};
const condition:z.ZodType<Condition>=z.lazy(()=>z.union([
 z.object({group:z.enum(["AND","OR"]),conditions:z.array(condition).min(1).max(64)}).strict(),
 z.object({operator:z.enum(operators),question_version_id:id,value:z.unknown().optional()}).strict().superRefine((v,c)=>{
  const unary=["EMPTY","NOT_EMPTY","CHANGED"].includes(v.operator);
  if(unary?"value" in v:!("value" in v))c.addIssue({code:"custom",message:"INVALID_OPERAND"});
  if(v.operator==="IN"&&!Array.isArray(v.value))c.addIssue({code:"custom",message:"INVALID_OPERAND"});
 })]));
const action=z.object({type:z.enum(["SHOW","HIDE","REQUIRED","OPTIONAL","SCORE","ANOMALY","RISK","RECOMMENDATION","OPPORTUNITY","SOLUTION_LEVEL","REQUIRE_DOCUMENT","HUMAN_REVIEW","BLOCK_PUBLICATION","BLOCK_RFQ","SUGGEST_SERVICE","START_CHILD_DIAGNOSTIC","SET_VALIDITY_DAYS"]),target:z.string().min(1).max(160).optional(),metadata:z.record(z.string(),z.unknown()).optional(),value:z.unknown().optional(),dimension:z.string().regex(/^[A-Z][A-Z0-9_.-]{1,79}$/).optional(),delta_basis_points:z.number().int().min(-10000).max(10000).optional(),duration_days:z.number().int().min(1).max(3650).optional()}).strict().superRefine((v,c)=>{
 if(["SHOW","HIDE","REQUIRED","OPTIONAL","ANOMALY","RISK","RECOMMENDATION","OPPORTUNITY","SOLUTION_LEVEL","REQUIRE_DOCUMENT","SUGGEST_SERVICE","START_CHILD_DIAGNOSTIC"].includes(v.type)&&!v.target)c.addIssue({code:"custom",message:"TARGET_REQUIRED"});
 if(v.type==="SCORE"&&(!v.dimension||v.delta_basis_points===undefined))c.addIssue({code:"custom",message:"SCORE_REQUIRED"});
 if(v.type==="SET_VALIDITY_DAYS"&&!v.duration_days)c.addIssue({code:"custom",message:"DURATION_REQUIRED"});
});
const schema=z.object({condition_ast:condition,actions:z.array(action).min(1).max(64),dependency_graph:z.record(z.string(),z.array(id).max(256)),priority:z.number().int().min(0).max(100000),sensitive:z.boolean()}).strict();
export function parseFranchiseRulePayload(raw:string,allowedIds:Set<string>){
 if(raw.length>262144)return null;
 let value:unknown;try{value=JSON.parse(raw);}catch{return null;}
 // Bound depth before recursive schema validation to reject hostile deeply nested JSON.
 const stack=[{value,depth:0}];let nodes=0;
 while(stack.length){const item=stack.pop()!;if(item.depth>20||++nodes>10000)return null;if(item.value&&typeof item.value==="object")for(const child of Object.values(item.value))stack.push({value:child,depth:item.depth+1});}
 const result=schema.safeParse(value);if(!result.success)return null;
 const refs:Condition[]=[result.data.condition_ast];while(refs.length){const node=refs.pop()!;if("group"in node)refs.push(...node.conditions);else if(!allowedIds.has(node.question_version_id))return null;}
 for(const action of result.data.actions) if(["SHOW","HIDE","REQUIRED","OPTIONAL"].includes(action.type)&&!allowedIds.has(action.target??""))return null;
 const graph=result.data.dependency_graph;
 if(Object.keys(graph).length>256)return null;
 const visiting=new Set<string>(),done=new Set<string>();
 function cycle(id:string):boolean{if(visiting.has(id))return true;if(done.has(id))return false;visiting.add(id);for(const target of graph[id]??[])if(!allowedIds.has(target)||cycle(target))return true;visiting.delete(id);done.add(id);return false;}
 for(const key of Object.keys(graph))if(!allowedIds.has(key)||cycle(key))return null;
 return result.data;
}
