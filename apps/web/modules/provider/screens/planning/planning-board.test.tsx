import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PlanningWeekBoard } from "./planning-board";

describe("PlanningWeekBoard", () => {
  it("place les échéances réelles sur le jour civil sans horaire inventé", () => {
    const html = renderToStaticMarkup(
      <PlanningWeekBoard
        locale="fr"
        incomplete={false}
        today="2025-05-14"
        days={["2025-05-12", "2025-05-13", "2025-05-14", "2025-05-15", "2025-05-16", "2025-05-17", "2025-05-18"]}
        prevHref="/fr/sous-traitant/planning?week=2025-05-05"
        nextHref="/fr/sous-traitant/planning?week=2025-05-19"
        todayHref="/fr/sous-traitant/planning?week=2025-05-12"
        events={[{
          id: "invite:1",
          kind: "consultation",
          kindLabel: "Consultation",
          label: "Lot CVC",
          dueAt: "2025-05-14T11:00:00.000Z",
          href: "/fr/sous-traitant/consultations/1",
        }]}
      />,
    );
    expect(html).toContain("Lot CVC");
    expect(html).toContain("Consultation");
    expect(html).toContain("/fr/sous-traitant/consultations/1");
    expect(html).toContain("Afrique/Casablanca");
    expect(html).not.toMatch(/exemple illustratif/i);
  });
  it.each(["fr", "ar"] as const)("labels actual events as known while the scope is incomplete in %s", (locale) => {
    const html = renderToStaticMarkup(<PlanningWeekBoard locale={locale} incomplete events={[{id:"milestone:test",kind:"milestone",kindLabel:"Jalon",label:"Livraison autorisée",dueAt:"2026-11-03T12:00:00Z",href:`/${locale}/sous-traitant/missions/test`}]} days={["2026-11-02","2026-11-03","2026-11-04","2026-11-05","2026-11-06","2026-11-07","2026-11-08"]} today="2026-11-02" prevHref="?week=2026-10-26" nextHref="?week=2026-11-09" todayHref="?week=2026-11-02" />);
    expect(html).toContain("Livraison autorisée");
    expect(html).toContain(locale === "ar" ? "1 أحداث معروفة" : "1 événement connu");
    expect(html).toContain(locale === "ar" ? "المواعيد غير مكتملة" : "Échéances non exhaustives");
    expect(html).not.toContain(locale === "ar" ? "لا حدث" : "Aucun événement");
  });

});
