import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { signerPreparationSchema } from "@/modules/shared/lib/signer-preparation/model";
import { SignerPreparationPanel } from "./panel";
const id="03940000-0000-4000-8000-000000000001";
const initial=signerPreparationSchema.parse({envelopeId:id,signerId:id,contractId:id,amendmentId:null,status:"DRAFT",canConfigure:true,firstName:"",lastName:"",locale:"fr",fields:[],documents:[{id,sha256:"a".repeat(64),fileName:"contrat.pdf",contractVersionId:id,locale:"fr"}]});
it("renders explicit blank identity/placements with an authenticated private PDF preview", () => {
  const html=renderToStaticMarkup(createElement(SignerPreparationPanel,{initial,locale:"fr"}));
  expect(html).toContain("Préparer ma signature");expect(html.toLowerCase()).toContain('autocomplete="given-name"');expect(html).toContain('value=""');expect(html).toContain(`/api/signatures/yousign/envelopes/${id}/documents/${id}`);expect(html).toContain("iframe");expect(html).toContain("Enregistrer ma préparation");expect(html).not.toContain("storage_path");
});
it("provides Arabic RTL labels and actual same-origin document access", () => {
  const html=renderToStaticMarkup(createElement(SignerPreparationPanel,{initial,locale:"ar"}));expect(html).toContain('dir="rtl"');expect(html).toContain("إعداد توقيعي");expect(html).toContain("الاسم الشخصي الدقيق");expect(html).toContain('rel="noreferrer"');
});
it("keeps dispatched preparation read-only and explains the freeze", () => {
  const html=renderToStaticMarkup(createElement(SignerPreparationPanel,{initial:{...initial,canConfigure:false,status:"SENT"},locale:"fr"}));expect(html).toContain("La préparation est verrouillée");expect(html).toContain("disabled");
});
