import{renderToStaticMarkup}from"react-dom/server";
import{describe,expect,it,vi}from"vitest";
import type{SubscriptionDashboard,HistoricalSubscriptionPlan}from"@/modules/shared/lib/subscriptions/model";
vi.mock("react",async original=>({...await original<typeof import("react")>(),useActionState:()=>[{status:"idle"},()=>{},false]}));
vi.mock("./actions",()=>({changePlanAction:vi.fn(),ensureTrialAction:vi.fn()}));
vi.mock("./payment-intent-button",()=>({PaymentIntentButton:()=> <span data-checkout="real"/>}));
import{SubscriptionPanel}from"./subscription-panel";
import{getSubscriptionMessages}from"./messages";
const current:HistoricalSubscriptionPlan={id:"a2460000-0000-4000-8000-000000000001",code:"GOLD",version:1,currency:"MAD",monthlyPriceMinor:"2000",annualPriceMinor:"20000",monthlyCreditGrant:"10",validFrom:"2026-01-01",validTo:null,status:"ACTIVE",coreAllocationBasisPoints:5000,benefitPoolAllocationBasisPoints:5000,limitsSnapshot:{},boxVersionReference:null,contentHash:"a".repeat(64),entitlements:[]};
const dashboard:SubscriptionDashboard={organizationId:"a2460000-0000-4000-8000-000000000002",organizationName:"Client",plans:[{...current,id:"lower",code:"PREMIUM",monthlyPriceMinor:"1000"},{...current},{...current,id:"higher",code:"PLATINUM",monthlyPriceMinor:"3000"}],subscription:{id:"subscription",status:"ACTIVE",planVersionId:current.id,pendingPlanVersionId:null,billingInterval:"MONTHLY",currentPeriodEnd:null,pendingChangeEffectiveAt:null,rowVersion:"1",currentPlan:current,pendingPlan:null,cycles:[],transitions:[]},capabilities:{canStartTrial:false,canChangePlan:true}};
describe("paid upgrade availability",()=>{
 it.each(["fr","ar"]as const)("links to independently approved upgrade options without a direct unpaid change (%s)",locale=>{const m=getSubscriptionMessages(locale),html=renderToStaticMarkup(<SubscriptionPanel dashboard={dashboard} locale={locale} messages={m} keys={{trial:"key"}} dateLabels={{}}/>);expect(html).toContain(m.upgradeCheckoutRequired);expect(html).toContain('href="#paid-upgrade-options"');expect(html).not.toContain('value="UPGRADE_IMMEDIATE"');expect(html).not.toContain('data-checkout="real"');expect(html).toContain('value="DOWNGRADE_NEXT_CYCLE"');});
 it("retains the real payment path for an activatable trial",()=>{const trial={...dashboard,subscription:{...dashboard.subscription!,status:"TRIAL_ACTIVE"}};const html=renderToStaticMarkup(<SubscriptionPanel dashboard={trial} locale="fr" messages={getSubscriptionMessages("fr")} keys={{trial:"key"}} dateLabels={{}}/>);expect(html).toContain('data-checkout="real"');expect(html).not.toContain('value="UPGRADE_IMMEDIATE"');});
});

it("does not offer an unsupported checkout for a cancelled subscription",()=>{const cancelled={...dashboard,subscription:{...dashboard.subscription!,status:"CANCELLED"}};const html=renderToStaticMarkup(<SubscriptionPanel dashboard={cancelled} locale="fr" messages={getSubscriptionMessages("fr")} keys={{trial:"key"}} dateLabels={{}}/>);expect(html).not.toContain('data-checkout="real"');});
