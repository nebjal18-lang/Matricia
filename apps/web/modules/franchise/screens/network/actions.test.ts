import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn() }));
vi.mock("@/modules/franchise/data/network/invitation-token", () => ({ networkInvitationId: () => "33333333-3333-4333-8333-333333333333", networkInvitationToken: () => "a".repeat(43), networkInvitationTokenHash: () => "b".repeat(64) }));
vi.mock("@/modules/shared/lib/supabase/server", () => ({ getSupabaseServerClient: async () => ({ auth: { getUser: mocks.getUser }, rpc: mocks.rpc }) }));
vi.mock("@/modules/shared/lib/i18n/locale", () => ({ isLocale: (value: string) => value === "fr" || value === "ar" }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { importFranchiseProviders, inviteFranchiseProvider, recordFranchiseFolderActivity, advanceFranchiseFolderPipeline, type FranchiseInviteState } from "./actions";

const idle: FranchiseInviteState = { status: "idle" };
const id = "11111111-1111-4111-8111-111111111111";
const key = "22222222-2222-4222-8222-222222222222";

function form() {
  const value = new FormData();
  value.set("locale", "fr");
  value.set("franchiseId", id);
  value.set("territoryVersionId", id);
  value.set("ownerUserId", id);
  value.set("idempotencyKey", key);
  value.set("contactPermissionConfirmed", "yes");
  value.set("invitationLocale", "fr");
  return value;
}

beforeEach(() => {
  mocks.getUser.mockReset().mockResolvedValue({ data: { user: { id } } });
  mocks.rpc.mockReset().mockResolvedValue({ data: { outcome: "FRANCHISE_NETWORK_INVITATIONS_QUEUED", created: 1, skipped: 0, delivery: "OUTBOX_PENDING" }, error: null });
});

describe("franchise provider invitations", () => {
  it("demande un envoi PROVIDER atomique sans déclarer qu’un email a été envoyé", async () => {
    const value = form();
    value.set("displayName", "Studio Atlas");
    value.set("contactEmail", "atlas@example.invalid");
    value.set("organizationName", "Atlas");
    value.set("sourceCode", "INVITE");
    const result = await inviteFranchiseProvider(idle, value);
    expect(result.status).toBe("success");
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("queue_franchise_network_invitations_v1", expect.objectContaining({
      p_prospect_type: "PROVIDER", p_contact_permission_confirmed: true,
      p_rows: [expect.objectContaining({ display_name: "Studio Atlas", contact_email: "atlas@example.invalid", source_code: "INVITE", locale: "fr", token_hash: "b".repeat(64) })],
    }));
    expect(JSON.stringify(mocks.rpc.mock.calls)).not.toContain("a".repeat(43));
  });

  it("importe un CSV dans le périmètre du mandat", async () => {
    const value = form();
    value.set("csvText", "nom,courriel,organisation\nStudio Atlas,atlas@example.invalid,Atlas");
    const result = await importFranchiseProviders(idle, value);
    expect(result.status).toBe("success");
    if (result.status === "success") expect(result.created).toBe(1);
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("queue_franchise_network_invitations_v1", expect.objectContaining({
      p_prospect_type: "PROVIDER", p_idempotency_key: key, p_rows: [expect.objectContaining({ source_code: "CSV_IMPORT" })],
    }));
  });

  it("demande une invitation CLIENT sans ajouter de membre dans l’organisation opératrice", async () => {
    const value = form();
    value.set("displayName", "Conseil stratégique");
    value.set("contactEmail", "client@example.invalid");
    value.set("organizationName", "Conseil");
    value.set("sourceCode", "INVITE");
    value.set("prospectType", "CLIENT");
    const result = await inviteFranchiseProvider(idle, value);
    expect(result.status).toBe("success");
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("queue_franchise_network_invitations_v1", expect.objectContaining({
      p_prospect_type: "CLIENT", p_rows: [expect.objectContaining({ display_name: "Conseil stratégique" })],
    }));
  });

  it("refuse de contacter sans confirmation et distingue MFA et panne Auth", async () => {
    const value = form(); value.set("displayName", "TEST réseau"); value.set("contactEmail", "test@example.invalid");
    value.delete("contactPermissionConfirmed");
    await expect(inviteFranchiseProvider(idle, value)).resolves.toEqual({ status: "error", reason: "VALIDATION" });
    expect(mocks.rpc).not.toHaveBeenCalled();
    value.set("contactPermissionConfirmed", "yes");
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "FRANCHISE_NETWORK_MFA_REQUIRED" } });
    await expect(inviteFranchiseProvider(idle, value)).resolves.toEqual({ status: "error", reason: "MFA_REQUIRED" });
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: { status: 503 } });
    await expect(inviteFranchiseProvider(idle, value)).resolves.toEqual({ status: "error", reason: "FAILED" });
  });

  it("garde la même commande et les mêmes identifiants lors d’un rejeu CSV et expose les doublons", async () => {
    const value = form(); value.set("csvText", "nom,courriel,organisation\nStudio Atlas,atlas@example.invalid,Atlas");
    mocks.rpc.mockResolvedValue({ data: { outcome: "FRANCHISE_NETWORK_INVITATIONS_QUEUED", created: 0, skipped: 1, delivery: "OUTBOX_PENDING" }, error: null });
    const result = await importFranchiseProviders(idle, value); await importFranchiseProviders(idle, value);
    expect(result).toEqual({ status: "success", outcome: "FRANCHISE_NETWORK_INVITATIONS_QUEUED", created: 0, skipped: 1 });
    expect(mocks.rpc.mock.calls[0]).toEqual(mocks.rpc.mock.calls[1]);
  });

  it("consigne une activité de dossier et avance le pipeline du mandat", async () => {
    mocks.rpc.mockResolvedValue({ data: { outcome: "FRANCHISE_ACTIVITY_RECORDED", prospect_id: id }, error: null });
    const activity = form();
    activity.set("prospectId", id);
    activity.set("activityType", "NOTE");
    activity.set("occurredAt", "2026-09-21T10:00:00.000Z");
    activity.set("summary", "Pièce reçue");
    activity.set("evidenceReference", "doc://rc");
    const recorded = await recordFranchiseFolderActivity(idle, activity);
    expect(recorded.status).toBe("success");
    expect(mocks.rpc).toHaveBeenCalledWith("record_franchise_activity", expect.objectContaining({
      p_prospect_id: id,
      p_activity_type: "NOTE",
      p_evidence_refs: [{ reference: "doc://rc" }],
    }));
    mocks.rpc.mockResolvedValue({ data: { outcome: "PIPELINE_ADVANCED", prospect_id: id }, error: null });
    const pipeline = form();
    pipeline.set("prospectId", id);
    pipeline.set("toStage", "OPENED");
    pipeline.set("reasonCode", "CONTACT_CONFIRMED");
    pipeline.set("rowVersion", "2");
    const advanced = await advanceFranchiseFolderPipeline(idle, pipeline);
    expect(advanced.status).toBe("success");
    expect(mocks.rpc).toHaveBeenCalledWith("advance_franchise_pipeline", expect.objectContaining({
      p_to_stage: "OPENED",
      p_expected_row_version: 2,
    }));
  });
});
