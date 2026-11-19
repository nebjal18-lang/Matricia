import { access } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { filmHubChain } from "./admin-film";

const adminRoot = path.resolve(process.cwd(), "app/[locale]/administration");

async function exists(rel: string) {
  await access(path.join(adminRoot, rel));
  return true;
}

describe("E2E film routes S1–S6 (structure)", () => {
  it("exposes the hub chain covering steps 1–11", () => {
    const chain = filmHubChain("fr");
    expect(chain.map((step) => step.step)).toEqual(
      expect.arrayContaining([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]),
    );
  });

  it("keeps the S1–S6 operator pages on disk", async () => {
    const required = [
      "command-center/page.tsx",
      "preparation/page.tsx",
      "catalogue/page.tsx",
      "candidatures-franchise/page.tsx",
      "invitations-reseau/page.tsx",
      "entreprises/page.tsx",
      "conformite-clients/page.tsx",
      "[space]/page.tsx",
      "facturation-clients/page.tsx",
      "finance/page.tsx",
    ];
    for (const rel of required) {
      await expect(exists(rel)).resolves.toBe(true);
    }
  });
});
