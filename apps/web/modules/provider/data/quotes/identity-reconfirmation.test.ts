import {beforeEach,describe,expect,it,vi} from "vitest";
const {rpc}=vi.hoisted(()=>({rpc:vi.fn()}));
vi.mock("@/modules/shared/lib/supabase/client",()=>({getSupabaseBrowserClient:()=>({rpc})}));
import {loadSelectedQuoteIdentity,proposeSelectedQuoteIdentity,selectedQuoteIdentityContextSchema} from "./identity-reconfirmation";
export const uid=(n:number)=>`${String(n).padStart(8,"0")}-0000-4000-8000-000000000000`;
export const party={organization_id:uid(1),legal_name:"TEST Provider",country_code:"MA",identifiers:{ICE:"123456789012345",IF:"12345678",RC:"RC-TEST"},registered_address:"TEST ancienne adresse",verified_identity_hash:"a".repeat(64),identity_review_id:uid(2),verified_at:"2026-11-01T00:00:00Z"};
export const context={quote_version_id:uid(3),request_id:uid(4),client_organization_id:uid(5),provider_organization_id:uid(1),source_quote_hash:"b".repeat(64),selection_hash:"c".repeat(64),context_hash:"d".repeat(64),current_client_party:{...party,organization_id:uid(5),legal_name:"TEST Client"},provider_party_base:party,canonical_provider_address:"TEST adresse canonique",previous_provider_address:"TEST ancienne adresse",blocked_reasons:[],original_provider_current:false,can_propose_provider:true,proposals:[],effective_proposal:null,page:1,page_size:25 as const,total:0,has_next:false};
const input={quoteVersionId:uid(3),contextHash:context.context_hash,registeredAddress:context.canonical_provider_address,reason:"TEST nouvelle identité revue",confirmed:true as const,idempotencyKey:uid(6),correlationId:uid(7)};
beforeEach(()=>rpc.mockReset());
describe("selected quote identity authority",()=>{
  it("loads the selected immutable version and exact organisation, not a newer current quote version",async()=>{
    rpc.mockResolvedValue({data:context,error:null});
    expect(await loadSelectedQuoteIdentity(uid(3),uid(1),1)).toEqual(context);
    expect(rpc).toHaveBeenCalledWith("get_selected_quote_identity_reconfirmation_context_v1",{p_quote_version_id:uid(3),p_page:1});
  });
  it.each([{...context,provider_organization_id:uid(99)},{...context,quote_version_id:uid(99)},{...context,page:2}])("refuses a mismatched tenant, selected version or page",async(data)=>{
    rpc.mockResolvedValue({data,error:null});await expect(loadSelectedQuoteIdentity(uid(3),uid(1),1)).rejects.toThrow("SCOPE_MISMATCH");
  });
  it("keeps the effective agreement outside a later history page",()=>{
    const proposal={id:uid(8),content_hash:"e".repeat(64),context_hash:context.context_hash,provider_reason:"TEST previous accepted proposal",proposed_at:"2026-11-01T00:00:00Z",proposed_by:uid(9),client_party:context.current_client_party,provider_party:party,decision:"ACCEPT",decision_reason:"TEST client explicit agreement",responded_by:uid(10),responded_at:"2026-11-01T01:00:00Z",current:true,effective:true};
    const parsed=selectedQuoteIdentityContextSchema.parse({...context,page:2,total:26,effective_proposal:proposal});
    expect(parsed.proposals).toEqual([]);expect(parsed.effective_proposal?.id).toBe(uid(8));
  });
  it("requires explicit confirmation before any mutation",async()=>{
    await expect(proposeSelectedQuoteIdentity({...input,confirmed:false as unknown as true})).rejects.toThrow();expect(rpc).not.toHaveBeenCalled();
  });
  it("pins the actual context and stable retry key and only acknowledges pending Client response",async()=>{
    rpc.mockResolvedValue({data:{outcome:"SELECTED_QUOTE_IDENTITY_PROPOSED",proposal_id:uid(8),content_hash:"e".repeat(64),status:"PENDING_CLIENT_RESPONSE"},error:null});
    await proposeSelectedQuoteIdentity(input);await proposeSelectedQuoteIdentity(input);
    expect(rpc.mock.calls[0]).toEqual(rpc.mock.calls[1]);
    expect(rpc.mock.calls[0]?.[1]).toMatchObject({p_expected_context_hash:context.context_hash,p_registered_address:context.canonical_provider_address,p_idempotency_key:uid(6)});
  });
  it("never treats acceptance or contract activation as proposal success",async()=>{
    rpc.mockResolvedValue({data:{outcome:"CONTRACT_ACTIVE",proposal_id:uid(8),content_hash:"e".repeat(64),status:"SIGNED"},error:null});
    await expect(proposeSelectedQuoteIdentity(input)).rejects.toThrow();
  });
  it("preserves stale-context rejection",async()=>{
    rpc.mockResolvedValue({data:null,error:{message:"STALE_QUOTE_IDENTITY_CONTEXT"}});await expect(proposeSelectedQuoteIdentity(input)).rejects.toThrow("STALE_QUOTE_IDENTITY_CONTEXT");
  });
});
