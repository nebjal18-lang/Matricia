import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Locale } from "@/modules/shared/lib/i18n/locale";

const mocks = vi.hoisted(() => ({ load: vi.fn(), rpc: vi.fn(), notFound: vi.fn(), redirect: vi.fn() }));
const organizationA = "22222222-2222-4222-8222-222222222222";
const organizationB = "33333333-3333-4333-8333-333333333333";
const userId = "11111111-1111-4111-8111-111111111111";
const membershipId = "44444444-4444-4444-8444-444444444444";

vi.mock("next/navigation", () => ({ notFound: mocks.notFound, redirect: mocks.redirect }));
vi.mock("@/modules/admin/data/spaces/context", () => ({
  resolveAdminSpace: async ({ organizationId }: { organizationId?: string }) => ({
    status: "success", selectedOrganizationId: organizationId ?? null,
    selectedQuery: organizationId ? `?organizationId=${organizationId}` : "", userEmail: "admin@example.test",
  }),
}));
vi.mock("@/modules/admin/data/spaces/actors-repository", () => ({ loadAdminActorUser: mocks.load }));
vi.mock("@/modules/shared/lib/supabase/server", () => ({ getSupabaseServerClient: async () => ({ rpc: mocks.rpc }) }));
vi.mock("@/modules/admin/ui/admin-app-shell", () => ({
  AdminAppShell: ({ children, locale, selectedOrganizationId }: { children: ReactNode; locale: Locale; selectedOrganizationId: string | null }) =>
    <div dir={locale === "ar" ? "rtl" : "ltr"} data-selected-organization={selectedOrganizationId}>{children}</div>,
  AdminCrumb: () => null,
}));
vi.mock("@/modules/admin/screens/spaces/actor-forms", () => ({
  EditUserRolesForm: ({ organizationId }: { organizationId: string }) => <form data-organization-target={organizationId} />,
}));
vi.mock("@/modules/admin/screens/spaces/actor-boards", () => ({ UserFicheBoard: () => <section data-user-fiche /> }));
vi.mock("@/modules/admin/screens/account-access/panel", () => ({ AccountAccessPanel: () => <form data-account-access /> }));

import UserPage from "./page";
import RolesPage from "./roles/page";

const row = (organizationId: string) => ({
  userId, membershipId, organizationId, organizationName: organizationId,
  roles: ["CLIENT_OWNER"], status: "ACTIVE", updatedAt: null, displayName: "Compte test",
});
const props = (locale: Locale, organizationId: string | undefined = organizationA) => ({
  params: Promise.resolve({ locale, userId }), searchParams: Promise.resolve({ organizationId }),
});
const render = async (page: typeof UserPage, locale: Locale) => renderToStaticMarkup(await page(props(locale)));

beforeEach(() => {
  vi.resetAllMocks();
  mocks.notFound.mockImplementation(() => { throw new Error("ACTOR_NOT_FOUND"); });
  mocks.redirect.mockImplementation((href: string) => { throw new Error(`ACTOR_REDIRECT:${href}`); });
  mocks.load.mockResolvedValue({ status: "success", rows: [row(organizationA)], fiche: null, organizations: [] });
  mocks.rpc.mockImplementation(async (name: string) => name === "get_admin_role_editor_context_v1"
    ? { data: { roles: [{ roleCode: "CLIENT_OWNER", franchiseId: null, franchiseLabel: null }], franchises: [] }, error: null }
    : { data: null, error: { code: "42501" } });
});

describe.each(["fr", "ar"] as const)("admin actor pages in %s", (locale) => {
  it.each([UserPage, RolesPage])("shows forbidden and unavailable states without a misleading 404", async (page) => {
    for (const reason of ["FORBIDDEN", "UNAVAILABLE", "INVALID_RESPONSE"] as const) {
      mocks.load.mockResolvedValue({ status: "error", reason });
      const html = await render(page, locale);
      expect(html).toContain('role="alert"');
      expect(html).toContain(locale === "ar" ? 'dir="rtl"' : 'dir="ltr"');
      expect(html).toContain(reason === "FORBIDDEN"
        ? locale === "ar" ? "الوصول غير مسموح" : "Accès non autorisé"
        : locale === "ar" ? "تعذر تحميل الحساب" : "Compte indisponible");
      expect(html).not.toContain("<form");
      expect(html).toContain(`organizationId=${organizationA}`);
      expect(mocks.notFound).not.toHaveBeenCalled();
      expect(mocks.rpc).not.toHaveBeenCalled();
    }
  });

  it("never renders a roles form or reads editing contexts for a different organization", async () => {
    mocks.load.mockResolvedValue({ status: "success", rows: [row(organizationB)], fiche: null, organizations: [] });
    await expect(render(RolesPage, locale)).rejects.toThrow("ACTOR_NOT_FOUND");
    expect(mocks.notFound).toHaveBeenCalledOnce();
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.load).toHaveBeenCalledWith(userId, organizationA);
  });

  it("renders only the requested organization form, even when another row is first", async () => {
    mocks.load.mockResolvedValue({ status: "success", rows: [row(organizationB), row(organizationA)], fiche: null, organizations: [] });
    const html = await render(RolesPage, locale);
    expect(html).toContain(`data-organization-target="${organizationA}"`);
    expect(html).not.toContain(`data-organization-target="${organizationB}"`);
    expect(mocks.rpc).toHaveBeenCalledWith("get_admin_role_editor_context_v1", { p_membership_id: membershipId });
  });

  it("requires an explicit organization choice for multiple memberships before reading or rendering any editor", async () => {
    mocks.load.mockResolvedValue({ status: "success", rows: [row(organizationB), row(organizationA), row(organizationA)], fiche: null, organizations: [] });
    const html = renderToStaticMarkup(await RolesPage({ params: Promise.resolve({ locale, userId }), searchParams: Promise.resolve({}) }));
    expect(html).toContain(locale === "ar" ? "اختر مؤسسة" : "Choisir une organisation");
    expect(html).toContain(locale === "ar" ? 'dir="rtl"' : 'dir="ltr"');
    for (const organizationId of [organizationA, organizationB]) {
      const href = `/${locale}/administration/utilisateurs/${userId}/roles?organizationId=${organizationId}`;
      expect(html.match(new RegExp(`href="${href.replaceAll("?", "\\?")}"`, "g"))).toHaveLength(1);
    }
    expect(html).not.toContain("<form");
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.notFound).not.toHaveBeenCalled();
  });

  it("continues with a single unambiguous organization when no selection is provided", async () => {
    const html = renderToStaticMarkup(await RolesPage({ params: Promise.resolve({ locale, userId }), searchParams: Promise.resolve({}) }));
    expect(html).toContain(`data-organization-target="${organizationA}"`);
    expect(html).not.toContain("actor-organization-choice");
    expect(mocks.rpc).toHaveBeenCalledWith("get_admin_role_editor_context_v1", { p_membership_id: membershipId });
    expect(mocks.rpc).toHaveBeenCalledWith("get_admin_account_access_v1", { p_user_id: userId });
  });

  it.each([UserPage, RolesPage])("reserves notFound for a successful empty lookup", async (page) => {
    mocks.load.mockResolvedValue({ status: "success", rows: [], fiche: null, organizations: [] });
    await expect(render(page, locale)).rejects.toThrow("ACTOR_NOT_FOUND");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it.each([UserPage, RolesPage])("redirects an expired session while preserving the selected organization", async (page) => {
    mocks.load.mockResolvedValue({ status: "error", reason: "UNAUTHENTICATED" });
    await expect(render(page, locale)).rejects.toThrow(`/${locale}/connexion?next=`);
    const redirectPath = mocks.redirect.mock.calls[0][0] as string;
    expect(new URL(redirectPath, "https://example.test").searchParams.get("next")).toContain(`?organizationId=${organizationA}`);
    expect(mocks.notFound).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
