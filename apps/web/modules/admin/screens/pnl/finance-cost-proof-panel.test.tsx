import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { FinanceCostProofPanel } from "./finance-cost-proof-panel";
import { financeCostProofCopy } from "./finance-cost-proof-copy";
import type { FinanceCostProofWorkspace } from "@/modules/shared/lib/finance-cost-proofs/review-commands";
const mocks=vi.hoisted(()=>({client:vi.fn(),refresh:vi.fn()}));
vi.mock("next/navigation",()=>({useRouter:()=>({refresh:mocks.refresh})}));
vi.mock("@/modules/shared/lib/supabase/client",()=>({getSupabaseBrowserClient:mocks.client}));
const target="11111111-1111-4111-8111-111111111111";
const workspace=(canUpload=true):Extract<FinanceCostProofWorkspace,{status:"success"}>=>({status:"success",targets:[{id:target,component:"PSP_FEE",label:"Encaissement TEST / وثيقة أصلية"}],canUpload,proposals:[]});
for(const locale of ["fr","ar"] as const)describe(`Finance evidence workspace ${locale}`,()=>{
 it("offers a real file input for an authorized business target without requiring technical references",()=>{
  const html=renderToStaticMarkup(<FinanceCostProofPanel locale={locale} workspace={workspace()} returnPath={`/${locale}/administration/finance?bookId=${target}`}/>);
  expect(html).toContain('type="file"');expect(html).toContain('accept="application/pdf,image/jpeg,image/png"');expect(html).toContain('Encaissement TEST / وثيقة أصلية');
  expect(html).toContain(financeCostProofCopy[locale].lead);expect(html).toContain(financeCostProofCopy[locale].loading);expect(html).not.toContain(financeCostProofCopy[locale].noReviews);
  expect(html).not.toContain('name="sha256"');expect(html).not.toContain('name="targetId"');expect(html).not.toContain('type="checkbox"');
  expect(html).toContain(locale==="ar"?'dir="rtl"':'dir="ltr"');expect(mocks.client).not.toHaveBeenCalled();
 });
 it("requires a deliberate choice when more than one authorized dossier is available",()=>{
  const value=workspace();value.targets.push({id:"22222222-2222-4222-8222-222222222222",component:"FULFILLMENT_COST",label:"Réalisation TEST"});
  const html=renderToStaticMarkup(<FinanceCostProofPanel locale={locale} workspace={value} returnPath={`/${locale}/administration/finance`}/>);
  expect(html).toContain(financeCostProofCopy[locale].choose);expect(html).not.toContain('type="file"');expect(html).not.toContain(financeCostProofCopy[locale].noReviews);
 });
 it("does not expose an upload form to a reader without upload capability",()=>{
  const html=renderToStaticMarkup(<FinanceCostProofPanel locale={locale} workspace={workspace(false)} returnPath={`/${locale}/administration/finance`}/>);
  expect(html).toContain(financeCostProofCopy[locale].readOnly);expect(html).not.toContain('type="file"');
 });
 it("keeps a failed source distinct from a successful empty scope",()=>{
  const failed=renderToStaticMarkup(<FinanceCostProofPanel locale={locale} workspace={{status:"error",reason:"QUERY_FAILED"}} returnPath={`/${locale}/administration/finance`}/>);
  expect(failed).toContain('role="alert"');expect(failed).not.toContain(financeCostProofCopy[locale].noTargets);expect(failed).not.toContain('type="file"');
  const empty=renderToStaticMarkup(<FinanceCostProofPanel locale={locale} workspace={{status:"success",targets:[],canUpload:false}} returnPath={`/${locale}/administration/finance`}/>);
  expect(empty).toContain(financeCostProofCopy[locale].noTargets);expect(empty).not.toContain('role="alert"');
 });
 it("provides the actual MFA setup link and retains the protected return context",()=>{
  const path=`/${locale}/administration/finance?bookId=${target}`;
  const html=renderToStaticMarkup(<FinanceCostProofPanel locale={locale} workspace={{status:"error",reason:"MFA_REQUIRED"}} returnPath={path}/>);
  expect(html).toContain(`href="/${locale}/securite/compte?next=${encodeURIComponent(path)}"`);expect(html).not.toContain(financeCostProofCopy[locale].noTargets);
 });
 it("keeps invalid-session login separate and never uses an external retry destination",()=>{
  const html=renderToStaticMarkup(<FinanceCostProofPanel locale={locale} workspace={{status:"error",reason:"UNAUTHENTICATED"}} returnPath="https://external.invalid/"/>);
  expect(html).toContain(`href="/${locale}/connexion?next=${encodeURIComponent(`/${locale}/administration/finance`)}"`);expect(html).not.toContain('https://external.invalid');
 });
});
