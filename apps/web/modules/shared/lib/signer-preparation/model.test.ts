import { describe, expect, it } from "vitest";
import { preparationDocumentUrl, preparationInput, samePreparation, signerPreparationSchema } from "./model";
const id = "03940000-0000-4000-8000-000000000001", hash = "a".repeat(64);
const document = { id,sha256:hash,fileName:"contrat.pdf",contractVersionId:id,locale:"fr" as const };
const current = { envelopeId:id,signerId:id,contractId:id,amendmentId:null,status:"DRAFT",canConfigure:true,firstName:"",lastName:"",locale:"fr",fields:[],documents:[document] };
describe("explicit signer preparation input", () => {
  it("retains exact explicit names and chosen document placement", () => {
    expect(preparationInput(" Mina ","Alami","fr",[{documentSha256:hash,page:"2",x:"40",y:"600"}],[document])).toEqual({firstName:"Mina",lastName:"Alami",locale:"fr",fields:[{documentSha256:hash,page:2,x:40,y:600}]});
  });
  it.each(["", "-1", "1.5", "1e2"])("does not invent a numeric position from %s", x => {
    expect(() => preparationInput("Mina","Alami","fr",[{documentSha256:hash,page:"1",x,y:"600"}],[document])).toThrow();
  });
  it("rejects a different document even when the position is syntactically valid", () => {
    expect(() => preparationInput("Mina","Alami","fr",[{documentSha256:"b".repeat(64),page:"1",x:"40",y:"600"}],[document])).toThrow();
  });
  it("requires explicit names and does not infer them from display data", () => {
    expect(() => preparationInput("","","fr",[{documentSha256:hash,page:"1",x:"40",y:"600"}],[document])).toThrow();
  });
  it("rejects private paths, another signer or fields outside the projected documents", () => {
    expect(signerPreparationSchema.safeParse({...current,storagePath:"private/source.pdf"}).success).toBe(false);
    expect(signerPreparationSchema.safeParse({...current,fields:[{documentSha256:"b".repeat(64),page:1,x:40,y:600}]}).success).toBe(false);
  });
  it("confirms success only when the readback matches every prepared value", () => {
    const input=preparationInput("Mina","Alami","fr",[{documentSha256:hash,page:"1",x:"40",y:"600"}],[document]);
    expect(samePreparation(signerPreparationSchema.parse({...current,...input}),input)).toBe(true);
    expect(samePreparation(signerPreparationSchema.parse({...current,...input,lastName:"Other"}),input)).toBe(false);
    expect(samePreparation(signerPreparationSchema.parse({...current,...input,fields:[{...input.fields[0],x:41}]}),input)).toBe(false);
  });
  it("builds only same-origin routes with valid exact identifiers", () => {
    expect(preparationDocumentUrl(id,id)).toBe(`/api/signatures/yousign/envelopes/${id}/documents/${id}`);
    expect(() => preparationDocumentUrl("https://evil.example",id)).toThrow();
  });
});
