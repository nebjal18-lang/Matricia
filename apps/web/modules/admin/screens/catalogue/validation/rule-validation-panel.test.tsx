import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/modules/shared/ui/alert", () => ({ Alert: ({ children, ...props }: { children: ReactNode } & ComponentPropsWithoutRef<"div">) => <div {...props}>{children}</div>, AlertDescription: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock("@/modules/shared/ui/badge", () => ({ Badge: ({ children }: { children: ReactNode }) => <span>{children}</span> }));
vi.mock("@/modules/shared/ui/button", () => ({ Button: ({ children, variant, ...props }: ComponentPropsWithoutRef<"button"> & { variant?: string }) => <button data-variant={variant} {...props}>{children}</button> }));
vi.mock("@/modules/shared/ui/card", () => ({ Card: ({ children }: { children: ReactNode }) => <article>{children}</article>, CardContent: ({ children }: { children: ReactNode }) => <div>{children}</div>, CardDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>, CardHeader: ({ children }: { children: ReactNode }) => <header>{children}</header>, CardTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2> }));
vi.mock("@/modules/shared/ui/label", () => ({ Label: ({ children, ...props }: ComponentPropsWithoutRef<"label">) => <label {...props}>{children}</label> }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }), usePathname: () => "/fr/administration/catalogue/validation" }));
vi.mock("./actions", () => ({ validateRules: async () => ({ status: "idle" }), simulateRules: async () => ({ status: "idle" }) }));


import { RuleValidationPanel } from "./rule-validation-panel";
import { getRuleValidationMessages } from "./messages";

const versionId = "11111111-1111-4111-8111-111111111111";
const questionId = "22222222-2222-4222-8222-222222222222";
const workspace = {
  versions: [{ id: versionId, version: 2, status: "LOCAL_TEST" as const, titleFr: "Diagnostic IT", titleAr: "تشخيص التقنية", audience: "CLIENT" as const, engineVersion: "engine-v1", policyVersion: "policy-v1", libraryId: "33333333-3333-4333-8333-333333333333", libraryCode: "IT" }],
  selectedVersionId: versionId,
  questions: [{ id: questionId, sortOrder: 1, labelFr: "Avez-vous une sauvegarde ?", labelAr: "هل لديكم نسخة احتياطية؟", answerType: "YES_NO", dataKey: "it.backup.exists", required: true }],
};

function render(locale: "fr" | "ar") { return renderToStaticMarkup(<div dir={locale === "ar" ? "rtl" : "ltr"}><RuleValidationPanel workspace={workspace} locale={locale} messages={getRuleValidationMessages(locale)}/></div>); }

describe("RuleValidationPanel", () => {
  it("associe tous les champs à un libellé et annonce les résultats", () => {
    const html = render("fr");
    const controls = [...html.matchAll(/<(?:select|textarea)[^>]*\sid="([^"]+)"/g)].map((value) => value[1]);
    const labels = [...html.matchAll(/<label[^>]+for="([^"]+)"/g)].map((value) => value[1]);
    expect(controls.length).toBe(3);
    expect(labels).toEqual(expect.arrayContaining(controls));
    expect((html.match(/aria-live="polite"/g) ?? []).length).toBeGreaterThanOrEqual(2);
    expect(html).toContain("Avez-vous une sauvegarde ?");
    expect(html).toContain("Oui ou non");
    expect(html).not.toContain("Réponses actuelles (JSON)");
    expect(html).not.toMatch(/>YES_NO</);
  });

  it("rend l’arabe RTL sans largeur fixe incompatible avec 360 px", () => {
    const html = render("ar");
    expect(html).toContain('dir="rtl"');
    expect(html).toContain("هل لديكم نسخة احتياطية؟");
    expect(html).toContain("تعبير مضبوط");
    expect(html).not.toMatch(/(?:min-w|max-w|w)-\[(?:[4-9]\d\d|\d{4,})px\]/);
  });
});
