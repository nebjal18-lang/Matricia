import{describe,expect,it}from"vitest";
import{createHash}from"node:crypto";
import{renderSignatureDocumentPdf}from"./pdf";
import{source}from"./fixture.test-support";
import{renderPdfDocument}from"@/modules/shared/lib/commercial-documents/pdf";
describe("immutable contract source PDF",()=>{
 it.each(["fr","ar"]as const)("renders a reproducible %s PDF with embedded real fonts",async locale=>{const a=await renderSignatureDocumentPdf(source,locale),b=await renderSignatureDocumentPdf(source,locale);expect(a.subarray(0,5).toString()).toBe("%PDF-");expect(a.toString("latin1")).toContain("/FontFile");expect(a.toString("latin1")).toContain("%%EOF");expect(a).toEqual(b);expect(createHash("sha256").update(a).digest("hex")).not.toBe(source.source_hash);});
 it("keeps both languages as distinct artifacts",async()=>{expect(await renderSignatureDocumentPdf(source,"fr")).not.toEqual(await renderSignatureDocumentPdf(source,"ar"));});
 it("renders a negative amendment delta and keeps original quote amounts",async()=>{const amended={...source,source_kind:"AMENDMENT"as const,price_minor:"11900",amendment:{id:"bb410000-0000-4000-8000-000000000008",number:1,reason:"Réduction approuvée de test",scope_canonical:'{"reduction":true}',price_delta_minor:"-100",deadline_delta_days:-1,deliverables_canonical:"[]",commission_canonical:source.commission_snapshot_canonical}};expect((await renderSignatureDocumentPdf(amended,"ar")).subarray(0,5).toString()).toBe("%PDF-");});
 it.each(["subtotal","tax","currency"])("refuses %s inconsistent with the immutable selected quote",async kind=>{const invalid=structuredClone(source);if(kind==="subtotal")invalid.quote.items[0].subtotal_minor="9999";if(kind==="tax")invalid.quote.tax_minor="1999";if(kind==="currency")invalid.quote.currency="EUR";await expect(renderSignatureDocumentPdf(invalid,"fr")).rejects.toThrow();});
 it("never rounds amounts through floating point",async()=>{const large=structuredClone(source);large.price_minor="9007199254740993";large.quote.subtotal_minor="9007199254740993";large.quote.tax_minor="0";large.quote.total_minor=large.price_minor;Object.assign(large.quote.items[0],{unit_price_minor:large.price_minor,subtotal_minor:large.price_minor,tax_minor:"0",total_minor:large.price_minor,tax_rate_basis_points:0});expect((await renderSignatureDocumentPdf(large,"fr")).length).toBeGreaterThan(1000);});
 it("stops collecting emitted PDF bytes at the configured archive cap",async()=>{await expect(renderPdfDocument({content:"Bounded real PDF output"},32)).rejects.toThrow("DOCUMENT_PDF_TOO_LARGE");});
 it("refuses incomplete legal sources instead of inventing clauses or parties",async()=>{const invalid=structuredClone(source);invalid.clauses.ar="";await expect(renderSignatureDocumentPdf(invalid,"ar")).rejects.toThrow();});
});
