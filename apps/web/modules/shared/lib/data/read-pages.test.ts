import { describe, expect, it, vi } from "vitest";
import { readAllPages, readPage, readRelatedPages } from "./read-pages";

describe("bounded reads", () => {
  it.each([5001, 100000, 1000000])("bounds complete reads of %i rows without partial success", async (length) => {
    const query = vi.fn(async (from: number, to: number) => ({ data: Array.from({ length: Math.max(0, Math.min(to + 1, length) - from) }, (_, i) => from + i), error: null }));
    expect(await readAllPages(query)).toMatchObject({ data: null, error: { code: "READ_LIMIT_EXCEEDED" } });
    expect(query).toHaveBeenCalledTimes(11);
    expect(query).toHaveBeenLastCalledWith(5000, 5000);
  });
  it("accepts an exactly complete limit after checking the sentinel", async () => {
    const rows = Array.from({ length: 5000 }, (_, i) => i);
    expect(await readAllPages(async (from, to) => ({ data: rows.slice(from, to + 1), error: null }))).toEqual({ data: rows, error: null });
  });
  it("shares the limit between related batches and discards earlier results on failure", async () => {
    const ids = Array.from({ length: 200 }, (_, i) => String(i));
    const query = vi.fn(async (_ids: string[], from: number, to: number) => ({ data: Array.from({ length: Math.max(0, Math.min(to + 1, 3000) - from) }, (_, i) => i), error: null }));
    expect(await readRelatedPages(ids, query)).toMatchObject({ data: null, error: { code: "READ_LIMIT_EXCEEDED" } });
    expect(query.mock.calls.length).toBeLessThanOrEqual(12);
  });
  it("rejects excessive parents before querying and deduplicates a small input", async () => {
    const query = vi.fn(async () => ({ data: [], error: null }));
    expect(await readRelatedPages(Array.from({ length: 5001 }, (_, i) => String(i)), query)).toMatchObject({ error: { code: "READ_LIMIT_EXCEEDED" } });
    expect(query).not.toHaveBeenCalled();
    await readRelatedPages(["a", "a"], query);
    expect(query).toHaveBeenCalledWith(["a"], 0, 499);
  });
  it("returns a page with explicit continuation in one query", async () => {
    const rows = Array.from({ length: 100000 }, (_, i) => i);
    const query = vi.fn(async (from: number, to: number) => ({ data: rows.slice(from, to + 1), error: null }));
    expect(await readPage(query, { offset: 50, pageSize: 25 })).toEqual({ data: rows.slice(50, 75), error: null, nextOffset: 75 });
    expect(query).toHaveBeenCalledExactlyOnceWith(50, 75);
  });
  it("distinguishes invalid, unavailable and empty pages", async () => {
    const query = vi.fn(async () => ({ data: [], error: null }));
    expect(await readPage(query, { offset: -1, pageSize: 25 })).toMatchObject({ error: { code: "INVALID_PAGE" } });
    expect(query).not.toHaveBeenCalled();
    expect(await readPage(query, { offset: 0, pageSize: 25 })).toEqual({ data: [], error: null, nextOffset: null });
    expect(await readPage(async () => { throw new Error("private"); }, { offset: 0, pageSize: 25 })).toMatchObject({ data: null, error: { code: "UNAVAILABLE" } });
  });
});
