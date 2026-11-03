import { generateServiceContent, generatedServiceContentSchema, serviceContentInput, type GeneratedServiceContent } from "./content-engine";
import type { z } from "zod";
import { isIP } from "node:net";
import { request as httpsRequest } from "node:https";
import { lookup } from "node:dns/promises";

export type ServiceContentRequest = z.input<typeof serviceContentInput>;
export type MarketingContentProvider = {
  name: string;
  generate(request: ServiceContentRequest): Promise<GeneratedServiceContent[]>;
};
export type ProviderRun = { provider: string; contents: GeneratedServiceContent[]; failoverUsed: boolean };

export const deterministicSandboxProvider: MarketingContentProvider = {
  name: "DETERMINISTIC_SANDBOX",
  async generate(request) { return generateServiceContent(request); },
};

export function publicIp(host:string){if(isIP(host)===4){const [a,b,c]=host.split(".").map(Number);return !(a===0||a===10||a===127||a>=224||(a===100&&b>=64&&b<=127)||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&(b===0||b===168||b===2||b===88&&c===99))||(a===198&&(b===18||b===19||b===51&&c===100))||(a===203&&b===0&&c===113))}if(isIP(host)!==6)return false;const [one,two]=host.split(":");const first=Number.parseInt(one||"0",16),second=Number.parseInt(two||"0",16);return first>=0x2000&&first<0x3fff&&first!==0x2002&&!(first===0x2001&&(second<0x0200||second===0x0db8))}
async function boundedJson(response:Response){const declared=Number(response.headers.get("content-length")??"0");if(declared>262144)throw new Error("MARKETING_PROVIDER_RESPONSE_TOO_LARGE");const reader=response.body?.getReader();if(!reader)return null;const chunks:Uint8Array[]=[];let size=0;for(;;){const{done,value}=await reader.read();if(done)break;if(value){size+=value.byteLength;if(size>262144){await reader.cancel();throw new Error("MARKETING_PROVIDER_RESPONSE_TOO_LARGE")}chunks.push(value)}}const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength}return JSON.parse(new TextDecoder().decode(bytes))as unknown}
type PinnedRequest = (endpoint: URL, address: string, body: string, headers: Record<string, string>, signal: AbortSignal, options?: {maxResponseBytes:number}) => Promise<Response>;
/** Connect to the address actually checked, while retaining TLS hostname verification and SNI. */
export const pinnedProviderRequest: PinnedRequest = (endpoint, address, body, headers, signal, options) => new Promise((resolve, reject) => {
  const request = httpsRequest(endpoint, {
    method: "POST", headers, signal, agent: false, family: isIP(address), rejectUnauthorized:true,
    lookup: (_hostname, _options, callback) => callback(null, address, isIP(address)),
  }, response => {
    const maxResponseBytes=options?.maxResponseBytes??262144;
    const declared=Number(response.headers["content-length"]??"0");
    if(declared>maxResponseBytes){response.destroy();reject(new Error("PROVIDER_RESPONSE_TOO_LARGE"));return;}
    const responseHeaders=new Headers();for(const [key,value]of Object.entries(response.headers))if(value!==undefined)responseHeaders.set(key,Array.isArray(value)?value.join(", "):value);
    const chunks: Buffer[] = []; let size = 0;
    response.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > maxResponseBytes) { response.destroy(new Error("MARKETING_PROVIDER_RESPONSE_TOO_LARGE")); return; }
      chunks.push(chunk);
    });
    response.on("error", reject);
    response.on("end", () => { try { const status = response.statusCode ?? 502; resolve(new Response([204,205,304].includes(status) ? null : Buffer.concat(chunks), { status,headers:responseHeaders })); } catch (error) { reject(error); } });
  });
  request.on("error", reject);
  request.end(body);
});

export function configuredExternalProvider(config: {
  endpoint: string; endpointAllowlist: string[]; apiKey: string; name?: string;
  resolveAddresses?: (host: string) => Promise<readonly string[]>;
  sendPinned?: PinnedRequest;
}): MarketingContentProvider {
  const endpoint = new URL(config.endpoint), host = endpoint.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (endpoint.protocol !== "https:" || endpoint.username || endpoint.password || (endpoint.port && endpoint.port !== "443") || !config.endpointAllowlist.includes(endpoint.href) || (isIP(host) ? !publicIp(host) : !validProviderHost(host)) || config.apiKey.length < 32) throw new Error("MARKETING_PROVIDER_CONFIG_INVALID");
  return { name: config.name ?? "CONFIGURED_EXTERNAL", async generate(request) {
    const signal = AbortSignal.timeout(20_000);
    const headers = { authorization: `Bearer ${config.apiKey}`, "content-type": "application/json", "user-agent": "matricia-marketing-worker/1", ...(request.providerIdempotencyKey ? { "idempotency-key": request.providerIdempotencyKey } : {}) };
    const body = JSON.stringify(request);
    let response: Response;
    if (isIP(host)) {
      response = await fetch(endpoint, { method: "POST", headers, body, signal, redirect: "error" });
    } else {
      const addresses = await new Promise<readonly string[]>((resolve, reject) => {
        const abort = () => reject(new Error("MARKETING_PROVIDER_TIMEOUT"));
        signal.addEventListener("abort", abort, { once: true });
        (config.resolveAddresses?.(host) ?? lookup(host, { all: true, verbatim: true }).then(rows => rows.map(row => row.address)))
          .then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
      });
      if (!addresses.length || addresses.some(address => !publicIp(address))) throw new Error("MARKETING_PROVIDER_ADDRESS_DENIED");
      response = await (config.sendPinned ?? pinnedProviderRequest)(endpoint, addresses[0]!, body, headers, signal);
    }
    if (!response.ok) throw new Error("MARKETING_PROVIDER_FAILED");
    const raw = await boundedJson(response);
    return generatedServiceContentSchema.array().length(3).parse(raw);
  } };
}

function validProviderHost(host:string){return /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/u.test(host)&&host.includes(".")&&!/(?:\.local|\.internal|\.invalid|\.test|\.localhost)$/u.test(host)}

export function configuredProviders(env:NodeJS.ProcessEnv=process.env):readonly MarketingContentProvider[]{
  const providers:MarketingContentProvider[]=[];
  for(const prefix of ["MARKETING_CONTENT_PROVIDER", "MARKETING_CONTENT_FALLBACK_PROVIDER"]){
    const endpoint=env[`${prefix}_URL`],apiKey=env[`${prefix}_API_KEY`];
    const endpointAllowlist=(env[`${prefix}_ENDPOINT_ALLOWLIST`]??"").split(",").map(x=>x.trim()).filter(Boolean);
    if(endpoint&&apiKey&&endpointAllowlist.length)providers.push(configuredExternalProvider({endpoint,endpointAllowlist,apiKey,name:prefix==="MARKETING_CONTENT_PROVIDER"?"CONFIGURED_EXTERNAL":"CONFIGURED_FALLBACK"}));
  }
  if(env.NODE_ENV!=="production"&&env.APP_ENV?.trim().toLowerCase()!=="production")providers.push(deterministicSandboxProvider);
  return providers;
}

function validBatch(contents: GeneratedServiceContent[]) {
  return contents.length === 3 && new Set(contents.map((item) => item.channel)).size === 3
    && contents.every((item) => item.contentHash.length === 64 && item.landingUrl.startsWith("https://"));
}

export async function generateWithFailover(request: ServiceContentRequest, providers: readonly MarketingContentProvider[]): Promise<ProviderRun> {
  if (!providers.length) throw new Error("MARKETING_PROVIDER_UNAVAILABLE");
  for (let index = 0; index < providers.length; index++) {
    const provider = providers[index]!;
    try {
      const contents = await provider.generate(request);
      if (validBatch(contents)) return { provider: provider.name, contents, failoverUsed: index > 0 };
    } catch {
      // Provider failures are intentionally opaque; the next configured adapter is tried.
    }
  }
  throw new Error("MARKETING_PROVIDER_UNAVAILABLE");
}
