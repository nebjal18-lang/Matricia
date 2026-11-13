import { createHash } from "node:crypto";
import { PDFDocument } from "pdf-lib";
import { expect, it } from "vitest";
import { validatePdfPlacements } from "./placement";
async function source() { const document=await PDFDocument.create();document.addPage([595.28,841.89]);document.addPage([595.28,841.89]);const bytes=await document.save();return{bytes,sha:createHash("sha256").update(bytes).digest("hex")}; }
it("validates an explicitly chosen placement against actual immutable PDF pages", async () => {
  const {bytes,sha}=await source();await expect(validatePdfPlacements(bytes,sha,[{documentSha256:sha,page:2,x:40,y:600}])).resolves.toBeUndefined();
});
it.each([{page:3,x:40,y:600},{page:1,x:511,y:600},{page:1,x:40,y:805},{page:1,x:-1,y:600}])("rejects a nonexistent page or a stamp outside its real boundary %#", async field => {
  const {bytes,sha}=await source();await expect(validatePdfPlacements(bytes,sha,[{documentSha256:sha,...field}])).rejects.toThrow("INVALID_PLACEMENT");
});
it("rejects a PDF whose bytes no longer match the envelope hash", async () => {
  const {bytes,sha}=await source();const changed=new Uint8Array(bytes);changed[20]^=1;await expect(validatePdfPlacements(changed,sha,[{documentSha256:sha,page:1,x:40,y:600}])).rejects.toThrow("DOCUMENT_CHANGED");
});
