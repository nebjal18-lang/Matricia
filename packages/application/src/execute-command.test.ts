import { describe, expect, it, vi } from "vitest";
import { executeCommand } from "./execute-command";

describe("command authorization port", () => {
  it("does not execute without authentication", async () => {
    const execute = vi.fn();
    expect(await executeCommand({ correlationId: "request", authenticate: async () => ({ authenticated: false, error: false }), execute })).toEqual({ status: "error", code: "UNAUTHENTICATED", correlationId: "request" });
    expect(execute).not.toHaveBeenCalled();
  });
  it("distinguishes unavailable authentication and does not retry mutations", async () => {
    const execute = vi.fn(async () => { throw new Error("private"); });
    expect(await executeCommand({ correlationId: "request", authenticate: async () => ({ authenticated: false, error: true }), execute })).toMatchObject({ code: "UNAVAILABLE" });
    expect(execute).not.toHaveBeenCalled();
    expect(await executeCommand({ correlationId: "request", authenticate: async () => ({ authenticated: true, error: false }), execute })).toMatchObject({ code: "UNAVAILABLE" });
    expect(execute).toHaveBeenCalledTimes(1);
  });
});
