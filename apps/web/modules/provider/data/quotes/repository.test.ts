import { describe, expect, it, vi } from "vitest";
vi.mock("@/modules/shared/lib/supabase/server", () => ({ getSupabaseServerClient: vi.fn() }));
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";
import { loadProviderQuotes, parseQuoteVersionAmounts, sharedDocumentsFromRows, unambiguousTaxRules } from "./repository";

describe("provider consultation and quote Auth reads", () => {
  it.each([[503, "AUTH_QUERY_FAILED"], [401, "UNAUTHENTICATED"]] as const)("preserves Auth %s before reading business data", async (status, reason) => {
    const from = vi.fn();
    vi.mocked(getSupabaseServerClient).mockResolvedValue({ auth: { getUser: async () => ({ data: { user: null }, error: { status } }) }, from } as never);
    expect(await loadProviderQuotes()).toEqual({ status: "error", reason });
    expect(from).not.toHaveBeenCalled();
  });
});

const rule = (id: string, category: string, rate: number) => ({
  id,
  category_code: category,
  rate_basis_points: rate,
  effective_from: "2026-01-01",
  effective_to: null,
  professional_validation_status: "VALIDATED" as const,
});

describe("provider quote tax selection", () => {
  it("exclut toute catégorie fiscale ambiguë", () => {
    const selected = unambiguousTaxRules([
      rule("11111111-1111-4111-8111-111111111111", "STANDARD_SERVICE", 2000),
      rule("22222222-2222-4222-8222-222222222222", "STANDARD_SERVICE", 1000),
      rule("33333333-3333-4333-8333-333333333333", "EXEMPT", 0),
    ]);
    expect(selected.map((item) => item.category_code)).toEqual(["EXEMPT"]);
  });
  it("conserve les versions non chevauchantes nécessaires aux dates futures",()=>{const selected=unambiguousTaxRules([{...rule("11111111-1111-4111-8111-111111111111","STANDARD_SERVICE",2000),effective_to:"2026-12-31"},{...rule("22222222-2222-4222-8222-222222222222","STANDARD_SERVICE",2100),effective_from:"2027-01-01"}]);expect(selected.map(item=>item.id)).toHaveLength(2);});
});

describe("provider quote exact amount projection", () => {
  const projected = { id:"11111111-1111-4111-8111-111111111111",version_number:1,currency:"MAD",subtotal_minor:"900719925474099300",tax_minor:"180143985094819860",total_minor:"1080863910568919160" };
  it("conserve les bigint projetés en texte au-delà de Number.MAX_SAFE_INTEGER",()=>expect(parseQuoteVersionAmounts([projected]).data?.[0]?.subtotal_minor).toBe("900719925474099300"));
  it("refuse une réponse PostgREST numérique susceptible de perdre la précision",()=>expect(parseQuoteVersionAmounts([{...projected,subtotal_minor:900719925474099300}]).success).toBe(false));
});

describe("provider consultation shared documents", () => {
  const documentId = "55555555-5555-4555-8555-555555555555";
  it("projette les pièces liées avec un identifiant téléchargeable", () => {
    expect(sharedDocumentsFromRows([
      { document_id: documentId, title: "cdc.pdf", file_extension: "pdf", size_bytes: "1048576" },
    ])).toEqual([{ id: documentId, title: "cdc.pdf", type: "PDF", size: "1 Mo" }]);
  });
  it("ignore une projection invalide au lieu d’inventer une pièce", () => {
    expect(sharedDocumentsFromRows([{ document_id: "not-a-uuid", title: "cdc.pdf", file_extension: "pdf", size_bytes: "12" }])).toEqual([]);
  });
});
