"use server";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { adminAllocateInput,adminConsumeInput,localeInput } from "@/modules/admin/data/volume/model";
import { allocateAdminVolume,consumeAdminVolume,loadAdminVolume } from "@/modules/admin/data/volume/repository";
import type{State}from"./state";
export type{State}from"./state";
const read=(form:FormData,name:string)=>String(form.get(name)??"");
const fail=(reason:string):State=>({status:"error",reason:reason==="FORBIDDEN"?"FORBIDDEN":"UNAVAILABLE"});
export async function allocateAction(_:State,form:FormData):Promise<State>{const locale=localeInput.safeParse(read(form,"locale")),input=adminAllocateInput.safeParse({reservationId:read(form,"reservationId"),providerCommitmentId:read(form,"providerCommitmentId"),units:read(form,"units"),idempotencyKey:read(form,"idempotencyKey")});if(!locale.success||!input.success)return{status:"error",reason:"VALIDATION"};const result=await allocateAdminVolume({...input.data,correlationId:randomUUID()});if(result.status==="error")return fail(result.reason);revalidatePath(`/${locale.data}/administration/achats-groupes`);return{status:"success"};}
export async function consumeAction(_:State,form:FormData):Promise<State>{const locale=localeInput.safeParse(read(form,"locale")),input=adminConsumeInput.safeParse({allocationId:read(form,"allocationId"),units:read(form,"units"),idempotencyKey:read(form,"idempotencyKey")});if(!locale.success||!input.success)return{status:"error",reason:"VALIDATION"};const dashboard=await loadAdminVolume();if(dashboard.status==="error")return fail(dashboard.reason);const allocation=dashboard.value.allocations.find(item=>item.id===input.data.allocationId);if(!allocation)return{status:"error",reason:"VALIDATION"};const result=await consumeAdminVolume({...input.data,reservationId:allocation.reservation_id,correlationId:randomUUID()});if(result.status==="error")return fail(result.reason);revalidatePath(`/${locale.data}/administration/achats-groupes`);return{status:"success"};}
