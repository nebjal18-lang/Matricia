import test from "node:test";
import assert from "node:assert/strict";
import { shouldBuild } from "../vercel-should-build.mjs";

test("builds when the web app or the Vercel root changes", () => {
  assert.equal(shouldBuild(["apps/web/app/[locale]/client/missions/page.tsx"]), true);
  assert.equal(shouldBuild(["packages/domain/vercel.json"]), true);
  assert.equal(shouldBuild(["package.json"]), true);
});

test("skips commits that do not affect the web deployment", () => {
  assert.equal(shouldBuild(["docs/progress/PROJECT_STATE.md", "supabase/migrations/example.sql"]), false);
});
