import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { validateArtifacts, validateManifestShape } from "./release/manifest.mjs";

const checks = ["validate-catalog.ts", "validate-spec.ts", "validate-traceability.ts", "validate-no-placeholders.ts"];
for (const check of checks) {
  const result = spawnSync(process.execPath, ["--experimental-strip-types", `scripts/${check}`], { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
if (process.argv.includes("--structure-only")) {
  console.log("Gates structurels validés ; aucune autorisation de livraison.");
  process.exit(0);
}
const failures: string[] = [];
const interactionProof = process.env.RELEASE_INTERACTION_PROOF_PATH;
if (!interactionProof) failures.push("INTERACTION_RUNTIME_PROOF_REQUIRED");
else {
  const inventory = spawnSync(process.execPath, ["scripts/audit-interactions.mjs", "--check", "--runtime-proof", interactionProof], { stdio: "inherit" });
  if (inventory.status !== 0) failures.push("INTERACTION_RUNTIME_PROOF_INVALID");
}
const commit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
if (execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim()) failures.push("RELEASE_WORKTREE_NOT_FROZEN");
const registry = readFileSync("docs/traceability/REQUIREMENTS_COVERAGE.md", "utf8");
for (const line of registry.split(/\r?\n/).filter(line => /^\| (MAT-FUNC|MARKETING)-\d{3} \|/.test(line))) {
  const [, id, status, , , , owner, signoff] = line.split("|").map(value => value.trim());
  if (status !== "VERIFIED" || !signoff?.startsWith("APPROVED:")) failures.push(`REGISTRY_NOT_APPROVED:${id}`);
  const reviewer = signoff?.split(":")[1];
  if (reviewer && reviewer === owner) failures.push(`REGISTRY_REVIEWER_NOT_INDEPENDENT:${id}`);
}
const path = process.env.RELEASE_MANIFEST_PATH ?? "artifacts/test-results/release-manifest.json";
try {
  const manifest = JSON.parse(readFileSync(resolve(path), "utf8"));
  failures.push(...validateManifestShape(manifest, { commit }), ...await validateArtifacts(manifest, process.cwd()));
} catch { failures.push("RELEASE_MANIFEST_MISSING_OR_INVALID"); }
if (failures.length) {
  console.error(`Livraison refusée (${failures.length} conditions non satisfaites):\n${failures.map(code => `- ${code}`).join("\n")}`);
  process.exit(1);
}
console.log(`Release V1 validée pour ${commit}. Les signatures externes restent vérifiables dans les preuves référencées.`);
