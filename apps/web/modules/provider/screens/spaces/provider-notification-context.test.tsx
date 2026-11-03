import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({space:vi.fn(),dashboard:vi.fn(),notifications:vi.fn(),inbox:vi.fn(),board:vi.fn()}));
vi.mock("@/app/[locale]/securite/compte/actions",()=>({getAccountSecurity:vi.fn()}));
vi.mock("@/app/[locale]/securite/sessions/actions",()=>({listMySessions:vi.fn()}));
vi.mock("@/modules/provider/data/spaces/context",()=>({resolveProviderSpace:mocks.space}));
vi.mock("@/modules/provider/data/qualification/repository",()=>({loadProviderDashboard:mocks.dashboard}));
vi.mock("@/modules/shared/lib/notifications/repository",()=>({loadNotificationCenter:mocks.notifications}));
vi.mock("@/modules/provider/data/messages/inbox",()=>({loadProviderInbox:mocks.inbox}));
vi.mock("@/modules/shared/lib/internal-messaging/server-repository",()=>({createInternalMessagingRepository:async()=>({})}));
vi.mock("@/modules/provider/ui/provider-app-shell",()=>({ProviderAppShell:({children}:{children:ReactNode})=><div>{children}</div>}));
vi.mock("@/app/[locale]/notifications/actions",()=>({saveNotificationPreference:vi.fn(),markNotificationRead:vi.fn()}));
vi.mock("@/modules/provider/screens/messages/inbox-board",()=>({ProviderInboxBoard:(props:{notificationsUnavailable:boolean;notifications:Array<{subject:string}>})=>{mocks.board(props);return <main>{props.notificationsUnavailable?<p role="alert">NOTIFICATIONS_UNAVAILABLE</p>:props.notifications.map((item,index)=><p key={index}>{item.subject}</p>)}</main>}}));
import SettingsPage from "@/app/[locale]/sous-traitant/parametres/page";
import { ProviderMessagesPage } from "./nested-screens";
const selected="ab970000-0000-4000-8000-000000000001",other="ab970000-0000-4000-8000-000000000002";
const space={status:"success",readError:null,selectedOrganizationId:selected,selectedQuery:`?organizationId=${selected}`,userEmail:null,organizationName:"Selected test Provider",organizations:[{id:other,name:"Other test Provider"},{id:selected,name:"Selected test Provider"}]};
beforeEach(()=>{
  vi.clearAllMocks();mocks.space.mockResolvedValue(space);
  mocks.dashboard.mockResolvedValue({status:"success",dashboard:{organizationId:selected,services:[],regionCodes:[]}});
  mocks.notifications.mockImplementation(async(locale:string,organizationId:string)=>organizationId===selected?{status:"success",dashboard:{organizationId:selected,organizationName:"Selected test Provider",canViewDeliveryOperations:false,categories:[{code:"MISSION_ALERT",label:locale==="ar"?"تنبيهات المهمة":"Alertes de mission",mandatory:false}],preferences:[],notifications:[{id:selected,subject:locale==="ar"?"تنبيه مرخص للمؤسسة المحددة":"Alerte autorisée de l’organisation sélectionnée",created_at:"2026-11-02T12:00:00Z",cta_path:null,read_at:null}],templates:[]}}:{status:"error",reason:"NO_ORGANIZATION"});
  mocks.inbox.mockResolvedValue({inbox:{status:"success",value:{inbox:[],total:0,pageSize:25}},options:{status:"success",value:{options:[]}},history:null});
});
describe("Provider notification callers retain authorized organization context",()=>{
  it.each(["fr","ar"])("SSR renders real preference form fields for the selected shell organization in %s",async locale=>{
    const html=renderToStaticMarkup(await SettingsPage({params:Promise.resolve({locale}),searchParams:Promise.resolve({})}));
    expect(mocks.notifications).toHaveBeenCalledExactlyOnceWith(locale,selected);
    expect(html).toContain(`name="organizationId" value="${selected}"`);expect(html).toContain('name="categoryCode" value="MISSION_ALERT"');
    expect(html).toContain('name="deliveryMode"');expect(html).toContain(locale==="ar"?"تنبيهات المهمة":"Alertes de mission");
    expect(html).not.toContain(`name="organizationId" value="${other}"`);expect(html).not.toContain('data-workspace-failure=');
  });
  it.each(["fr","ar"])("keeps an explicit notification refusal precise and does not render editable preferences in %s",async locale=>{
    mocks.notifications.mockResolvedValue({status:"error",reason:"FORBIDDEN"});
    const html=renderToStaticMarkup(await SettingsPage({params:Promise.resolve({locale}),searchParams:Promise.resolve({organizationId:selected})}));
    expect(mocks.notifications).toHaveBeenCalledExactlyOnceWith(locale,selected);expect(html).toContain('data-workspace-failure="FORBIDDEN"');
    expect(html).toContain(locale==="ar"?"الوصول إلى هذه الوظيفة غير مسموح":"Accès non autorisé à cette fonction");expect(html).not.toContain('name="deliveryMode"');
  });
  it.each(["fr","ar"])("passes the same selected organization to the messages notification read and inbox props in %s",async locale=>{
    const html=renderToStaticMarkup(await ProviderMessagesPage({params:Promise.resolve({locale}),searchParams:Promise.resolve({})}));
    expect(mocks.notifications).toHaveBeenCalledExactlyOnceWith(locale,selected);expect(mocks.inbox).toHaveBeenCalledWith(expect.anything(),expect.objectContaining({organizationId:selected}));
    expect(mocks.board).toHaveBeenCalledWith(expect.objectContaining({organizationId:selected,notificationsUnavailable:false,notifications:[expect.objectContaining({id:selected,subject:locale==="ar"?"تنبيه مرخص للمؤسسة المحددة":"Alerte autorisée de l’organisation sélectionnée"})]}));
    expect(html).toContain(locale==="ar"?"تنبيه مرخص":"Alerte autorisée");
  });
  it.each(["fr","ar"])("keeps an inbox notification read failure unavailable instead of displaying success in %s",async locale=>{
    mocks.notifications.mockResolvedValue({status:"error",reason:"QUERY_FAILED"});
    const html=renderToStaticMarkup(await ProviderMessagesPage({params:Promise.resolve({locale}),searchParams:Promise.resolve({organizationId:selected})}));
    expect(mocks.notifications).toHaveBeenCalledExactlyOnceWith(locale,selected);expect(mocks.board).toHaveBeenCalledWith(expect.objectContaining({organizationId:selected,notificationsUnavailable:true,notifications:[]}));
    expect(html).toContain('role="alert"');
  });
  it.each(["fr","ar"])("does not fall back to the first employer when notification context is absent in %s",async locale=>{
    mocks.space.mockResolvedValue({...space,selectedOrganizationId:null,selectedQuery:""});
    const html=renderToStaticMarkup(await SettingsPage({params:Promise.resolve({locale}),searchParams:Promise.resolve({})}));
    expect(mocks.notifications).toHaveBeenCalledExactlyOnceWith(locale,undefined);expect(html).toContain('data-workspace-failure="NO_ORGANIZATION"');expect(html).not.toContain('name="deliveryMode"');
  });
});
