import { describe, expect, it } from "vitest";
import { normalizeQuestionPayload, toQuestionChoices, weightedPercentage } from "./question-scoring";

describe("question percentage", () => {
  it("uses the cahier ratio and keeps a zero-weight question out of the result", () => {
    expect(weightedPercentage([
      { weight: "2", maximumScore: "10", answerScore: "8" },
      { weight: "1", maximumScore: "4", answerScore: "2" },
      { weight: "0", maximumScore: "10", answerScore: "10" },
    ])).toBe("75.00");
  });

  it("rejects an answer above its maximum", () => {
    expect(weightedPercentage([{ weight: "1", maximumScore: "4", answerScore: "5" }])).toBeNull();
  });
});

describe("choice scores", () => {
  it("keeps a score on every choice and rejects a total above the maximum", () => {
    const saved = normalizeQuestionPayload({
      answer_type: "MULTIPLE_CHOICE",
      weight: "1",
      maximum_score: "10",
      options: [
        { value: "OPT_1", label_fr: "Faible", label_ar: "ضعيف", score: "2" },
        { value: "OPT_2", label_fr: "Élevé", label_ar: "مرتفع", score: "8" },
      ],
    });
    expect(saved.ok).toBe(true);
    if (saved.ok) expect(saved.payload.options).toEqual([
      { value: "OPT_1", label_fr: "Faible", label_ar: "ضعيف", score: "2" },
      { value: "OPT_2", label_fr: "Élevé", label_ar: "مرتفع", score: "8" },
    ]);
    expect(normalizeQuestionPayload({
      answer_type: "MULTIPLE_CHOICE", weight: "1", maximum_score: "9",
      options: [{ value: "OPT_1", label_fr: "A", label_ar: "أ", score: "6" }, { value: "OPT_2", label_fr: "B", label_ar: "ب", score: "4" }],
    }).ok).toBe(false);
  });

  it("shows the bilingual label to the client and leaves the score off the screen model", () => {
    expect(toQuestionChoices([{ value: "OPT_1", label_fr: "Oui", label_ar: "نعم", score: "10" }])).toEqual([{ value: "OPT_1", labelFr: "Oui", labelAr: "نعم" }]);
  });
});
