import {beforeEach,describe,expect,it,vi} from "vitest";
import {renderToStaticMarkup} from "react-dom/server";
import type {ReactNode} from "react";
const mocks=vi.hoisted(()=>({context:vi.fn(),pages:vi.fn()}));
vi.mock("@/modules/admin/ui/sensitive-page-context",()=>({sensitivePageContext:mocks.context}));
vi.mock("@/modules/franchise/data/operations/paging",()=>({collectOperationPages:mocks.pages}));
vi.mock("@/modules/admin/ui/admin-step2-gate",()=>({AdminStep2Gate:()=>null}));
vi.mock("@/modules/franchise/screens/relances/panel",()=>({Decision:({id}:{id:string})=><form data-policy={id}/> }));
import Page from "@/app/[locale]/administration/relances-franchise/page";
const actor="e0380000-0000-4000-8000-000000000001",other="e0380000-0000-4000-8000-000000000002";
const policy={id:"e0381000-0000-4000-8000-000000000001",version:2,proposed_by:other,eligible_stages:["SENT"],reminder_delays_minutes:[0,1440],retry_delays_minutes:[5,15],maximum_attempts:3,maximum_reminders_per_7_days:2,lease_seconds:120,effective_from:"2026-11-23T00:00:00Z",effective_until:null,change_reason:"Revue humaine des limites",franchises:{operator_code:"FRANCHISEE",territory_code:"TERRITORY"}};
beforeEach(()=>{vi.clearAllMocks();mocks.context.mockResolvedValue({status:"authorized",access:{client:{},userId:actor},selfPath:"/fr/administration/relances-franchise",wrap:(children:ReactNode)=>children});mocks.pages.mockResolvedValue({data:[policy],error:null});});
describe("central followup review",()=>{
 it.each(["fr","ar"])("shows actual policy terms before independent review in %s",async locale=>{const html=renderToStaticMarkup(await Page({params:Promise.resolve({locale})}));expect(html).toContain("0, 1440");expect(html).toContain(policy.change_reason);expect(html).toContain(`data-policy="${policy.id}"`);expect(mocks.context).toHaveBeenCalledWith(expect.objectContaining({roles:["SUPER_ADMIN","MATRICIA_ADMIN"]}));});
 it("does not offer self approval",async()=>{mocks.pages.mockResolvedValue({data:[{...policy,proposed_by:actor}],error:null});const html=renderToStaticMarkup(await Page({params:Promise.resolve({locale:"fr"})}));expect(html).not.toContain("<form");expect(html).toContain("autre administrateur");});
 it("does not read policies when the role or MFA gate blocks access",async()=>{mocks.context.mockResolvedValue({status:"blocked",view:<p>Denied</p>});expect(renderToStaticMarkup(await Page({params:Promise.resolve({locale:"fr"})}))).toContain("Denied");expect(mocks.pages).not.toHaveBeenCalled();});
});
