import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { commercialSourceSchema,clientBillingPdfSnapshot } from "./model";
import { renderBillingPdf } from "@/modules/shared/lib/commercial-documents/pdf";
import { source } from "./__fixtures__/source";
describe("immutable client commercial snapshots",()=>{
 it("keeps exact totals and the recorded issuer, independent of current configuration",()=>{const pdf=clientBillingPdfSnapshot(source,"fr");expect(pdf.totalMinor).toBe("12000");expect(pdf.lines.map(line=>line.amountMinor)).toEqual(["10000","2000"]);expect(pdf.issuer.name).toContain(source.snapshot.issuer.legal_name);expect(pdf.recipient).toContain(source.snapshot.buyer.ice);});
 it("rejects inconsistent totals and a cross-document artifact",()=>{expect(commercialSourceSchema.safeParse({...source,snapshot:{...source.snapshot,total_minor:"12001"}}).success).toBe(false);expect(commercialSourceSchema.safeParse({...source,artifacts:[{document_id:source.id,locale:"fr",source_hash:source.source_hash,pdf_sha256:"b".repeat(64),size_bytes:100,storage_path:"../other-tenant.pdf",renderer_version:"CLIENT_BILLING_PDF_V1"}]}).success).toBe(false);});
 it("requires both the original invoice and the confirmed adjustment for a credit note",()=>{expect(commercialSourceSchema.safeParse({...source,snapshot:{...source.snapshot,kind:"CREDIT_NOTE",original_invoice_number:"TEST-2026-00000040"}}).success).toBe(false);});
 it.each(["fr","ar"]as const)("renders the recorded %s snapshot to reproducible real PDF bytes",async locale=>{const snapshot=clientBillingPdfSnapshot(source,locale),a=await renderBillingPdf(snapshot,locale),b=await renderBillingPdf(snapshot,locale);expect(a.subarray(0,5).toString()).toBe("%PDF-");expect(a.length).toBeGreaterThan(100);expect(createHash("sha256").update(a).digest("hex")).toBe(createHash("sha256").update(b).digest("hex"));});
});
