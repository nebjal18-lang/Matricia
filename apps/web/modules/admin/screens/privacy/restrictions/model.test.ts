import{describe,it,expect}from"vitest";
import{restrictionScopeCommand,restrictionFulfilCommand}from"./model";
const id="d2520000-0000-4000-8000-000000000001",hash="a".repeat(64);
const request={id,row_version:1,organization_id:id,organization_name:"TEST",status:"IN_REVIEW",verified:true,due_at:"2026-11-01",marketing_restricted:true,scope:{id,version:1,action:"APPLY",purposes:["MARKETING"],content_hash:hash},proposal:null,application:{id,scope_version_id:id,action:"APPLY",purposes:["MARKETING"],sha256:hash,applied_at:"2026-11-01",current:true,acknowledged:true,reference:`privacy-restriction:${id}`}};
describe("effective processing restriction",()=>{
 it("fixes scope to typed purposes rather than accepting arbitrary jobs or tenants",()=>expect(restrictionScopeCommand(id,"APPLY",["MARKETING","MARKETING"])).toEqual({p_request_id:id,p_action:"APPLY",p_purposes:["MARKETING"]}));
 it.each([{purposes:["ALL"]},{purposes:["SECURITY"]},{purposes:["LEGAL"]},{purposes:[]}])("refuses unsupported scope %j",({purposes})=>expect(()=>restrictionScopeCommand(id,"APPLY",purposes)).toThrow());
 it("requires a real current application and the subject receipt before completion",()=>expect(restrictionFulfilCommand(request)).toEqual({p_request_id:id,p_expected_version:1,p_new_status:"FULFILLED",p_decision_reason_code:"RESTRICTION_EFFECT_AND_DELIVERY_CONFIRMED",p_export_storage_reference:`privacy-restriction:${id}`}));
 it.each([{...request,application:null},{...request,application:{...request.application,current:false}},{...request,application:{...request.application,acknowledged:false}},{...request,scope:{...request.scope,id:"d2520000-0000-4000-8000-000000000002"}}])("never closes a stale or unacknowledged effect",value=>expect(()=>restrictionFulfilCommand(value)).toThrow());
});
