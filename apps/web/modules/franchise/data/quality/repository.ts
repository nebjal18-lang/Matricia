import { classifyAuthReadFailure } from "@/modules/shared/lib/auth/read-failure";
import { collectOperationPages } from "../operations/paging";
import { z } from "zod";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";

const id = z.string().uuid();
const plan = z.object({
  id,
  franchise_id: id,
  plan_key: z.string(),
  version: z.number().int().positive(),
  status: z.enum(["PROPOSED", "APPROVED", "ACTIVE", "COMPLETED", "CANCELLED"]),
  due_on: z.string(),
});

export type FranchiseCorrectivePlan = {
  id: string;
  franchiseId: string;
  key: string;
  version: number;
  status: z.infer<typeof plan>["status"];
  dueOn: string;
};

export type FranchiseCorrectiveLoadResult =
  | { status: "success"; plans: FranchiseCorrectivePlan[] }
  | { status: "error"; reason: "UNAUTHENTICATED" | "QUERY_FAILED" | "INVALID_RESPONSE" };

async function readFranchiseCorrectivePlans(franchiseId?:string): Promise<FranchiseCorrectiveLoadResult> {
  const client = await getSupabaseServerClient();
  const { data: auth,error:authError } = await client.auth.getUser();
  if(authError)return{status:"error",reason:classifyAuthReadFailure(authError)==="UNAUTHENTICATED"?"UNAUTHENTICATED":"QUERY_FAILED"};
  if (!auth.user) return { status: "error", reason: "UNAUTHENTICATED" };
  const result = await collectOperationPages((from,to)=>client
    .from("franchise_corrective_plan_versions")
    .select("id,franchise_id,plan_key,version,status,due_on")
    .match(franchiseId?{franchise_id:franchiseId}:{})
    .order("due_on").order("id")
    .range(from,to));
  if (result.error) return { status: "error", reason: "QUERY_FAILED" };
  const parsed = z.array(plan).safeParse(result.data);
  if (!parsed.success) return { status: "error", reason: "INVALID_RESPONSE" };
  return {
    status: "success",
    plans: parsed.data.map((item) => ({
      id: item.id,
      franchiseId: item.franchise_id,
      key: item.plan_key,
      version: item.version,
      status: item.status,
      dueOn: item.due_on,
    })),
  };
}

/** A transport rejection is an incident, never a successful empty workspace. */
export async function loadFranchiseCorrectivePlans(franchiseId?:string):Promise<FranchiseCorrectiveLoadResult>{
 try{return await readFranchiseCorrectivePlans(franchiseId);}catch{return{status:"error",reason:"QUERY_FAILED"};}
}
