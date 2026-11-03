import { createHash,createHmac } from "node:crypto";
import { afterEach,beforeEach,expect,it,vi } from "vitest";
import { scanDocumentBytes } from "./scanner";
const token="t".repeat(32),bytes=Buffer.from("%PDF-1.7 scanner test"),hash=createHash("sha256").update(bytes).digest("hex"),nonce="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",now=Date.parse("2026-11-01T00:00:00Z");
const base={resolveAddresses:async()=>["8.8.8.8"],now:()=>now,nonce:()=>nonce};
function response(overrides:Record<string,unknown>={}){const body=JSON.stringify({version:2,result:"CLEAN",sha256:hash,requestNonce:nonce,scannedAt:new Date(now).toISOString(),engineCode:"CLAMAV_TCP",engineVersion:"1.4.2",...overrides});return new Response(body,{headers:{"x-scan-signature":createHmac("sha256",token).update(body).digest("hex")}});}
beforeEach(()=>{vi.stubEnv("MALWARE_SCANNER_URL","https://scanner-production.up.railway.app/scan");vi.stubEnv("MALWARE_SCANNER_ALLOWED_HOSTS","scanner-production.up.railway.app");vi.stubEnv("MALWARE_SCANNER_TOKEN",token);vi.stubEnv("DELIVERY_PROOF_SCANNER_MODE","EXTERNAL");});
afterEach(()=>vi.unstubAllEnvs());
it("accepts an allowlisted Railway hostname and pins the checked global address",async()=>{
 const sendPinned=vi.fn(async()=>response());expect(await scanDocumentBytes(bytes,hash,"application/pdf",{...base,sendPinned})).toMatchObject({result:"CLEAN",engineCode:"CLAMAV_TCP"});expect(sendPinned).toHaveBeenCalledWith(new URL("https://scanner-production.up.railway.app/scan"),"8.8.8.8",expect.stringContaining(nonce),expect.objectContaining({authorization:`Bearer ${token}`}),expect.any(AbortSignal),{maxResponseBytes:32768});
});
it.each([["8.8.8.8","127.0.0.1"],["169.254.169.254"],["::ffff:7f00:1"],["fd00::1"],[]].map(addresses=>({addresses})))("rejects every mixed/private or empty DNS answer %# before connecting",async({addresses})=>{
 const sendPinned=vi.fn();expect(await scanDocumentBytes(bytes,hash,"application/pdf",{...base,resolveAddresses:async()=>addresses,sendPinned})).toMatchObject({result:"ERROR",retryable:true});expect(sendPinned).not.toHaveBeenCalled();
});
it("uses one checked answer and never falls back to unvalidated fetch/DNS",async()=>{
 let resolutions=0;const request=vi.fn();const sendPinned=vi.fn(async(_url:URL,address:string)=>{expect(address).toBe("8.8.8.8");return response();});await scanDocumentBytes(bytes,hash,"application/pdf",{...base,request,resolveAddresses:async()=>++resolutions===1?["8.8.8.8"]:["127.0.0.1"],sendPinned});expect(resolutions).toBe(1);expect(request).not.toHaveBeenCalled();
});
it.each([{requestNonce:"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"},{scannedAt:new Date(now-60_001).toISOString()},{scannedAt:new Date(now+60_001).toISOString()},{sha256:"f".repeat(64)},{version:1}])("rejects stale or mismatched correctly signed verdict %#",async overrides=>{
 expect(await scanDocumentBytes(bytes,hash,"application/pdf",{...base,sendPinned:async()=>response(overrides)})).toMatchObject({result:"ERROR",retryCode:"SCANNER_INVALID_RESPONSE"});
});
it("cancels an oversized response stream at32KiB before allocating its remainder",async()=>{
 const cancel=vi.fn();let pulls=0;const stream=new ReadableStream<Uint8Array>({pull(controller){pulls++;controller.enqueue(new Uint8Array(20000));},cancel});const result=await scanDocumentBytes(bytes,hash,"application/pdf",{...base,sendPinned:async()=>new Response(stream)});expect(result.result).toBe("ERROR");expect(cancel).toHaveBeenCalled();expect(pulls).toBeLessThanOrEqual(3);
});
it("rejects an oversized declared response without reading the body",async()=>{
 const cancel=vi.fn();const stream=new ReadableStream<Uint8Array>({cancel});expect((await scanDocumentBytes(bytes,hash,"application/pdf",{...base,sendPinned:async()=>new Response(stream,{headers:{"content-length":"32769"}})})).result).toBe("ERROR");expect(cancel).toHaveBeenCalled();
});
it("refuses files over10MiB and altered input hashes before DNS or network",async()=>{
 const resolveAddresses=vi.fn();expect((await scanDocumentBytes(bytes,"a".repeat(64),"application/pdf",{...base,resolveAddresses})).result).toBe("ERROR");expect((await scanDocumentBytes(Buffer.alloc(10485761),hash,"application/pdf",{...base,resolveAddresses})).result).toBe("ERROR");expect(resolveAddresses).not.toHaveBeenCalled();
});

it.each([["application/json",'{"synthetic_export":true}'],["text/csv","id,value\ntest,synthetic\n"],["application/zip","PK synthetic archive"]])("does not invent sandbox CLEAN for export type %s",async(mediaType,body)=>{
 vi.stubEnv("DELIVERY_PROOF_SCANNER_MODE","SANDBOX");vi.stubEnv("APP_ENV","development");vi.stubEnv("NODE_ENV","test");const actual=Buffer.from(body),sha=createHash("sha256").update(actual).digest("hex"),sendPinned=vi.fn();expect(await scanDocumentBytes(actual,sha,mediaType,{...base,sendPinned})).toMatchObject({result:"ERROR",engineCode:"MATRICIA_SANDBOX"});expect(sendPinned).not.toHaveBeenCalled();
});
