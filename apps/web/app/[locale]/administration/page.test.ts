import { beforeEach, describe, expect, it, vi } from "vitest";

const redirect = vi.hoisted(() => vi.fn((path: string) => {
  throw new Error(`REDIRECT:${path}`);
}));
const notFound = vi.hoisted(() => vi.fn(() => {
  throw new Error("NOT_FOUND");
}));

vi.mock("next/navigation", () => ({ redirect, notFound }));
vi.mock("@/modules/shared/lib/i18n/locale", () => ({
  isLocale: (value: string) => value === "fr" || value === "ar",
}));

import AdministrationIndexPage from "./page";

describe("administration index", () => {
  beforeEach(() => {
    redirect.mockClear();
    notFound.mockClear();
  });

  it("renvoie vers le command center en conservant le contexte organisation", async () => {
    await expect(
      AdministrationIndexPage({
        params: Promise.resolve({ locale: "fr" }),
        searchParams: Promise.resolve({ organizationId: "11111111-1111-4111-8111-111111111111" }),
      }),
    ).rejects.toThrow("REDIRECT:/fr/administration/command-center?organizationId=11111111-1111-4111-8111-111111111111");
  });

  it("refuse une locale invalide", async () => {
    await expect(
      AdministrationIndexPage({
        params: Promise.resolve({ locale: "en" }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow("NOT_FOUND");
  });
});
