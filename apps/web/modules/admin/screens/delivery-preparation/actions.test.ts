import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.hoisted(() => vi.fn());
const revalidatePath = vi.hoisted(() => vi.fn());
vi.mock("@/modules/shared/lib/supabase/server", () => ({ getSupabaseServerClient: async () => ({ rpc }) }));
vi.mock("next/cache", () => ({ revalidatePath }));
import { saveDeliveryPreparation } from "./actions";
import { parsePreparationInput } from "./model";

const idle = { status: "idle" as const };
function form(input: Record<string, string>) {
  const data = new FormData();
  Object.entries(input).forEach(([key, value]) => data.set(key, value));
  return data;
}
const base = { locale: "fr", rowVersion: "0", idempotencyKey: "00000000-0000-4000-8000-000000000381" };

beforeEach(() => { rpc.mockReset(); revalidatePath.mockReset(); rpc.mockResolvedValue({ data: { outcome: "DELIVERY_PREPARATION_SAVED" }, error: null }); });

describe("delivery preparation drafts", () => {
  it("stores a legal draft and never sends an empty secret", async () => {
    await expect(saveDeliveryPreparation(idle, form({ ...base, section: "LEGAL", itemKey: "LEGAL_ENTITY_NAME", valueText: "Éditeur à confirmer" }))).resolves.toEqual({ status: "success" });
    expect(rpc).toHaveBeenCalledWith("save_delivery_preparation", expect.objectContaining({ p_section: "LEGAL", p_item_key: "LEGAL_ENTITY_NAME", p_secret: null, p_expected_row_version: 0 }));
    expect(revalidatePath).toHaveBeenCalledWith("/fr/administration/preparation");
  });

  it("sends an integration credential separately from its public description", async () => {
    await saveDeliveryPreparation(idle, form({ ...base, section: "INTEGRATION", itemKey: "EMAIL", valueText: "SMTP de préproduction", secret: "credential-value" }));
    expect(rpc.mock.calls[0][1]).toMatchObject({ p_value_text: "SMTP de préproduction", p_secret: "credential-value" });
  });

  it("rejects a catalogue name without Arabic letters before calling the database", async () => {
    await expect(saveDeliveryPreparation(idle, form({ ...base, section: "CATALOG_SERVICE_AR", itemKey: "IT-AUDIT-SI", valueText: "Audit français" }))).resolves.toEqual({ status: "error", reason: "VALIDATION" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects a formula key that does not name a plan and a field", () => {
    expect(parsePreparationInput(form({ ...base, section: "BOX", itemKey: "GOLD:QUOTA", valueText: "Quota à confirmer" }))).toBeNull();
  });

  it("maps a stale draft to a conflict", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "40001", message: "STALE_DELIVERY_PREPARATION" } });
    await expect(saveDeliveryPreparation(idle, form({ ...base, section: "RELEASE", itemKey: "CNDP", valueText: "Décision à consigner" }))).resolves.toEqual({ status: "error", reason: "CONFLICT" });
  });
});
