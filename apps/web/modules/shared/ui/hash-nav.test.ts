import { describe, expect, it } from "vitest";
import { hashIdFromHref } from "./hash-nav";

describe("hash navigation helpers", () => {
  it("extracts hash ids from absolute and relative hrefs", () => {
    expect(hashIdFromHref("#domaines")).toBe("domaines");
    expect(hashIdFromHref("/fr/administration/catalogue#questions")).toBe("questions");
    expect(hashIdFromHref("/fr/administration/finance?organizationId=1#boxes")).toBe("boxes");
    expect(hashIdFromHref("/fr/administration/catalogue")).toBeNull();
  });
});
