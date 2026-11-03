import type { Locale } from "@/modules/shared/lib/i18n/locale";
import type { CalendarContext, CalendarDateLabels } from "@/modules/admin/screens/catalogue-calendar/model";

/** Call only at the server boundary: browsers can carry a different timezone database. */
export function formatCalendarDateLabels(locale: Locale, context: CalendarContext): CalendarDateLabels {
    const formatter = new Intl.DateTimeFormat(locale === "ar" ? "ar-MA" : "fr-MA", {
        dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Casablanca",
    });
    return Object.fromEntries(context.conflicts.map(row => [row.releaseId, {
        from: formatter.format(new Date(row.effectiveFrom)),
        until: row.effectiveUntil ? formatter.format(new Date(row.effectiveUntil)) : null,
    }]));
}
