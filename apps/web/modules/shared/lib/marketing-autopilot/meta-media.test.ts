import { describe, expect, it, vi } from "vitest";
import { createMetaContainer, inspectMetaContainer, mediaBytesValid, metaMediaCaption, publishMetaContainer, verifyMetaMedia } from "./meta-media";
import type { PublicationJob } from "./publisher";
const credential={accessToken:"test-credential-".repeat(3),targetId:"123456",graphVersion:"v23.0"};
const base={containerId:"444444",publicationId:"555555",caption:"Approved\nhttps://example.test/?mref=exact",channel:"INSTAGRAM" as const,startedAt:"2026-10-31T10:00:00Z",deadlineAt:"2026-10-31T10:30:00Z"};
const media={id:"555555",caption:base.caption,owner:{id:credential.targetId},timestamp:"2026-10-31T10:05:00+00:00",media_type:"IMAGE"};
const json=(value:unknown)=>Response.json(value);
const requestQueue=(...values:unknown[])=>vi.fn<typeof fetch>().mockImplementation(async()=>json(values.shift()));
describe("durable Meta native protocol (injected responses, no publication)",()=>{
 it("sends documented container/create and publish requests to fixed Graph endpoint",async()=>{
  const request=requestQueue({id:"444444"},{id:"555555"});
  await expect(createMetaContainer(credential,{channel:"REEL",assetUrl:"https://project.supabase.co/storage/v1/object/public/marketing-media-public/hash",caption:base.caption},request)).resolves.toMatchObject({containerId:"444444",responseHash:expect.stringMatching(/^[0-9a-f]{64}$/u)});
  expect(new URLSearchParams(request.mock.calls[0]?.[1]?.body as string).get("media_type")).toBe("REELS");
  await expect(publishMetaContainer(credential,"444444",request)).resolves.toMatchObject({publicationId:"555555"});
  expect(request.mock.calls.every(([url,init])=>String(url).startsWith("https://graph.facebook.com/v23.0/")&&init?.redirect==="error")).toBe(true);
 });
 it("persists asynchronous processing instead of treating container creation as publication",async()=>{
  await expect(inspectMetaContainer(credential,"444444",requestQueue({id:"444444",status_code:"IN_PROGRESS"}))).resolves.toMatchObject({status_code:"IN_PROGRESS"});
  await expect(verifyMetaMedia(credential,base,requestQueue({id:"444444",status_code:"FINISHED"}))).rejects.toMatchObject({code:"META_CONTAINER_NOT_PUBLISHED"});
 });
 it("requires original container PUBLISHED and exact owner/caption/time before positive proof",async()=>{
  const request=requestQueue({id:"444444",status_code:"PUBLISHED"},media);await expect(verifyMetaMedia(credential,base,request)).resolves.toMatchObject({publicationId:"555555",nativeCreatedAt:media.timestamp});expect(request.mock.calls.every(([,init])=>init?.method==="GET")).toBe(true);
 });
 it.each([{...media,owner:{id:"999999"}},{...media,caption:"old identical prose without exact marker"},{...media,timestamp:"2026-10-30T10:00:00Z"},{...media,media_type:"VIDEO"}])("rejects unrelated media %#",async candidate=>{
  await expect(verifyMetaMedia(credential,base,requestQueue({id:"444444",status_code:"PUBLISHED"},candidate))).rejects.toMatchObject({code:"META_PUBLICATION_PROOF_MISMATCH"});
 });
 it("recovers lost publish response by bounded native feed only, without following next URL",async()=>{
  const request=requestQueue({id:"444444",status_code:"PUBLISHED"},{data:[media],paging:{next:"http://127.0.0.1/private",cursors:{after:"opaque-cursor"}}},{data:[]});
  await expect(verifyMetaMedia(credential,{...base,publicationId:null},request)).resolves.toMatchObject({publicationId:media.id});
  expect(String(request.mock.calls[2]?.[0])).toContain("after=opaque-cursor");expect(request.mock.calls.every(([url,init])=>String(url).startsWith("https://graph.facebook.com/")&&init?.method==="GET")).toBe(true);
 });
 it("does not accept duplicate exact markers or incomplete feed windows",async()=>{
  await expect(verifyMetaMedia(credential,{...base,publicationId:null},requestQueue({id:"444444",status_code:"PUBLISHED"},{data:[media,{...media,id:"666666"}]}))).rejects.toMatchObject({code:"META_NATIVE_PROOF_AMBIGUOUS"});
  const page={data:[media],paging:{next:"https://graph.facebook.com/next",cursors:{after:"cursor"}}};
  await expect(verifyMetaMedia(credential,{...base,publicationId:null},requestQueue({id:"444444",status_code:"PUBLISHED"},page,{...page,data:[{...media,caption:"other1"}]},{...page,data:[{...media,caption:"other2"}]}))).rejects.toMatchObject({code:"META_FEED_WINDOW_INCOMPLETE"});
 });
 it("refuses redirect/error/identifier-less responses as ambiguous",async()=>{
  await expect(publishMetaContainer(credential,"444444",requestQueue({success:true}))).rejects.toMatchObject({code:"META_PUBLISH_RESPONSE_UNKNOWN"});
  await expect(createMetaContainer(credential,{channel:"INSTAGRAM",assetUrl:"https://assets.test/photo",caption:"test"},vi.fn().mockResolvedValue(new Response("",{status:503})))).rejects.toMatchObject({code:"META_POST_RESULT_UNKNOWN"});
 });
 it("binds a unique execution tracking parameter and checks asset signatures",()=>{
  const job={content:{hook:"h",body:"b",cta:"c",landing_url:"https://app.test/cta?keep=1",hashtags:[]}} as unknown as PublicationJob;
  expect(metaMediaCaption(job,"eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee")).toContain("keep=1&mref=eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee");
  expect(mediaBytesValid(new Uint8Array([255,216,255,0]),"image/jpeg")).toBe(true);expect(mediaBytesValid(new Uint8Array([0,0,0,16,102,116,121,112,0,0,0,0,0]),"video/mp4")).toBe(true);expect(mediaBytesValid(new TextEncoder().encode("not a jpeg"),"image/jpeg")).toBe(false);
 });
});
