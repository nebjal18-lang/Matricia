import { describe,expect,it } from "vitest";
import { renderBillingPdf,type BillingPdfSnapshot } from "./pdf";
const source:BillingPdfSnapshot={kind:"invoice",number:"TEST-2026-001",issuer:{name:"Test Issuer",address:"Adresse du test",ice:"123456789012345",version:"test-v1"},recipient:"شركة اختبار",currency:"MAD",totalMinor:"12000",issuedOn:"2026-10-31",sourceHash:"a".repeat(64),lines:[{label:"Service / خدمة",amountMinor:"10000"},{label:"TVA",amountMinor:"2000"}]};
describe("immutable bilingual billing PDF",()=>{
 for(const locale of ["fr","ar"]as const)it(`renders ${locale} with embedded fonts and a real PDF structure`,async()=>{const bytes=await renderBillingPdf(source,locale);expect(bytes.subarray(0,5).toString()).toBe("%PDF-");expect(bytes.length).toBeGreaterThan(2000);expect(bytes.toString("latin1")).toContain("/FontFile");expect(bytes.toString("latin1")).toContain("%%EOF");});
 for(const locale of["fr","ar"]as const)it(`renders the credit note reference and reason in ${locale}`,async()=>{const bytes=await renderBillingPdf({...source,kind:"credit_note",number:"TEST-CREDIT-001",originalInvoiceNumber:source.number,reason:"Remboursement partiel / استرداد جزئي"},locale);expect(bytes.subarray(0,5).toString()).toBe("%PDF-");expect(bytes.toString("latin1")).toContain("/FontFile");expect(bytes.length).toBeGreaterThan(2000);});
 it("reproduces identical bytes for an unchanged immutable source",async()=>{expect(await renderBillingPdf(source,"fr")).toEqual(await renderBillingPdf(source,"fr"));});
 it("refuses imprecise or untrusted numeric snapshots",async()=>{await expect(renderBillingPdf({...source,totalMinor:"120.00"},"fr")).rejects.toThrow("BILLING_PDF_INVALID_AMOUNT");});
});
