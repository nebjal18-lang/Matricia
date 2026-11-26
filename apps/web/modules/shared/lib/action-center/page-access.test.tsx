import {beforeEach,describe,expect,it,vi} from "vitest";
import {renderToStaticMarkup} from "react-dom/server";
const mocks=vi.hoisted(()=>({access:vi.fn(),center:vi.fn()}));
vi.mock("@/modules/shared/lib/account-security/platform-access",()=>({loadMyPlatformAccess:mocks.access,hasPlatformRole:(roles:Set<string>,allowed:string[])=>allowed.some(r=>roles.has(r))}));
vi.mock("./repository",()=>({loadUserActionCenter:mocks.center}));
import Page from "@/app/[locale]/actions/page";
beforeEach(()=>{vi.clearAllMocks();mocks.access.mockResolvedValue({status:"ok",roles:new Set(["MATRICIA_ADMIN"]),requirementSatisfied:true});mocks.center.mockResolvedValue({status:"success",value:{items:[],degradedSources:[]}});});
describe("universal action page authorization",()=>{
 it("includes administrator tasks after server role and MFA verification",async()=>{await Page({params:Promise.resolve({locale:"fr"})});expect(mocks.center).toHaveBeenCalledWith("fr",expect.any(String),undefined,{includeAdmin:true});});
 it("does not request administrator tasks for an organization member",async()=>{mocks.access.mockResolvedValue({status:"ok",roles:new Set(),requirementSatisfied:true});await Page({params:Promise.resolve({locale:"fr"})});expect(mocks.center).toHaveBeenCalledWith("fr",expect.any(String),undefined,{includeAdmin:false});});
 it("does not read administrative tasks before MFA",async()=>{mocks.access.mockResolvedValue({status:"ok",roles:new Set(["MATRICIA_ADMIN"]),requirementSatisfied:false});const html=renderToStaticMarkup(await Page({params:Promise.resolve({locale:"fr"})}));expect(mocks.center).not.toHaveBeenCalled();expect(html).not.toContain("Aucune action");});
 it("does not report an empty queue when role verification fails",async()=>{mocks.access.mockResolvedValue({status:"error",reason:"QUERY_FAILED"});await Page({params:Promise.resolve({locale:"fr"})});expect(mocks.center).not.toHaveBeenCalled();});
});
