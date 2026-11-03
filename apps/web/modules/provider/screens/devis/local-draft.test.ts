import{afterEach,describe,expect,it,vi}from"vitest";
import{createDraftAutosaver,restoreQuoteDraft,saveQuoteDraft,type StoredQuoteDraft}from"./local-draft";
const id="11111111-1111-4111-8111-111111111111",other="22222222-2222-4222-8222-222222222222";
const draft:StoredQuoteDraft={version:3,expiresAt:2000,baseVersionId:id,fields:{solution:"Travail conservé"},lines:[{key:1,label:"Pose",quantity:"1",unitCode:"UNIT",unitPrice:"100",taxRuleVersionId:id,itemKind:"ONE_TIME",recurrenceInterval:""}],operation:{revision:id,correlation:other}};
afterEach(()=>vi.useRealTimers());
describe("quote draft recovery",()=>{
 it("retains the exact draft on a newer server revision",()=>{const restored=restoreQuoteDraft(JSON.stringify(draft),other,1000);expect(restored).toEqual({status:"conflict",draft});});
 it("restores against the matching base and rejects expiry",()=>{expect(restoreQuoteDraft(JSON.stringify(draft),id,1000).status).toBe("ready");expect(restoreQuoteDraft(JSON.stringify(draft),id,2000)).toEqual({status:"expired"});});
 it("preserves legacy drafts as explicit conflicts",()=>{const old={...draft,version:2,baseVersionId:undefined};expect(restoreQuoteDraft(JSON.stringify(old),id,1000)).toMatchObject({status:"conflict",draft:{fields:draft.fields}});});
 it("never reports success when local storage is full",()=>{expect(saveQuoteDraft({setItem:()=>{throw new Error("quota");}},"draft",draft)).toBe("failed");});
 it("debounces edits and flushes the pending edit on page exit",()=>{vi.useFakeTimers();const write=vi.fn(),saver=createDraftAutosaver(write,500);saver.schedule();vi.advanceTimersByTime(300);saver.schedule();vi.advanceTimersByTime(499);expect(write).not.toHaveBeenCalled();saver.flush();expect(write).toHaveBeenCalledTimes(1);vi.advanceTimersByTime(1000);expect(write).toHaveBeenCalledTimes(1);saver.schedule();vi.advanceTimersByTime(500);expect(write).toHaveBeenCalledTimes(2);saver.cancel();});
});
