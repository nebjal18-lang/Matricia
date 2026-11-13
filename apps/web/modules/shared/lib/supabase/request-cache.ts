import { cache } from "react";

/** Per-request memoization for RSC. Disabled under Vitest so mocks stay per-test. */
export function withRequestCache<A extends unknown[], R>(fn: (...args: A) => R): (...args: A) => R {
  if (process.env.VITEST) return fn;
  return cache(fn) as (...args: A) => R;
}
