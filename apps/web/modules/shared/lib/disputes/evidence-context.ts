import { z } from "zod";

const source = z.object({ id: z.string().uuid(), name: z.string().min(1) });
export const disputeEvidenceContextSchema = z.object({
  organizationId: z.string().uuid(),
  party: z.enum(["client", "provider"]),
  documents: z.array(source),
  messages: z.array(source),
  deliveries: z.array(source.extend({ version: z.number().int().positive() })),
});
export type DisputeEvidenceContext = z.infer<typeof disputeEvidenceContextSchema>;

// Authoritative hashes, bytes, sender and object links are resolved inside SQL.
export function disputeEvidenceReferences(form: FormData) {
  const visibility = z.enum(["BOTH_PARTIES", "CLIENT_ONLY", "PROVIDER_ONLY", "MEDIATOR_ONLY"]).parse(form.get("visibility"));
  const statement = z.string().trim().min(1).max(4000).parse(form.get("evidenceStatement"));
  const orgValue = form.get("evidenceOrganizationId");
  const organizationId = orgValue ? z.string().uuid().parse(orgValue) : undefined;
  const items: Record<string, unknown>[] = [{ type: "MESSAGE", statement, visibility, metadata: organizationId ? { source_organization_id: organizationId } : {} }];
  for (const [field, type, key] of [
    ["documentId", "DOCUMENT", "source_document_id"],
    ["sourceMessageId", "MESSAGE", "source_message_id"],
    ["deliveryProofId", "DELIVERY_PROOF", "source_delivery_proof_id"],
  ] as const) {
    const ids = z.array(z.string().uuid()).max(19).parse(form.getAll(field));
    if (new Set(ids).size !== ids.length) throw new Error("DUPLICATE_EVIDENCE_REFERENCE");
    for (const id of ids) items.push({ type, visibility, metadata: { [key]: id, ...(organizationId ? { source_organization_id: organizationId } : {}) } });
  }
  if (items.length > 20 || (items.length > 1 && form.get("confirmDocumentSharing") !== "on")) throw new Error("EVIDENCE_SHARING_CONFIRMATION_REQUIRED");
  return items;
}
