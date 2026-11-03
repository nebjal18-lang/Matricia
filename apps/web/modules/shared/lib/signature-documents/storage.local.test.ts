import{describe,expect,it}from"vitest";
import{createHash,randomUUID}from"node:crypto";
import{createClient}from"@supabase/supabase-js";
import{renderSignatureDocumentPdf}from"./pdf";
import{source}from"./fixture.test-support";
/** Explicit local transport exercise only. No canonical registration, signature or external system. */
describe.skipIf(process.env.RUN_LOCAL_SIGNATURE_STORAGE_TEST!=="1")("native private local source PDF storage",()=>{
 it("uploads and re-reads real FR/AR bytes, handles duplicate ACK loss, refuses public download and cleans its exact paths",async()=>{
  const url=process.env.SIGNATURE_STORAGE_TEST_URL,key=process.env.SIGNATURE_STORAGE_TEST_SERVICE_KEY;
  if(url!=="http://127.0.0.1:54321"||process.env.APP_ENV!=="development"||process.env.E2E_LOCAL_PROJECT_ID!=="Matricia"||!key)throw new Error("EXPLICIT_LOCAL_STORAGE_CONFIGURATION_REQUIRED");
  const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(10000)})}}),bucket="signature-source-documents",storage=client.storage.from(bucket),paths:string[]=[],id=randomUUID();
  const info=await client.storage.getBucket(bucket);expect(info.error).toBeNull();expect(info.data?.public).toBe(false);
  try{
   const hashes:string[]=[];
   for(const locale of["fr","ar"]as const){
    const bytes=await renderSignatureDocumentPdf(source,locale),sha=createHash("sha256").update(bytes).digest("hex"),path=`contract/${id}/${source.source_hash}/${locale}/${sha}.pdf`;paths.push(path);hashes.push(sha);
    const uploaded=await storage.upload(path,bytes,{upsert:false,contentType:"application/pdf",cacheControl:"0"});expect(uploaded.error).toBeNull();
    const duplicate=await storage.upload(path,bytes,{upsert:false,contentType:"application/pdf"});expect(String((duplicate.error as{statusCode?:unknown}|null)?.statusCode)).toBe("409");
    const read=await storage.download(path,{}, {signal:AbortSignal.timeout(10000)});expect(read.error).toBeNull();expect(read.data?.size).toBe(bytes.length);const actual=Buffer.from(await read.data!.arrayBuffer());expect(createHash("sha256").update(actual).digest("hex")).toBe(sha);expect(actual).toEqual(bytes);
    const publicRead=await fetch(`${url}/storage/v1/object/public/${bucket}/${path}`,{signal:AbortSignal.timeout(10000)});expect([400,401,403,404]).toContain(publicRead.status);await publicRead.body?.cancel();
   }
   expect(new Set(hashes).size).toBe(2);
  }finally{
   if(paths.length){const cleanup=await storage.remove(paths);expect(cleanup.error).toBeNull();for(const path of paths){const absent=await storage.download(path,{}, {signal:AbortSignal.timeout(10000)});expect(absent.error).not.toBeNull();}}
  }
 },30000);
});
