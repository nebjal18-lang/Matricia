import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { formatMinorAmount, formatDateTimeCasablanca } from '../../../apps/web/modules/shared/lib/format/display.ts';
import { readAllPages } from '../../../apps/web/modules/shared/lib/data/read-pages.ts';
const root = fileURLToPath(new URL('../../../', import.meta.url));
const evidence = fileURLToPath(new URL('./evidence/', import.meta.url));
const require = createRequire(join(root, 'package.json'));
const ts = require('typescript');
const small = '9007199254740992';
const large = '9007199254740993';
const money = { minorA: small, minorB: large, displayedA: formatMinorAmount(small, 'MAD', 'fr'), displayedB: formatMinorAmount(large, 'MAD', 'fr') };
money.collapsedDistinctMinorAmounts = money.displayedA === money.displayedB;
const instant = '2026-03-01T23:30:00Z';
const civilTime = { instant, application: formatDateTimeCasablanca(instant, 'fr'),
  intlAfricaCasablanca: new Intl.DateTimeFormat('fr-MA', { timeZone: 'Africa/Casablanca', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(instant)),
  nodeTzdata: process.versions.tz };
const total = 100_000;
let calls = 0;
const rows = await readAllPages(async (from, to) => { calls++; return { data: Array.from({ length: Math.min(500, Math.max(0, total - from)) }, (_, n) => ({ id: from + n })), error: null }; });
const compilerOptions = [];
for (const file of ['tsconfig.json', 'apps/web/tsconfig.json', 'apps/worker/tsconfig.json']) {
  const config = ts.getParsedCommandLineOfConfigFile(join(root, file), {}, { ...ts.sys, onUnRecoverableConfigFileDiagnostic: diagnostic => { throw new Error(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')); } });
  compilerOptions.push({ file, strict: !!config.options.strict, noUncheckedIndexedAccess: !!config.options.noUncheckedIndexedAccess,
    exactOptionalPropertyTypes: !!config.options.exactOptionalPropertyTypes, noImplicitOverride: !!config.options.noImplicitOverride,
    noFallthroughCasesInSwitch: !!config.options.noFallthroughCasesInSwitch });
}
const result = { generatedAt: new Date().toISOString(), nodeVersion: process.version,
  protocol: 'Imports execute actual unmodified source functions; pagination uses synthetic in-memory transport, not measured network latency',
  money, civilTime, pagination: { totalRows: rows.data.length, calls, pageSize: 500 }, compilerOptions };
await writeFile(join(evidence, 'source-probes.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
