import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpc, from, getUser } = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn(), getUser: vi.fn() }));
vi.mock("@/modules/shared/lib/supabase/server", () => ({
  getSupabaseServerClient: async () => ({ rpc, from, auth: { getUser } }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { discoverPublicNeedScope, savePublicNeedIntake } from "./actions";

const organizationId = "00000000-0000-4000-8000-000000000001";
const intakeId = "00000000-0000-4000-8000-000000000002";
const serviceVersionId = "00000000-0000-4000-8000-000000000003";
const serviceId = "00000000-0000-4000-8000-000000000004";
const libraryId = "00000000-0000-4000-8000-000000000005";
const questionId = "00000000-0000-4000-8000-000000000006";

function form(payload: unknown = { need: "Sécuriser le réseau du bureau", location: "Casablanca", timing: "Ce trimestre", constraints: "Accès en soirée" }) {
  const data = new FormData();
  data.set("locale", "fr");
  data.set("organizationId", organizationId);
  data.set("payload", JSON.stringify(payload));
  return data;
}

function query(data: unknown) {
  const result = { data, error: null };
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  for (const method of ["select", "in", "eq", "gt", "order", "limit"]) chain[method] = self;
  chain.then = (resolve: (value: typeof result) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve(result).then(resolve, reject);
  return chain;
}

describe("savePublicNeedIntake", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockResolvedValue({ data: { user: { id: organizationId } } });
    from.mockImplementation(() => query([]));
  });

  it("rejects invalid input before the RPC", async () => {
    await expect(savePublicNeedIntake({ status: "idle" }, form({ need: "court", location: "", timing: "", constraints: "" }))).resolves.toEqual({ status: "error", reason: "VALIDATION" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("persists through the guarded RPC", async () => {
    rpc.mockResolvedValue({ data: { outcome: "PUBLIC_NEED_INTAKE_SAVED", intake_id: intakeId, status: "DRAFT_REVIEW" }, error: null });
    await expect(savePublicNeedIntake({ status: "idle" }, form())).resolves.toEqual({ status: "success", intakeId });
    expect(rpc).toHaveBeenCalledWith("save_public_need_intake", expect.objectContaining({ p_organization_id: organizationId, p_locale: "fr", p_idempotency_key: expect.stringMatching(/^[0-9a-f]{64}$/u) }));
  });

  it("revalidates and snapshots a canonical structured classification", async () => {
    const { revalidatePath } = await import("next/cache");
    rpc.mockResolvedValue({ data: { outcome: "PUBLIC_NEED_INTAKE_SAVED", intake_id: intakeId, status: "DRAFT_REVIEW" }, error: null });
    await savePublicNeedIntake({ status: "idle" }, form({ need: "Sécuriser le réseau du bureau", location: "", timing: "", constraints: "", classification: { libraryCode: "IT", serviceCode: "IT-AUDIT-SI" } }));
    expect(rpc).toHaveBeenCalledWith("save_public_need_intake", expect.objectContaining({ p_payload: expect.objectContaining({ constraints: expect.stringContaining("IT-AUDIT-SI") }) }));
    expect(revalidatePath).toHaveBeenCalledWith("/fr/client/demandes");
  });

  it("rejects a forged or cross-library classification", async () => {
    await expect(savePublicNeedIntake({ status: "idle" }, form({ need: "Sécuriser le réseau du bureau", location: "", timing: "", constraints: "", classification: { libraryCode: "LEGAL", serviceCode: "IT-AUDIT-SI" } }))).resolves.toEqual({ status: "error", reason: "VALIDATION" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects an overlong constraint plus classification instead of silently truncating", async () => {
    await expect(savePublicNeedIntake({ status: "idle" }, form({
      need: "Sécuriser le réseau du bureau",
      location: "",
      timing: "",
      constraints: "C".repeat(1200),
      classification: { libraryCode: "IT", serviceCode: "IT-AUDIT-SI" },
    }))).resolves.toEqual({ status: "error", reason: "VALIDATION" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("maps a tenant denial without exposing details", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "42501" } });
    await expect(savePublicNeedIntake({ status: "idle" }, form())).resolves.toEqual({ status: "error", reason: "FORBIDDEN" });
  });
});

describe("discoverPublicNeedScope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockResolvedValue({ data: { user: { id: organizationId } } });
    from.mockImplementation((table: string) => {
      if (table === "catalog_service_versions") {
        return query([{ id: serviceVersionId, service_id: serviceId, library_id: libraryId, name_fr: "Audit du système d’information et feuille de route", name_ar: "تدقيق نظام المعلومات", code: "IT-AUDIT-SI" }]);
      }
      if (table === "catalog_libraries") return query([{ id: libraryId, code: "IT" }]);
      if (table === "question_versions") {
        return query([{
          id: questionId,
          source_service_id: serviceId,
          label_fr: "Combien de sites sont concernés ?",
          label_ar: "كم عدد المواقع المعنية؟",
          help_fr: "Indiquez le nombre de sites.",
          help_ar: null,
          data_key: "site.count",
          required_for_quote: true,
          answer_type: "INTEGER",
          options: [],
        }]);
      }
      if (table === "prefill_fact_versions") {
        return query([{ data_key: "site.city", value: "Casablanca", source_type: "ORGANIZATION", observed_at: "2026-09-01T00:00:00.000Z", fresh_until: "2027-01-01T00:00:00.000Z" }]);
      }
      return query([]);
    });
    rpc.mockResolvedValue({
      data: {
        outcome: "ASSISTANCE_SCOPE_DISCOVERED",
        algorithm: "TOKEN_OVERLAP_V1",
        service_candidates: [{ service_version_id: serviceVersionId, service_id: serviceId, score_basis_points: 7500 }],
        question_candidates: [{ question_version_id: questionId, service_id: serviceId, required_for_quote: true, score_basis_points: 10_000 }],
        human_confirmation_required: true,
      },
      error: null,
    });
  });

  it("rejects a too short need before discovery", async () => {
    await expect(discoverPublicNeedScope({ locale: "fr", organizationId, inputText: "court" })).resolves.toEqual({ status: "error", reason: "VALIDATION" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("returns labeled candidates without creating a need or analysis", async () => {
    const result = await discoverPublicNeedScope({ locale: "fr", organizationId, inputText: "Audit du système d’information interne" });
    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    expect(result.value.humanConfirmationRequired).toBe(true);
    expect(result.value.algorithm).toBe("TOKEN_OVERLAP_V1");
    expect(result.value.services[0]).toMatchObject({ serviceCode: "IT-AUDIT-SI", libraryCode: "IT", scoreBasisPoints: 7500 });
    expect(result.value.questions[0]).toMatchObject({ dataKey: "site.count", requiredForQuote: true });
    expect(result.value.locationPrefill).toBe("Casablanca");
    expect(rpc).toHaveBeenCalledWith("discover_assistance_scope", expect.objectContaining({ p_organization_id: organizationId, p_limit: 20 }));
    expect(rpc.mock.calls.some((call) => call[0] === "run_assisted_analysis")).toBe(false);
    expect(rpc.mock.calls.some((call) => call[0] === "save_public_need_intake")).toBe(false);
  });

  it("maps a tenant denial without exposing details", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "42501" } });
    await expect(discoverPublicNeedScope({ locale: "fr", organizationId, inputText: "Audit du système d’information interne" })).resolves.toEqual({ status: "error", reason: "FORBIDDEN" });
  });
});
