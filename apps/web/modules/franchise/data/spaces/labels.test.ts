import { describe, expect, it } from "vitest";
import { franchiseStageLabel } from "./labels";

describe("CRM stage names", () => {
  it("never presents a prospect saved with the legacy SENT code as a delivered email", () => {
    expect(franchiseStageLabel("SENT", "fr")).toBe("Prospect enregistré");
    expect(franchiseStageLabel("SENT", "ar")).toBe("تم تسجيل العميل المحتمل");
  });
});
