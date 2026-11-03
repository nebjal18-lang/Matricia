import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";
import { classifyAuthReadFailure } from "@/modules/shared/lib/auth/read-failure";
import { nativeReportSchema } from "@/modules/franchise/data/performance/native-control";
export async function GET(_: Request, { params }: { params: Promise<{ reportId: string }> }) {
  const { reportId } = await params;
  if (!z.string().uuid().safeParse(reportId).success) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  try {
    const client = await getSupabaseServerClient();
    const { data, error } = await client.auth.getUser();
    const failure = classifyAuthReadFailure(error);
    if (failure === "UNAVAILABLE") return NextResponse.json({ error: "UNAVAILABLE" }, { status: 503 });
    if (failure || !data.user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    const result = await client.from("franchise_control_reports_v1").select("*").eq("id", reportId).maybeSingle();
    if (result.error) return NextResponse.json({ error: "UNAVAILABLE" }, { status: 503 });
    if (!result.data) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    const parsed = nativeReportSchema.safeParse(result.data);
    if (!parsed.success || parsed.data.id !== reportId) return NextResponse.json({ error: "UNAVAILABLE" }, { status: 503 });
    return new Response(JSON.stringify(parsed.data, null, 2), { headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="franchise-control-${reportId}.json"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch {
    return NextResponse.json({ error: "UNAVAILABLE" }, { status: 503 });
  }
}
