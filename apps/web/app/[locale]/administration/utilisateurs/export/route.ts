import { csvDocument } from "@/modules/shared/lib/csv/export";
import { NextResponse } from "next/server";
import { matchesActorUser } from "@/modules/admin/data/spaces/actor-user-model";
import { loadAdminActorDirectory } from "@/modules/admin/data/spaces/actors-repository";
import { isLocale } from "@/modules/shared/lib/i18n/locale";

export async function GET(request: Request, { params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  const directory = await loadAdminActorDirectory(true);
  const header = locale === "ar"
    ? ["user_id","membership_id","organization_id","المؤسسة", "الأدوار", "الحالة","MFA","الجلسات المسجلة","الاسم","البريد الإلكتروني","أدوار المنصة","حالة الحساب"]
    : ["user_id","membership_id","organization_id","organization", "roles", "status","mfa_status","recorded_sessions","display_name","email","platform_roles","account_status"];
  if (directory.reason) return NextResponse.json({ error: directory.reason }, { status: directory.reason === "UNAUTHENTICATED" ? 401 : directory.reason === "FORBIDDEN" ? 403 : 503 });
  const search = new URL(request.url).searchParams;
  const users = directory.users.filter(row => matchesActorUser(row, {org: search.get("org") ?? undefined, role: search.get("role") ?? undefined, status: search.get("status") ?? undefined}, search.get("q") ?? undefined));
  const body = csvDocument([header, ...users.map((row) => [row.userId,row.membershipId??"",row.organizationId??"",row.organizationName??"",row.roles.join("|"),row.status,row.mfaStatus??"UNKNOWN",row.sessionCount??"",row.displayName??"",row.email??"",(row.platformRoles??[]).join("|"),row.accountStatus??""])]);
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="utilisateurs-${locale}.csv"`,
    },
  });
}
