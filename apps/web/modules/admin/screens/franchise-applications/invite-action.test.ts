import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.hoisted(() => vi.fn());
const deliverNotification = vi.hoisted(() => vi.fn());
vi.mock("@/modules/shared/lib/supabase/server", () => ({
  getSupabaseServerClient: async () => ({ rpc }),
}));
vi.mock("@/modules/shared/lib/notification-delivery/adapter", () => ({ deliverNotification }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { openFranchiseApplicationInvite } from "./invite-action";

const idle = { status: "idle" as const };
const applicationId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const idempotencyKey = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function form(input: Record<string, string>) {
  const data = new FormData();
  Object.entries(input).forEach(([key, value]) => data.set(key, value));
  return data;
}

const base = {
  locale: "fr",
  applicantName: "Candidat Invite",
  replyEmail: "invitee@example.invalid",
  territoryCode: "CASABLANCA_SETTAT",
  domainLabel: "IT — Informatique",
  reason: "Ouverture manuelle pour le territoire",
  idempotencyKey,
};

beforeEach(() => {
  rpc.mockReset();
  deliverNotification.mockReset();
  deliverNotification.mockResolvedValue({ outcome: "SENT" });
});

describe("openFranchiseApplicationInvite", () => {
  it("opens a REGISTERED dossier and mails the candidate", async () => {
    rpc.mockResolvedValue({ data: { application_id: applicationId, status: "REGISTERED", replayed: false }, error: null });
    await expect(openFranchiseApplicationInvite(idle, form(base))).resolves.toEqual({
      status: "success",
      reference: "AAAAAAAA",
      mailed: true,
      replayed: false,
    });
    expect(rpc).toHaveBeenCalledWith("open_franchise_application_invite_v1", expect.objectContaining({
      p_reply_email: "invitee@example.invalid",
      p_territory_code: "CASABLANCA_SETTAT",
      p_idempotency_key: idempotencyKey,
    }));
    expect(deliverNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientEmail: "invitee@example.invalid",
        ctaPath: "/fr/franchise/candidature",
      }),
      expect.any(Object),
    );
  });

  it("skips mail on idempotent replay", async () => {
    rpc.mockResolvedValue({ data: { application_id: applicationId, status: "REGISTERED", replayed: true }, error: null });
    await expect(openFranchiseApplicationInvite(idle, form(base))).resolves.toEqual({
      status: "success",
      reference: "AAAAAAAA",
      mailed: false,
      replayed: true,
    });
    expect(deliverNotification).not.toHaveBeenCalled();
  });

  it("maps MFA and denial errors", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "FRANCHISE_APPLICATION_INVITE_MFA_REQUIRED" } });
    await expect(openFranchiseApplicationInvite(idle, form(base))).resolves.toEqual({ status: "error", reason: "MFA_REQUIRED" });
    rpc.mockResolvedValue({ data: null, error: { message: "FRANCHISE_APPLICATION_INVITE_DENIED" } });
    await expect(openFranchiseApplicationInvite(idle, form(base))).resolves.toEqual({ status: "error", reason: "DENIED" });
  });

  it("rejects invalid form data before RPC", async () => {
    await expect(openFranchiseApplicationInvite(idle, form({ ...base, replyEmail: "bad" }))).resolves.toEqual({ status: "error", reason: "VALIDATION" });
    expect(rpc).not.toHaveBeenCalled();
  });
});
