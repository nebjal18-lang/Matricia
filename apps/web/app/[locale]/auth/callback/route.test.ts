import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ exchange: vi.fn() }));
vi.mock("@/modules/shared/lib/supabase/server", () => ({
  getSupabaseServerClient: async () => ({ auth: { exchangeCodeForSession: mocks.exchange } }),
}));

import { GET } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.exchange.mockResolvedValue({ error: null });
});

describe("auth callback", () => {
  it("uses safeReturnPath for a successful exchange", async () => {
    const request = new NextRequest("https://matricia.example/fr/auth/callback?code=abc&next=%2Ffr%2Fclient%2Fdemandes");
    const response = await GET(request, { params: Promise.resolve({ locale: "fr" }) });
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://matricia.example/fr/client/demandes");
  });

  it("rejects an external next and falls back to the dashboard", async () => {
    const request = new NextRequest("https://matricia.example/fr/auth/callback?code=abc&next=https%3A%2F%2Fevil.invalid");
    const response = await GET(request, { params: Promise.resolve({ locale: "fr" }) });
    expect(response.headers.get("location")).toBe("https://matricia.example/fr/tableau-de-bord");
  });

  it("preserves next on exchange failure", async () => {
    mocks.exchange.mockResolvedValue({ error: { message: "failed" } });
    const request = new NextRequest("https://matricia.example/ar/auth/callback?code=abc&next=%2Far%2Ffranchise%2Faccueil");
    const response = await GET(request, { params: Promise.resolve({ locale: "ar" }) });
    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/ar/connexion");
    expect(location.searchParams.get("next")).toBe("/ar/franchise/accueil");
  });
});
