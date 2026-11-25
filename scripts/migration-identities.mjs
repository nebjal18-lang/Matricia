import { readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export function validateMigrationIdentities(names) {
  const versions = new Map();
  const errors = [];
  for (const name of names.filter(name => name.endsWith('.sql'))) {
    const match = /^(\d{14})_([a-z0-9_]+)\.sql$/.exec(name);
    if (!match) { errors.push({ code: 'INVALID_MIGRATION_NAME', files: [name] }); continue; }
    const previous = versions.get(match[1]);
    if (previous) errors.push({ code: 'DUPLICATE_MIGRATION_VERSION', version: match[1], files: [previous, name] });
    else versions.set(match[1], name);
  }
  return { passed: errors.length === 0, migrationCount: versions.size, errors };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = validateMigrationIdentities(await readdir(fileURLToPath(new URL('../supabase/migrations', import.meta.url))));
  console.log(JSON.stringify(result));
  if (!result.passed) process.exitCode = 1;
}
