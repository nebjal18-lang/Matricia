import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repositorySource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "repository.ts"),
  "utf8",
);

describe("MAT-FUNC-056 progression transversal contract", () => {
  it("surfaces row_version on contracts and milestones for optimistic progression", () => {
    expect(repositorySource).toContain('row_version');
    expect(repositorySource).toMatch(/rowVersion:\s*contract\.row_version/);
    expect(repositorySource).toMatch(/rowVersion:\s*milestone\.row_version/);
  });

  it("loads mission scope reconciliation flags for cross-domain progression", () => {
    expect(repositorySource).toContain("get_mission_signed_scope_states_v1");
    expect(repositorySource).toContain("scopeReconciliationRequired");
    expect(repositorySource).toContain("signedScopePending");
  });
});
