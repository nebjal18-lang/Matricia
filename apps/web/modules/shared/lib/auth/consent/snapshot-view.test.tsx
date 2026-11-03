import{renderToStaticMarkup}from"react-dom/server";
import{describe,expect,it}from"vitest";
import{ConsentSnapshotView}from"./snapshot-view";
import{currentConsentSnapshot}from"./current-documents";
import{ConsentUpdateForm}from"@/app/[locale]/connexion/consentements/consent-form";
import{vi}from"vitest";
vi.mock("@/modules/shared/lib/supabase/admin",()=>({getSupabaseAdminClient:vi.fn()}));
vi.mock("@/app/[locale]/connexion/consentements/actions",()=>({acceptUpdatedLegalDocuments:vi.fn()}));
describe("versioned legal snapshot presentation",()=>{
 it.each(["fr","ar"]as const)("renders the exact source paragraphs accessibly in %s without environment key labels",locale=>{const snapshot=currentConsentSnapshot(locale),html=renderToStaticMarkup(<ConsentSnapshotView snapshot={snapshot} locale={locale}/>);expect(html).toContain(snapshot.terms.title);expect(html).toContain(snapshot.privacy.title);expect(html).not.toContain("LEGAL_ENTITY_NAME");expect(html).not.toContain("\"paragraphs\"");});
 it("starts with an explicit unchecked consent control",()=>{const html=renderToStaticMarkup(<ConsentUpdateForm locale="fr" documentSetId="a2070000-0000-4000-8000-000000000001" sourceHash={"a".repeat(64)} idempotencyKey="a2070000-0000-4000-8000-000000000002"/>);expect(html).toContain('name="accepted"');expect(html).toContain('type="checkbox"');expect(html).not.toContain('checked=""');});
});
