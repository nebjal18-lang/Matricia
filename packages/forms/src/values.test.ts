import { describe, expect, it } from "vitest";
import { formText, isoDate } from "./values";

describe("form boundary values", () => {
  it("rejects files and missing values rather than coercing them into business fields", () => {
    const form = new FormData();
    form.set("label", "Contract"); form.set("upload", new Blob(["private"]), "proof.txt");
    expect(formText(form, "label")).toBe("Contract");
    expect(formText(form, "upload")).toBe("");
    expect(formText(form, "missing")).toBe("");
  });
  it("normalizes dates and rejects invalid inputs", () => {
    expect(isoDate("2026-11-19T12:00:00Z")).toBe("2026-11-19T12:00:00.000Z");
    expect(isoDate("invalid")).toBeNull();
  });
});
