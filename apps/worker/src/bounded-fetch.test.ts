import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createBoundedFetch } from "./bounded-fetch";

const servers: Server[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => new Promise<void>((resolve, reject) => {
    server.closeAllConnections();
    server.close(error => error ? reject(error) : resolve());
  })));
});

describe("worker bounded HTTP", () => {
  it("keeps the caller's method, headers and body while imposing an abort deadline", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response("ok"));
    const body = JSON.stringify({ command: "read" });
    await createBoundedFetch(30_000, fetcher)("https://database.example/rpc", {
      method: "POST", headers: { "content-type": "application/json" }, body,
    });
    expect(fetcher).toHaveBeenCalledWith("https://database.example/rpc", expect.objectContaining({
      method: "POST", headers: { "content-type": "application/json" }, body, signal: expect.any(AbortSignal),
    }));
  });

  it.each(["init", "request"] as const)("retains cancellation from %s instead of replacing it", async source => {
    const controller = new AbortController();
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response("ok"));
    const bounded = createBoundedFetch(30_000, fetcher);
    if (source === "request") await bounded(new Request("https://database.example/rpc", { signal: controller.signal }));
    else await bounded("https://database.example/rpc", { signal: controller.signal });
    const signal = fetcher.mock.calls[0]?.[1]?.signal;
    expect(signal?.aborted).toBe(false);
    controller.abort(new Error("caller stopped"));
    expect(signal?.aborted).toBe(true);
    expect(signal?.reason).toBe(controller.signal.reason);
  });

  it("aborts a stalled response body after headers, so an RPC cannot pin the last successful cycle forever", async () => {
    const server = createServer((_request, response) => {
      response.writeHead(200, { "content-type": "application/json" });
      response.write('{"pending":');
    });
    servers.push(server);
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address() as AddressInfo;
    const response = await createBoundedFetch(500)(`http://127.0.0.1:${port}/rpc`);
    await expect(response.json()).rejects.toMatchObject({ name: "AbortError" });
  });

  it.each([0, -1, 120_001, 1.5, NaN])("rejects an unbounded or invalid deadline %s", timeout => {
    expect(() => createBoundedFetch(timeout)).toThrow("WORKER_HTTP_TIMEOUT_INVALID");
  });
});
