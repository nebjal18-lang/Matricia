import {renderToStaticMarkup} from "react-dom/server";
import {describe,expect,it,vi} from "vitest";
vi.mock("@/modules/shared/lib/supabase/client",()=>({getSupabaseBrowserClient:vi.fn()}));
import {ReconfirmationProposalForm,ReconfirmationPartyCard,reconfirmationError} from "./identity-reconfirmation";
import {selectedQuoteIdentityContextSchema} from "@/modules/provider/data/quotes/identity-reconfirmation";
const uid=(n:number)=>`${String(n).padStart(8,"0")}-0000-4000-8000-000000000000`;
const party={organization_id:uid(1),legal_name:"TEST Provider",country_code:"MA",identifiers:{ICE:"123456789012345",IF:"12345678",RC:"RC-TEST"},registered_address:"TEST ancienne adresse",verified_identity_hash:"a".repeat(64),identity_review_id:uid(2),verified_at:"2026-11-01T00:00:00Z"};
const context=selectedQuoteIdentityContextSchema.parse({quote_version_id:uid(3),request_id:uid(4),client_organization_id:uid(5),provider_organization_id:uid(1),source_quote_hash:"b".repeat(64),selection_hash:"c".repeat(64),context_hash:"d".repeat(64),current_client_party:party,provider_party_base:party,canonical_provider_address:"TEST adresse canonique",previous_provider_address:"TEST ancienne adresse",blocked_reasons:[],original_provider_current:false,can_propose_provider:true,proposals:[],effective_proposal:null,page:1,page_size:25,total:0,has_next:false});
describe("Provider legal reconfirmation form",()=>{
  it("shows the approved canonical address read-only and requires a fresh explicit confirmation",()=>{
    const html=renderToStaticMarkup(<ReconfirmationProposalForm context={context} locale="fr" busy={false} loading={false} onSubmit={()=>undefined}/>);
    expect(html).toContain("TEST adresse canonique");expect(html).not.toContain("TEST ancienne adresse");expect(html).toContain('readOnly=""');expect(html).toContain('name="confirmed"');expect(html).not.toContain('checked=""');expect(html).toContain('minLength="10"');expect(html).not.toContain("Accepter");
  });
  it("never silently reuses an old declared address when no canonical address is available",()=>{
    const html=renderToStaticMarkup(<ReconfirmationProposalForm context={{...context,canonical_provider_address:null}} locale="fr" busy={false} loading={false} onSubmit={()=>undefined}/>);
    expect(html).not.toContain("TEST ancienne adresse");expect(html).not.toContain('readOnly=""');expect(html).toContain('required=""');
  });
  it("blocks proposal when authoritative eligibility checks are unresolved and translates Arabic labels",()=>{
    const html=renderToStaticMarkup(<ReconfirmationProposalForm context={{...context,blocked_reasons:["PROVIDER_IDENTITY_REVIEW_REQUIRED"]}} locale="ar" busy={false} loading={false} onSubmit={()=>undefined}/>);
    expect(html).toContain('disabled=""');expect(html).toContain("اقتراح هذه الهويات على العميل");
  });
  it("presents both business identifiers and exact legal address without a fake identity",()=>{
    const html=renderToStaticMarkup(<ReconfirmationPartyCard party={party} locale="fr" label="Prestataire"/>);
    expect(html).toContain("123456789012345");expect(html).toContain("RC-TEST");expect(html).toContain("TEST ancienne adresse");
    expect(renderToStaticMarkup(<ReconfirmationPartyCard party={null} locale="fr" label="Client"/>)).toContain("actuellement indisponible");
  });
  it("makes concurrency rejection actionable without saying the proposal succeeded",()=>{
    expect(reconfirmationError("STALE_QUOTE_IDENTITY_CONTEXT","fr")).toContain("confirmez à nouveau");expect(reconfirmationError("PROVIDER_CANONICAL_ADDRESS_REQUIRED","ar")).toContain("الهوية القانونية المعتمدة");
  });
});
