import { describe, expect, it } from "vitest";
import { columnLooksLikeStatus } from "./queue-status-column";

describe("columnLooksLikeStatus", () => {
  it("chips real status columns", () => {
    expect(columnLooksLikeStatus("État")).toBe(true);
    expect(columnLooksLikeStatus("Statut")).toBe(true);
    expect(columnLooksLikeStatus("Statut capacité")).toBe(true);
    expect(columnLooksLikeStatus("Qualification")).toBe(true);
    expect(columnLooksLikeStatus("الحالة")).toBe(true);
  });

  it("does not chip date, risk or conformity columns", () => {
    expect(columnLooksLikeStatus("État d’expiration")).toBe(false);
    expect(columnLooksLikeStatus("État d'expiration")).toBe(false);
    expect(columnLooksLikeStatus("Risque")).toBe(false);
    expect(columnLooksLikeStatus("Conformité")).toBe(false);
    expect(columnLooksLikeStatus("Activation")).toBe(false);
    expect(columnLooksLikeStatus("Fin")).toBe(false);
  });
});
