// The worker is bundled in production. During these source integration tests,
// resolve its relative TypeScript imports without replacing any implementation.
const workerRoot = new URL('../../apps/worker/src/', import.meta.url).href;
export async function resolve(specifier, context, nextResolve) {
  try { return await nextResolve(specifier, context); }
  catch (error) {
    if (error.code !== 'ERR_MODULE_NOT_FOUND' || !context.parentURL?.startsWith(workerRoot) || !specifier.startsWith('./') || /\.[a-z]+$/iu.test(specifier)) throw error;
    return nextResolve(`${specifier}.ts`, context);
  }
}
