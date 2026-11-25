import { access, realpath } from 'node:fs/promises';
import { delimiter, dirname, resolve } from 'node:path';

// Invoke JS with Node on every platform: never execute .cmd via a shell.
export async function corepackCommand(env = process.env, executable = process.execPath) {
  const directories = [dirname(executable), ...(env.PATH ?? env.Path ?? '').split(delimiter)];
  const candidates = env.COREPACK_CLI_PATH ? [resolve(env.COREPACK_CLI_PATH)] : [];
  for (const directory of directories) {
    if (!directory) continue;
    candidates.push(resolve(directory, 'node_modules/corepack/dist/corepack.js'));
    try { candidates.push(await realpath(resolve(directory, 'corepack'))); } catch { /* Try next installation. */ }
  }
  for (const candidate of candidates) {
    if (!candidate.endsWith('.js')) continue;
    try { await access(candidate); return { command: executable, args: [candidate, 'pnpm'] }; } catch { /* Try next installation. */ }
  }
  throw new Error('RELEASE_COREPACK_CLI_NOT_FOUND');
}

export function parseVitestSummary(output) {
  const counts = { assertions: 0, skipped: 0, expectedFailures: 0, failed: 0 };
  const summaries = output.replace(/\u001b\[[0-9;]*m/g, '').split(/\r?\n/)
    .filter(line => /\bTests\s+\d+\s+(?:passed|failed|skipped|todo)\b/.test(line));
  if (!summaries.length) return counts;
  for (const line of summaries) {
    const body = line.slice(line.indexOf('Tests') + 5).trim();
    const match = body.match(/^((?:\d+ (?:passed|failed|skipped|todo)(?:\s*\|\s*)?)+)\s*\((\d+)\)\s*$/);
    if (!match) throw new Error('RELEASE_UNIT_SUMMARY_INVALID');
    const seen = new Set(); let total = 0;
    for (const [, number, status] of match[1].matchAll(/(\d+) (passed|failed|skipped|todo)/g)) {
      if (seen.has(status)) throw new Error('RELEASE_UNIT_SUMMARY_INVALID');
      seen.add(status); const count = Number(number); total += count;
      counts[{ passed: 'assertions', failed: 'failed', skipped: 'skipped', todo: 'expectedFailures' }[status]] += count;
    }
    if (total !== Number(match[2])) throw new Error('RELEASE_UNIT_SUMMARY_INVALID');
  }
  return counts;
}
