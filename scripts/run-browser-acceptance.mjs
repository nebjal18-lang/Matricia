import { spawn } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { validateBrowserReport } from './release/browser-report.mjs';
const suite = process.argv[2] ?? 'public';
const suites = {
  public: ['tests/e2e/public-experience.spec.ts', 'tests/e2e/cookie-preferences.spec.ts'],
  authenticated: ['tests/e2e/authenticated-route-smoke.spec.ts'],
  workflows: ['tests/e2e/p23-provider-quotes.spec.ts', 'tests/e2e/p24-marketing-completion.spec.ts', 'tests/e2e/p25-client-provider-completion.spec.ts', 'tests/e2e/p26-transversal-completion.spec.ts'],
};
if (!Object.hasOwn(suites, suite)) throw new Error('BROWSER_ACCEPTANCE_SUITE_INVALID');
if (suite !== 'public') for (const role of ['CLIENT', 'PROVIDER', 'FRANCHISE', 'ADMIN']) if (!process.env[`E2E_${role}_STORAGE_STATE`]) throw new Error(`E2E_${role}_STORAGE_STATE_REQUIRED`);
if (suite === 'workflows') for (const name of ['E2E_CLIENT_B_STORAGE_STATE', 'E2E_P23_TARGET_ORGANIZATION_ID', 'E2E_P23_DECOY_ORGANIZATION_ID', 'E2E_P23_CASES', 'E2E_MARKETING_CHAIN_FIXTURE', 'E2E_P25_WORKFLOWS', 'E2E_CRON_SECRET']) if (!process.env[name]) throw new Error(`${name}_REQUIRED`);
const directory = resolve('artifacts/test-results/acceptance');
await mkdir(directory, { recursive: true });
const reportPath = resolve(directory, `${suite}-playwright.json`);
await rm(reportPath, { force: true });
const startedAt = new Date().toISOString();
const child = spawn(process.execPath, [resolve('node_modules/@playwright/test/cli.js'), 'test', ...suites[suite], '--retries=0', '--reporter=line,json'], { stdio: 'inherit', env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_FILE: reportPath } });
const code = await new Promise((resolveExit, reject) => { child.once('error', reject); child.once('exit', (code, signal) => signal ? reject(new Error('BROWSER_ACCEPTANCE_INTERRUPTED')) : resolveExit(code ?? 1)); });
if (code !== 0) process.exit(code);
const bytes = await readFile(reportPath);
const assertions = validateBrowserReport(JSON.parse(bytes));
await writeFile(resolve(directory, `${suite}-summary.json`), JSON.stringify({ schemaVersion: 1, check: { public: 'e2ePublic', authenticated: 'e2eAuthenticated', workflows: 'e2eWorkflows' }[suite], command: `playwright test ${suites[suite].join(' ')} --retries=0`, suite, commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), startedAt, finishedAt: new Date().toISOString(), exitCode: 0, status: 'passed', assertions, skipped: 0, flaky: 0, expectedFailures: 0, artifact: { path: `artifacts/test-results/acceptance/${suite}-playwright.json`, sha256: createHash('sha256').update(bytes).digest('hex') } }, null, 2) + '\n');
console.log(`Acceptance ${suite}: ${assertions} tests, zéro ignoré/instable/échec attendu.`);
