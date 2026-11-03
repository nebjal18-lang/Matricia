import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ from: vi.fn(), getUser: vi.fn(), rpc:vi.fn() }));

vi.mock("@/modules/shared/lib/supabase/server", () => ({
  getSupabaseServerClient: async () => ({ auth: { getUser: mocks.getUser }, from: mocks.from, rpc:mocks.rpc }),
}));

import { loadFranchiseOperations } from "./repository";

const libraryId = "22222222-2222-4222-8222-222222222222";
const requestId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const franchiseId="33333333-3333-4333-8333-333333333333";
const currentVersionId="77777777-7777-4777-8777-777777777777";
const permissions={franchiseId,libraryId,canDecideQualifications:true,canMaintainDefinitions:true,canInstructDisputes:true,canProposeVolume:true};
const metrics={methodologyVersion:"FRANCHISE_SUPERVISION_V1",grain:"LIBRARY_ALL_HISTORY",libraryId,franchiseId,asOf:"2026-11-03T00:00:00Z",requestCount:0,conversionDenominator:0,convertedRequests:0,missionCount:0,completedMissions:0,capacityProviders:0,availableProviders:0,responseAverageSeconds:null,qualitySnapshot:null,byService:[],byProvider:[]};
const serviceId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

function chain(data: unknown) {
  const value = {
    select: vi.fn(() => value),
    eq: vi.fn(() => value),
    in: vi.fn(() => value),
    not: vi.fn(() => value),
    order: vi.fn(() => value),
    range: vi.fn(async (from:number,to:number) => ({ data:Array.isArray(data)?data.slice(from,to+1):data, error: null })),
  };
  return value;
}

describe("franchise operations repository", () => {
  beforeEach(()=>{vi.clearAllMocks();mocks.rpc.mockImplementation(async(name:string)=>({error:null,data:name==="franchise_operation_permissions_v1"?permissions:name==="franchise_supervision_metrics"?metrics:name==="franchise_operational_missions_v1"?{complete:true,libraryId,franchiseId,missions:[]}:[]}));});
  it("ne charge rien hors session", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    await expect(loadFranchiseOperations({ libraryId, franchiseId })).rejects.toThrow("FRANCHISE_OPERATIONS_UNAUTHENTICATED");
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("agrège les dossiers de la bibliothèque mandatée sans identifiant d’organisation prestataire", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "11111111-1111-4111-8111-111111111111" } } });
    mocks.from.mockImplementation((table: string) => {
      if (table === "service_requests") return chain([{ id: requestId, status: "MATCHING", service_id: serviceId, library_id: libraryId,current_version_id:currentVersionId }]);
      if (table === "catalog_services") return chain([{ id: serviceId, code: "IT_BACKUP" }]);
      if (table === "service_request_versions") return chain([{ id:currentVersionId,request_id: requestId, urgency: "HIGH" }]);
      if (table === "matching_runs") return chain([{ id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", request_id: requestId }]);
      if (table === "matching_candidates") return chain([{ id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", matching_run_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", eligible: true, score_basis_points: 4200 }]);
      if (table === "rfqs") return chain([{ id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", request_id: requestId }]);
      if (table === "quotes") return chain([{ id: "ffffffff-ffff-4fff-8fff-ffffffffffff", status: "SUBMITTED", rfq_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd" }]);
      if (table === "quote_versions") return chain([{ quote_id: "ffffffff-ffff-4fff-8fff-ffffffffffff", total_minor: "125000", currency: "MAD", version_number: 1 }]);
      if (table === "diagnostic_anomalies") return chain([{ id: "99999999-9999-4999-8999-999999999999", title_fr: "Score critique", title_ar: "درجة حرجة", severity: "HIGH", status: "OPEN", anomaly_code: "HEALTH_SCORE_IMPORTANT", blocking: false }]);
      return chain([]);
    });
    const snapshot = await loadFranchiseOperations({ libraryId, franchiseId });
    expect(snapshot.requests[0]).toMatchObject({ title: "IT_BACKUP", status: "MATCHING", urgency: "HIGH" });
    expect(snapshot.matching[0]).toMatchObject({ eligible: true, scoreBps: 4200, requestId });
    expect(snapshot.quotes[0]).toMatchObject({ totalMinor: "125000", currency: "MAD", requestId });
    expect(snapshot.anomalies[0]?.titleFr).toBe("Score critique");
    expect(snapshot.disputes).toEqual([]);
    expect(snapshot.skus).toEqual([]);
    expect(snapshot.anomalyDefinitions).toEqual([]);
    expect(snapshot.volumeProposals).toEqual([]);
    expect(JSON.stringify(snapshot)).not.toMatch(/Hatim|Jalil-NEOXA|50\s*%/);
  });

  it("projette les définitions et propositions volume de la bibliothèque mandatée", async () => {
    const definitionId = "31313131-3131-4313-8313-313131313131";
    mocks.getUser.mockResolvedValue({ data: { user: { id: "11111111-1111-4111-8111-111111111111" } } });
    mocks.from.mockImplementation((table: string) => {
      if (table === "anomaly_definition_versions") return chain([{ id: "41414141-4141-4414-8414-414141414141", definition_id: definitionId, severity: "CRITICAL", title_fr: "Score critique", title_ar: "درجة حرجة", version: 2 }]);
      if (table === "franchise_volume_proposals") return chain([{ id: "51515151-5151-4515-8515-515151515151", sku_id: serviceId, status: "PROPOSED", payment_model: "PAY_PER_USE" }]);
      if (table === "provider_qualifications") return chain([{ id: "61616161-6161-4616-8616-616161616161", service_id: serviceId, row_version: 3, current_decision_id: null }]);
      return chain([]);
    });
    mocks.rpc.mockImplementation(async(name:string)=>({error:null,data:name==="franchise_operation_permissions_v1"?permissions:name==="franchise_supervision_metrics"?metrics:name==="franchise_operational_missions_v1"?{complete:true,libraryId,franchiseId,missions:[]}:[{organizationId:"11111111-1111-4111-8111-111111111111",name:"TEST",companyStatus:"VERIFIED",status:"ACTIVE",createdAt:"2026-11-03T00:00:00Z",teamSize:1,regions:[],qualifications:[{id:"61616161-6161-4616-8616-616161616161",serviceId,serviceCode:"TEST_SERVICE",rowVersion:3,status:"PENDING"}],capacities:[],documents:[]}]}));
    const snapshot = await loadFranchiseOperations({ libraryId, franchiseId });
    expect(snapshot.anomalyDefinitions).toEqual([expect.objectContaining({ id: definitionId, titleFr: "Score critique", severity: "CRITICAL" })]);
    expect(snapshot.volumeProposals).toEqual([expect.objectContaining({ status: "PROPOSED", paymentModel: "PAY_PER_USE" })]);
    expect(snapshot.qualifications[0]).toMatchObject({ serviceId, status: "PENDING", rowVersion: 3 });
  });
  it("ne transforme pas un incident Auth en succès vide",async()=>{
    mocks.getUser.mockResolvedValue({data:{user:null},error:{status:503}});
    await expect(loadFranchiseOperations({libraryId,franchiseId})).rejects.toThrow("AUTH_UNAVAILABLE");
    expect(mocks.rpc).not.toHaveBeenCalled();expect(mocks.from).not.toHaveBeenCalled();
  });
  it("refuse un contexte de bibliothèque différent dans la projection serveur",async()=>{
    mocks.getUser.mockResolvedValue({data:{user:{id:franchiseId}}});
    mocks.rpc.mockImplementation(async(name:string)=>({error:null,data:name==="franchise_operation_permissions_v1"?permissions:name==="franchise_supervision_metrics"?{...metrics,libraryId:serviceId}:name==="franchise_operational_missions_v1"?{complete:true,libraryId,franchiseId,missions:[]}:[]}));
    await expect(loadFranchiseOperations({libraryId,franchiseId})).rejects.toThrow("METRICS_UNAVAILABLE");expect(mocks.from).not.toHaveBeenCalled();
  });
  it("lit toutes les pages des demandes et utilise la version courante même si une ancienne arrive après",async()=>{
    mocks.getUser.mockResolvedValue({data:{user:{id:franchiseId}}});
    const requests=Array.from({length:101},(_,index)=>({id:`aaaaaaaa-aaaa-4aaa-8aaa-${String(index).padStart(12,"0")}`,status:"DRAFT",service_id:serviceId,current_version_id:currentVersionId}));
    const chains:ReturnType<typeof chain>[]=[];
    mocks.from.mockImplementation((table:string)=>{
      const query=chain(table==="service_requests"?requests:table==="service_request_versions"?[{id:currentVersionId,request_id:requests[0].id,urgency:"CRITICAL"},{id:serviceId,request_id:requests[0].id,urgency:"LOW"}]:[]);
      if(table==="service_requests")chains.push(query);return query;
    });
    const snapshot=await loadFranchiseOperations({libraryId,franchiseId});
    expect(snapshot.requests).toHaveLength(101);expect(snapshot.requests[0]?.urgency).toBe("CRITICAL");
    expect(chains.map(query=>query.range.mock.calls)).toEqual([[[0,99]],[[100,199]]]);
    expect(mocks.from.mock.calls.flat()).not.toContain("missions");expect(mocks.from.mock.calls.flat()).not.toContain("provider_document_versions");
    expect(mocks.rpc).toHaveBeenCalledWith("franchise_operational_missions_v1",{p_franchise_id:franchiseId});
  });
});
