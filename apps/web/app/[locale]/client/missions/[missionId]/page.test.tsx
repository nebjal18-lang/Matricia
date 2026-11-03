import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({missions:vi.fn(),amendments:vi.fn(),space:vi.fn(),board:vi.fn(),notFound:vi.fn(()=>{throw new Error("NOT_FOUND")}),redirect:vi.fn((href:string)=>{void href;throw new Error("REDIRECT")})}));
vi.mock("next/navigation",()=>({notFound:mocks.notFound,redirect:mocks.redirect}));
vi.mock("@/modules/client/data/spaces/context",()=>({resolveClientSpace:mocks.space}));
vi.mock("@/modules/shared/lib/contracts-missions/repository",()=>({loadContractMissions:mocks.missions}));
vi.mock("@/modules/shared/lib/contracts-missions/amendments",()=>({loadClientAmendments:mocks.amendments}));
vi.mock("@/modules/client/ui/client-app-shell",()=>({ClientAppShell:({children}:{children:ReactNode})=><div>{children}</div>}));
vi.mock("@/modules/client/screens/spaces/follow-board",()=>({FollowBoard:(props:{mission:unknown})=>{mocks.board(props);return <main>FOLLOW_BOARD</main>}}));
vi.mock("@/modules/client/screens/missions/mission-panel",()=>({MissionPanel:()=>null}));
vi.mock("@/modules/client/screens/missions/milestone-decisions",()=>({MilestoneDecisions:()=>null}));
vi.mock("@/modules/client/screens/missions/amendment-panel",()=>({AmendmentPanel:()=>null}));
import Page from "./page";
const organizationId="a9700000-0000-4000-8000-000000000001",missionId="a9700000-0000-4000-8000-000000000002";
const input=(locale="fr",id=missionId)=>({params:Promise.resolve({locale,missionId:id}),searchParams:Promise.resolve({organizationId})});
beforeEach(()=>{
  vi.clearAllMocks();
  mocks.space.mockResolvedValue({status:"success",selectedOrganizationId:organizationId,selectedQuery:`?organizationId=${organizationId}`,organizationName:"Société test",userEmail:"owner@example.invalid"});
  mocks.missions.mockResolvedValue({status:"error",reason:"QUERY_FAILED"});
  mocks.amendments.mockResolvedValue({status:"success",value:{organizationId,items:[]}});
});
describe("Client mission route read states",()=>{
  it.each(["fr","ar"])("keeps a failed or partial scope-state read visible with contextual retry in %s",async locale=>{
    const html=renderToStaticMarkup(await Page(input(locale)));
    expect(html).toContain('role="alert"');expect(html).toContain(locale==="ar"?"متابعة المهمة غير متاحة":"Suivi de mission indisponible");
    expect(html).toContain(locale==="ar"?"إعادة المحاولة":"Réessayer");
    expect(html).toContain(`/${locale}/client/missions/${missionId}?organizationId=${organizationId}`);
    expect(html).not.toContain("FOLLOW_BOARD");expect(html).not.toContain("<details");expect(html).not.toContain("QUERY_FAILED");
    expect(mocks.board).not.toHaveBeenCalled();expect(mocks.notFound).not.toHaveBeenCalled();
    expect(mocks.missions).toHaveBeenCalledWith(locale,organizationId);
  });
  it.each(["fr","ar"])("returns404 only after a successful read finds no authorized mission in %s",async locale=>{
    mocks.missions.mockResolvedValue({status:"success",dashboard:{organizationId,contracts:[],missions:[{id:organizationId}]}});
    await expect(Page(input(locale))).rejects.toThrow("NOT_FOUND");expect(mocks.board).not.toHaveBeenCalled();expect(mocks.notFound).toHaveBeenCalledOnce();
  });
  it("rejects malformed mission references before reading any tenant data",async()=>{
    await expect(Page(input("fr","malformed"))).rejects.toThrow("NOT_FOUND");expect(mocks.space).not.toHaveBeenCalled();expect(mocks.missions).not.toHaveBeenCalled();
  });
  it.each(["fr","ar"])("passes the actual completed mission with pending preparation to its board in %s",async locale=>{
    const mission={id:missionId,status:"COMPLETED",scopeReconciliationRequired:false,signedScopePending:true};
    mocks.missions.mockResolvedValue({status:"success",dashboard:{organizationId,contracts:[],missions:[mission,{id:organizationId}]}});
    const html=renderToStaticMarkup(await Page(input(locale)));expect(html).toContain("FOLLOW_BOARD");expect(mocks.notFound).not.toHaveBeenCalled();
    expect(mocks.board).toHaveBeenCalledWith(expect.objectContaining({mission,query:`?organizationId=${organizationId}`}));
  });
  it.each(["fr","ar"])("redirects an expired DAL session to a safe deep link with organization context in %s",async locale=>{
    mocks.missions.mockResolvedValue({status:"error",reason:"UNAUTHENTICATED"});
    await expect(Page(input(locale))).rejects.toThrow("REDIRECT");
    const destination=mocks.redirect.mock.calls[0]![0] as string;
    const login=new URL(destination,"https://matricia.invalid");
    expect(login.pathname).toBe(`/${locale}/connexion`);expect(login.searchParams.get("next")).toBe(`/${locale}/client/missions/${missionId}?organizationId=${organizationId}`);
    expect(mocks.notFound).not.toHaveBeenCalled();expect(mocks.board).not.toHaveBeenCalled();
  });
  it.each(["fr","ar"])("preserves the requested deep-link context when space authentication expires in %s",async locale=>{
    mocks.space.mockResolvedValue({status:"unauthenticated"});await expect(Page(input(locale))).rejects.toThrow("REDIRECT");
    expect(new URL(mocks.redirect.mock.calls[0]![0],"https://matricia.invalid").searchParams.get("next")).toBe(`/${locale}/client/missions/${missionId}?organizationId=${organizationId}`);
    expect(mocks.missions).not.toHaveBeenCalled();
  });
  it.each(["fr","ar"])("distinguishes refused rights from an incident with a concrete entitlement action in %s",async locale=>{
    mocks.missions.mockResolvedValue({status:"error",reason:"FORBIDDEN_ORGANIZATION"});const html=renderToStaticMarkup(await Page(input(locale)));
    expect(html).toContain('data-workspace-failure="FORBIDDEN"');expect(html).toContain(`/${locale}/organisation/roles`);
    expect(html).toContain(locale==="ar"?"طلب صلاحية مناسبة":"Demander une habilitation");
    expect(html).not.toContain(locale==="ar"?"متابعة المهمة غير متاحة":"Suivi de mission indisponible");expect(html).not.toContain(locale==="ar"?"إعادة المحاولة":"Réessayer");
    expect(mocks.notFound).not.toHaveBeenCalled();expect(mocks.board).not.toHaveBeenCalled();
  });
  it.each(["fr","ar"])("offers real organization selection and joining paths rather than technical retry in %s",async locale=>{
    for(const [reason,path] of [["ORGANIZATION_SELECTION_REQUIRED","tableau-de-bord"],["NO_CLIENT_ORGANIZATION","organisation/rattachements"]]){
      mocks.missions.mockResolvedValue({status:"error",reason});const html=renderToStaticMarkup(await Page(input(locale)));
      expect(html).toContain('data-workspace-failure="NO_ORGANIZATION"');expect(html).toContain(`/${locale}/${path}`);
      expect(html).not.toContain(locale==="ar"?"متابعة المهمة غير متاحة":"Suivi de mission indisponible");expect(html).not.toContain(locale==="ar"?"إعادة المحاولة":"Réessayer");
    }
    expect(mocks.notFound).not.toHaveBeenCalled();expect(mocks.board).not.toHaveBeenCalled();
  });
  it.each(["fr","ar"])("retains technical retry for an invalid response in %s",async locale=>{
    mocks.missions.mockResolvedValue({status:"error",reason:"INVALID_RESPONSE"});const html=renderToStaticMarkup(await Page(input(locale)));
    expect(html).toContain(locale==="ar"?"متابعة المهمة غير متاحة":"Suivi de mission indisponible");expect(html).toContain(`/${locale}/client/missions/${missionId}?organizationId=${organizationId}`);expect(mocks.notFound).not.toHaveBeenCalled();expect(mocks.board).not.toHaveBeenCalled();
  });

});
