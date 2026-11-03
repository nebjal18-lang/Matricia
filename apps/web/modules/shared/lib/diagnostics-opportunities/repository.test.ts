import{describe,expect,it,vi}from"vitest";import{createDiagnosticsRepository,type Source}from"./repository";const U="00000000-0000-4000-8000-000000000001",S="00000000-0000-4000-8000-000000000002",V="00000000-0000-4000-8000-000000000003",O="00000000-0000-4000-8000-000000000004",L="00000000-0000-4000-8000-000000000005";function source(user:string|null=U):Source{return{async user(){return user},async sessions(){return{data:[{id:S,organization_id:O,library_id:L,submitted_at:"2026-09-12T00:00:00Z"}],error:null}},async runs(){return{data:[],error:null}},async services(){return{data:[{id:S,current_published_version_id:V}],error:null}},async serviceVersions(){return{data:[{id:V,name_fr:"Audit",name_ar:"تدقيق"}],error:null}},async subscores(){return{data:[],error:null}},async anomalies(){return{data:[],error:null}},async recommendations(){return{data:[],error:null}},async opportunities(){return{data:[],error:null}},async rpc(){return{data:{outcome:"OK"},error:null}}}}describe("diagnostics repository",()=>{it("fails closed before reads when unauthenticated",async()=>{expect(await createDiagnosticsRepository(source(null)).list()).toEqual({status:"error",reason:"UNAUTHENTICATED"})});it("maps only published service labels supplied by RLS source",async()=>{const r=await createDiagnosticsRepository(source()).list();expect(r.status).toBe("success");if(r.status==="success")expect(r.value.services[0]).toEqual({id:S,nameFr:"Audit",nameAr:"تدقيق"})});it("rejects malformed detail ids",async()=>{expect(await createDiagnosticsRepository(source()).detail("bad")).toEqual({status:"error",reason:"INVALID_INPUT"})})});

describe("canonical diagnostic command",()=>{
 it("sends references only to the authoritative published engine",async()=>{
  const rpc=vi.fn().mockResolvedValue({data:{outcome:"DIAGNOSTIC_COMPLETED",diagnostic_run_id:V},error:null});
  const input={sessionId:S,serviceId:null,idempotencyKey:U,correlationId:O};
  expect((await createDiagnosticsRepository({...source(),rpc}).complete(input)).status).toBe("success");
  expect(rpc).toHaveBeenCalledWith("complete_published_client_diagnostic_v1",{p_session_id:S,p_service_id:null,p_idempotency_key:U,p_correlation_id:O});
 });
 it("rejects unknown success and exposes the missing policy prerequisite",async()=>{
  const input={sessionId:S,serviceId:null,idempotencyKey:U,correlationId:O};
  expect(await createDiagnosticsRepository(source()).complete(input)).toEqual({status:"error",reason:"UNAVAILABLE"});
  expect(await createDiagnosticsRepository({...source(),rpc:async()=>({data:null,error:{code:"55000"}})}).complete(input)).toEqual({status:"error",reason:"POLICY_REQUIRED"});
 });
});
