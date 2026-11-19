import { describe, expect, it } from "vitest";
import { DOCUMENT_LOCALE_BOOTSTRAP } from "./document-locale-bootstrap";

describe("document locale bootstrap", () => {
  it("contains a blocking pathname switch for fr and ar", () => {
    expect(DOCUMENT_LOCALE_BOOTSTRAP).toContain("/(fr|ar)");
    expect(DOCUMENT_LOCALE_BOOTSTRAP).toContain('document.documentElement.lang=l');
    expect(DOCUMENT_LOCALE_BOOTSTRAP).toContain('dir=l==="ar"?"rtl":"ltr"');
  });
});
