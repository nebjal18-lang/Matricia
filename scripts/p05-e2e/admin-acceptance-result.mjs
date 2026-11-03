// An RPC probe is not browser acceptance. Cleanup failures always fail the run.
export function completedAdminAcceptanceStatus({ probeOnly, rpc, browser }) {
  const admin = rpc.some(result => result.actor === 'admin' && result.schemaValid && result.authenticatedAal2 && result.code === null);
  const denied = rpc.some(result => result.actor === 'ordinary' && result.authenticatedAal2 && result.code === '42501');
  if (!admin || !denied) return 'FAILED';
  if (probeOnly) return 'PROBE_PASSED';
  return ['fr', 'ar'].every(locale => [360, 1280].every(width => browser.some(result => result.locale === locale && result.width === width && result.realSearchAndSelection && result.ownOrganizationHeadingVerified))) ? 'PASSED' : 'FAILED';
}

export async function finalizeAdminAcceptance({ proof, steps, persist }) {
  for (const { code, run } of steps) {
    try { await run(); }
    catch {
      proof.status = 'FAILED';
      (proof.cleanupFailures ??= []).push(code);
    }
  }
  if (!proof.cleanup?.verified) proof.status = 'FAILED';
  await persist(proof);
  return ['PASSED', 'PROBE_PASSED'].includes(proof.status);
}
