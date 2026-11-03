import { describe, expect, it, vi } from "vitest";
import { loadDeliveryPreparationWorkspace } from "./load";

const overview = { services_pending: 2, services_drafted: 1, categories_pending: 3, categories_drafted: 0, legal_drafted: 1, legal_total: 11, box_drafted: 0, integrations_drafted: 1, integrations_secret: 0, integrations_total: 5, release_drafted: 0, release_total: 4 };
const list = { total: 0, items: [] };

describe("delivery preparation workspace", () => {
  it("reads the overview and every section in one batch", async () => {
    const rpc = vi.fn(async (fn: string) => ({ data: fn === "delivery_preparation_overview" ? overview : list, error: null }));
    const result = await loadDeliveryPreparationWorkspace({ rpc }, { serviceQ: "audit", servicePage: "2" });
    expect(result.status).toBe("success");
    expect(rpc).toHaveBeenCalledTimes(7);
    if (result.status === "success") expect(result.workspace.overview.services_pending).toBe(2);
    expect(rpc.mock.calls.map((call) => call[0])).toEqual(["delivery_preparation_overview", "list_delivery_preparation", "list_delivery_preparation", "list_delivery_preparation", "list_delivery_preparation", "list_delivery_preparation", "list_delivery_preparation"]);
  });

  it("returns an error when one section fails", async () => {
    const rpc = vi.fn(async (fn: string) => ({ data: fn === "delivery_preparation_overview" ? overview : list, error: fn === "delivery_preparation_overview" ? { message: "denied" } : null }));
    await expect(loadDeliveryPreparationWorkspace({ rpc }, {})).resolves.toMatchObject({ status: "error" });
  });
});
