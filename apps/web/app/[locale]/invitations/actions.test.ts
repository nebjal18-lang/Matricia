import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  signInWithOtp: vi.fn(),
  rpc: vi.fn(),
  from: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/modules/shared/lib/supabase/server", () => ({
  getSupabaseServerClient: async () => ({ auth: { getUser: mocks.getUser, signInWithOtp: mocks.signInWithOtp }, rpc: mocks.rpc, from: mocks.from }),
}));
vi.mock("@/modules/shared/lib/i18n/locale", () => ({
  isLocale: (value: string) => value === "fr" || value === "ar",
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("node:crypto", () => ({ randomUUID: () => "11111111-1111-4111-8111-111111111111" }));

import {
  acceptInvitation,
  createInvitation,
  declineInvitation,
  listInvitations,
  type InvitationActionState,
} from "./actions";

const idle: InvitationActionState = { status: "idle" };
const userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const invitedUserId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const userEmail = "owner@matricia.test";
const invitedEmail = "invitee@matricia.test";
const organizationId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const invitationId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

function inviteForm(overrides: Record<string, string | string[]> = {}) {
  const values = {
    locale: "fr",
    organizationId,
    invitedEmail,
    roleCodes: ["CLIENT_MEMBER", "CLIENT_VIEWER"],
    expiryDays: "7",
    idempotencyKey: "invitation-test-key-001",
    ...overrides,
  };
  const form = new FormData();
  for (const [key, value] of Object.entries(values)) {
    if (Array.isArray(value)) value.forEach((item) => form.append(key, item));
    else form.set(key, value);
  }
  return form;
}

function decisionForm(overrides: Record<string, string> = {}) {
  const form = new FormData();
  for (const [key, value] of Object.entries({ invitationId, locale: "ar", confirmed: "yes", ...overrides })) form.set(key, value);
  return form;
}

describe("invitation mutations", () => {
  beforeEach(() => {
    vi.useRealTimers();
    mocks.getUser.mockReset();
    mocks.signInWithOtp.mockReset();
    mocks.rpc.mockReset();
    mocks.from.mockReset();
    mocks.revalidatePath.mockReset();
    mocks.getUser.mockResolvedValue({ data: { user: { id: userId, email: userEmail } }, error: null });
    mocks.signInWithOtp.mockResolvedValue({ data: {}, error: null });
    mocks.rpc.mockResolvedValue({ data: { outcome: "INVITATION_CREATED", invitation_id: invitationId }, error: null });
  });

  it.each([["create",createInvitation,inviteForm],["accept",acceptInvitation,decisionForm],["decline",declineInvitation,decisionForm]] as const)("preserves a technical Auth outage when attempting to %s an invitation",async(_name,action,form)=>{mocks.getUser.mockResolvedValue({data:{user:null},error:{status:503,name:"AuthRetryableFetchError"}});await expect(action(idle,form())).resolves.toEqual({status:"error",reason:"UNAVAILABLE"});expect(mocks.rpc).not.toHaveBeenCalled();});
  it("valide les champs et les rôles avant tout accès Auth", async () => {
    const result = await createInvitation(idle, inviteForm({ organizationId: "invalid", roleCodes: ["SUPER_ADMIN"] }));
    expect(result).toEqual({ status: "error", reason: "VALIDATION" });
    expect(mocks.getUser).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("interdit une auto-invitation sans appeler le RPC", async () => {
    await expect(createInvitation(idle, inviteForm({ invitedEmail: userEmail.toUpperCase() }))).resolves.toEqual({ status: "error", reason: "VALIDATION" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("crée une invitation multi-rôles avec une échéance calculée côté serveur", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-11T12:00:00.000Z"));
    await expect(createInvitation(idle, inviteForm())).resolves.toEqual({ status: "success" });
    expect(mocks.rpc).toHaveBeenCalledWith("invite_organization_member_by_email", {
      p_organization_id: organizationId,
      p_invited_email: invitedEmail,
      p_role_codes: ["CLIENT_MEMBER", "CLIENT_VIEWER"],
      p_expires_at: "2026-09-18T12:00:00.000Z",
      p_idempotency_key: "invitation-test-key-001",
      p_correlation_id: "11111111-1111-4111-8111-111111111111",
    });
    expect(mocks.signInWithOtp).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/fr/invitations");
  });

  it("renvoie une erreur neutre sans divulguer l’erreur SQL", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "FORBIDDEN internal detail" } });
    const result = await createInvitation(idle, inviteForm());
    expect(result).toEqual({ status: "error", reason: "UNAVAILABLE" });
    expect(JSON.stringify(result)).not.toContain("FORBIDDEN");
  });

  it.each([
    ["accept_organization_invitation", acceptInvitation],
    ["decline_organization_invitation", declineInvitation],
  ] as const)("confirme puis appelle %s avec corrélation", async (rpcName, action) => {
    await expect(action(idle, decisionForm())).resolves.toEqual({ status: "success" });
    expect(mocks.rpc).toHaveBeenCalledWith(rpcName, {
      p_invitation_id: invitationId,
      p_correlation_id: "11111111-1111-4111-8111-111111111111",
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/ar/invitations");
  });

  it("refuse une décision non confirmée avant tout accès Auth", async () => {
    await expect(acceptInvitation(idle, decisionForm({ confirmed: "no" }))).resolves.toEqual({ status: "error", reason: "VALIDATION" });
    expect(mocks.getUser).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});

describe("listInvitations", () => {
  beforeEach(() => {
    mocks.getUser.mockReset();
    mocks.from.mockReset();
    mocks.getUser.mockResolvedValue({ data: { user: { id: userId, email: userEmail } }, error: null });
  });

  it("retourne uniquement les organisations où le rôle permet d’inviter et masque l’organisation reçue non encore rejointe", async () => {
    const receivedId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
    const declinedId = "12121212-1212-4212-8212-121212121212";
    const membershipResult = { data: [{ id: "ffffffff-ffff-4fff-8fff-ffffffffffff", organization_id: organizationId }], error: null };
    const memberRolesResult = { data: [{ membership_id: "ffffffff-ffff-4fff-8fff-ffffffffffff", role_code: "CLIENT_ADMIN", revoked_at: null }], error: null };
    const organizationResult = { data: [{ id: organizationId, display_name: "Atlas Conseil" }], error: null };
    const invitationsResult = { data: [
      { id: invitationId, organization_id: organizationId, invited_user_id: invitedUserId, invited_email: invitedEmail, invited_by: userId, status: "PENDING", expires_at: "2099-09-18T12:00:00Z", created_at: "2026-09-11T12:00:00Z" },
      { id: receivedId, organization_id: "99999999-9999-4999-8999-999999999999", invited_user_id: null, invited_email: userEmail, invited_by: invitedUserId, status: "PENDING", expires_at: "2099-09-18T12:00:00Z", created_at: "2026-09-11T13:00:00Z" },
      { id: declinedId, organization_id: "99999999-9999-4999-8999-999999999999", invited_user_id: userId, invited_email: userEmail, invited_by: invitedUserId, status: "DECLINED", expires_at: "2099-09-18T12:00:00Z", created_at: "2026-09-11T14:00:00Z" },
    ], error: null };
    const invitationRolesResult = { data: [
      { invitation_id: invitationId, role_code: "CLIENT_MEMBER" },
      { invitation_id: receivedId, role_code: "PROVIDER_VIEWER" },
    ], error: null };

    mocks.from.mockImplementation((table: string) => {
      if (table === "organization_memberships") return { select: () => ({ eq: () => ({ eq: async () => membershipResult }) }) };
      if (table === "organization_member_roles") return { select: () => ({ in: async () => memberRolesResult }) };
      if (table === "organizations") return { select: () => ({ in: async () => organizationResult }) };
      if (table === "organization_invitations") return { select: () => ({ order: async () => invitationsResult }) };
      if (table === "organization_invitation_roles") return { select: () => ({ in: async () => invitationRolesResult }) };
      throw new Error(`unexpected table ${table}`);
    });

    const result = await listInvitations();
    expect(result).toEqual({
      status: "success",
      organizations: [{ id: organizationId, displayName: "Atlas Conseil" }],
      invitations: [
        { id: invitationId, organizationName: "Atlas Conseil", roles: ["CLIENT_MEMBER"], status: "PENDING", createdAt: "2026-09-11T12:00:00Z", expiresAt: "2099-09-18T12:00:00Z", direction: "MANAGED" },
        { id: receivedId, organizationName: null, roles: ["PROVIDER_VIEWER"], status: "PENDING", createdAt: "2026-09-11T13:00:00Z", expiresAt: "2099-09-18T12:00:00Z", direction: "RECEIVED" },
        { id: declinedId, organizationName: null, roles: [], status: "DECLINED", createdAt: "2026-09-11T14:00:00Z", expiresAt: "2099-09-18T12:00:00Z", direction: "RECEIVED" },
      ],
    });
  });

  it.each([{status:503,name:"AuthRetryableFetchError"},{status:500,name:"AuthApiError"},{name:"TypeError"}])("does not mistake Auth transport failure %j for a missing session",async error=>{mocks.getUser.mockResolvedValue({data:{user:null},error});await expect(listInvitations()).resolves.toEqual({status:"error",reason:"UNAVAILABLE"});expect(mocks.from).not.toHaveBeenCalled();});
  it.each([{status:401,name:"AuthApiError"},{name:"AuthSessionMissingError"}])("recognizes a known invalid session %j",async error=>{mocks.getUser.mockResolvedValue({data:{user:null},error});await expect(listInvitations()).resolves.toEqual({status:"error",reason:"UNAUTHENTICATED"});expect(mocks.from).not.toHaveBeenCalled();});
  it("ne lance aucune requête tenant si la session est absente", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(listInvitations()).resolves.toEqual({ status: "error", reason: "UNAUTHENTICATED" });
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
