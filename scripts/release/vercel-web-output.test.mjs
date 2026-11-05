import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { prepareVercelWebOutput } from '../prepare-vercel-web-output.mjs';

test('keeps static assets patchable for Vercel preview comments', async () => {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const source = await readFile(join(root, 'apps/web/next.config.ts'), 'utf8');
  assert.match(source, /supportsImmutableAssets:\s*false/);
});

test('all Vercel entrypoints retain the same scheduled application endpoints', async () => {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const configs = await Promise.all(['vercel.json', 'apps/web/vercel.json', 'packages/domain/vercel.json']
    .map(async path => JSON.parse(await readFile(join(root, path), 'utf8'))));
  for (const config of configs.slice(1)) assert.deepEqual(config.crons, configs[0].crons);
  for (const cron of configs[0].crons) {
    const pathname = new URL(cron.path, 'https://matricia.example').pathname;
    assert.match(await readFile(join(root, 'apps/web/app', pathname.slice(1), 'route.ts'), 'utf8'), /export/);
  }
});

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'matricia-vercel-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const path of ['apps/web/.next', 'apps/web/public', 'apps/web/node_modules/next',
    'apps/web/node_modules/@fontsource/noto-sans-arabic', 'packages/domain/node_modules/typescript']) {
    await mkdir(join(root, path), { recursive: true });
  }
  await writeFile(join(root, 'apps/web/.next/BUILD_ID'), 'native-next-test');
  await writeFile(join(root, 'apps/web/package.json'), JSON.stringify({ dependencies: {
    next: '16.4.1', '@fontsource/noto-sans-arabic': '5.2.8',
  } }));
  await writeFile(join(root, 'packages/domain/node_modules/typescript/retained'), 'domain dependency');
  return root;
}

test('exposes native Next output, assets and scoped runtime dependencies; preserves domain dependencies', async t => {
  const root = await fixture(t);
  await mkdir(join(root, 'packages/domain/.next/cache'), { recursive: true });
  await writeFile(join(root, 'packages/domain/.next/cache/old'), 'disposable cache');
  const first = await prepareVercelWebOutput(root);
  for (const path of ['.next', 'public', 'node_modules/next', 'node_modules/@fontsource/noto-sans-arabic']) {
    assert.equal(await realpath(join(root, 'packages/domain', path)), await realpath(join(root, 'apps/web', path)));
  }
  assert.equal(await readFile(join(root, 'packages/domain/node_modules/typescript/retained'), 'utf8'), 'domain dependency');
  assert.deepEqual(await prepareVercelWebOutput(root), first);
});

test('refuses public directory collisions before changing generated output', async t => {
  const root = await fixture(t);
  await mkdir(join(root, 'packages/domain/public'));
  await writeFile(join(root, 'packages/domain/public/keep'), 'existing source');
  await assert.rejects(prepareVercelWebOutput(root), /VERCEL_WEB_ALIAS_CONFLICT: public/);
  assert.equal(await readFile(join(root, 'packages/domain/public/keep'), 'utf8'), 'existing source');
  await assert.rejects(realpath(join(root, 'packages/domain/.next')), { code: 'ENOENT' });
});

test('requires a completed Next build before creating aliases', async t => {
  const root = await fixture(t);
  await rm(join(root, 'apps/web/.next/BUILD_ID'));
  await assert.rejects(prepareVercelWebOutput(root), { code: 'ENOENT' });
  await assert.rejects(realpath(join(root, 'packages/domain/.next')), { code: 'ENOENT' });
});

test('refuses a conflicting installed dependency without replacing it', async t => {
  const root = await fixture(t);
  await mkdir(join(root, 'packages/domain/node_modules/next'));
  await writeFile(join(root, 'packages/domain/node_modules/next/keep'), 'existing dependency');
  await assert.rejects(prepareVercelWebOutput(root), /VERCEL_WEB_ALIAS_CONFLICT: node_modules\/next/);
  assert.equal(await readFile(join(root, 'packages/domain/node_modules/next/keep'), 'utf8'), 'existing dependency');
});
