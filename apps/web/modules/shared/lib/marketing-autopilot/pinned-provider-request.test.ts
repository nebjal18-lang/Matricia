import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { expect,it,vi } from "vitest";
const mock=vi.hoisted(()=>({request:vi.fn()}));
vi.mock("node:https",()=>({request:mock.request}));
import { pinnedProviderRequest } from "./provider-orchestrator";
function response(body:string){mock.request.mockImplementation((_url,options,callback)=>{const request=new EventEmitter()as EventEmitter&{end:(body:string)=>void};request.end=()=>{const incoming=new PassThrough()as PassThrough&{statusCode:number;headers:Record<string,string>};incoming.statusCode=200;incoming.headers={"x-scan-signature":"signed-value","content-type":"application/json"};callback(incoming);queueMicrotask(()=>incoming.end(body));};return request;});}
it("pins lookup to the validated address while retaining original HTTPS host and certificate validation",async()=>{
 response('{"ok":true}');const endpoint=new URL("https://scanner-production.up.railway.app/scan");const result=await pinnedProviderRequest(endpoint,"8.8.8.8","payload",{},AbortSignal.timeout(1000),{maxResponseBytes:32768});expect(result.headers.get("x-scan-signature")).toBe("signed-value");const [url,options]=mock.request.mock.calls[0]!;expect(url).toBe(endpoint);expect(options).toMatchObject({family:4,rejectUnauthorized:true,agent:false});const checked=vi.fn();options.lookup("scanner-production.up.railway.app",{},checked);expect(checked).toHaveBeenCalledWith(null,"8.8.8.8",4);
});
it("destroys the real Node response stream as soon as its configured byte cap is exceeded",async()=>{
 response("x".repeat(32769));await expect(pinnedProviderRequest(new URL("https://scanner-production.up.railway.app/scan"),"8.8.8.8","payload",{},AbortSignal.timeout(1000),{maxResponseBytes:32768})).rejects.toThrow("MARKETING_PROVIDER_RESPONSE_TOO_LARGE");
});
