import { describe, expect, it } from "vitest";
import { subscriptionCheckoutAvailable } from "@/modules/shared/lib/subscriptions/model";
const now = Date.parse("2026-11-02T12:00:00Z");
describe("paid cycle renewal admission", () => {
 it.each(["ACTIVE", "CANCELLED"])("offers a fully paid next cycle only after %s period end", status => {
  expect(subscriptionCheckoutAvailable(status, "2026-11-02T11:59:59Z", now)).toBe(true);
  expect(subscriptionCheckoutAvailable(status, "2026-11-02T12:00:00Z", now)).toBe(true);
  expect(subscriptionCheckoutAvailable(status, "2026-11-02T12:00:01Z", now)).toBe(false);
  expect(subscriptionCheckoutAvailable(status, null, now)).toBe(false);
  expect(subscriptionCheckoutAvailable(status, "invalid", now)).toBe(false);
 });
 it.each(["TRIAL_ACTIVE", "TRIAL_EXPIRED", "PAST_DUE", "SUSPENDED"])("preserves the existing activatable %s path",status=>expect(subscriptionCheckoutAvailable(status,null,now)).toBe(true));
 it("never infers checkout from an unknown status or invalid clock",()=>{
  expect(subscriptionCheckoutAvailable("UNKNOWN", "2026-01-01",now)).toBe(false);
  expect(subscriptionCheckoutAvailable("ACTIVE","2026-01-01",NaN)).toBe(false);
 });
});
