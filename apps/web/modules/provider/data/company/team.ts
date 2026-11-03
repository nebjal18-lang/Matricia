import { z } from "zod";
import { classifyAuthReadFailure } from "@/modules/shared/lib/auth/read-failure";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";
import { readAllPages, readRelatedPages } from "@/modules/shared/lib/data/read-pages";

const membership = z.object({ id:z.string().uuid(), organization_id:z.string().uuid(),user_id:z.string().uuid(),status:z.enum(["ACTIVE","INVITED","SUSPENDED","REVOKED"]) });
const role = z.object({membership_id:z.string().uuid(),role_code:z.string().min(1),revoked_at:z.string().nullable()});
export type ProviderTeam = { id:string;isCurrentUser:boolean;status:z.infer<typeof membership>["status"];roles:string[] }[];
export async function loadProviderTeam(organizationId:string|null):Promise<{status:"success";members:ProviderTeam}|{status:"error";reason:"UNAUTHENTICATED"|"FORBIDDEN"|"UNAVAILABLE"}> {
 const client=await getSupabaseServerClient();
 const auth=await client.auth.getUser();
 const authFailure=classifyAuthReadFailure(auth.error);
 if(authFailure)return{status:"error",reason:authFailure};
 if(!auth.data.user)return{status:"error",reason:"UNAUTHENTICATED"};
 if(!organizationId||!z.string().uuid().safeParse(organizationId).success)return{status:"error",reason:"FORBIDDEN"};
 const own=await client.from("organization_memberships").select("id").eq("organization_id",organizationId).eq("user_id",auth.data.user.id).eq("status","ACTIVE").maybeSingle();
 if(own.error)return{status:"error",reason:"UNAVAILABLE"};
 if(!own.data)return{status:"error",reason:"FORBIDDEN"};
 const result=await readAllPages((from,to)=>client.from("organization_memberships").select("id,organization_id,user_id,status").eq("organization_id",organizationId).order("id").range(from,to));
 const members=z.array(membership).safeParse(result.data);
 if(result.error||!members.success||members.data.some(member=>member.organization_id!==organizationId))return{status:"error",reason:"UNAVAILABLE"};
 const roleResult=await readRelatedPages(members.data.map(member=>member.id),(ids,from,to)=>client.from("organization_member_roles").select("membership_id,role_code,revoked_at").in("membership_id",ids).is("revoked_at",null).order("membership_id").order("role_code").range(from,to));
 const roles=z.array(role).safeParse(roleResult.data);
 if(roleResult.error||!roles.success)return{status:"error",reason:"UNAVAILABLE"};
 const grouped=new Map<string,string[]>();
 for(const item of roles.data){const values=grouped.get(item.membership_id)??[];if(item.revoked_at===null)values.push(item.role_code);grouped.set(item.membership_id,values);}
 return{status:"success",members:members.data.map(member=>({id:member.id,isCurrentUser:member.user_id===auth.data.user!.id,status:member.status,roles:grouped.get(member.id)??[]}))};
}
