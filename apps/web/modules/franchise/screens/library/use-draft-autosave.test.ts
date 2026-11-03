import{afterEach,describe,it,expect,vi}from"vitest";
import{scheduleDraftSave}from"./use-draft-autosave";
afterEach(()=>vi.useRealTimers());
describe("draft autosave scheduling",()=>{
 it("waits for a pause, submits a valid draft once, and records the attempted payload",()=>{vi.useFakeTimers();const submit=vi.fn();const attempt=vi.fn();scheduleDraftSave({checkValidity:()=>true,requestSubmit:submit},attempt);vi.advanceTimersByTime(1999);expect(submit).not.toHaveBeenCalled();vi.advanceTimersByTime(1);expect(submit).toHaveBeenCalledOnce();expect(attempt).toHaveBeenCalledOnce();vi.runAllTimers();expect(submit).toHaveBeenCalledOnce();});
 it("never sends incomplete forms and cancels a superseded or unmounted draft",()=>{vi.useFakeTimers();const submit=vi.fn();const attempt=vi.fn();scheduleDraftSave({checkValidity:()=>false,requestSubmit:submit},attempt);const cancel=scheduleDraftSave({checkValidity:()=>true,requestSubmit:submit},attempt);cancel();vi.runAllTimers();expect(submit).not.toHaveBeenCalled();expect(attempt).not.toHaveBeenCalled();});
});
