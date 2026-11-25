import { csvDocument } from "@/modules/shared/lib/csv/export";
import { NextResponse } from "next/server";
import { isAdminDirectoryFixture } from "@/modules/admin/data/spaces/actor-presentation";
import { groupActorAccounts, matchesActorUser } from "@/modules/admin/data/spaces/actor-user-model";
import { loadAdminActorDirectory } from "@/modules/admin/data/spaces/actors-repository";
import { isLocale } from "@/modules/shared/lib/i18n/locale";

export async function GET(request: Request, { params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  const directory = await loadAdminActorDirectory(true);
  const header = locale === "ar"
    ? ["user_id", "الاسم", "الاسم العائلي", "الاسم المعروض", "البريد الإلكتروني", "الهاتف", "اللغة", "المؤسسات", "أدوار المؤسسة", "أدوار المنصة", "حالة الحساب", "MFA", "الجلسات"]
    : ["user_id", "given_name", "family_name", "display_name", "email", "phone", "preferred_locale", "organizations", "organization_roles", "platform_roles", "account_status", "mfa_status", "recorded_sessions"];
  if (directory.reason) return NextResponse.json({ error: directory.reason }, { status: directory.reason === "UNAUTHENTICATED" ? 401 : directory.reason === "FORBIDDEN" ? 403 : 503 });
  const search = new URL(request.url).searchParams;
  const includeFixtures = search.get("fixtures") === "1" || search.get("fixtures") === "true";
  const filtered = directory.users.filter((row) => {
    if (!includeFixtures && isAdminDirectoryFixture(row)) return false;
    return matchesActorUser(row, {
      org: search.get("org") ?? undefined,
      role: search.get("role") ?? undefined,
      status: search.get("status") ?? undefined,
    }, search.get("q") ?? undefined);
  });
  const accounts = groupActorAccounts(filtered);
  const body = csvDocument([header, ...accounts.map((account) => [
    account.userId,
    account.givenName ?? "",
    account.familyName ?? "",
    account.displayName ?? "",
    account.email ?? "",
    account.phone ?? "",
    account.preferredLocale ?? "",
    account.memberships.map((item) => item.organizationName ?? "").filter(Boolean).join("|"),
    [...new Set(account.memberships.flatMap((item) => item.roles))].join("|"),
    account.platformRoles.join("|"),
    account.accountStatus ?? "",
    account.mfaStatus ?? "UNKNOWN",
    account.sessionCount ?? "",
  ])]);
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="utilisateurs-${locale}.csv"`,
    },
  });
}
