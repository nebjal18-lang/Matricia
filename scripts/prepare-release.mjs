import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { prepareManifest } from './release/manifest.mjs';
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const output = resolve(process.env.RELEASE_MANIFEST_PATH ?? 'artifacts/test-results/release-manifest.json');
await mkdir(dirname(output), { recursive: true });
await writeFile(output, JSON.stringify(prepareManifest(commit), null, 2) + '\n', { flag: 'wx', mode: 0o600 });
console.log('Manifeste préparé avec contrôles non exécutés et approbations non accordées. Aucun résultat n’a été inventé.');
