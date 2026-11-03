import {renderToStaticMarkup} from "react-dom/server";
import {describe,expect,it,vi} from "vitest";
vi.mock("@/modules/shared/lib/supabase/client",()=>({getSupabaseBrowserClient:vi.fn()}));
import {BenefitPolicyFields,quotaScopeLabel} from "./console";
describe("benefit policy approval form",()=>{
 it("requires explicit quota and capacity choices, never a default global scope",()=>{
  const html=renderToStaticMarkup(<BenefitPolicyFields locale="fr" declaredQuota={null}/>);
  expect(html.match(/value="" selected=""/g)).toHaveLength(2);expect(html).toContain('name="humanEvidence"');expect(html).not.toContain('checked=""');
  expect(html).toContain("ni fichier livré ou analyse antivirus");expect(html).toContain("Périmètre du quota");
 });
 it("shows a source quota as immutable and prevents silently choosing no quota",()=>{
  const html=renderToStaticMarkup(<BenefitPolicyFields locale="fr" declaredQuota="9007199254740993"/>);
  expect(html).toContain("9007199254740993");expect(html).toContain('readOnly=""');expect(html).toContain('value="NONE" disabled=""');
 });
 it("uses clear Arabic labels and server-period semantics",()=>{
  const html=renderToStaticMarkup(<BenefitPolicyFields locale="ar" declaredQuota={null}/>);
  expect(html).toContain("اختيار نطاق الحصة صراحة");expect(html).toContain("استلام مستقل من العميل");
  expect(quotaScopeLabel("ORGANIZATION_SUBSCRIPTION_PERIOD","fr")).toContain("cycle d’abonnement financé");
 });
});
