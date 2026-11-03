import { describe, expect, it } from "vitest";
import { disputeEvidenceReferences } from "./evidence-context";
const document = "00000000-0000-4000-8000-000000000001";
function form() { const f = new FormData(); f.set("visibility", "BOTH_PARTIES"); f.set("evidenceStatement", "Preuve libre عربي"); return f; }
describe("contradictory evidence references", () => {
  it("preserves free text and sends references without trusting supplied hash or path", () => {
    const f = form(); f.set("documentId", document); f.set("confirmDocumentSharing", "on"); f.set("evidenceHash", "forged"); f.set("storagePath", "another/tenant.pdf");
    const items = disputeEvidenceReferences(f);
    expect(items).toEqual([{ type: "MESSAGE", statement: "Preuve libre عربي", visibility: "BOTH_PARTIES", metadata: {} }, { type: "DOCUMENT", visibility: "BOTH_PARTIES", metadata: { source_document_id: document } }]);
    expect(JSON.stringify(items)).not.toMatch(/forged|tenant/);
  });
  it("requires explicit consent before sharing selected private objects", () => { const f = form(); f.set("documentId", document); expect(() => disputeEvidenceReferences(f)).toThrow("EVIDENCE_SHARING_CONFIRMATION_REQUIRED"); });
  it("handles immutable message and versioned delivery references", () => { const f = form(); f.set("sourceMessageId", document); f.set("deliveryProofId", document); f.set("confirmDocumentSharing", "on"); expect(disputeEvidenceReferences(f).slice(1)).toEqual([{ type: "MESSAGE", visibility: "BOTH_PARTIES", metadata: { source_message_id: document } }, { type: "DELIVERY_PROOF", visibility: "BOTH_PARTIES", metadata: { source_delivery_proof_id: document } }]); });
  it("rejects duplicate or malformed source references", () => { const f = form(); f.append("documentId", document); f.append("documentId", document); expect(() => disputeEvidenceReferences(f)).toThrow("DUPLICATE_EVIDENCE_REFERENCE"); f.set("documentId", "bad"); expect(() => disputeEvidenceReferences(f)).toThrow(); });
  it("limits the total evidence batch, including the statement", () => { const f = form(); for (let i = 1; i <= 19; i++) f.append("documentId", `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`); f.set("sourceMessageId", document); f.set("confirmDocumentSharing", "on"); expect(() => disputeEvidenceReferences(f)).toThrow("EVIDENCE_SHARING_CONFIRMATION_REQUIRED"); });
});
