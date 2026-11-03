import { beforeEach,describe,expect,it,vi } from "vitest";
import { source } from "./__fixtures__/source";
const mocks=vi.hoisted(()=>({rpc:vi.fn(),archive:vi.fn(),admin:vi.fn()}));
vi.mock("@/modules/shared/lib/supabase/admin",()=>({getSupabaseAdminClient:mocks.admin}));
vi.mock("./artifacts",()=>({archiveClientCommercialDocument:mocks.archive}));
import { consumeClientCommercialDocumentIssued } from "./issued-consumer";
describe("durable client document issuance",()=>{
 beforeEach(()=>{vi.clearAllMocks();mocks.admin.mockReturnValue({rpc:mocks.rpc});mocks.rpc.mockImplementation(async(name:string)=>({data:name==="get_client_commercial_document_for_archive_v1"?source:{outcome:"CLIENT_COMMERCIAL_DOCUMENT_READY"},error:null}));mocks.archive.mockResolvedValue({ok:true});});
 it("finishes both translations before readiness",async()=>{expect((await consumeClientCommercialDocumentIssued(source.id)).ok).toBe(true);expect(mocks.archive.mock.calls.map(call=>call[2])).toEqual(["fr","ar"]);expect(mocks.rpc).toHaveBeenLastCalledWith("complete_client_commercial_document_issue_v1",{p_document_id:source.id});});
 it("keeps readiness pending when the second archive fails",async()=>{mocks.archive.mockResolvedValueOnce({ok:true}).mockResolvedValueOnce({ok:false,code:"CLIENT_BILLING_UNAVAILABLE"});expect((await consumeClientCommercialDocumentIssued(source.id)).ok).toBe(false);expect(mocks.rpc).not.toHaveBeenCalledWith("complete_client_commercial_document_issue_v1",expect.anything());});
});
