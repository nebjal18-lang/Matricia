import { renderToStaticMarkup } from "react-dom/server";
import { describe,expect,it } from "vitest";
import { ContractSnapshot } from "./contract-dossier";
describe("contractual bilingual content",()=>{
 it("keeps every contractual policy beside its approved localized wording",()=>{const html=renderToStaticMarkup(<ContractSnapshot locale="ar" value={{fr:"Clause française",ar:"بند معتمد",dispute_policy:{review_business_days:2},description:"Texte libre non traduit"}}/>);expect(html).toContain("بند معتمد");expect(html).not.toContain("Clause française");expect(html).toContain("review business days");expect(html).toContain("Texte libre non traduit")});
 it("escapes immutable user-entered contractual text",()=>{const html=renderToStaticMarkup(<ContractSnapshot locale="fr" value={{description:"<script>alert(1)</script>"}}/>);expect(html).toContain("&lt;script&gt;");expect(html).not.toContain("<script>")});
});
