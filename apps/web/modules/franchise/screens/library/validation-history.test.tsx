import { describe,expect,it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { FranchiseValidationsWorkbench } from "./validations-workbench";
import type { FranchiseLibraryWorkspace } from "@/modules/franchise/data/library/workspace-model";
const row={id:"11111111-1111-4111-8111-111111111111",kind:"SERVICE"as const,title:"Audit sécurité",code:"AUDIT",status:"DRAFT",versionLabel:"v2",href:"/fr/franchise/services/a",category:"IT",subcategory:null,subcategoryId:null,description:null,nameFr:"Audit",nameAr:"تدقيق",reviewEvents:[{id:"review-a",versionId:"version-a",status:"REJECTED",requestedAt:"2026-10-01T12:00:00Z",reviewedAt:"2026-10-02T12:00:00Z",comment:"Justificatif contractuel à compléter"}]};
const workspace={mandate:{libraryName:"IT",operatorOrganizationId:"org",franchiseId:"mandate"},services:[row,{...row,id:"other",title:"Conseil réseau",reviewEvents:[]}],questionnaires:[],rules:[],counts:{drafts:2,inReview:0,published:0,returns:1}}as unknown as FranchiseLibraryWorkspace;
describe("franchise actual validation history",()=>{
 it("shows persisted review comments and rejected drafts in the correction queue",()=>{
  const html=renderToStaticMarkup(<FranchiseValidationsWorkbench locale="fr" query="" workspace={workspace} bucket="corrections"/>);
  expect(html).toContain("Justificatif contractuel à compléter");expect(html).toContain("Audit sécurité");expect(html).not.toContain("Conseil réseau");
 });
 it("sends category identities to the server and keeps type filters on the next page",()=>{
  const categoryId="22222222-2222-4222-8222-222222222222";
  const actual={...workspace,categories:[{id:categoryId,title:"Informatique",children:[]}],serverPage:{page:1,pageSize:25,kind:"RULE",search:"filtre",status:"DRAFT",categoryId:null,language:"ALL",completeness:"ALL",validation:"ALL",counts:{drafts:40,inReview:0,published:0,returns:0},groups:{SERVICE:{total:0,ids:[],versionIds:[]},QUESTIONNAIRE:{total:0,ids:[],versionIds:[]},RULE:{total:40,ids:[],versionIds:[]},QUESTION:{total:0,ids:[],versionIds:[]}}}}as FranchiseLibraryWorkspace;
  const html=renderToStaticMarkup(<FranchiseValidationsWorkbench locale="fr" query="?organizationId=org&franchiseId=mandate" workspace={actual} bucket="brouillons" filters={{type:"RULE",q:"filtre"}}/>);
  expect(html).toContain(`value="${categoryId}"`);
  expect(html).toContain("type=RULE");expect(html).toContain("page=2");expect(html).toContain("q=filtre");
 });
 it("applies type, category and text filters without inventing timeline completion",()=>{
  const html=renderToStaticMarkup(<FranchiseValidationsWorkbench locale="fr" query="" workspace={workspace} bucket="historique" filters={{q:"Justificatif",type:"SERVICE",category:"IT"}}/>);
  expect(html).toContain("Justificatif contractuel à compléter");expect(html).not.toContain("Conseil réseau");expect(html).not.toContain('data-done="true"');expect(html).toContain('name="franchiseId"');
 });
});
