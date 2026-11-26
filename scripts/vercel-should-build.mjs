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

function runGit(args) {
  return execFileSync("git", args, { encoding: "utf8" })
    .split(/\r?\n/)
    .filter(Boolean);
}

/** Merge-aware path list: first-parent diff alone misses some PR merges on shallow clones. */
function changedPaths() {
  const previous = process.env.VERCEL_GIT_PREVIOUS_SHA;
  if (previous && /^[0-9a-f]{7,40}$/iu.test(previous)) {
    try {
      return runGit(["diff", "--name-only", previous, "HEAD"]);
    } catch {
      /* fall through */
    }
  }
  try {
    return runGit(["diff-tree", "--no-commit-id", "--name-only", "-r", "-m", "HEAD"]);
  } catch {
    return runGit(["diff", "--name-only", "HEAD^", "HEAD"]);
  }
}

if (process.argv[1] && process.argv[1].endsWith("vercel-should-build.mjs")) {
  try {
    // Exit 1 = continue build (Vercel ignoreCommand convention).
    process.exit(shouldBuild(changedPaths()) ? 1 : 0);
  } catch {
    process.exit(1);
  }
}
