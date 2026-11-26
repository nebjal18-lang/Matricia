export type ReadError = { code?: string; message?: string };
export type ReadResult<T> = { data: T[]; error: null } | { data: null; error: ReadError };
type Query<T> = (from: number, to: number) => PromiseLike<{ data: T[] | null; error: ReadError | null }>;

export const READ_LIMITS = { pageSize: 500, rows: 5000, requests: 60, relatedIds: 5000, batchSize: 100 } as const;
const limitError = (): ReadError => ({ code: "READ_LIMIT_EXCEEDED", message: "Narrow the scope or use explicit pagination" });

async function fetchRange<T>(query: Query<T>, from: number, to: number): Promise<ReadResult<T>> {
  try {
    const result = await query(from, to);
    if (result.error) return { data: null, error: result.error };
    if (!Array.isArray(result.data) || result.data.length > to - from + 1) return { data: null, error: { code: "INVALID_RESPONSE" } };
    return { data: result.data, error: null };
  } catch {
    return { data: null, error: { code: "UNAVAILABLE" } };
  }
}

/** One business page with a sentinel, never a total or a workflow-wide snapshot.
 * The adapter must apply tenant/filter predicates and a unique stable order. */
export async function readPage<T>(query: Query<T>, options: { offset: number; pageSize: number }) {
  const { offset, pageSize } = options;
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 1_000_000 || !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > READ_LIMITS.pageSize) {
    return { data: null, error: { code: "INVALID_PAGE" }, nextOffset: null } as const;
  }
  const result = await fetchRange(query, offset, offset + pageSize);
  if (result.error || !result.data) return { data: null, error: result.error, nextOffset: null };
  return { data: result.data.slice(0, pageSize), error: null, nextOffset: result.data.length > pageSize ? offset + pageSize : null };
}

/** Transitional complete projection: bounded work and all-or-error semantics.
 * Never use a partial list to authorize a transition or compute a ledger total. */
export async function readAllPages<T>(query: Query<T>): Promise<ReadResult<T>> {
  return readComplete(query, { rows: 0, requests: 0 });
}

async function readComplete<T>(query: Query<T>, budget: { rows: number; requests: number }): Promise<ReadResult<T>> {
  const data: T[] = [];
  for (let from = 0; ; ) {
    if (budget.requests >= READ_LIMITS.requests) return { data: null, error: limitError() };
    const size = Math.min(READ_LIMITS.pageSize, READ_LIMITS.rows - budget.rows + 1);
    budget.requests++;
    const result = await fetchRange(query, from, from + size - 1);
    if (result.error || !result.data) return { data: null, error: result.error ?? { code: "INVALID_RESPONSE" } };
    budget.rows += result.data.length;
    if (budget.rows > READ_LIMITS.rows) return { data: null, error: limitError() };
    data.push(...result.data);
    if (result.data.length < size) return { data, error: null };
    from += size;
  }
}

/** Shared row/request budget across every IN batch, not a fresh cap per parent. */
export async function readRelatedPages<T>(ids: string[], query: (ids: string[], from: number, to: number) => ReturnType<Query<T>>): Promise<ReadResult<T>> {
  const unique = new Set<string>();
  for (const id of ids) {
    unique.add(id);
    if (unique.size > READ_LIMITS.relatedIds) return { data: null, error: limitError() };
  }
  const keys = [...unique], data: T[] = [], budget = { rows: 0, requests: 0 };
  for (let offset = 0; offset < keys.length; offset += READ_LIMITS.batchSize) {
    const batch = keys.slice(offset, offset + READ_LIMITS.batchSize);
    const result = await readComplete((from, to) => query(batch, from, to), budget);
    if (result.error || !result.data) return { data: null, error: result.error ?? { code: "INVALID_RESPONSE" } };
    data.push(...result.data);
  }
  return { data, error: null };
}
