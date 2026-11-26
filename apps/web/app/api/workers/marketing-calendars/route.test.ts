import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/modules/shared/lib/supabase/admin", () => ({
  getSupabaseAdminClient: () => ({ rpc: mocks.rpc }),
}));

import { GET, POST } from "./route";

const SECRET = "m".repeat(32);
const shortageResult = { outcome: "MARKETING_CALENDAR_SHORTAGES_CHECKED", detected: 0 };

function request(query = "", secret = SECRET): Request {
  return new Request(`http://localhost/api/workers/marketing-calendars${query}`, {
    method: "POST",
    headers: { authorization: `Bearer ${secret}` },
  });
}

describe("POST /api/workers/marketing-calendars", () => {
  beforeEach(() => {
    mocks.rpc.mockReset();
    process.env.CRON_SECRET = SECRET;
  });

  afterEach(() => {
    vi.useRealTimers();
    delete process.env.CRON_SECRET;
  });

  it("refuse un appel sans secret de service valide", async () => {
    const response = await POST(request("", "incorrect"));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ code: "UNAUTHORIZED" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it.each(["2026-09-13", "2026-13-01", "not-a-month"])(
    "refuse le mois invalide %s avant tout appel base",
    async (month) => {
      const response = await POST(request(`?month=${month}`));

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ code: "INVALID_MONTH" });
      expect(mocks.rpc).not.toHaveBeenCalled();
    },
  );

  it("appelle le RPC service avec le mois demandé et une corrélation", async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: {
        monthStart: "2026-10-01",
        generatedCalendars: 2,
        scheduledItems: 12,
        skippedRules: 1,
      },
      error: null,
    }).mockResolvedValueOnce({ data: shortageResult, error: null });

    const response = await POST(request("?month=2026-10-01"));

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-correlation-id")).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(mocks.rpc).toHaveBeenNthCalledWith(1, "generate_due_marketing_calendars_v1", {
      p_month_start: "2026-10-01",
      p_correlation_id: expect.any(String),
    });
    const generationCorrelation = mocks.rpc.mock.calls[0]?.[1].p_correlation_id;
    expect(mocks.rpc).toHaveBeenNthCalledWith(2, "detect_marketing_calendar_shortages_v1", {
      p_month_start: "2026-10-01",
      p_correlation_id: generationCorrelation,
    });
    expect(await response.json()).toMatchObject({ generatedCalendars: 2, scheduledItems: 12, shortages: shortageResult });
  });

  it("laisse le RPC sélectionner le mois lorsqu'il est omis", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-13T23:59:59.000Z"));
    mocks.rpc.mockResolvedValueOnce({ data: { generatedCalendars: 0 }, error: null }).mockResolvedValueOnce({ data: shortageResult, error: null });

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(mocks.rpc).toHaveBeenNthCalledWith(
      1,
      "generate_due_marketing_calendars_v1",
      expect.objectContaining({ p_month_start: null }),
    );
    expect(mocks.rpc).toHaveBeenNthCalledWith(2, "detect_marketing_calendar_shortages_v1", expect.objectContaining({ p_month_start: "2026-10-01" }));
  });

  it("expose le même contrat sécurisé au scheduler Vercel GET", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: { generatedCalendars: 1 }, error: null }).mockResolvedValueOnce({ data: shortageResult, error: null });

    const response = await GET(request());

    expect(response.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledTimes(2);
  });

  it("masque les erreurs Supabase", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "sensitive database detail" } });

    const response = await POST(request("?month=2026-10-01"));
    const body = await response.text();

    expect(response.status).toBe(503);
    expect(body).toContain("MARKETING_CALENDAR_GENERATION_FAILED");
    expect(body).not.toContain("sensitive database detail");
  });

  it("signale sans fuite une vérification de pénurie incomplète", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: { generatedCalendars: 1 }, error: null }).mockResolvedValueOnce({ data: null, error: { message: "sensitive shortage detail" } });

    const response = await POST(request("?month=2026-10-01"));
    const body = await response.text();

    expect(response.status).toBe(503);
    expect(body).toContain("MARKETING_CALENDAR_SHORTAGE_CHECK_FAILED");
    expect(body).not.toContain("sensitive shortage detail");
  });
});
