import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
const m=vi.hoisted(()=>({load:vi.fn()}));
vi.mock("next/navigation",()=>({notFound:()=>{throw Error("NOT_FOUND");},redirect:(url:string)=>{throw Error(`REDIRECT:${url}`);}}));
vi.mock("@/modules/shared/lib/catalogue-builder/server-repository",()=>({createServerCatalogBuilderRepository:async()=>({loadWorkspace:m.load})}));
vi.mock("@/modules/admin/ui/admin-module-page",()=>({AdminModulePage:({children,querySuffix}:{children:ReactNode;querySuffix?:string})=><section data-query={querySuffix}>{children}</section>}));
vi.mock("@/modules/admin/screens/catalogue/question-builder",()=>({QuestionBuilder:()=> <p>REAL_QUESTION_FORM_SCOPE</p>}));
vi.mock("@/modules/admin/screens/catalogue/questionnaire-builder",()=>({QuestionnaireBuilder:()=>null}));
vi.mock("@/modules/admin/screens/catalogue/rule-builder",()=>({RuleBuilder:()=>null}));
vi.mock("@/modules/admin/screens/catalogue/release-workflow",()=>({ReleaseWorkflow:()=>null}));
import Page from "./page";
beforeEach(()=>m.load.mockResolvedValue({status:"success",value:{libraries:[{id:"lib-1",code:"LIB"}],services:[{id:"service-1",code:"SERVICE"}],draftReleases:[],approvedServiceVersions:[]}}));
describe("Catalogue scoped anchors",()=>{
 it.each(["fr","ar"])("preserves library/service in every questions link in %s",async locale=>{const html=renderToStaticMarkup(await Page({params:Promise.resolve({locale}),searchParams:Promise.resolve({library:"lib-1",service:"service-1"})}));expect(html).toContain(`/${locale}/administration/catalogue?library=lib-1&amp;service=service-1#questions`);expect(html).toContain("REAL_QUESTION_FORM_SCOPE");expect(html).not.toContain('data-query="?');});
 it("does not render a builder for an unrelated selected service",async()=>{const html=renderToStaticMarkup(await Page({params:Promise.resolve({locale:"fr"}),searchParams:Promise.resolve({library:"lib-1",service:"foreign-service"})}));expect(html).not.toContain("REAL_QUESTION_FORM_SCOPE");});
 it("preserves the selection in the retry after a load failure",async()=>{m.load.mockResolvedValue({status:"error",reason:"UNAVAILABLE"});const html=renderToStaticMarkup(await Page({params:Promise.resolve({locale:"ar"}),searchParams:Promise.resolve({library:"lib-1",service:"service-1"})}));expect(html).toContain('href="/ar/administration/catalogue?library=lib-1&amp;service=service-1"');expect(html).not.toContain("REAL_QUESTION_FORM_SCOPE");});
 it("preserves the selection through reauthentication",async()=>{m.load.mockResolvedValue({status:"error",reason:"UNAUTHENTICATED"});await expect(Page({params:Promise.resolve({locale:"fr"}),searchParams:Promise.resolve({library:"lib-1",service:"service-1"})})).rejects.toThrow(/library%3Dlib-1%26service%3Dservice-1/);});
});
