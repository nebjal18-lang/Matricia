import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  rpc: vi.fn(),
  download: vi.fn(),
}));

vi.mock("@/modules/shared/lib/supabase/server", () => ({
  getSupabaseServerClient: async () => ({ auth: { getUser: mocks.getUser }, rpc: mocks.rpc }),
}));
vi.mock("@/modules/shared/lib/supabase/admin", () => ({
  getSupabaseAdminClient: () => ({ storage: { from: () => ({ download: mocks.download }) } }),
}));

import { GET } from "./route";

const requestId = "11111111-1111-4111-8111-111111111111";
const documentId = "22222222-2222-4222-8222-222222222222";
const pdf = "%PDF-1.4 authorized-pack";

function grant(overrides: Record<string, unknown> = {}) {
  return {
    outcome: "CLIENT_DOCUMENT_AUTHORIZED",
    document_id: documentId,
    bucket: "client-compliance",
    object_path: `${requestId.replace(/-/gu, "")}/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/pack.pdf`,
    file_name: "cahier-des-charges.pdf",
    mime_type: "application/pdf",
    size_bytes: Buffer.byteLength(pdf),
    ...overrides,
  };
}

function request() {
  return new Request(`https://app.example.test/api/client/assistance/${requestId}/documents/${documentId}`);
}

function params(request = requestId, document = documentId) {
  return { params: Promise.resolve({ requestId: request, documentId: document }) };
}

describe("GET consultation document download", () => {
  beforeEach(() => {
    mocks.getUser.mockReset().mockResolvedValue({ data: { user: { id: "33333333-3333-4333-8333-333333333333" } } });
    mocks.rpc.mockReset().mockResolvedValue({ data: grant(), error: null });
    mocks.download.mockReset().mockResolvedValue({ data: new Blob([pdf]), error: null });
  });

  it("refuse un identifiant invalide sans appeler le stockage", async () => {
    const response = await GET(request(), params("not-a-uuid", documentId));
    expect(response.status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.download).not.toHaveBeenCalled();
  });

  it("refuse un visiteur non authentifié", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    const response = await GET(request(), params());
    expect(response.status).toBe(401);
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.download).not.toHaveBeenCalled();
  });

  it("n’ouvre pas le stockage si l’autorisation est refusée", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "CLIENT_DOCUMENT_DENIED" } });
    const response = await GET(request(), params());
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ code: "CLIENT_DOCUMENT_DENIED" });
    expect(mocks.download).not.toHaveBeenCalled();
  });

  it("ne révèle pas le détail Storage en cas d’échec", async () => {
    mocks.download.mockResolvedValue({ data: null, error: { message: "bucket secret" } });
    const response = await GET(request(), params());
    const body = JSON.stringify(await response.json());
    expect(response.status).toBe(503);
    expect(body).not.toContain("bucket secret");
    expect(body).not.toContain("object_path");
  });

  it("télécharge la pièce après autorisation serveur", async () => {
    const response = await GET(request(), params());
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toContain("cahier-des-charges.pdf");
    expect(await response.text()).toBe(pdf);
    expect(mocks.rpc).toHaveBeenCalledWith("authorize_client_assistance_document", {
      p_request_id: requestId,
      p_document_id: documentId,
    });
    expect(mocks.download).toHaveBeenCalledTimes(1);
  });
});
