import { lookup } from "node:dns/promises";
import { createConnection, isIP, type Socket } from "node:net";
import { DocumentScanError } from "./errors";
import type { AntivirusResult, AntivirusScanner } from "./contracts";

export type ClamAvNetworkMode = "LOCAL" | "PRIVATE";

export type ClamAvTcpConfig = Readonly<{
  host: string;
  allowedHosts: readonly string[];
  networkMode: ClamAvNetworkMode;
  port: number;
  engineVersion: string;
  timeoutMs: number;
  chunkBytes: number;
  maximumResponseBytes: number;
  maximumDatabaseAgeMs?: number;
}>;

export type ClamAvHealth = Readonly<{ status: "up"; engineCode: "CLAMAV_TCP"; engineVersion: string }>;
export interface ClamAvHealthCheck { check(): Promise<ClamAvHealth> }

function required(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name]?.trim();
  if (!value) throw new DocumentScanError("ANTIVIRUS_CONFIG_INVALID");
  return value;
}

function boundedInteger(value: string | undefined, fallback: number, minimum: number, maximum: number): number {
  if (value !== undefined && !/^[0-9]+$/.test(value)) throw new DocumentScanError("ANTIVIRUS_CONFIG_INVALID");
  const parsed = value === undefined ? fallback : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) throw new DocumentScanError("ANTIVIRUS_CONFIG_INVALID");
  return parsed;
}

function normalizeHost(value: string): string {
  const host = value.trim().toLowerCase();
  if (!host || host.includes("://") || /[\s/\\]/.test(host) || (!isIP(host) && !/^[a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])?$/.test(host))) {
    throw new DocumentScanError("ANTIVIRUS_CONFIG_INVALID");
  }
  return host;
}

export function readClamAvTcpConfig(env: NodeJS.ProcessEnv): ClamAvTcpConfig {
  const host = normalizeHost(required(env, "CLAMAV_HOST"));
  const allowedHosts = required(env, "CLAMAV_ALLOWED_HOSTS").split(",").map(normalizeHost);
  if (new Set(allowedHosts).size !== allowedHosts.length || !allowedHosts.includes(host)) throw new DocumentScanError("ANTIVIRUS_CONFIG_INVALID");
  const networkMode = required(env, "CLAMAV_NETWORK_MODE");
  if (networkMode !== "LOCAL" && networkMode !== "PRIVATE") throw new DocumentScanError("ANTIVIRUS_CONFIG_INVALID");
  const engineVersion = required(env, "CLAMAV_ENGINE_VERSION");
  if (engineVersion.length > 80) throw new DocumentScanError("ANTIVIRUS_CONFIG_INVALID");
  return Object.freeze({
    host,
    allowedHosts: Object.freeze([...allowedHosts]),
    networkMode,
    port: boundedInteger(env.CLAMAV_PORT, 3310, 1, 65_535),
    engineVersion,
    timeoutMs: boundedInteger(env.CLAMAV_TIMEOUT_MS, 15_000, 100, 120_000),
    chunkBytes: boundedInteger(env.CLAMAV_CHUNK_BYTES, 65_536, 1_024, 1_048_576),
    maximumResponseBytes: 4_096,
    maximumDatabaseAgeMs: boundedInteger(env.CLAMAV_MAX_DATABASE_AGE_HOURS?.trim()||undefined,48,1,168)*3_600_000,
  });
}

function validatedConfig(config: ClamAvTcpConfig): ClamAvTcpConfig {
  const host = normalizeHost(config.host);
  const allowedHosts = config.allowedHosts.map(normalizeHost);
  if (allowedHosts.length === 0 || new Set(allowedHosts).size !== allowedHosts.length || !allowedHosts.includes(host)
    || (config.networkMode !== "LOCAL" && config.networkMode !== "PRIVATE")
    || !Number.isSafeInteger(config.port) || config.port < 1 || config.port > 65_535
    || !Number.isSafeInteger(config.timeoutMs) || config.timeoutMs < 100 || config.timeoutMs > 120_000
    || !Number.isSafeInteger(config.chunkBytes) || config.chunkBytes < 1_024 || config.chunkBytes > 1_048_576
    || !Number.isSafeInteger(config.maximumResponseBytes) || config.maximumResponseBytes < 1 || config.maximumResponseBytes > 4_096
    || (config.maximumDatabaseAgeMs !== undefined && (!Number.isSafeInteger(config.maximumDatabaseAgeMs) || config.maximumDatabaseAgeMs < 3_600_000 || config.maximumDatabaseAgeMs > 604_800_000))
    || !config.engineVersion.trim() || config.engineVersion.length > 80) {
    throw new DocumentScanError("ANTIVIRUS_CONFIG_INVALID");
  }
  return Object.freeze({ ...config, host, allowedHosts: Object.freeze([...allowedHosts]) });
}

function ipv4Parts(address: string): number[] | null {
  if (isIP(address) !== 4) return null;
  const parts = address.split(".").map(Number);
  return parts.length === 4 ? parts : null;
}

function isLoopback(address: string): boolean {
  const parts = ipv4Parts(address);
  return parts ? parts[0] === 127 : address.toLowerCase() === "::1";
}

function isPrivate(address: string): boolean {
  const parts = ipv4Parts(address);
  if (parts) {
    const first = parts[0] ?? -1;
    const second = parts[1] ?? -1;
    return first === 10 || (first === 172 && second >= 16 && second <= 31) || (first === 192 && second === 168) || first === 127;
  }
  const normalized = address.toLowerCase();
  return normalized === "::1" || /^f[cd][0-9a-f]{2}:/.test(normalized) || /^fe[89ab][0-9a-f]:/.test(normalized);
}

async function resolveEndpoint(config: ClamAvTcpConfig): Promise<string> {
  if (!config.allowedHosts.includes(config.host)) throw new DocumentScanError("ANTIVIRUS_CONFIG_INVALID");
  let resolved: readonly Readonly<{ address: string; family: number }>[];
  try {
    resolved = await lookup(config.host, { all: true, verbatim: true });
  } catch {
    throw new DocumentScanError("ANTIVIRUS_UNAVAILABLE", true);
  }
  if (resolved.length === 0 || resolved.some(({ address }) => config.networkMode === "LOCAL" ? !isLoopback(address) : !isPrivate(address))) {
    throw new DocumentScanError("ANTIVIRUS_CONFIG_INVALID");
  }
  const address = resolved[0]?.address;
  if (!address) throw new DocumentScanError("ANTIVIRUS_UNAVAILABLE", true);
  return address;
}

function waitForDrain(socket: Socket): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = () => { socket.off("drain", onDrain); socket.off("error", onError); socket.off("close", onClose); };
    const onDrain = () => { cleanup(); resolve(); };
    const onError = () => { cleanup(); reject(new DocumentScanError("ANTIVIRUS_UNAVAILABLE", true)); };
    const onClose = () => { cleanup(); reject(new DocumentScanError("ANTIVIRUS_UNAVAILABLE", true)); };
    socket.once("drain", onDrain);
    socket.once("error", onError);
    socket.once("close", onClose);
  });
}

async function writeBounded(socket: Socket, bytes: Uint8Array): Promise<void> {
  if (!socket.write(bytes)) await waitForDrain(socket);
}

async function exchange(config: ClamAvTcpConfig, writer: (socket: Socket) => Promise<void>, pinnedAddress?:string): Promise<string> {
  const address = pinnedAddress ?? await resolveWithinDeadline(config,Date.now()+config.timeoutMs);
  return new Promise((resolve, reject) => {
    const socket = createConnection({ host: address, port: config.port });
    const responseChunks: Buffer[] = [];
    let responseBytes = 0;
    let settled = false;
    let totalTimer:ReturnType<typeof setTimeout>|undefined;
    const fail = (error: DocumentScanError) => {
      if (settled) return;
      settled = true;
      clearTimeout(totalTimer);
      socket.destroy();
      reject(error);
    };
    const succeed = (response: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(totalTimer);
      socket.destroy();
      resolve(response);
    };
    totalTimer=setTimeout(()=>fail(new DocumentScanError("ANTIVIRUS_UNAVAILABLE",true)),config.timeoutMs);
    socket.setTimeout(config.timeoutMs, () => fail(new DocumentScanError("ANTIVIRUS_UNAVAILABLE", true)));
    socket.once("error", () => fail(new DocumentScanError("ANTIVIRUS_UNAVAILABLE", true)));
    socket.on("data", (chunk: Buffer) => {
      const terminator = chunk.indexOf(0);
      const accepted = terminator >= 0 ? chunk.subarray(0, terminator) : chunk;
      responseBytes += accepted.length;
      if (responseBytes > config.maximumResponseBytes) {
        fail(new DocumentScanError("ANTIVIRUS_RESPONSE_INVALID"));
        return;
      }
      responseChunks.push(accepted);
      if (terminator >= 0) succeed(Buffer.concat(responseChunks).toString("utf8"));
    });
    socket.once("end", () => { if (!settled) fail(new DocumentScanError("ANTIVIRUS_RESPONSE_INVALID")); });
    socket.once("connect", () => {
      void writer(socket).catch((error: unknown) => fail(
        error instanceof DocumentScanError ? error : new DocumentScanError("ANTIVIRUS_UNAVAILABLE", true),
      ));
    });
  });
}

function parseClamAvResponse(response: string, engineVersion: string): AntivirusResult {
  const normalized = response.trim();
  if (/^(?:stream|instream): OK$/i.test(normalized)) return Object.freeze({ verdict: "CLEAN", engineCode: "CLAMAV_TCP", engineVersion });
  if (/^(?:stream|instream): .+ FOUND$/i.test(normalized)) return Object.freeze({ verdict: "INFECTED", engineCode: "CLAMAV_TCP", engineVersion });
  if (/^(?:stream|instream): .+ ERROR$/i.test(normalized)) return Object.freeze({ verdict: "ERROR", engineCode: "CLAMAV_TCP", engineVersion });
  throw new DocumentScanError("ANTIVIRUS_RESPONSE_INVALID");
}

function remainingConfig(config:ClamAvTcpConfig,deadline:number):ClamAvTcpConfig {
 const remaining=deadline-Date.now();if(remaining<=0)throw new DocumentScanError("ANTIVIRUS_UNAVAILABLE",true);return {...config,timeoutMs:remaining};
}
async function resolveWithinDeadline(config:ClamAvTcpConfig,deadline:number){
 let timer:ReturnType<typeof setTimeout>|undefined;
 try{return await Promise.race([resolveEndpoint(config),new Promise<never>((_resolve,reject)=>{timer=setTimeout(()=>reject(new DocumentScanError("ANTIVIRUS_UNAVAILABLE",true)),Math.max(1,deadline-Date.now()));})]);}finally{clearTimeout(timer);}
}
type NativeVersion=Readonly<{engine:string;database:string;updatedAt:string;attested:string}>;
function parseNativeVersion(raw:string,config:ClamAvTcpConfig):NativeVersion {
 const match=raw.trim().match(/^ClamAV ([0-9]+\.[0-9]+\.[0-9]+(?:[-.][A-Za-z0-9.-]+)?)\/([0-9]{1,12})\/(.{10,100})$/u);
 if(!match||match[1]!==config.engineVersion||BigInt(match[2]!)<=0)throw new DocumentScanError("ANTIVIRUS_VERSION_UNVERIFIED",true);
 const nativeDate=match[3]!;
 const rfc=/^(?:Sun|Mon|Tue|Wed|Thu|Fri|Sat), [0-9]{2} (?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) [0-9]{4} [0-9]{2}:[0-9]{2}:[0-9]{2} GMT$/u;
 const clam=/^(?:Sun|Mon|Tue|Wed|Thu|Fri|Sat) (?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) +[0-9]{1,2} [0-9]{2}:[0-9]{2}:[0-9]{2} [0-9]{4}$/u;
 const timestamp=rfc.test(nativeDate)?Date.parse(nativeDate):clam.test(nativeDate)?Date.parse(`${nativeDate} UTC`):NaN;
 if(!Number.isFinite(timestamp))throw new DocumentScanError("ANTIVIRUS_VERSION_UNVERIFIED",true);
 const canonical=new Date(timestamp).toUTCString();const parts=canonical.split(" ");
 const nativeCanonical=`${parts[0]?.replace(",","")} ${parts[2]} ${Number(parts[1])} ${parts[4]} ${parts[3]}`;
 if(rfc.test(nativeDate)?nativeDate!==canonical:nativeDate.replace(/\s+/gu," ")!==nativeCanonical)throw new DocumentScanError("ANTIVIRUS_VERSION_UNVERIFIED",true);
 const age=Date.now()-timestamp;
 if(age < -300_000 || age > (config.maximumDatabaseAgeMs??172_800_000))throw new DocumentScanError("ANTIVIRUS_DATABASE_STALE",true);
 const updatedAt=new Date(timestamp).toISOString(),attested=`${match[1]}/db:${match[2]}@${updatedAt}`;
 if(attested.length>80)throw new DocumentScanError("ANTIVIRUS_VERSION_UNVERIFIED",true);
 return Object.freeze({engine:match[1]!,database:match[2]!,updatedAt,attested});
}
async function versionAt(config:ClamAvTcpConfig,address:string){return parseNativeVersion(await exchange(config,socket=>writeBounded(socket,Buffer.from("zVERSION\0","ascii")),address),config);}
export function createClamAvTcpScanner(config: ClamAvTcpConfig): AntivirusScanner {
 const safeConfig=validatedConfig(config);
 return Object.freeze({async scan(content:Uint8Array){
  const deadline=Date.now()+safeConfig.timeoutMs,address=await resolveWithinDeadline(safeConfig,deadline);
  const before=await versionAt(remainingConfig(safeConfig,deadline),address);
  const response=await exchange(remainingConfig(safeConfig,deadline),async socket=>{
   await writeBounded(socket,Buffer.from("zINSTREAM\0","ascii"));
   for(let offset=0;offset<content.byteLength;offset+=safeConfig.chunkBytes){const chunk=content.subarray(offset,Math.min(offset+safeConfig.chunkBytes,content.byteLength));const size=Buffer.allocUnsafe(4);size.writeUInt32BE(chunk.length);await writeBounded(socket,size);await writeBounded(socket,chunk);}await writeBounded(socket,Buffer.alloc(4));
  },address);
  const after=await versionAt(remainingConfig(safeConfig,deadline),address);
  if(before.attested!==after.attested)throw new DocumentScanError("ANTIVIRUS_VERSION_UNVERIFIED",true);
  return parseClamAvResponse(response,after.attested);
 }});
}
export function createClamAvTcpHealthCheck(config:ClamAvTcpConfig):ClamAvHealthCheck {
 const safeConfig=validatedConfig(config);
 return Object.freeze({async check(){
  const deadline=Date.now()+safeConfig.timeoutMs,address=await resolveWithinDeadline(safeConfig,deadline);
  const response=(await exchange(remainingConfig(safeConfig,deadline),socket=>writeBounded(socket,Buffer.from("zPING\0","ascii")),address)).trim();
  if(response!=="PONG")throw new DocumentScanError("ANTIVIRUS_RESPONSE_INVALID");
  const version=await versionAt(remainingConfig(safeConfig,deadline),address);
  return Object.freeze({status:"up",engineCode:"CLAMAV_TCP",engineVersion:version.attested});
 }});
}
