import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ start: vi.fn(), save: vi.fn(), submit: vi.fn(), revalidate: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/modules/shared/lib/questionnaire-sessions/server-repository", () => ({ createServerQuestionnaireSessionsRepository: async () => ({ start: mocks.start, save: mocks.save, submit: mocks.submit }) }));
import { saveQuestionnaireAnswerAction, startQuestionnaireAction, submitQuestionnaireAction, type QuestionnaireActionState } from "./actions";
const idle: QuestionnaireActionState = { status: "idle" }, id = (n: number) => `${String(n).padStart(8, "0")}-0000-4000-8000-000000000000`;
function base() { const form = new FormData(); form.set("locale", "fr"); form.set("idempotencyKey", "command-123"); form.set("correlationId", id(1)); return form; }
beforeEach(() => { Object.values(mocks).forEach((mock) => mock.mockReset()); });
describe("questionnaire session actions", () => {
  it("starts a versioned session with an optional due date", async () => { mocks.start.mockResolvedValue({ status: "success", value: { sessionId: id(4), rowVersion: 1 } }); const form = base(); form.set("organizationId", id(2)); form.set("questionnaireVersionId", id(3)); form.set("dueAt", ""); await expect(startQuestionnaireAction(idle, form)).resolves.toEqual({ status: "success", operation: "STARTED", sessionId: id(4) }); expect(mocks.start).toHaveBeenCalledWith(expect.objectContaining({ dueAt: null, questionnaireVersionId: id(3), siteId: null })); });
  it("starts a session scoped to an optional company site", async () => { mocks.start.mockResolvedValue({ status: "success", value: { sessionId: id(4), rowVersion: 1 } }); const form = base(); form.set("organizationId", id(2)); form.set("questionnaireVersionId", id(3)); form.set("dueAt", ""); form.set("siteId", id(9)); await expect(startQuestionnaireAction(idle, form)).resolves.toEqual({ status: "success", operation: "STARTED", sessionId: id(4) }); expect(mocks.start).toHaveBeenCalledWith(expect.objectContaining({ siteId: id(9) })); });
  it("canonicalizes exact money without a JavaScript float", async () => { mocks.save.mockResolvedValue({ status: "success", value: { sessionId: id(2), serverRowVersion: 2, answerRowVersion: 1 } }); const form = base(); form.set("sessionId", id(2)); form.set("questionVersionId", id(3)); form.set("expectedSessionRowVersion", "1"); form.set("expectedAnswerRowVersion", "0"); form.set("answerType", "MONEY"); form.set("nullable", "false"); form.set("amountMinor", "900719925474099300"); form.set("currency", "mad"); await saveQuestionnaireAnswerAction(idle, form); expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ value: { kind: "MONEY", amountMinor: "900719925474099300", currency: "MAD" } })); });
  it("converts French major units on the server and rejects overprecision before mutation", async () => {
    mocks.save.mockResolvedValue({ status: "success", value: { sessionId: id(2), serverRowVersion: 2, answerRowVersion: 1 } });
    const form = base();
    for (const [key, value] of Object.entries({sessionId:id(2),questionVersionId:id(3),expectedSessionRowVersion:"1",expectedAnswerRowVersion:"0",answerType:"MONEY",nullable:"false",amountMajor:"15,50",currency:"MAD"})) form.set(key,value);
    await saveQuestionnaireAnswerAction(idle,form);
    expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({value:{kind:"MONEY",amountMinor:"1550",currency:"MAD"}}));
    mocks.save.mockClear();
    form.set("amountMajor","15,505");
    expect(await saveQuestionnaireAnswerAction(idle,form)).toEqual({status:"error",reason:"VALIDATION"});
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("rejects malformed JSON locally", async () => { const form = base(); form.set("sessionId", id(2)); form.set("questionVersionId", id(3)); form.set("expectedSessionRowVersion", "1"); form.set("expectedAnswerRowVersion", "0"); form.set("answerType", "TABLE"); form.set("nullable", "false"); form.set("answerValue", "{"); await expect(saveQuestionnaireAnswerAction(idle, form)).resolves.toEqual({ status: "error", reason: "VALIDATION" }); expect(mocks.save).not.toHaveBeenCalled(); });
  it("exposes missing required answers on submission", async () => { mocks.submit.mockResolvedValue({ status: "error", reason: "REQUIRED_MISSING" }); const form = base(); form.set("sessionId", id(2)); form.set("expectedSessionRowVersion", "2"); await expect(submitQuestionnaireAction(idle, form)).resolves.toEqual({ status: "error", reason: "REQUIRED_MISSING" }); });
});
