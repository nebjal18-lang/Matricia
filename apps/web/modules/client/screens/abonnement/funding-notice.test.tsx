import{renderToStaticMarkup}from"react-dom/server";
import{describe,expect,it}from"vitest";
import{SubscriptionFundingNotice}from"./funding-notice";
const org="a2460000-0000-4000-8000-000000000001";
describe("current funding presentation",()=>{
 it.each(["fr","ar"]as const)("explains unverified payment funding and preserves the real organization support link (%s)",locale=>{const html=renderToStaticMarkup(<SubscriptionFundingNotice funding={{status:"PAYMENT_FUNDING_REVIEW_REQUIRED",new_request_admissible:false,funded_cycle:null}} locale={locale} organizationId={org}/>);expect(html).toContain(`/${locale}/client/assistance?organizationId=${org}`);expect(html).not.toContain("PAYMENT_FUNDING_REVIEW_REQUIRED");expect(html).not.toContain("PAID_CYCLE_VERIFIED");});
 it("does not present missing funding data as a verified paid period",()=>{const html=renderToStaticMarkup(<SubscriptionFundingNotice funding={null} locale="fr" organizationId={org}/>);expect(html).toContain("n’ont pas pu être vérifiés");expect(html).not.toContain("est vérifié depuis son paiement");});
 it("does not infer that expired paid access invalidates carried credit lots",()=>{const html=renderToStaticMarkup(<SubscriptionFundingNotice funding={{status:"NO_ACTIVE_PAID_CYCLE",new_request_admissible:false,funded_cycle:null}} locale="fr" organizationId={org}/>);expect(html).toContain("lots de crédits reportés valides restent utilisables");});
});
