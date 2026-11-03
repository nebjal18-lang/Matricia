import { describe,it,expect } from "vitest";
import { classifyCommandFailure } from "./command-failure";
describe("public action failure categories",()=>{
 it("separates assurance requirements from permissions without exposing SQL messages",()=>{
  expect(classifyCommandFailure({code:"42501",message:"BENEFIT_AAL2_REQUIRED"})).toBe("MFA_REQUIRED");
  expect(classifyCommandFailure({code:"42501",message:"TENANT_ACCESS_DENIED"})).toBe("FORBIDDEN");
 });
 it("does not call a transient outage a logout or a conflict",()=>{
  expect(classifyCommandFailure({status:503,code:"08006"})).toBe("FAILED");
  expect(classifyCommandFailure({status:401})).toBe("UNAUTHENTICATED");
  expect(classifyCommandFailure({code:"40001"})).toBe("CONFLICT");
  expect(classifyCommandFailure({code:"22003"})).toBe("VALIDATION");
 });
});
