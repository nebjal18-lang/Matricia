import { readdir } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";

const root = resolve("apps/web/public");
const forbidden = [];
const sensitiveSegment = /^(?:\.git|\.env(?:\..*)?|node_modules|tests?|__tests__|backups?)$/iu;
const sensitiveFile = /(?:\.(?:map|bak|backup|old|orig|sql|sqlite|db|log|pem|key|p12|pfx|test\.[a-z0-9]+)|(?:^|\.)env(?:\..*)?)$/iu;

async function inspect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    const displayPath = relative(root, path).split(sep).join("/");
    if (sensitiveSegment.test(entry.name) || entry.name.startsWith(".") || sensitiveFile.test(entry.name)) {
      forbidden.push(displayPath);
      continue;
    }
    if (entry.isSymbolicLink()) {
      forbidden.push(displayPath);
      continue;
    }
    if (entry.isDirectory()) await inspect(path);
    else if (!entry.isFile()) forbidden.push(displayPath);
  }
}

await inspect(root);
if (forbidden.length) {
  process.stderr.write(`Public assets contain forbidden paths: ${forbidden.join(", ")}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write("Public assets: no secrets, backups, source maps, test files or symlinks found.\n");
}
