import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.hoisted(() => vi.fn());
const deliverNotification = vi.hoisted(() => vi.fn());
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers({ "x-forwarded-for": "203.0.113.10" })) }));
vi.mock("@/modules/shared/lib/supabase/admin", () => ({ getSupabaseAdminClient: () => ({ rpc }) }));
vi.mock("@/modules/shared/lib/notification-delivery/adapter", () => ({ deliverNotification }));
import { submitFranchiseApplication } from "../../app/[locale]/(public)/franchise/actions";

const applicationId = "12345678-1234-4000-8000-123456789abc";
function form() {
  const data = new FormData();
  Object.entries({
    locale: "fr",
    displayName: "Hatim Candidat",
    replyEmail: "candidat@example.invalid",
    zone: "CASABLANCA_SETTAT",
    profile: "Dirigeant",
    domain: "IT — Informatique",
    availability: "Immédiate",
    motivation: "Je présente une expérience professionnelle suffisante pour ce territoire.",
    website: "",
  }).forEach(([key, value]) => data.set(key, value));
  return data;
}

beforeEach(() => {
  rpc.mockReset();
  deliverNotification.mockReset();
  delete process.env.PUBLIC_CONTACT_NOTIFICATION_EMAIL;
});

describe("franchise candidature", () => {
  it("opens a registered dossier and emails the candidate the reference", async () => {
    rpc.mockResolvedValue({ data: applicationId, error: null });
    deliverNotification.mockResolvedValue({ outcome: "SENT", providerMessageId: "message-1", evidence: { adapter: "EMAIL_RESEND" } });
    await expect(submitFranchiseApplication({ status: "idle" }, form())).resolves.toEqual({ status: "success", reference: "12345678", mailed: true });
    expect(rpc).toHaveBeenCalledWith("submit_franchise_application", expect.objectContaining({ p_territory_code: "CASABLANCA_SETTAT", p_reply_email: "candidat@example.invalid" }));
    expect(deliverNotification).toHaveBeenCalledWith(expect.objectContaining({ recipientEmail: "candidat@example.invalid", deliveryId: applicationId }), expect.any(Object));
  });

  it("keeps the on-screen reference when the candidate email cannot leave", async () => {
    rpc.mockResolvedValue({ data: applicationId, error: null });
    deliverNotification.mockResolvedValue({ outcome: "RETRYABLE_FAILURE", errorCode: "EMAIL_PROVIDER_UNAVAILABLE", evidence: { adapter: "EMAIL_RESEND" } });
    await expect(submitFranchiseApplication({ status: "idle" }, form())).resolves.toEqual({ status: "success", reference: "12345678", mailed: false });
  });
});
