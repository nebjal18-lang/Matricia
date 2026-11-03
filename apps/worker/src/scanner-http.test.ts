import { createHash,createHmac,randomUUID } from "node:crypto";
import { request as httpRequest, createServer as createHttpServer } from "node:http";
import { createServer as createTcpServer } from "node:net";
import { afterEach,expect,it,vi } from "vitest";
import { createScannerHttpHandler } from "./scanner-http";
import { createClamAvTcpScanner } from "./client-compliance/clamav-tcp";
import type { AntivirusScanner } from "./client-compliance/contracts";
const token="t".repeat(32),bytes=Buffer.from("%PDF-1.7 exact bytes"),hash=createHash("sha256").update(bytes).digest("hex");
const clean:AntivirusScanner={scan:vi.fn(async()=>({verdict:"CLEAN" as const,engineCode:"CLAMAV_TCP",engineVersion:"1.4.2"}))};
const cleanup:Array<()=>Promise<void>>=[];
afterEach(async()=>{while(cleanup.length)await cleanup.pop()!();});
async function http(scanner:AntivirusScanner=clean,available=()=>true,secret=token){const handler=createScannerHttpHandler({scanner,token:secret,available});const server=createHttpServer((req,res)=>void handler(req,res));await new Promise<void>(resolve=>server.listen(0,"127.0.0.1",resolve));cleanup.push(()=>new Promise<void>((resolve,reject)=>{server.close(error=>error?reject(error):resolve());server.closeAllConnections();}));const address=server.address();if(!address||typeof address==="string")throw new Error("address");return `http://127.0.0.1:${address.port}/scan`;}
const payload=(overrides:Record<string,unknown>={})=>({version:2,sha256:hash,contentBase64:bytes.toString("base64"),mediaType:"application/pdf",requestNonce:randomUUID(),issuedAt:new Date().toISOString(),...overrides});
const post=(url:string,body:unknown=payload(),secret=token)=>fetch(url,{method:"POST",headers:{authorization:`Bearer ${secret}`,"content-type":"application/json"},body:JSON.stringify(body)});
it.each(["application/pdf","text/plain","application/json","text/csv"])("routes actual %s HTTP bytes through the real ClamAV INSTREAM adapter and signs the exact native result (TCP fixture)",async(mediaType)=>{
 const databaseDate=new Date().toUTCString();let scanned:Buffer|undefined;const tcp=createTcpServer(socket=>{let buffered=Buffer.alloc(0),header=false;const chunks:Buffer[]=[];socket.on("data",chunk=>{buffered=Buffer.concat([buffered,chunk]);if(!header){if(buffered.length>=9&&buffered.subarray(0,9).toString()==="zVERSION\0"){socket.end(`ClamAV 1.4.2-test-protocol/28000/${databaseDate}\0`);return;}if(buffered.length<10)return;expect(buffered.subarray(0,10).toString()).toBe("zINSTREAM\0");buffered=buffered.subarray(10);header=true;}while(buffered.length>=4){const size=buffered.readUInt32BE();if(buffered.length<4+size)return;buffered=buffered.subarray(4);if(size===0){scanned=Buffer.concat(chunks);socket.end("stream: OK\0");return;}chunks.push(buffered.subarray(0,size));buffered=buffered.subarray(size);}});});await new Promise<void>(resolve=>tcp.listen(0,"127.0.0.1",resolve));cleanup.push(()=>new Promise<void>(resolve=>tcp.close(()=>resolve())));const address=tcp.address();if(!address||typeof address==="string")throw new Error("tcp address");
 const scanner=createClamAvTcpScanner({host:"127.0.0.1",allowedHosts:["127.0.0.1"],networkMode:"LOCAL",port:address.port,engineVersion:"1.4.2-test-protocol",timeoutMs:1000,chunkBytes:1024,maximumResponseBytes:4096});const actualBytes=mediaType==="text/plain"?Buffer.from("Private attachment text protocol fixture"):mediaType==="application/json"?Buffer.from(JSON.stringify({synthetic_export:true})):mediaType==="text/csv"?Buffer.from("id,value\ntest,synthetic\n"):bytes;const actualHash=createHash("sha256").update(actualBytes).digest("hex");const request=payload({mediaType,contentBase64:actualBytes.toString("base64"),sha256:actualHash});const response=await post(await http(scanner),request);expect(response.status).toBe(200);const raw=await response.text();expect(response.headers.get("x-scan-signature")).toBe(createHmac("sha256",token).update(raw).digest("hex"));expect(JSON.parse(raw)).toMatchObject({version:2,result:"CLEAN",sha256:actualHash,requestNonce:request.requestNonce,engineCode:"CLAMAV_TCP",engineVersion:expect.stringMatching(/^1\.4\.2-test-protocol\/db:28000@/u)});expect(scanned).toEqual(actualBytes);
});
it("refuses wrong secrets and an unavailable scanner before parsing/scanning",async()=>{
 const scan=vi.fn();const scanner={scan};expect((await post(await http(scanner),payload(),"wrong")).status).toBe(401);expect((await post(await http(scanner,()=>false))).status).toBe(503);expect((await post(await http(scanner,()=>true,""))).status).toBe(503);expect(scan).not.toHaveBeenCalled();
});
it("rejects stale requests, hash changes and replayed nonce",async()=>{
 const url=await http(),request=payload();expect((await post(url,{...request,issuedAt:new Date(Date.now()-120000).toISOString()})).status).toBe(400);expect((await post(url,{...request,sha256:"f".repeat(64)})).status).toBe(422);expect((await post(url,request)).status).toBe(200);expect((await post(url,request)).status).toBe(409);
});
it("reports scanner failure without a signed CLEAN result or leaked exception",async()=>{
 const response=await post(await http({scan:async()=>{throw new Error("private scanner details");}}));expect(response.status).toBe(503);expect(response.headers.get("x-scan-signature")).toBeNull();expect(await response.text()).not.toContain("private scanner details");
});
it("preserves infected verdict and refuses ERROR as scanner unavailability",async()=>{
 const infected=await post(await http({scan:async()=>({verdict:"INFECTED",engineCode:"CLAMAV_TCP",engineVersion:"1.4.2"})}));expect(await infected.json()).toMatchObject({result:"INFECTED"});const error=await post(await http({scan:async()=>({verdict:"ERROR",engineCode:"CLAMAV_TCP",engineVersion:"1.4.2"})}));expect(error.status).toBe(503);
});

it("refuses declared bodies over the encoded10MiB contract before scanner allocation",async()=>{
 const scan=vi.fn();const url=await http({scan});const status=await new Promise<number>((resolve,reject)=>{const request=httpRequest(url,{method:"POST",headers:{authorization:`Bearer ${token}`,"content-type":"application/json","content-length":String(Math.ceil(10485760/3)*4+8193)}},response=>{response.resume();response.on("end",()=>resolve(response.statusCode??0));});request.on("error",reject);request.end();});expect(status).toBe(413);expect(scan).not.toHaveBeenCalled();
});
it("bounds concurrency and leaves unavailable scans unsigned",async()=>{
 let entered!:()=>void;const started=new Promise<void>(resolve=>{entered=resolve;});let finish!:()=>void;const wait=new Promise<void>(resolve=>{finish=resolve;});const url=await http({scan:async()=>{entered();await wait;return {verdict:"CLEAN",engineCode:"CLAMAV_TCP",engineVersion:"1.4.2"};}});const first=post(url);await started;const second=await post(url);expect(second.status).toBe(503);expect(second.headers.get("x-scan-signature")).toBeNull();finish();expect((await first).status).toBe(200);
});

it("does not sign a CLEAN verdict when TCP PONG availability masks a stale native database",async()=>{
 let streams=0;const tcp=createTcpServer(socket=>{socket.once("data",data=>{if(data.toString().startsWith("zVERSION"))socket.end(`ClamAV 1.4.2/28000/${new Date(Date.now()-49*3600000).toUTCString()}\0`);else{streams++;socket.end("stream: OK\0");}});});await new Promise<void>(resolve=>tcp.listen(0,"127.0.0.1",resolve));cleanup.push(()=>new Promise<void>(resolve=>tcp.close(()=>resolve())));const address=tcp.address();if(!address||typeof address==="string")throw new Error("tcp");
 const scanner=createClamAvTcpScanner({host:"127.0.0.1",allowedHosts:["127.0.0.1"],networkMode:"LOCAL",port:address.port,engineVersion:"1.4.2",timeoutMs:1000,chunkBytes:1024,maximumResponseBytes:4096});const response=await post(await http(scanner,()=>true));expect(response.status).toBe(503);expect(response.headers.get("x-scan-signature")).toBeNull();expect(streams).toBe(0);
});

it("refuses ZIP without native archive capability evidence, never signing a CLEAN or invoking scan",async()=>{
 const scan=vi.fn();const zip=Buffer.from("504b0506000000000000000000000000000000000000","hex"),request=payload({mediaType:"application/zip",contentBase64:zip.toString("base64"),sha256:createHash("sha256").update(zip).digest("hex")});const response=await post(await http({scan}),request);expect(response.status).toBe(503);expect(await response.json()).toEqual({code:"ARCHIVE_SCAN_CAPABILITY_REQUIRED"});expect(response.headers.get("x-scan-signature")).toBeNull();expect(scan).not.toHaveBeenCalled();
});

it.each(["application/pdf","application/json"])("does not bypass missing archive capability when ZIP bytes are labelled %s",async mediaType=>{const scan=vi.fn(),zip=Buffer.concat([Buffer.from("%PDF-1.7\n"),Buffer.from("504b0506000000000000000000000000000000000000","hex")]),request=payload({mediaType,contentBase64:zip.toString("base64"),sha256:createHash("sha256").update(zip).digest("hex")});const response=await post(await http({scan}),request);expect(response.status).toBe(503);expect(await response.json()).toEqual({code:"ARCHIVE_SCAN_CAPABILITY_REQUIRED"});expect(response.headers.get("x-scan-signature")).toBeNull();expect(scan).not.toHaveBeenCalled();});
