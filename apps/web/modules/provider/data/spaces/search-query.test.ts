import{describe,expect,it}from"vitest";
import{providerSearchQuery}from"./list-rows";
describe("Provider list navigation",()=>{
 it("resets a stale page when switching tabs without losing organization and search",()=>{const p=new URLSearchParams(providerSearchQuery("?organizationId=org&page=7&q=libre&tab=drafts",{tab:"submitted"}));expect(p.get("page")).toBeNull();expect(p.get("organizationId")).toBe("org");expect(p.get("q")).toBe("libre");});
 it("keeps page for a navigation that changes no filter",()=>{expect(providerSearchQuery("?page=7&tab=drafts",{tab:"drafts"})).toContain("page=7");});
 it("returns to page one when removing an active tab",()=>{expect(providerSearchQuery("?page=7&tab=drafts",{tab:undefined})).toBe("");});
});
