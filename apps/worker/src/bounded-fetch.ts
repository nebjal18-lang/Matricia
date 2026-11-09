/** Keep Supabase RPCs, Auth and private Storage bodies within a network deadline.
 * The signal stays attached to the response body after headers arrive.
 */
export function createBoundedFetch(timeoutMs = 30_000, fetcher: typeof fetch = fetch): typeof fetch {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 120_000) {
    throw new Error("WORKER_HTTP_TIMEOUT_INVALID");
  }

  return (input, init) => {
    const inherited = init?.signal ?? (input instanceof Request ? input.signal : undefined);
    const deadline = AbortSignal.timeout(timeoutMs);
    const signal = inherited ? AbortSignal.any([inherited, deadline]) : deadline;
    return fetcher(input, { ...init, signal });
  };
}
