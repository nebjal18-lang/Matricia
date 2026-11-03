import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import Bank from "@/app/[locale]/franchise/questions/page";
import Detail from "@/app/[locale]/franchise/questions/[questionId]/page";
const mocks=vi.hoisted(()=>({require:vi.fn(),rpc:vi.fn()}));
vi.mock("@/modules/franchise/screens/library/page-helper",()=>({requireFranchiseLibrary:mocks.require}));
vi.mock("@/modules/shared/lib/supabase/server",()=>({getSupabaseServerClient:async()=>({rpc:mocks.rpc})}));
vi.mock("@/modules/franchise/screens/library/question-editor",()=>({FranchiseQuestionEditor:()=> <div>QUESTION_EDITOR</div>}));
vi.mock("@/modules/franchise/ui/franchise-app-shell",()=>({FranchiseAppShell:({children,languagePath}:{children:ReactNode;languagePath:string})=><div data-language-path={languagePath}>{children}</div>}));
const id="11111111-1111-4111-8111-111111111111",franchiseId="22222222-2222-4222-8222-222222222222",libraryId="33333333-3333-4333-8333-333333333333";
const suffix=`?organizationId=${id}&franchiseId=${franchiseId}`;
const space={selectedQuery:suffix,selectedOrganizationId:id,userEmail:null,organizations:[{id,name:"Organisation autorisée"}]};
const workspace={mandate:{franchiseId,libraryId,libraryName:"Bibliothèque mandatée",operatorOrganizationId:id},questions:[]};
beforeEach(()=>{vi.clearAllMocks();mocks.require.mockResolvedValue({space,result:{status:"success",workspace}});});
for(const locale of ["fr","ar"] as const)describe(`question bank and detail recovery ${locale}`,()=>{
 it("explains an absent mandate instead of calling it a temporary incident",async()=>{
  mocks.require.mockResolvedValue({space,result:{status:"error",reason:"NO_MANDATE"}});
  const html=renderToStaticMarkup(await Bank({params:Promise.resolve({locale}),searchParams:Promise.resolve({})}));
  expect(html).toContain(`href="/${locale}/franchise/candidature"`);expect(mocks.rpc).not.toHaveBeenCalled();
 });
 it("offers technical retry with the same question context and keeps the return navigation",async()=>{
  mocks.rpc.mockResolvedValue({data:null,error:{code:"08006"}});
  const html=renderToStaticMarkup(await Detail({params:Promise.resolve({locale,questionId:id}),searchParams:Promise.resolve({organizationId:id,franchiseId})}));
  expect(html).toContain(`/${locale}/franchise/questions/${id}?organizationId=${id}&amp;franchiseId=${franchiseId}`);
  expect(html).toContain(`href="/${locale}/franchise/questions?organizationId=${id}&amp;franchiseId=${franchiseId}"`);
  expect(html).not.toContain("QUESTION_EDITOR");
  expect(html).toContain('data-workspace-failure="QUERY_FAILED"');
 });
 it("keeps an explicit denial distinct from an unavailable question",async()=>{
  mocks.rpc.mockResolvedValue({data:null,error:{code:"42501"}});
  const html=renderToStaticMarkup(await Detail({params:Promise.resolve({locale,questionId:id}),searchParams:Promise.resolve({franchiseId})}));
  expect(html).not.toContain("QUESTION_EDITOR");expect(html).toContain('data-workspace-failure="FORBIDDEN"');expect(html).not.toContain('data-workspace-failure="QUERY_FAILED"');
 });
 it("keeps search, paging and selected mandate while changing language",async()=>{
  const html=renderToStaticMarkup(await Bank({params:Promise.resolve({locale}),searchParams:Promise.resolve({q:"recherche arabe",page:"3",franchiseId})}));
  expect(html).toContain("q=recherche+arabe&amp;page=3");expect(html).toContain(`franchiseId=${franchiseId}`);
 });
});
