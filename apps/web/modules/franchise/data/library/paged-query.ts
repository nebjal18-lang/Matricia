/** Fetch each bounded server page explicitly so PostgREST's max_rows never truncates history. */
export async function collectCatalogPages<T>(query: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<{ data: T[]; error: unknown }> {
  const data: T[] = [];
  const size = 500;
  for (let from = 0; ; from += size) {
    const page = await query(from, from + size - 1);
    if (page.error) return { data: [], error: page.error };
    if (!page.data) return { data: [], error: new Error("CATALOG_RESPONSE_MISSING") };
    data.push(...page.data);
    if (page.data.length < size) return { data, error: null };
  }
}
