import { renderToStaticMarkup } from "react-dom/server";
import{describe,expect,it,vi}from"vitest";
vi.mock("next/image",()=>({default:()=>null}));
vi.mock("@/modules/shared/ui/workspace-account-menu",()=>({WorkspaceAccountMenu:()=>null}));
vi.mock("./client-workspace-nav",()=>({ClientWorkspaceNav:()=>null}));
import{ClientAppShell}from"./client-app-shell";
function html(path:string){return renderToStaticMarkup(<ClientAppShell locale="fr" selectedQuery="?organizationId=own" selectedOrganizationId="own" userEmail={null} active="requests" languagePath={path}>Contenu</ClientAppShell>);}
describe("Client language context",()=>{
 it("preserves deep request and encoded filters in the other language",()=>{expect(html("/fr/client/demandes/request/offres?organizationId=own&q=plan%20action&page=3&statut=DRAFT")).toContain('href="/ar/client/demandes/request/offres?organizationId=own&amp;q=plan%20action&amp;page=3&amp;statut=DRAFT"');});
 it.each(["https://evil.invalid/fr/","/fr/../../evil","/fr/client/evil%0dpath","/ar/client/demandes"])("rejects an invalid language location %s",path=>{const rendered=html(path);expect(rendered).toContain('href="/ar/client/demandes?organizationId=own"');expect(rendered).not.toContain('href="https://evil');});
});
