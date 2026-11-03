import Link from "next/link";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import {
  eventHourLabel,
  eventsForDay,
  isAllDayEvent,
  planningKindLabel,
  type PlanningEvent,
  type PlanningKind,
} from "@/modules/provider/data/planning/events";

const tones: Record<PlanningKind, "peach" | "violet" | "mint" | "sky"> = {
  consultation: "peach",
  quote: "violet",
  milestone: "mint",
  document: "sky",
  invoice: "peach",
  renewal:"sky",
};

export function PlanningWeekBoard({
  locale,
  events,
  days,
  today,
  prevHref,
  nextHref,
  todayHref,
}: {
  locale: Locale;
  events: readonly PlanningEvent[];
  days: readonly string[];
  today: string;
  prevHref: string;
  nextHref: string;
  todayHref: string;
}) {
  const ar = locale === "ar";
  const range = new Intl.DateTimeFormat(ar ? "ar-MA" : "fr-MA", { day: "numeric", month: "long", year: "numeric" });
  const weekday = new Intl.DateTimeFormat(ar ? "ar-MA" : "fr-MA", { weekday: "long", day: "numeric", month: "short" });
  const first = days[0]!;
  const last = days[6]!;
  const weekEvents = days.flatMap((day) => eventsForDay(events, day));

  return (
    <main className="client-page provider-planning">
      <div className="provider-planning-toolbar client-card">
        <p className="provider-planning-range">
          <strong>{range.format(new Date(`${first}T12:00:00.000Z`))}</strong>
          <span aria-hidden> – </span>
          <strong>{range.format(new Date(`${last}T12:00:00.000Z`))}</strong>
        </p>
        <nav className="provider-planning-nav" aria-label={ar ? "أسبوع" : "Semaine"}>
          <Link href={prevHref} className="client-ghost-link">{ar ? "السابق" : "Semaine précédente"}</Link>
          <Link href={todayHref} className="client-cta">{ar ? "اليوم" : "Aujourd’hui"}</Link>
          <Link href={nextHref} className="client-ghost-link">{ar ? "التالي" : "Semaine suivante"}</Link>
        </nav>
        <p className="client-access-note">{ar ? "التوقيت: إفريقيا/الدار البيضاء" : "Fuseau horaire : Afrique/Casablanca"}</p>
      </div>
      <ul className="provider-planning-legend" aria-label={ar ? "أنواع المواعيد" : "Types d’échéances"}>
        {(["consultation", "quote", "milestone", "document", "invoice", "renewal"] as const).map((kind) => (
          <li key={kind}><span className="client-status-chip" data-tone={tones[kind]}>{planningKindLabel(locale, kind)}</span></li>
        ))}
      </ul>
      {weekEvents.length === 0 ? (
        <p className="client-card" role="status">{ar ? "لا مواعيد في هذا الأسبوع." : "Aucune échéance sur cette semaine."}</p>
      ) : null}
      <section className="provider-planning-week" aria-label={ar ? "تخطيط الأسبوع" : "Planning de la semaine"}>
        {days.map((day) => {
          const dayEvents = eventsForDay(events, day);
          return (
            <article key={day} className="client-card provider-planning-day" data-today={day === today ? "true" : "false"}>
              <header>
                <h2>{weekday.format(new Date(`${day}T12:00:00.000Z`))}</h2>
                <p>{dayEvents.length === 0 ? (ar ? "لا حدث" : "Aucun événement") : ar ? `${dayEvents.length} أحداث` : `${dayEvents.length} événement${dayEvents.length > 1 ? "s" : ""}`}</p>
              </header>
              <ul className="client-feed">
                {dayEvents.map((event) => (
                  <li key={event.id}>
                    <span className="client-status-chip" data-tone={tones[event.kind]}>{event.kindLabel}</span>
                    <span>
                      <strong>{event.label}</strong>
                      <small dir="ltr">{isAllDayEvent(event.dueAt) ? (ar ? "اليوم كاملاً" : "Journée") : eventHourLabel(event.dueAt, locale)}</small>
                    </span>
                    <Link href={event.href} className="client-ghost-link">{ar ? "فتح" : "Ouvrir"}</Link>
                  </li>
                ))}
              </ul>
            </article>
          );
        })}
      </section>
    </main>
  );
}
