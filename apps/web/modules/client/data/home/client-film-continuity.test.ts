import { describe, expect, it } from "vitest";
import {
  clientFilmNextAction,
  clientFilmReference,
  clientFilmStageFromStatus,
  clientFilmStepId,
} from "./client-film-continuity";
import { clientJourneySteps } from "./view-model";

describe("client film continuity", () => {
  it("maps statuses to a stable demande→mission path", () => {
    expect(clientFilmStageFromStatus("DRAFT")).toBe("DRAFT");
    expect(clientFilmStageFromStatus("QUOTES_RECEIVED")).toBe("QUOTES");
    expect(clientFilmStageFromStatus("CONTRACTED")).toBe("MISSION");
    expect(clientFilmStepId("DRAFT")).toBe("need");
    expect(clientFilmNextAction("DRAFT", "fr")).toContain("Compléter");
  });

  it("keeps the same request reference across steps", () => {
    const featured = {
      requestId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      title: "Refonte communication",
      status: "DRAFT",
      createdAt: "2026-11-25T10:00:00Z",
      quoteCount: 0,
      href: "/fr/client/demandes/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      steps: clientJourneySteps("DRAFT"),
    };
    expect(clientFilmReference(featured)).toBe(featured.requestId);
    expect(clientFilmReference(null)).toBeNull();
  });
});
