import { createServer, type Socket } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { createClamAvTcpHealthCheck, createClamAvTcpScanner, readClamAvTcpConfig, type ClamAvTcpConfig } from "./clamav-tcp";

const servers: ReturnType<typeof createServer>[] = [];
const databaseFixtureDate=new Date().toUTCString();

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
});

async function listen(handler: (socket: Socket) => void): Promise<number> {
  const server = createServer(handler);
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("TEST_SERVER_ADDRESS_INVALID");
  return address.port;
}

function config(port: number, overrides: Partial<ClamAvTcpConfig> = {}): ClamAvTcpConfig {
  return {
    host: "127.0.0.1",
    allowedHosts: ["127.0.0.1"],
    networkMode: "LOCAL",
    port,
    engineVersion: "1.4.2",
    timeoutMs: 1_000,
    chunkBytes: 1_024,
    maximumResponseBytes: 4_096,
    ...overrides,
  };
}

function receiveCommand(socket: Socket, onCommand: (command: string, content: Buffer) => void,versionResponse=()=>`ClamAV 1.4.2/28000/${databaseFixtureDate}`): void {
  let pending = Buffer.alloc(0);
  let command: string | null = null;
  const content: Buffer[] = [];
  socket.on("data", (chunk) => {
    pending = Buffer.concat([pending, chunk]);
    if (command === null) {
      const end = pending.indexOf(0);
      if (end < 0) return;
      command = pending.subarray(0, end).toString("ascii");
      pending = pending.subarray(end + 1);
      if (command === "zVERSION") {socket.end(`${versionResponse()}\0`);return;}
      if (command === "zPING") onCommand(command, Buffer.alloc(0));
    }
    if (command !== "zINSTREAM") return;
    while (pending.length >= 4) {
      const size = pending.readUInt32BE(0);
      if (size === 0) {
        pending = pending.subarray(4);
        onCommand(command, Buffer.concat(content));
        return;
      }
      if (pending.length < size + 4) return;
      content.push(pending.subarray(4, size + 4));
      pending = pending.subarray(size + 4);
    }
  });
}

describe("ClamAV TCP configuration", () => {
  it("requires an explicit allowlist and network boundary", () => {
    expect(readClamAvTcpConfig({
      CLAMAV_HOST: "clamav.internal",
      CLAMAV_ALLOWED_HOSTS: "clamav.internal",
      CLAMAV_NETWORK_MODE: "PRIVATE",
      CLAMAV_ENGINE_VERSION: "1.4.2",
    })).toMatchObject({ host: "clamav.internal", allowedHosts: ["clamav.internal"], networkMode: "PRIVATE", port: 3310 });
    expect(() => readClamAvTcpConfig({ CLAMAV_HOST: "clamav.internal", CLAMAV_ENGINE_VERSION: "1" })).toThrow("ANTIVIRUS_CONFIG_INVALID");
    expect(() => readClamAvTcpConfig({
      CLAMAV_HOST: "clamav.internal", CLAMAV_ALLOWED_HOSTS: "other.internal",
      CLAMAV_NETWORK_MODE: "PRIVATE", CLAMAV_ENGINE_VERSION: "1",
    })).toThrow("ANTIVIRUS_CONFIG_INVALID");
  });

  it("rejects integer junk rather than partially parsing it", () => {
    expect(() => readClamAvTcpConfig({
      CLAMAV_HOST: "127.0.0.1", CLAMAV_ALLOWED_HOSTS: "127.0.0.1", CLAMAV_NETWORK_MODE: "LOCAL",
      CLAMAV_ENGINE_VERSION: "1", CLAMAV_PORT: "3310junk",
    })).toThrow("ANTIVIRUS_CONFIG_INVALID");
  });

  it("rejects an allowlisted public destination before opening TCP", async () => {
    await expect(createClamAvTcpScanner({ ...config(3310), host: "8.8.8.8", allowedHosts: ["8.8.8.8"], networkMode: "PRIVATE" })
      .scan(new Uint8Array([1]))).rejects.toMatchObject({ code: "ANTIVIRUS_CONFIG_INVALID" });
  });
});

describe("ClamAV zINSTREAM protocol", () => {
  it.each([
    ["stream: OK\0", "CLEAN"],
    ["stream: Eicar-Signature FOUND\0", "INFECTED"],
    ["stream: read failure ERROR\0", "ERROR"],
  ] as const)("maps a bounded %s response", async (response, verdict) => {
    const port = await listen((socket) => receiveCommand(socket, (command, bytes) => {
      expect(command).toBe("zINSTREAM");
      expect(bytes).toEqual(Buffer.from("scan-content"));
      socket.end(response);
    }));
    await expect(createClamAvTcpScanner(config(port)).scan(Buffer.from("scan-content"))).resolves.toMatchObject({ verdict });
  });

  it("handles a NUL-terminated response fragmented across packets", async () => {
    const port = await listen((socket) => receiveCommand(socket, () => {
      socket.write("stream: ");
      setTimeout(() => socket.end(Buffer.from("OK\0")), 5);
    }));
    await expect(createClamAvTcpScanner(config(port)).scan(Buffer.from("fragmented"))).resolves.toMatchObject({ verdict: "CLEAN" });
  });

  it("rejects an oversized response", async () => {
    const port = await listen((socket) => receiveCommand(socket, () => socket.end(Buffer.concat([Buffer.alloc(4_097, 0x78), Buffer.from([0])]))));
    await expect(createClamAvTcpScanner(config(port)).scan(Buffer.from("bounded"))).rejects.toMatchObject({ code: "ANTIVIRUS_RESPONSE_INVALID" });
  });

  it("times out when the daemon never answers", async () => {
    const port = await listen((socket) => receiveCommand(socket, () => undefined));
    await expect(createClamAvTcpScanner(config(port, { timeoutMs: 100 })).scan(Buffer.from("timeout")))
      .rejects.toMatchObject({ code: "ANTIVIRUS_UNAVAILABLE", retryable: true });
  });

  it("completes a large stream when the receiver applies backpressure", async () => {
    const content = Buffer.alloc(4 * 1024 * 1024, 0x61);
    const port = await listen((socket) => {
      socket.pause();
      setTimeout(() => socket.resume(), 30);
      receiveCommand(socket, (_command, bytes) => {
        expect(bytes.length).toBe(content.length);
        socket.end(Buffer.from("stream: OK\0"));
      });
    });
    await expect(createClamAvTcpScanner(config(port, { timeoutMs: 3_000, chunkBytes: 16_384 })).scan(content))
      .resolves.toMatchObject({ verdict: "CLEAN" });
  });
});

describe("ClamAV health check", () => {
  it("sends a bounded NUL-terminated PING and accepts PONG", async () => {
    const port = await listen((socket) => receiveCommand(socket, (command) => {
      expect(command).toBe("zPING");
      socket.end(Buffer.from("PONG\0"));
    }));
    await expect(createClamAvTcpHealthCheck(config(port)).check()).resolves.toEqual({
      status: "up", engineCode: "CLAMAV_TCP", engineVersion: expect.stringMatching(/^1\.4\.2\/db:28000@/u),
    });
  });

  it("fails closed on invalid or missing health responses", async () => {
    const invalidPort = await listen((socket) => receiveCommand(socket, () => socket.end(Buffer.from("NOPE\0"))));
    await expect(createClamAvTcpHealthCheck(config(invalidPort)).check()).rejects.toMatchObject({ code: "ANTIVIRUS_RESPONSE_INVALID" });
    const timeoutPort = await listen((socket) => receiveCommand(socket, () => undefined));
    await expect(createClamAvTcpHealthCheck(config(timeoutPort, { timeoutMs: 100 })).check())
      .rejects.toMatchObject({ code: "ANTIVIRUS_UNAVAILABLE" });
  });
});

describe("native ClamAV version and database freshness",()=>{
 it.each(["ClamAV unknown","ClamAV 1.4.2/0/unknown",`ClamAV 9.9.9/28000/${new Date().toUTCString()}`])("refuses unverifiable VERSION %s",async version=>{
  const port=await listen(socket=>receiveCommand(socket,()=>socket.end("stream: OK\0"),()=>version));await expect(createClamAvTcpScanner(config(port)).scan(Buffer.from("content"))).rejects.toMatchObject({code:"ANTIVIRUS_VERSION_UNVERIFIED",retryable:true});
 });
 it("refuses a stale database even if PING succeeds",async()=>{
  let ping=false;const port=await listen(socket=>receiveCommand(socket,command=>{if(command==="zPING"){ping=true;socket.end("PONG\0");}},()=>`ClamAV 1.4.2/28000/${new Date(Date.now()-49*3600000).toUTCString()}`));await expect(createClamAvTcpHealthCheck(config(port)).check()).rejects.toMatchObject({code:"ANTIVIRUS_DATABASE_STALE",retryable:true});expect(ping).toBe(true);
 });
 it("does not send document bytes when VERSION says the database is stale",async()=>{
  let streams=0;const port=await listen(socket=>receiveCommand(socket,()=>{streams++;socket.end("stream: OK\0");},()=>`ClamAV 1.4.2/28000/${new Date(Date.now()-49*3600000).toUTCString()}`));await expect(createClamAvTcpScanner(config(port)).scan(Buffer.from("content"))).rejects.toMatchObject({code:"ANTIVIRUS_DATABASE_STALE"});expect(streams).toBe(0);
 });
 it("refuses CLEAN when the native database changes during the scan",async()=>{
  let versions=0;const date=new Date().toUTCString();const port=await listen(socket=>receiveCommand(socket,()=>socket.end("stream: OK\0"),()=>`ClamAV 1.4.2/${++versions===1?28000:28001}/${date}`));await expect(createClamAvTcpScanner(config(port)).scan(Buffer.from("content"))).rejects.toMatchObject({code:"ANTIVIRUS_VERSION_UNVERIFIED",retryable:true});
 });
});
