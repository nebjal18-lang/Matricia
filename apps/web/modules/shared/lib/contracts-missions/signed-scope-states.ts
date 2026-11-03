import { z } from "zod";

const stateRow = z.object({ mission_id: z.string().uuid(), signed_scope_pending: z.boolean() });
type Read = (ids: string[]) => PromiseLike<{ data: unknown; error: unknown }>;

/** Every already-authorized mission needs an explicit answer; an omission is not false. */
export async function readMissionSignedScopeStates(ids: readonly string[], read: Read): Promise<
  { status: "success"; states: Map<string, boolean> } | { status: "error" }
> {
  if (new Set(ids).size !== ids.length || ids.some(id => !z.string().uuid().safeParse(id).success)) return { status: "error" };
  const states = new Map<string, boolean>();
  for (let offset = 0; offset < ids.length; offset += 100) {
    const batch = ids.slice(offset, offset + 100);
    try {
      const result = await read(batch);
      const rows = z.array(stateRow).max(100).safeParse(result.data);
      if (result.error || !rows.success || rows.data.length !== batch.length || new Set(rows.data.map(row => row.mission_id)).size !== batch.length || rows.data.some(row => !batch.includes(row.mission_id))) return { status: "error" };
      for (const row of rows.data) states.set(row.mission_id, row.signed_scope_pending);
    } catch {
      return { status: "error" };
    }
  }
  return { status: "success", states };
}
