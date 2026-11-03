import { beforeEach,describe,it,expect,vi } from "vitest";
const mocks=vi.hoisted(()=>({navigation:vi.fn(),load:vi.fn(),cookie:vi.fn()}));
vi.mock("next/headers",()=>({cookies:async()=>({get:mocks.cookie})}));
vi.mock("@/modules/shared/lib/auth/workspace-navigation-server",()=>({readWorkspaceNavigation:mocks.navigation}));
vi.mock("@/modules/shared/lib/notifications/repository",()=>({loadNotificationCenter:mocks.load}));
import NotificationsPage from "./page";
const org="22222222-2222-4222-8222-222222222222";
beforeEach(()=>{
 vi.clearAllMocks();mocks.cookie.mockReturnValue({value:"client"});
 mocks.navigation.mockResolvedValue({status:"ok",navigation:{landing:"client",options:[{kind:"provider",href:"/fr/sous-traitant/accueil?organizationId=11111111-1111-4111-8111-111111111111"},{kind:"client",href:`/fr/client/accueil?organizationId=${org}&workspace=client`}]}});
 mocks.load.mockResolvedValue({status:"error",reason:"QUERY_FAILED"});
});
describe("notification page workspace binding",()=>{
 it("loads the same authorized organization selected for the Client shell",async()=>{
  const page=await NotificationsPage({params:Promise.resolve({locale:"fr"}),searchParams:Promise.resolve({q:"facture",unread:"1"})});
  expect(mocks.navigation).toHaveBeenCalledWith("fr",undefined,"client");
  expect(mocks.load).toHaveBeenCalledWith("fr",org,expect.objectContaining({q:"facture",unread:true}));
  expect(page.props.organizationId).toBe(org);
  expect(page.props.workspace).toBe("client");
  expect(page.props.currentPath).toContain(`organizationId=${org}`);
 });
 it("never loads another organization after a refused explicit context",async()=>{
  mocks.navigation.mockResolvedValue({status:"error",reason:"FORBIDDEN"});
  await NotificationsPage({params:Promise.resolve({locale:"ar"}),searchParams:Promise.resolve({organizationId:org,workspace:"client"})});
  expect(mocks.load).not.toHaveBeenCalled();
 });
});
