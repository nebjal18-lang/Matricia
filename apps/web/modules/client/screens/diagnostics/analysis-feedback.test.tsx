import{renderToStaticMarkup}from"react-dom/server";
import{describe,expect,it,vi}from"vitest";
const state=vi.hoisted(()=>({current:{status:"success",diagnosticRunId:"a2090000-0000-4000-8000-000000000903",organizationId:"a2090000-0000-4000-8000-000000000010"}}));
vi.mock("react",async original=>({...await original<typeof import("react")>(),useActionState:()=>[state.current,()=>{},false]}));
vi.mock("./actions",()=>({completeLatestAction:vi.fn()}));
vi.mock("next/link",()=>({default:({href,children,...props}:{href:string;children:React.ReactNode})=><a href={href}{...props}>{children}</a>}));
import{CompleteForm}from"./complete-form";
import{messages}from"./messages";
describe("diagnostic result receipt",()=>{
 it.each(["fr","ar"]as const)("keeps the real report receipt outside a closed disclosure in %s",locale=>{
  const html=renderToStaticMarkup(<CompleteForm disclosure={{summary:"Analyse",initialOpen:false}} locale={locale} organizations={[]} questionnaireHref={`/${locale}/client/questionnaires`} m={messages(locale)} keyValue="a2090000-0000-4000-8000-000000000904"/>);
  expect(html.indexOf('role="status"')).toBeGreaterThan(html.indexOf('</details>'));
  expect(html).toContain('tabindex="-1"');
  expect(html).toContain(`href="/${locale}/client/diagnostics/${state.current.diagnosticRunId}?organizationId=${state.current.organizationId}"`);
  expect(html).not.toContain('<details id="analyse" class="client-ops" open');
 });
});
