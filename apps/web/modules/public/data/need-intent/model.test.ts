import { describe, expect, it } from "vitest";
import {
  canonicalizePublicNeedClassification,
  classificationSnapshot,
  formatNeedScoreBasisPoints,
  overlapBasisPoints,
  publicNeedRequestHref,
  rankPublicNeedServices,
  resolvePublicNeedQuery,
  serviceCodeFromNeedSnapshot,
} from "./model";

describe("public need intent", () => {
  it("resolves a canonical service code and derives its library", () => {
    const result = resolvePublicNeedQuery({ serviceCode: "IT-AUDIT-SI", service: "texte non fiable" }, "fr");
    expect(result.invalidSelection).toBe(false);
    expect(result.classification).toMatchObject({ serviceCode: "IT-AUDIT-SI", libraryCode: "IT" });
    expect(result.initialNeed).toContain("Audit du système");
  });

  it("rejects unknown codes and mismatched libraries", () => {
    expect(resolvePublicNeedQuery({ serviceCode: "UNKNOWN" }, "fr").invalidSelection).toBe(true);
    expect(resolvePublicNeedQuery({ serviceCode: "IT-AUDIT-SI", library: "LEGAL" }, "fr").invalidSelection).toBe(true);
    expect(canonicalizePublicNeedClassification({ serviceCode: "IT-AUDIT-SI", libraryCode: "LEGAL" }, "fr")).toBeNull();
  });

  it("localizes the library and creates an explicit durable snapshot", () => {
    const classification = canonicalizePublicNeedClassification({ serviceCode: "IT-AUDIT-SI", libraryCode: "IT" }, "ar");
    expect(classification?.libraryName).toContain("تكنولوجيا");
    expect(classification && classificationSnapshot(classification, "ar")).toContain("IT-AUDIT-SI");
    expect(serviceCodeFromNeedSnapshot(classificationSnapshot(classification!, "fr"))).toBe("IT-AUDIT-SI");
    expect(serviceCodeFromNeedSnapshot("Domaine présélectionné : Informatique (IT).")).toBeNull();
    expect(publicNeedRequestHref("fr", "11111111-1111-4111-8111-111111111111", "IT-AUDIT-SI")).toBe("/fr/client/demandes/nouvelle?intakeId=11111111-1111-4111-8111-111111111111&serviceCode=IT-AUDIT-SI");
  });

  it("ranks published services from bounded free text without loading questions", () => {
    const ranked = rankPublicNeedServices("Audit du système d’information et feuille de route", "fr", 5);
    expect(ranked[0]?.serviceCode).toBe("IT-AUDIT-SI");
    expect(ranked[0]?.scoreBasisPoints).toBeGreaterThan(0);
    expect(ranked.every((item) => item.scoreBasisPoints <= 10_000)).toBe(true);
    expect(overlapBasisPoints("audit réseau", "audit réseau")).toBe(10_000);
    expect(formatNeedScoreBasisPoints(7500, "fr")).toBe("75 %");
    expect(formatNeedScoreBasisPoints(1234, "ar")).toBe("12,34٪");
    expect(rankPublicNeedServices("court", "fr")).toEqual([]);
  });

  it("signals missing approved Arabic service labels rather than silently returning French", () => {
    const fr = canonicalizePublicNeedClassification({ serviceCode: "IT-AUDIT-SI", libraryCode: "IT" }, "fr");
    const ar = canonicalizePublicNeedClassification({ serviceCode: "IT-AUDIT-SI", libraryCode: "IT" }, "ar");
    expect(ar?.serviceName).toContain("الاسم العربي");
    expect(ar?.serviceName).not.toBe(canonicalizePublicNeedClassification({ serviceCode: "IT-AUDIT-SI", libraryCode: "IT" }, "fr")?.serviceName);
    expect(fr?.serviceName ?? "").not.toContain("الاسم العربي");
  });

  it("matches approved Arabic domain terminology as well as French service names", () => {
    expect(rankPublicNeedServices("أحتاج دعم الأمن السيبراني والبيانات", "ar", 5).length).toBeGreaterThan(0);
    expect(rankPublicNeedServices("Audit du système d’information et feuille de route", "ar", 5)[0]?.serviceCode).toBe("IT-AUDIT-SI");
  });
});
