import { describe, expect, it } from "vitest";
import {
  addCalendarDays,
  collectPlanningEvents,
  eventCalendarDay,
  eventsForDay,
  mondayOnOrBefore,
  isAllDayEvent,
  eventHourLabel,
  weekDays,
} from "./events";

const id = (value: number) => `${String(value).padStart(8, "0")}-0000-4000-8000-000000000000`;

describe("planning calendar", () => {
  it("aligne la semaine sur le lundi et range les échéances par jour civil", () => {
    expect(mondayOnOrBefore("2025-05-14")).toBe("2025-05-12");
    expect(weekDays("2025-05-12")).toEqual([
      "2025-05-12", "2025-05-13", "2025-05-14", "2025-05-15", "2025-05-16", "2025-05-17", "2025-05-18",
    ]);
    expect(addCalendarDays("2025-05-12", 7)).toBe("2025-05-19");
    expect(eventCalendarDay("2027-01-15T00:00:00.000Z")).toBe("2027-01-15");
  });

  it("distingue une date civile d’une vraie échéance à minuit",()=>{expect(isAllDayEvent("2026-10-31")).toBe(true);expect(eventHourLabel("2026-10-31","fr")).toBeNull();expect(isAllDayEvent("2026-10-31T00:00:00Z")).toBe(false);expect(eventHourLabel("2026-10-31T00:00:00Z","fr")).not.toBeNull();});
  it("collecte uniquement les dossiers réels sans inventer d’horaire", () => {
    const events = collectPlanningEvents({
      locale: "fr",
      organizationQuery: "",
      quotes: {
        status: "success",
        dashboard: {
          organizations: [{ id: id(1), name: "Atlas" }],
          organizationId: id(1),
          organizationName: "Atlas",
          canManage: true,
          taxRules: [],
          invitations: [{
            id: id(2),
            status: "ACCEPTED",
            rowVersion: 1,
            rfqId: id(3),
            deadline: "2025-05-14T11:00:00.000Z",
            requestId: id(4),
            description: "Lot CVC",
            regionCode: "CASABLANCA",
            currency: "MAD",
            taxCategoryCode: null,
            quote: { id: id(5), status: "DRAFT", validUntil:"2025-05-15T14:00:00Z", currentVersionId: id(6), versionNumber: 1, currency: "MAD", subtotalMinor: "100", taxMinor: "20", totalMinor: "120" },
          }],
        },
      },
      missions: { status: "error" },
      qualification: {
        status: "success",
        dashboard: {
          organizationId: id(1),
          organizationName: "Atlas",
          profile: null,
          services: [],
          documents: [{ id: id(7), kind: "INSURANCE", code: "RC_2026", version: 1, status: "VERIFIED", expiresOn: "2025-05-16" }],
          catalogServices: [],
        },
      },
    });
    expect(events.map((event) => event.kind)).toEqual(["consultation", "quote", "document"]);
    expect(events.find(event=>event.kind==="quote")?.dueAt).toBe("2025-05-15T14:00:00Z");
    expect(events[0]?.href).toContain("/sous-traitant/consultations/");
    expect(eventsForDay(events, "2025-05-16")[0]?.label).toContain("RC_2026");
  });
});
