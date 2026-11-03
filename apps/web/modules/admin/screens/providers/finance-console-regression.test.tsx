import{describe,it,expect,vi}from"vitest";
import{renderToStaticMarkup}from"react-dom/server";
import{ProvidersPanel}from"./providers-panel";
import{getAdminProviderMessages}from"./messages";
import type{AdminProviderDashboard}from"@/modules/admin/data/providers/model";
vi.mock("next/navigation",()=>({useRouter:()=>({refresh:vi.fn()})}));
const dashboard:AdminProviderDashboard={capabilities:{qualificationDecision:false,financeAction:true,readOnly:false},providers:[],services:[],documents:[],statements:[],invoices:[],payments:[],accounts:[],creditNotes:[],paymentPlans:[],collectionCases:[],totalsByCurrency:[],limitsReached:[]};
describe("Provider Admin governed finance handoff",()=>{for(const locale of["fr","ar"]as const)it(`routes ${locale} periodic issuance and independent reviews through the actual console`,()=>{const html=renderToStaticMarkup(<ProvidersPanel dashboard={dashboard} locale={locale} messages={getAdminProviderMessages(locale)} keys={{}}/>);expect(html).toContain(`/${locale}/administration/finance/prestataires`);expect(html).not.toContain('name="statementNumber"');expect(html).not.toContain('name="invoiceNumber"');expect(html).toContain('name="invoiceId"');});});
