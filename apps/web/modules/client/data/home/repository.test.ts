import { beforeEach, describe, expect, it, vi } from "vitest";
const mocked = vi.hoisted(() => ({ rfq: vi.fn(), missions: vi.fn(), list: vi.fn() }));
vi.mock("@/modules/client/data/rfq/server-repository", () => ({ createServerClientRfqRepository: mocked.rfq }));
vi.mock("@/modules/shared/lib/contracts-missions/repository", () => ({ loadContractMissions: mocked.missions }));
import { loadClientHomeSnapshot } from "./repository";
beforeEach(() => {
 vi.clearAllMocks();
 mocked.rfq.mockResolvedValue({ list: mocked.list });
 mocked.missions.mockResolvedValue({status:"success", dashboard:{organizationName:"Current organization",contracts:[],missions:[]}});
});
describe("organization-scoped home snapshot", () => {
 const input = { organizationId:"selected-org",locale:"fr" as const,actionItems:[],now:"2026-11-02T00:00:00Z",isTeamLead:false };
 it("uses exhaustive tenant queries instead of the first request page", async () => {
  mocked.list.mockResolvedValue({status:"success",value:{requests:Array.from({length:31},(_,i)=>({id:String(i),organizationId:"selected-org",status:"DRAFT",description:"Draft",createdAt:input.now,quoteCount:0,rfqId:null}))}});
  const result=await loadClientHomeSnapshot(input);
  expect(mocked.rfq).toHaveBeenCalledWith({organizationId:"selected-org",allForOrganization:true});
  expect(mocked.missions).toHaveBeenCalledWith("fr","selected-org");
  expect(result).toMatchObject({status:"success",counts:{openRequests:31}});
 });
 it("retains authorized requests when the role cannot read mission data", async () => {
  mocked.list.mockResolvedValue({status:"success",value:{requests:[{id:"own",organizationId:"selected-org",status:"DRAFT",description:"Own request",createdAt:input.now,quoteCount:0,rfqId:null}]}});
  mocked.missions.mockResolvedValue({status:"error",reason:"FORBIDDEN_ORGANIZATION"});
  expect(await loadClientHomeSnapshot(input)).toMatchObject({status:"success",counts:{openRequests:1,activeMissions:null,pendingDecisions:null},partialSources:[{source:"missions",reason:"FORBIDDEN"}],featuredProject:{requestId:"own"}});
 });
 it("never highlights cancelled requests and never represents a source error with zero totals", async () => {
  mocked.list.mockResolvedValue({status:"success",value:{requests:[{id:"cancelled",organizationId:"selected-org",status:"CANCELLED",quoteCount:4,rfqId:null}]}});
  expect(await loadClientHomeSnapshot(input)).toMatchObject({status:"success",featuredProject:null,counts:{openRequests:0,quotesToReview:0}});
  mocked.list.mockResolvedValue({status:"error",reason:"UNAVAILABLE"});
  expect(await loadClientHomeSnapshot(input)).toMatchObject({status:"success",counts:{openRequests:null,quotesToReview:null,activeMissions:0},partialSources:[{source:"requests",reason:"UNAVAILABLE"}]});
  mocked.missions.mockResolvedValue({status:"error",reason:"QUERY_FAILED"});
  expect(await loadClientHomeSnapshot(input)).toMatchObject({status:"error",reason:"UNAVAILABLE",counts:{openRequests:null,quotesToReview:null,activeMissions:null}});
 });
});
