import { execFileSync } from "node:child_process";

const watched = [
  "apps/web/",
  "packages/domain/",
  "scripts/release/",
  "scripts/prepare-vercel-web-output.mjs",
  "scripts/vercel-should-build.mjs",
  "package.json",
  "pnpm-lock.yaml",
  "vercel.json",
];

export function shouldBuild(paths) {
  return paths.some((path) => watched.some((entry) => path === entry || path.startsWith(entry)));
}

function changedPaths() {
  return execFileSync("git", ["diff", "--name-only", "HEAD^", "HEAD"], { encoding: "utf8" })
    .split(/\r?\n/)
    .filter(Boolean);
}

if (process.argv[1] && process.argv[1].endsWith("vercel-should-build.mjs")) {
  try {
    process.exit(shouldBuild(changedPaths()) ? 1 : 0);
  } catch {
    process.exit(1);
  }
}
