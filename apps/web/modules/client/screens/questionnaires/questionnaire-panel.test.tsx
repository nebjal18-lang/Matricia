import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { QuestionnaireDashboard } from "@/modules/shared/lib/questionnaire-sessions/model";
vi.mock("./actions", () => ({ saveQuestionnaireAnswerAction: vi.fn(), startQuestionnaireAction: vi.fn(), submitQuestionnaireAction: vi.fn() }));
vi.mock("@/modules/shared/ui/badge", () => ({ Badge: (props: React.ComponentProps<"span">) => <span {...props} /> }));
vi.mock("@/modules/shared/ui/button", () => ({ Button: (props: React.ComponentProps<"button">) => <button {...props} /> }));
vi.mock("@/modules/shared/ui/input", () => ({ Input: (props: React.ComponentProps<"input">) => <input {...props} /> }));
vi.mock("@/modules/shared/ui/label", () => ({ Label: (props: React.ComponentProps<"label">) => <label {...props} /> }));
vi.mock("@/modules/shared/ui/textarea", () => ({ Textarea: (props: React.ComponentProps<"textarea">) => <textarea {...props} /> }));
import { getQuestionnaireMessages } from "./messages";
import { QuestionnairePanel } from "./questionnaire-panel";

const id = (n: number) => `${String(n).padStart(8, "0")}-0000-4000-8000-000000000000`;
const dashboard: QuestionnaireDashboard = { organizations: [{ id: id(1), name: "Atlas" }], questionnaires: [{ id: id(2), version: 1, titleFr: "Diagnostic", titleAr: "التشخيص", descriptionFr: "Diagnostic client", descriptionAr: "تشخيص العميل" }], sessions: [], selected: { id: id(3), organizationId: id(1), questionnaireVersionId: id(2), status: "IN_PROGRESS", locale: "ar-MA", updatedAt: "2026-09-12T12:00:00Z", submittedAt: null, rowVersion: 2, titleFr: "Diagnostic", titleAr: "التشخيص", descriptionFr: "Diagnostic client", descriptionAr: "تشخيص العميل", answeredCount: 0, expiringAnswerCount: 1, expiredAnswerCount: 1, questionCount: 1, sections: [{ id: id(4), labelFr: "Contexte", labelAr: "السياق", helpFr: null, helpAr: null, sortOrder: 1, questions: [{ id: id(5), sectionId: id(4), sortOrder: 1, labelFr: "Budget", labelAr: "الميزانية", helpFr: null, helpAr: null, whyFr: null, whyAr: null, type: "MONEY", required: true, nullable: false, options: [], validation: {}, structured: null, answer: { value: { amountMinor: "12500", currency: "MAD" }, rowVersion: 1, answeredAt: "2026-09-12T11:00:00Z", expiresAt: "2026-09-12T11:30:00Z", requiresRevalidation: true } }] }] } };
const identity = { idempotencyKey: "command-123", correlationId: id(8) };
describe("QuestionnairePanel", () => {
  it("renders Arabic controls with labels and responsive widths", () => {
    const html = renderToStaticMarkup(<div dir="rtl"><QuestionnairePanel locale="ar" dashboard={dashboard} messages={getQuestionnaireMessages("ar")} identities={{ start: identity, submit: identity, answers: { [id(5)]: identity } }} /></div>);
    const controls = [...html.matchAll(/<(?:input|select|textarea)[^>]*\sid="([^"]+)"/g)].map((match) => match[1]), labels = [...html.matchAll(/<label[^>]*\sfor="([^"]+)"/g)].map((match) => match[1]);
    expect(controls.length).toBeGreaterThanOrEqual(4);
    expect(labels).toEqual(expect.arrayContaining(controls));
    expect(html).toContain("الميزانية");
    expect(html).toContain("انتهت صلاحية الإجابة");
    expect(html).toContain("لا يوجد موقع مسجّل");
    expect(html).toContain("min-h-11");
    expect(html).not.toMatch(/(?:min-w|max-w|w)-\[(?:[4-9]\d\d|\d{4,})px\]/u);
  });
  it("keeps identical SSR markup with Node24 navigator, offline navigator or no navigator",()=>{
    const render=()=>renderToStaticMarkup(<QuestionnairePanel locale="ar" dashboard={dashboard} messages={getQuestionnaireMessages("ar")} identities={{start:identity,submit:identity,answers:{[id(5)]:identity}}}/>);
    try{
      vi.stubGlobal("navigator",undefined);const initial=render();
      vi.stubGlobal("navigator",{userAgent:"Node.js/24"});expect(render()).toBe(initial);
      vi.stubGlobal("navigator",{onLine:false});expect(render()).toBe(initial);
      vi.stubGlobal("navigator",{onLine:true});expect(render()).toBe(initial);
    }finally{vi.unstubAllGlobals();}
  });
  it("lists company sites on session start", () => {
    const html = renderToStaticMarkup(<QuestionnairePanel locale="ar" dashboard={dashboard} messages={getQuestionnaireMessages("ar")} identities={{ start: identity, submit: identity, answers: { [id(5)]: identity } }} sites={[{ id: id(9), nameFr: "Siege Casablanca", nameAr: "المقر الدار البيضاء" }]} />);
    expect(html).toContain('name="siteId"');
    expect(html).toContain("المقر الدار البيضاء");
  });
  it("provides localized offline recovery and conflict controls", () => {
    const messages = getQuestionnaireMessages("fr");
    expect(messages.saveQueued).toContain("automatiquement");
    expect(messages.refreshConflict).toContain("serveur");
    expect(messages.companySite).toContain("Site");
  });
});
