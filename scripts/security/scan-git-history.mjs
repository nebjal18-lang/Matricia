import { spawn } from "node:child_process";
import { createInterface } from "node:readline";

// Review every patch reachable from every Git ref without printing credential values.
const git = spawn("git", ["log", "--all", "--patch", "--no-ext-diff", "--no-textconv", "--format=COMMIT:%H", "--"], {
  stdio: ["ignore", "pipe", "pipe"],
});

const tokenPatterns = [
  ["GitHub token", /\b(?:ghp_|gho_|ghu_|ghs_|github_pat_)[A-Za-z0-9_]{20,}\b/u],
  ["AWS access key", /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/u],
  ["OpenAI API key", /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/u],
  ["Google API key", /\bAIza[0-9A-Za-z_-]{30,}\b/u],
  ["Stripe secret key", /\bsk_(?:live|test)_[A-Za-z0-9]{20,}\b/u],
  ["private key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/u],
];
const assignment = /\b([A-Z][A-Z0-9_]*(?:SECRET|TOKEN|PASSWORD|API_KEY|PRIVATE_KEY|STORE_KEY|SERVICE_ROLE_KEY)[A-Z0-9_]*)\s*[:=]\s*["']?([^\s"',;]{16,})/u;
const findings = new Map();
let commit = "unknown";
let file = "unknown";
let line = 0;
let patches = 0;

for await (const patchLine of createInterface({ input: git.stdout, crlfDelay: Infinity })) {
  if (patchLine.startsWith("COMMIT:")) { commit = patchLine.slice(7, 19); continue; }
  if (patchLine.startsWith("+++ b/")) { file = patchLine.slice(6); continue; }
  if (patchLine.startsWith("@@")) {
    line = Number(/\+(\d+)/u.exec(patchLine)?.[1] ?? 0);
    continue;
  }
  if (patchLine.startsWith("+") && !patchLine.startsWith("+++")) {
    patches++;
    const content = patchLine.slice(1);
    const labels = tokenPatterns.filter(([, pattern]) => pattern.test(content)).map(([label]) => label);
    const assigned = assignment.exec(content);
    if (assigned) {
      const value = assigned[2];
      if (!/^(?:process\.|env\.|\$|\{\{|example|placeholder|change|replace|your|dummy|test|redacted|fake|xxxx)/iu.test(value)
        && !/[{}()[\]`]/u.test(value)) labels.push(`assignment ${assigned[1]}`);
    }
    for (const label of labels) {
      const key = `${commit}:${file}:${line}:${label}`;
      findings.set(key, { commit, file, line, label });
    }
    line++;
  } else if (patchLine.startsWith(" ")) line++;
}

let stderr = "";
for await (const chunk of git.stderr) stderr += chunk;
const exitCode = await new Promise((resolve) => git.on("close", resolve));
if (exitCode !== 0) {
  process.stderr.write(`Git history scan failed: ${stderr.trim()}\n`);
  process.exit(2);
}
const candidates = [...findings.values()];
const grouped = [...new Set(candidates.map(({ file, label }) => `${file}: ${label}`))].sort();
process.stdout.write(`${JSON.stringify({ commits: "all reachable refs", addedLinesScanned: patches, candidateOccurrences: candidates.length, candidateLocations: grouped }, null, 2)}\n`);
process.exitCode = findings.size ? 1 : 0;
