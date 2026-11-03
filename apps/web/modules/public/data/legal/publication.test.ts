import { describe, expect, it } from "vitest";
import { legalPublication, legalPublicationFields } from "./publication";
describe("legal publication", () => {
  it("never manufactures the contracting entity", () => { const config = legalPublication({}); expect(config.ready).toBe(false); expect(config.missing).toContain("LEGAL_ENTITY_NAME"); expect(config.values.LEGAL_ENTITY_NAME).toBeNull(); });
  it("requires both translations and an approval reference", () => { const env = Object.fromEntries(legalPublicationFields.map(key => [key,"approved"])); expect(legalPublication(env).ready).toBe(true); delete env.LEGAL_RETENTION_AR; expect(legalPublication(env).missing).toEqual(["LEGAL_RETENTION_AR"]); });
});
