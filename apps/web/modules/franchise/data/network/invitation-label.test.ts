import { describe,expect,it } from "vitest";
import { franchiseInvitationLabel } from "./invitation-label";
const base={id:"TEST",status:"QUEUED" as const,deliveryMode:"EXTERNAL" as const,expiresAt:"2026-12-03T00:00:00Z",sentAt:null};
describe("native franchise invitation state",()=>{
 it.each(["fr","ar"] as const)("never turns a CRM-only prospect or a queue into a delivery claim in %s",locale=>{
  expect(franchiseInvitationLabel(undefined,locale)).toBeNull();
  const label=franchiseInvitationLabel(base,locale,Date.parse("2026-11-03T00:00:00Z"));
  expect(label).toContain(locale==="fr"?"attente":"انتظار");
 });
 it("marks a simulated acknowledgement explicitly and keeps its real queue state",()=>{
  expect(franchiseInvitationLabel({...base,deliveryMode:"NON_CONTRACTUAL_DEMO"},"fr",0)).toBe("Test non contractuel · Invitation en attente d’envoi");
 });
 it("derives expiry without falsely showing a live queued invitation",()=>{
  expect(franchiseInvitationLabel(base,"fr",Date.parse("2026-12-04T00:00:00Z"))).toBe("Invitation expirée");
  expect(franchiseInvitationLabel({...base,status:"REGISTERED"},"fr",Date.parse("2026-12-04T00:00:00Z"))).toBe("Inscription liée à l’invitation");
 });
});
