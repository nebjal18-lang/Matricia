import{dataColumns}from"@/modules/admin/data/spaces/layout-blueprint";
import { csvDocument } from "@/modules/shared/lib/csv/export";
import { filterAdminRows } from "@/modules/admin/data/spaces/filters";
import { NextResponse } from "next/server";
import { isAdminSpaceId } from "@/modules/admin/data/spaces/admin-nav";
import { spaceSpec } from "@/modules/admin/data/spaces/screen-catalog";
import { loadAdminSpaceSnapshot } from "@/modules/admin/data/spaces/space-data";
import { isLocale } from "@/modules/shared/lib/i18n/locale";

export async function GET(request: Request, { params }: { params: Promise<{ locale: string; space: string }> }) {
  const { locale, space } = await params;
  if (!isLocale(locale) || !isAdminSpaceId(space)) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  const search = new URL(request.url).searchParams;
  const query = search.toString();
  const snapshot = await loadAdminSpaceSnapshot(locale, space, query ? `?${query}` : "",true);
  if (snapshot.reason === "UNAUTHENTICATED") return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  if (snapshot.reason === "FORBIDDEN") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const spec = spaceSpec(space);
  const header = dataColumns(spec.columns(locale));
  if (snapshot.reason && snapshot.reason !== "OK") return NextResponse.json({ error: snapshot.reason }, { status: snapshot.reason === "MFA_REQUIRED" ? 403 : 503 });
  const rows = filterAdminRows(snapshot.rows, space, search.get("vue") ?? undefined, search.get("q") ?? undefined);
  const body = csvDocument([["id", ...header], ...rows.map((row) => [row.id, ...row.cells])]);
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="${space}-${locale}.csv"`,
    },
  });
}
