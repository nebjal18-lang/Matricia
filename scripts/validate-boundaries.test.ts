import { describe, expect, it } from "vitest";
import { applicationImportViolations, importSpecifiers } from "./validate-boundaries";

describe("application boundaries", () => {
  it.each([
    'import { execute } from "@matricia/application";',
    'export { execute } from "@matricia/infrastructure";',
    'const value = import("@matricia/application");',
    'const value = require("@matricia/infrastructure");',
    'type Value = import("@matricia/application").Value;',
    'import { execute } from "../../packages/application/src/index";',
  ])("rejects server imports from client: %s", (statement) => {
    expect(applicationImportViolations("apps/web/ui.tsx", `"use client";${statement}`)).toHaveLength(1);
  });
  it("rejects app-to-app imports", () => {
    expect(applicationImportViolations("apps/worker/index.ts", 'import "../web/secret";')).toHaveLength(1);
  });
  it("allows server adapters and ignores comments and string contents", () => {
    expect(applicationImportViolations("apps/web/action.ts", '"use server";import { execute } from "@matricia/application";')).toEqual([]);
    expect(importSpecifiers('// import x from "bad"\nconst text = `import "bad"`;')).toEqual([]);
  });
});
