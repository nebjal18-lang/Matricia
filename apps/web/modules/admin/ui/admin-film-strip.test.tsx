import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const filmSource = readFileSync(new URL("./admin-film-strip.tsx", import.meta.url), "utf8");
const renderSource = readFileSync(new URL("../screens/spaces/render-admin-space.tsx", import.meta.url), "utf8");
const kitSource = readFileSync(new URL("../screens/spaces/queue-kit.tsx", import.meta.url), "utf8");
const shellSource = readFileSync(new URL("./admin-app-shell.tsx", import.meta.url), "utf8");

describe("admin provider detail chrome", () => {
  it("keeps a compact film context on fiches without a second primary CTA", () => {
    expect(filmSource).toContain("compact?: boolean");
    expect(filmSource).toContain("admin-film-compact");
    expect(filmSource).toContain("Prochaine action");
    expect(filmSource).not.toMatch(/if \(compact\)[\s\S]*admin-primary-cta/);
    expect(renderSource).toContain('compact={Boolean(row && view !== "queue")}');
  });

  it("hides step gates and list actions on detail views", () => {
    expect(renderSource).toContain('view === "queue" && (space === "providers"');
    expect(renderSource).toContain('mode={row && view !== "queue" ? "detail" : "queue"}');
    expect(kitSource).toContain('mode?: "queue" | "detail"');
    expect(kitSource).toContain("listActions && createHref");
    expect(kitSource).toContain("listActions && spec.exportable");
  });

  it("keeps one dossier primary CTA and readable status tone", () => {
    expect(kitSource).toContain("admin-dossier-next");
    expect(kitSource).toContain("admin-detail-tabs");
    expect(kitSource).not.toMatch(/providerOrgId \?[\s\S]*admin-pills/);
    expect(shellSource).toContain("kickerTone");
    expect(shellSource).toContain('data-tone={kickerTone}');
  });
});
