import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.hoisted(() => vi.fn());
const revalidatePath = vi.hoisted(() => vi.fn());
vi.mock("@/modules/shared/lib/supabase/server", () => ({ getSupabaseServerClient: async () => ({ rpc }) }));
vi.mock("next/cache", () => ({ revalidatePath }));
import { linkMyFranchiseApplicationOrganization } from "./actions";

const idle = { status: "idle" as const };
const values = {
  locale: "fr",
  applicationId: "00000000-0000-4000-8000-000000000001",
  organizationId: "00000000-0000-4000-8000-000000000002",
  rowVersion: "3",
  idempotencyKey: "00000000-0000-4000-8000-000000000003",
};
function form(input: Record<string, string>) { const data = new FormData(); Object.entries(input).forEach(([key, value]) => data.set(key, value)); return data; }

beforeEach(() => { rpc.mockReset(); revalidatePath.mockReset(); });

describe("candidate organization link", () => {
  it("links the candidate's own organization to the dossier", async () => {
    rpc.mockResolvedValue({ data: { outcome: "FRANCHISE_APPLICATION_ORGANIZATION_LINKED" }, error: null });
    await expect(linkMyFranchiseApplicationOrganization(idle, form(values))).resolves.toEqual({ status: "success" });
    expect(rpc).toHaveBeenCalledWith("link_my_franchise_application_organization", {
      p_application_id: values.applicationId,
      p_organization_id: values.organizationId,
      p_expected_row_version: 3,
      p_idempotency_key: values.idempotencyKey,
    });
    expect(revalidatePath).toHaveBeenCalledWith("/fr/franchise/candidature");
  });

  it("rejects malformed identifiers before calling the database", async () => {
    await expect(linkMyFranchiseApplicationOrganization(idle, form({ ...values, organizationId: "x" }))).resolves.toEqual({ status: "error", reason: "VALIDATION" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it.each([["42501", "DENIED"], ["40001", "CONFLICT"], ["22023", "VALIDATION"], ["XX000", "UNAVAILABLE"]])("maps database code %s to %s", async (code, reason) => {
    rpc.mockResolvedValue({ data: null, error: { code, message: "refused" } });
    await expect(linkMyFranchiseApplicationOrganization(idle, form(values))).resolves.toEqual({ status: "error", reason });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
