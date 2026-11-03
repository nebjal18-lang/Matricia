import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Page from "./page";
const mocks=vi.hoisted(()=>({load:vi.fn()}));
vi.mock("@/modules/franchise/screens/library/page-helper",()=>({requireFranchiseLibrary:mocks.load}));
vi.mock("@/modules/franchise/ui/franchise-app-shell",()=>({FranchiseAppShell:({children}:{children:React.ReactNode})=><div>{children}</div>}));
vi.mock("@/modules/franchise/ui/franchise-access-page",()=>({FranchiseAccessPage:({reason}:{reason:string})=><p data-reason={reason}>READ_FAILED</p>}));
const org="22222222-2222-4222-8222-222222222222",franchise="33333333-3333-4333-8333-333333333333",question="44444444-4444-4444-8444-444444444444";
const query=`?organizationId=${org}&franchiseId=${franchise}`;
function fixture() {
  return {
    space: { selectedQuery: query, selectedOrganizationId: org, currentPath: "/fr/franchise/recherche", userEmail: null, mandates: [] },
    result: {
      status: "success",
      workspace: {
        mandate: { franchiseId: franchise, libraryName: "TEST" }, services: [], questionnaires: [], rules: [],
        questions: [{ id: question, label: "Question TEST", status: "DRAFT" }],
        serverPage: { page: 1, pageSize: 25, groups: { SERVICE: { total: 0 }, QUESTIONNAIRE: { total: 0 }, RULE: { total: 0 }, QUESTION: { total: 26 } } },
      },
    },
  };
}

beforeEach(()=>mocks.load.mockReset().mockResolvedValue(fixture()));
for(const locale of ["fr","ar"] as const)describe(`Franchise catalogue search ${locale}`,()=>{
 it("searches all four object types on the server with the exact selected context",async()=>{
  const html=renderToStaticMarkup(await Page({params:Promise.resolve({locale}),searchParams:Promise.resolve({organizationId:org,franchiseId:franchise,q:"  Question TEST  ",page:"1"})}));
  expect(mocks.load).toHaveBeenCalledWith(expect.objectContaining({organizationId:org,franchiseId:franchise,catalog:{kind:"ALL",search:"Question TEST",page:"1"}}));
  expect(html).toContain(`href="/${locale}/franchise/questions/${question}${query.replaceAll('&','&amp;')}"`);
  expect(html).toContain('26');expect(html).toContain('page=2');expect(html).toContain('q=Question+TEST');expect(html).toContain('franchiseId='+franchise);
 });
 it("presents a genuine empty search without replacing it by an error or inventing results",async()=>{
  const data=fixture();data.result.workspace.questions=[];data.result.workspace.serverPage.groups.QUESTION.total=0;mocks.load.mockResolvedValue(data);
  const html=renderToStaticMarkup(await Page({params:Promise.resolve({locale}),searchParams:Promise.resolve({q:"introuvable"})}));
  expect(html).toContain(locale==="fr"?"Aucun résultat":"لا توجد نتيجة");expect(html).not.toContain('READ_FAILED');expect(html).not.toContain('Question TEST');
 });
 it("keeps incidents distinct from an empty result",async()=>{
  const data=fixture();mocks.load.mockResolvedValue({...data,result:{status:"error",reason:"QUERY_FAILED"}});
  const html=renderToStaticMarkup(await Page({params:Promise.resolve({locale}),searchParams:Promise.resolve({q:"Question"})}));
  expect(html).toContain('data-reason="QUERY_FAILED"');expect(html).not.toContain(locale==="fr"?"Aucun résultat":"لا توجد نتيجة");
 });
});
