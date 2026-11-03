import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ load: vi.fn(), rpc: vi.fn(), from: vi.fn(), query: vi.fn() }));
vi.mock("@/modules/franchise/data/library/workspace", () => ({ loadFranchiseLibraryWorkspace: mocks.load }));
vi.mock("@/modules/shared/lib/supabase/server", () => ({ getSupabaseServerClient: async () => ({ rpc: mocks.rpc, from: mocks.from }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { saveFranchiseCompositionAction } from "./composition-actions";
import { saveFranchiseRuleAction } from "./rule-editor-actions";
import { saveFranchiseQuestion, duplicateFranchiseQuestion } from "./question-editor-actions";
import { editorialFailureMessage } from "./command-errors";
const id = "11111111-1111-4111-8111-111111111111", a = "22222222-2222-4222-8222-222222222222", b = "33333333-3333-4333-8333-333333333333";
function form(data: Record<string,string>) { const form = new FormData(); Object.entries(data).forEach(([key,value]) => form.set(key,value)); return form; }
const common = { locale: "fr", organizationId: id, franchiseId: id, libraryId: id, versionId: id, idempotencyKey: id };
const composition = () => form({ ...common, expectedRowVersion: "1", sections: JSON.stringify([{ key: "GENERAL", labelFr: "Général", labelAr: "عام" }]), questions: "[]", rules: "[]" });
const rule = (extra: Record<string,unknown> = {}) => form({ ...common, ruleId: "", versionId: "", ruleKey: "REAL_RULE", identityRowVersion: "1", versionRowVersion: "1", changeReason: "Révision de test", payload: JSON.stringify({ condition_ast: { operator: "EQ", question_version_id: a, value: true }, actions: [{ type: "HIDE", target: b }], dependency_graph: { [b]: [a] }, priority: 1, sensitive: false, ...extra }) });
const question = () => form({ ...common, franchiseId: id, questionId: id, scope: "LIBRARY", identityRowVersion: "1", versionRowVersion: "1", reason: "Révision de test", payload: "{}", operation: "SAVE" });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.load.mockResolvedValue({ status: "success", workspace: { mandate: { libraryId: id, franchiseId: id }, questionnaires: [{ draftVersionId: id }], rules: [] } });
  mocks.rpc.mockResolvedValue({ data: { rule_id: id, version_id: id, identity_row_version: 2, version_row_version: 1 }, error: null });
  const query = { select: vi.fn(), eq: vi.fn(), in: vi.fn(), then: (resolve: (r:unknown)=>void) => Promise.resolve({data:[{id:a},{id:b}],error:null}).then(resolve) };
  query.select.mockReturnValue(query);query.eq.mockReturnValue(query);query.in.mockImplementation((...args)=>{mocks.query(...args);return query;});
  mocks.from.mockReturnValue(query);
});
describe("franchise editorial commands keep incidents distinct from authorization", () => {
  it.each(["QUERY_FAILED","INVALID_RESPONSE"])("composition keeps %s technical", async reason => {
    mocks.load.mockResolvedValue({ status:"error", reason });
    expect(await saveFranchiseCompositionAction({status:"idle"},composition())).toEqual({status:"error",reason:"UNAVAILABLE"});
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it.each(["QUERY_FAILED","INVALID_RESPONSE"])("rule keeps %s technical", async reason => {
    mocks.load.mockResolvedValue({status:"error",reason});
    expect(await saveFranchiseRuleAction({status:"idle"},rule())).toEqual({status:"error",reason:"UNAVAILABLE"});
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("keeps expired authentication distinct from a missing mandate", async () => {
    mocks.load.mockResolvedValue({status:"error",reason:"UNAUTHENTICATED"});
    expect(await saveFranchiseCompositionAction({status:"idle"},composition())).toEqual({status:"error",reason:"UNAUTHENTICATED"});
    mocks.load.mockResolvedValue({status:"error",reason:"NO_MANDATE"});
    expect(await saveFranchiseRuleAction({status:"idle"},rule())).toEqual({status:"error",reason:"FORBIDDEN"});
  });
  it.each([["08006","UNAVAILABLE"],["42501","FORBIDDEN"]])("question scope %s is %s without a write", async (code,reason) => {
    mocks.rpc.mockResolvedValueOnce({data:null,error:{code}});
    expect(await saveFranchiseQuestion({status:"idle"},question())).toEqual({status:"error",reason});
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });
  it("preserves the explicit selected mandate in composition and rule commands",async()=>{
    mocks.rpc.mockResolvedValueOnce({data:{row_version:2},error:null});
    expect(await saveFranchiseCompositionAction({status:"idle"},composition())).toEqual({status:"success",rowVersion:2});
    expect(mocks.load).toHaveBeenCalledWith(expect.objectContaining({franchiseId:id,libraryId:id}));
    mocks.load.mockClear();
    await saveFranchiseRuleAction({status:"idle"},rule());
    expect(mocks.load).toHaveBeenCalledWith(expect.objectContaining({franchiseId:id,libraryId:id}));
  });
  it("queries dependency and action-only questions under the selected library before saving", async () => {
    expect(await saveFranchiseRuleAction({status:"idle"},rule())).toMatchObject({status:"success",ruleId:id});
    expect(mocks.query).toHaveBeenCalledWith("id",expect.arrayContaining([a,b]));
    expect(mocks.from.mock.results[0]!.value.eq).toHaveBeenCalledWith("library_id",id);
    expect(mocks.rpc).toHaveBeenCalledWith("create_catalog_rule",expect.objectContaining({p_library_id:id}));
  });
  it("rejects a foreign action target when RLS omits its question", async () => {
    const q={select:vi.fn(),eq:vi.fn(),in:vi.fn(),then:(resolve:(r:unknown)=>void)=>Promise.resolve({data:[{id:a}],error:null}).then(resolve)};
    q.select.mockReturnValue(q);q.eq.mockReturnValue(q);q.in.mockReturnValue(q);mocks.from.mockReturnValue(q);
    expect(await saveFranchiseRuleAction({status:"idle"},rule())).toEqual({status:"error",reason:"VALIDATION"});
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("rejects hostile nested JSON before querying or writing rule data",async()=>{
    const f=rule();f.set("payload",'{"a":'.repeat(4000)+'null'+'}'.repeat(4000));
    expect(await saveFranchiseRuleAction({status:"idle"},f)).toEqual({status:"error",reason:"VALIDATION"});
    expect(mocks.from).not.toHaveBeenCalled();expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("duplicates under the selected mandate and returns only the new identity",async()=>{
    const f=form({...common,franchiseId:id,questionId:a,versionId:b,questionKey:"QUESTION_COPY",dataKey:"question.copy",reason:"Duplication métier"});
    mocks.rpc.mockResolvedValueOnce({data:{id:a},error:null}).mockResolvedValueOnce({data:{outcome:"CATALOG_QUESTION_DUPLICATED",question_id:b,private_internal_field:"not returned"},error:null});
    expect(await duplicateFranchiseQuestion({status:"idle"},f)).toEqual({status:"success",questionId:b});
    expect(mocks.rpc).toHaveBeenNthCalledWith(1,"franchise_question_detail",{p_franchise_id:id,p_question_id:a});
    expect(mocks.rpc).toHaveBeenNthCalledWith(2,"duplicate_catalog_question",expect.objectContaining({p_question_id:a,p_source_version_id:b,p_new_question_key:"QUESTION_COPY",p_new_data_key:"question.copy"}));
  });
  it("does not duplicate when the mandate scope is unavailable or refused",async()=>{
    const f=form({...common,franchiseId:id,questionId:a,versionId:b,questionKey:"QUESTION_COPY",dataKey:"question.copy",reason:"Duplication métier"});
    mocks.rpc.mockResolvedValueOnce({data:null,error:{code:"08006"}});
    expect(await duplicateFranchiseQuestion({status:"idle"},f)).toEqual({status:"error",reason:"UNAVAILABLE"});
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });
  it.each(["fr","ar"] as const)("provides distinct localized recovery messages in %s",locale=>{
    const messages=["UNAUTHENTICATED","FORBIDDEN","UNAVAILABLE","CONFLICT","LOCKED","VALIDATION"].map(reason=>editorialFailureMessage(reason as Parameters<typeof editorialFailureMessage>[0],locale));
    expect(new Set(messages).size).toBe(6);expect(messages.every(message=>message.length>20)).toBe(true);
  });
});
