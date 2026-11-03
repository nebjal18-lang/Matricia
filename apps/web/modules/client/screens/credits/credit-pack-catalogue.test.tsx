import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
const rpc=vi.hoisted(()=>vi.fn());
vi.mock("@/modules/shared/lib/supabase/server",()=>({getSupabaseServerClient:async()=>({rpc})}));
vi.mock("../abonnement/payment-capture-return",()=>({PaymentCaptureReturn:()=>null}));
vi.mock("../abonnement/payment-intent-button",()=>({PaymentIntentButton:({packVersionId,attemptKey}:{packVersionId:string;attemptKey?:string})=><button data-pack={packVersionId} data-attempt={attemptKey}>Checkout</button>}));
vi.mock("./credit-pack-status",()=>({CreditPackStatus:()=>null}));
import { CreditPackCatalogue } from "./credit-pack-catalogue";
const org="ba301000-0000-4000-8000-000000000001",pack={id:"da301000-0000-4000-8000-000000000001",name_fr:"Pack publié",name_ar:"حزمة منشورة",quantity:"9007199254740993",price_minor:"1550",currency:"MAD",validity_days:180,pending:false,attempt_key:null,payment_intent_id:null};
beforeEach(()=>{vi.resetAllMocks();rpc.mockResolvedValue({data:{can_purchase:true,packs:[pack]},error:null});});
it.each(["fr","ar"] as const)("renders only exact published terms and the native pack purchase (%s)",async locale=>{
 const html=renderToStaticMarkup(await CreditPackCatalogue({locale,organizationId:org}));
 expect(html).toContain(locale==="fr"?pack.name_fr:pack.name_ar);expect(html).toContain(pack.quantity);expect(html).toContain('data-pack="'+pack.id+'"');
 expect(rpc).toHaveBeenCalledWith("get_client_credit_pack_catalogue_v1",{p_organization_id:org});
});
it("does not disguise failed catalogue loading as no published offers",async()=>{
 rpc.mockResolvedValueOnce({data:null,error:{code:"XX000"}});const html=renderToStaticMarkup(await CreditPackCatalogue({locale:"fr",organizationId:org}));
 expect(html).toContain('role="alert"');expect(html).toContain("indisponibles");expect(html).not.toContain("Aucun pack");expect(html).not.toContain("Checkout");
});
it("distinguishes a real empty catalogue and a read-only member",async()=>{
 rpc.mockResolvedValueOnce({data:{can_purchase:false,packs:[]},error:null});expect(renderToStaticMarkup(await CreditPackCatalogue({locale:"fr",organizationId:org}))).toContain("Aucun pack");
 rpc.mockResolvedValueOnce({data:{can_purchase:false,packs:[pack]},error:null});expect(renderToStaticMarkup(await CreditPackCatalogue({locale:"fr",organizationId:org}))).not.toContain("Checkout");
});
it("reuses the actor's durable attempt and offers assistance for another actor's unresolved purchase",async()=>{
 rpc.mockResolvedValueOnce({data:{can_purchase:true,packs:[{...pack,pending:true,attempt_key:"same-durable-attempt"}]},error:null});
 let html=renderToStaticMarkup(await CreditPackCatalogue({locale:"fr",organizationId:org}));expect(html).toContain('data-attempt="same-durable-attempt"');expect(html).toContain("Un achat est déjà en cours");
 rpc.mockResolvedValueOnce({data:{can_purchase:true,packs:[{...pack,pending:true}]},error:null});
 html=renderToStaticMarkup(await CreditPackCatalogue({locale:"fr",organizationId:org}));expect(html).not.toContain("Checkout");expect(html).toContain("Contacter l’assistance");
});
