"use client";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { useOperationKey } from "./use-operation-key";
import type { DeliveryActionState } from "./actions";
const idle:DeliveryActionState={status:"idle"};
/** Retry one intent after errors; only confirmed success starts the next intent. */
export function useMissionAction(command:(previous:DeliveryActionState,form:FormData)=>Promise<DeliveryActionState>){
 const router=useRouter(),[key,renewKey]=useOperationKey();
 const[state,action,pending]=useActionState(async(previous:DeliveryActionState,form:FormData)=>{const result=await command(previous,form);if(result.status==="success"){renewKey();router.refresh()}return result},idle);
 return{key,state,action,pending};
}
