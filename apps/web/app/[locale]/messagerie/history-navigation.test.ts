import{describe,expect,it}from"vitest";
import{messageHistoryHref,parseMessageCursor}from"./history-navigation";
const id="a2090000-0000-4000-8000-000000000903",stamp="2026-11-01T10:20:30.123456+00:00";
describe("message history navigation",()=>{
 it("requires both validated cursor fields instead of silently loading a newer page",()=>{
  expect(parseMessageCursor({})).toEqual({valid:true});
  expect(parseMessageCursor({before:stamp})).toEqual({valid:false});
  expect(parseMessageCursor({beforeId:id})).toEqual({valid:false});
  expect(parseMessageCursor({before:"bad",beforeId:id})).toEqual({valid:false});
  expect(parseMessageCursor({before:stamp,beforeId:id})).toEqual({valid:true,cursor:{createdAt:stamp,id}});
 });
 it.each(["fr","ar"]as const)("preserves search, organization and inbox page while traversing old messages in %s",locale=>{
  const query={fil:id,organizationId:id,q:"Pièce jointe بالعربية",page:"4",before:"old",beforeId:"old"};
  const url=new URL(messageHistoryHref(locale,query,{createdAt:stamp,id}),"https://example.invalid");
  expect(url.pathname).toBe(`/${locale}/messagerie`);expect(url.searchParams.get("q")).toBe(query.q);expect(url.searchParams.get("page")).toBe("4");expect(url.searchParams.get("organizationId")).toBe(id);expect(url.searchParams.get("before")).toBe(stamp);
  const recent=new URL(messageHistoryHref(locale,query),"https://example.invalid");expect(recent.searchParams.has("before")).toBe(false);expect(recent.searchParams.get("fil")).toBe(id);
 });
});
