import type{ReactNode}from"react";
import{renderToStaticMarkup}from"react-dom/server";
import{beforeEach,describe,expect,it,vi}from"vitest";
const m=vi.hoisted(()=>({load:vi.fn(),board:vi.fn()}));
vi.mock("next/navigation",()=>({redirect:(url:string)=>{throw Error(`REDIRECT:${url}`);},notFound:()=>{throw Error("NOT_FOUND");}}));
vi.mock("@/modules/admin/data/spaces/context",()=>({resolveAdminSpace:async()=>({status:"success",selectedQuery:"",selectedOrganizationId:null,userEmail:"operator@example.invalid"})}));
vi.mock("@/modules/admin/data/spaces/actors-repository",()=>({loadAdminClientDirectory:m.load}));
vi.mock("@/modules/admin/screens/spaces/actor-boards",()=>({ClientsBoard:m.board}));
vi.mock("@/modules/admin/ui/admin-app-shell",()=>({AdminAppShell:({children}:{children:ReactNode})=><section>{children}</section>,AdminCrumb:()=>null}));
import Page from"./page";
const empty={organizations:[],cases:[],diagnostics:[],dashboard:null,keys:{}};
beforeEach(()=>{vi.clearAllMocks();m.board.mockImplementation(()=><p>SUCCESS_EMPTY_COUNT_ZERO</p>);});
describe("Client Admin directory availability",()=>{
 it.each(["MFA_REQUIRED","FORBIDDEN","QUERY_FAILED","UNAVAILABLE","INVALID_RESPONSE"])("does not show false zero for %s",async reason=>{m.load.mockResolvedValue({...empty,reason});const html=renderToStaticMarkup(await Page({params:Promise.resolve({locale:"fr"}),searchParams:Promise.resolve({q:"client",status:"ACTIVE"})}));expect(m.board).not.toHaveBeenCalled();expect(html).not.toContain("SUCCESS_EMPTY_COUNT_ZERO");expect(html).toContain("role=\"alert\"");});
 it("renders a genuinely empty success",async()=>{m.load.mockResolvedValue({...empty,reason:null});expect(renderToStaticMarkup(await Page({params:Promise.resolve({locale:"ar"}),searchParams:Promise.resolve({})}))).toContain("SUCCESS_EMPTY_COUNT_ZERO");});
});
