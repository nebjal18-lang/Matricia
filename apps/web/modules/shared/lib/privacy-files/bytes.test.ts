import {describe,expect,it} from "vitest";
import {containsUnsupportedArchive,privateFileDisposition,verifiedPrivacyUploadMime} from "./bytes";
describe("privacy file byte verification",()=>{
 it("recognizes PDF/image bytes and rejects MIME spoofing",()=>{
  expect(verifiedPrivacyUploadMime(Buffer.from("%PDF-1.7\nTEST"),"application/pdf")).toBe("application/pdf");
  expect(verifiedPrivacyUploadMime(Uint8Array.from([137,80,78,71,13,10,26,10,1]),"image/png")).toBe("image/png");
  expect(()=>verifiedPrivacyUploadMime(Buffer.from("not a PDF"),"application/pdf")).toThrow("DSR_FILE_MIME_MISMATCH");
 });
 it("validates JSON without changing its source bytes and requires UTF-8",()=>{
  expect(verifiedPrivacyUploadMime(Buffer.from('{"nom":"أسماء"}\n'),"application/json")).toBe("application/json");
  expect(()=>verifiedPrivacyUploadMime(Buffer.from('{bad JSON'),"application/json")).toThrow("DSR_FILE_JSON_INVALID");
  expect(()=>verifiedPrivacyUploadMime(Uint8Array.from([0xff,0xfe,0]),"text/csv")).toThrow("DSR_FILE_UTF8_REQUIRED");
  expect(()=>verifiedPrivacyUploadMime(Buffer.from("field\0,value"),"text/csv")).toThrow("DSR_FILE_UTF8_REQUIRED");
 });
 it("does not let a declared PDF or JSON disguise an archive",()=>{
  const archive=Buffer.concat([Buffer.from("%PDF-1.7 prefix"),Buffer.from([80,75,5,6]),Buffer.alloc(22)]);
  expect(containsUnsupportedArchive(archive)).toBe(true);
  expect(()=>verifiedPrivacyUploadMime(archive,"application/pdf")).toThrow("ARCHIVE_SCAN_CAPABILITY_REQUIRED");
  expect(()=>verifiedPrivacyUploadMime(Buffer.from([80,75,3,4,0]),"application/json")).toThrow("ARCHIVE_SCAN_CAPABILITY_REQUIRED");
 });
 it("bounds uploads and produces a safe Arabic attachment filename",()=>{
  expect(()=>verifiedPrivacyUploadMime(new Uint8Array(10485761),"text/plain")).toThrow("DSR_FILE_SIZE_INVALID");
  const header=privateFileDisposition('هوية\r\n/"document.html',"application/pdf");
  expect(header).not.toMatch(/[\r\n]/u);expect(header).toContain("filename*=UTF-8''");expect(header).toContain(".pdf");expect(header).not.toContain('filename="هوية');
 });
});
