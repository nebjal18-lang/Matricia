import { renderToStaticMarkup } from "react-dom/server";
import { describe,it,expect,vi } from "vitest";
const mocks=vi.hoisted(()=>({client:vi.fn()}));
vi.mock("@/modules/shared/lib/supabase/server",()=>({getSupabaseServerClient:mocks.client}));
import EvidencePage from "@/app/[locale]/franchise/documents/[documentId]/page";
import ContractPage from "@/app/[locale]/franchise/fournisseurs/contrats/[decisionId]/page";
const id="11111111-1111-4111-8111-111111111111";
describe("franchise references without mandate context",()=>{
 it.each(["fr","ar"] as const)("shows recovery before any backend access (%s)",async(locale)=>{
  for(const franchiseId of [undefined,"not-a-uuid"]){
   const query=Promise.resolve({franchiseId,organizationId:id});
   for(const page of [await EvidencePage({params:Promise.resolve({locale,documentId:id}),searchParams:query}),await ContractPage({params:Promise.resolve({locale,decisionId:id}),searchParams:query})]){
    const html=renderToStaticMarkup(page);
    expect(html).toContain('role="alert"');expect(html).toContain(`/${locale}/franchise/documents?organizationId=${id}`);
    expect(html).toContain(locale==="ar"?'dir="rtl"':'dir="ltr"');
   }
  }
  expect(mocks.client).not.toHaveBeenCalled();
 });
});
