import { lstat, mkdir, readFile, realpath, rm, symlink } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

async function inspect(path) {
  try { return await lstat(path); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

// Compatibility for an existing Vercel project rooted in packages/domain.
// Expose the actual Next output and dependencies without changing domain's build.
export async function prepareVercelWebOutput(repositoryRoot) {
  const web = join(repositoryRoot, 'apps', 'web');
  const project = join(repositoryRoot, 'packages', 'domain');
  await readFile(join(web, '.next', 'BUILD_ID'), 'utf8');
  const manifest = JSON.parse(await readFile(join(web, 'package.json'), 'utf8'));
  const aliases = [
    { source: join(web, '.next'), target: join(project, '.next'), generated: true },
    { source: join(web, 'public'), target: join(project, 'public') },
  ];
  for (const name of Object.keys(manifest.dependencies)) {
    if (!/^(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+$/i.test(name)) {
      throw new Error('INVALID_WEB_DEPENDENCY_NAME');
    }
    aliases.push({
      source: join(web, 'node_modules', name),
      target: join(project, 'node_modules', name),
    });
  }

  // Validate every source and collision before replacing any generated output.
  const pending = [];
  for (const alias of aliases) {
    const source = await realpath(alias.source);
    const existing = await inspect(alias.target);
    if (existing) {
      try { if (await realpath(alias.target) === source) continue; }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
      if (!alias.generated) {
        throw new Error(`VERCEL_WEB_ALIAS_CONFLICT: ${relative(project, alias.target)}`);
      }
    }
    pending.push({ ...alias, existing });
  }
  for (const alias of pending) {
    // Only .next is disposable build output; existing public/dependencies survive.
    if (alias.existing) await rm(alias.target, { recursive: true, force: true });
    await mkdir(dirname(alias.target), { recursive: true });
    await symlink(relative(dirname(alias.target), alias.source), alias.target, 'dir');
  }
  return { aliases: aliases.length, project: 'packages/domain', output: 'apps/web/.next' };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  console.log(JSON.stringify(await prepareVercelWebOutput(root)));
}
