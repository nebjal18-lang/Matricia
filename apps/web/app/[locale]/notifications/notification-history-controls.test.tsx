import { describe,it,expect } from "vitest";
import { notificationHistoryHref } from "./notification-history-controls";
describe("notification history links",()=>{
 it("keeps organization, workspace, Arabic search and paired cursor",()=>{
  const href=notificationHistoryHref("ar","org-b","client",{q:"فاتورة",unread:true,before:"2026-10-01T00:00:00Z",beforeId:"notification-id"});
  const url=new URL(href,"https://matricia.invalid");
  expect(url.pathname).toBe("/ar/notifications");
  expect(Object.fromEntries(url.searchParams)).toEqual({organizationId:"org-b",workspace:"client",q:"فاتورة",unread:"1",before:"2026-10-01T00:00:00Z",beforeId:"notification-id"});
 });
 it("reset preserves the organization and drops only history filters",()=>{
  expect(notificationHistoryHref("fr","org-b","client",{})).toBe("/fr/notifications?organizationId=org-b&workspace=client");
 });
});
