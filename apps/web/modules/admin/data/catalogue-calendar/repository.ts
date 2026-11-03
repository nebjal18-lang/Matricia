import { z } from "zod";
import { unstable_rethrow } from "next/navigation";
import { loadMyPlatformAccess, hasPlatformRole, type PlatformAccess } from "@/modules/shared/lib/account-security/platform-access";
import { calendarRoles, calendarContextSchema, calendarRpcFailure, type CalendarContext, type CalendarFailure } from "@/modules/admin/screens/catalogue-calendar/model";
const querySchema = z.object({ libraryId: z.string().uuid().optional(), page: z.coerce.number().int().min(1).max(10000).default(1) });
export type CalendarResult = {
    status: "success";
    value: CalendarContext;
} | {
    status: "error";
    reason: CalendarFailure;
};
export async function loadCatalogCalendar(input: unknown, verifiedAccess?: Extract<PlatformAccess, {
    status: "ok";
}>): Promise<CalendarResult> {
    const query = querySchema.safeParse(input);
    if (!query.success)
        return { status: "error", reason: "VALIDATION" };
    try {
        const access = verifiedAccess ?? await loadMyPlatformAccess();
        if (access.status === "error")
            return access;
        if (!hasPlatformRole(access.roles, calendarRoles))
            return { status: "error", reason: "FORBIDDEN" };
        if (!access.requirementSatisfied)
            return { status: "error", reason: "MFA_REQUIRED" };
        const result = await access.client.rpc("get_catalog_release_window_context_v1", { p_library_id: query.data.libraryId ?? null, p_page: query.data.page });
        if (result.error)
            return { status: "error", reason: calendarRpcFailure(result.error) };
        const parsed = calendarContextSchema.safeParse(result.data);
        if (!parsed.success || parsed.data.page !== query.data.page)
            return { status: "error", reason: "INVALID_RESPONSE" };
        const data = parsed.data;
        if (new Set(data.conflicts.map(row => row.releaseId)).size !== data.conflicts.length || new Set(data.requests.map(row => row.id)).size !== data.requests.length || query.data.libraryId && [...data.conflicts, ...data.requests].some(row => row.libraryId !== query.data.libraryId))
            return { status: "error", reason: "INVALID_RESPONSE" };
        return { status: "success", value: data };
    }
    catch (error) {
        unstable_rethrow(error);
        return { status: "error", reason: "QUERY_FAILED" };
    }
}
