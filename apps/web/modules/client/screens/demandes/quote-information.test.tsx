import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), getUser: vi.fn(), revalidate: vi.fn() }));
vi.mock("@/modules/shared/lib/supabase/server", () => ({ getSupabaseServerClient: async () => ({ rpc: mocks.rpc, auth: { getUser: mocks.getUser } }) }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("node:crypto", () => ({ randomUUID: () => "99999999-9999-4999-8999-999999999999" }));

import { getClientRfqMessages } from "./messages";
const messages = { fr: getClientRfqMessages("fr") };
import { toQuoteInformation } from "./quote-information";
import { completeRequestInformationAction } from "./quote-information-actions";
import { QuoteInformationForm } from "./quote-information-form";

const uid = (n: number) => `${String(n).padStart(8, "0")}-0000-4000-8000-000000000000`;
const raw = {
  request_id: uid(1),
  status: "INFORMATION_REQUIRED",
  row_version: 3,
  version_number: 2,
  required_fields_complete: false,
  region_code: "",
  questions: [
    { data_key: "users_count", required: true, answer_type: "INTEGER", label_fr: "Nombre d’utilisateurs", label_ar: "عدد المستخدمين", help_fr: null, help_ar: null, options: [], answer: "" },
    { data_key: "hosting", required: true, answer_type: "SINGLE_CHOICE", label_fr: "Hébergement", label_ar: "الاستضافة", help_fr: "Choisissez une option", help_ar: null, options: [{ fr: "Cloud", ar: "سحابة" }, "Local"], answer: "Cloud" },
    { data_key: "notes", required: false, answer_type: "LONG_TEXT", label_fr: "Précisions", label_ar: "توضيحات", help_fr: null, help_ar: null, options: [], answer: "" },
  ],
};

function form(values: Record<string, string | string[]>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) for (const item of [value].flat()) data.append(key, item);
  return data;
}

describe("informations complémentaires pour les devis", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.getUser.mockResolvedValue({ data: { user: { id: uid(9) } } }); });

  it("normalise la réponse serveur par langue", () => {
    const info = toQuoteInformation(raw, "ar");
    expect(info?.questions.map((question) => question.label)).toEqual(["عدد المستخدمين", "الاستضافة", "توضيحات"]);
    expect(info?.questions[1]?.options).toEqual(["سحابة", "Local"]);
    expect(toQuoteInformation({ ...raw, row_version: 0 }, "fr")).toBeNull();
  });

  it("ne demande que les informations manquantes, la région et les compléments facultatifs", () => {
    const html = renderToStaticMarkup(<QuoteInformationForm locale="fr" information={toQuoteInformation(raw, "fr")!} messages={messages.fr} idempotencyKey={uid(5)} />);
    expect(html).toMatch(/<input(?=[^>]*name="answer:users_count")(?=[^>]*required="")[^>]*>/u);
    expect(html).not.toContain("Hébergement");
    expect(html).toMatch(/<select[^>]*name="regionCode"[^>]*required=""/u);
    expect(html).toContain(messages.fr.completeOptional);
    expect(html.replace(/<[^>]+>/gu, " ")).not.toMatch(/users_count|[0-9a-f]{8}-[0-9a-f]{4}/u);
  });

  it("conserve la confirmation complète et permet de préciser un mode facultatif", () => {
    const info = toQuoteInformation({ ...raw, status: "DRAFT", required_fields_complete: true, region_code: "CASABLANCA_SETTAT", questions: raw.questions.map((question) => ({ ...question, answer: "12" })) }, "fr")!;
    const html = renderToStaticMarkup(<QuoteInformationForm locale="fr" information={info} messages={messages.fr} idempotencyKey={uid(5)} />);
    expect(html).toContain('role="status"');
    expect(html).toContain(messages.fr.completeDone);
    expect(html).toContain('name="interventionMode"');
    expect(html).toContain('value="HYBRID"');
    expect(html).toContain("<button");
  });

  it("transmet seulement les réponses et la région validées", async () => {
    mocks.rpc.mockResolvedValue({ data: { status: "DRAFT", missing_quote_keys: [] }, error: null });
    const result = await completeRequestInformationAction({ status: "idle" }, form({ locale: "fr", requestId: uid(1), rowVersion: "3", regionCode: "CASABLANCA_SETTAT", idempotencyKey: uid(5), "answer:users_count": "12", "answer:modules": ["Paie", "Stock"], "answer:": "x", organizationId: uid(7) }));
    expect(result).toEqual({ status: "success", complete: true, missing: [] });
    expect(mocks.rpc).toHaveBeenCalledWith("complete_service_request_information", expect.objectContaining({ p_request_id: uid(1), p_expected_row_version: 3, p_region_code: "CASABLANCA_SETTAT", p_answers: { users_count: "12", modules: "Paie, Stock" } }));
    expect(mocks.revalidate).toHaveBeenCalledWith(`/fr/client/demandes/${uid(1)}`);
  });

  it("enregistre uniquement le mode canonique choisi et refuse un libellé traduit",async()=>{
    mocks.rpc.mockResolvedValue({data:{status:"DRAFT",missing_quote_keys:[]},error:null});
    const base={locale:"ar",requestId:uid(1),rowVersion:"3",idempotencyKey:uid(5),interventionMode:"HYBRID"};
    await completeRequestInformationAction({status:"idle"},form(base));
    expect(mocks.rpc).toHaveBeenCalledWith("complete_service_request_information",expect.objectContaining({p_answers:{intervention_mode:"HYBRID"}}));
    mocks.rpc.mockClear();
    expect(await completeRequestInformationAction({status:"idle"},form({...base,interventionMode:"مختلط"}))).toEqual({status:"error",reason:"VALIDATION"});
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("refuse une région hors référentiel sans appel serveur", async () => {
    await expect(completeRequestInformationAction({ status: "idle" }, form({ locale: "fr", requestId: uid(1), rowVersion: "3", regionCode: "MA-CAS", idempotencyKey: uid(5) }))).resolves.toEqual({ status: "error", reason: "VALIDATION" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("traduit les refus serveur", async () => {
    const base = { locale: "fr", requestId: uid(1), rowVersion: "3", regionCode: "", idempotencyKey: uid(5) };
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: "42501" } }).mockResolvedValueOnce({ data: null, error: { code: "40001" } });
    await expect(completeRequestInformationAction({ status: "idle" }, form(base))).resolves.toEqual({ status: "error", reason: "FORBIDDEN" });
    await expect(completeRequestInformationAction({ status: "idle" }, form(base))).resolves.toEqual({ status: "error", reason: "CONFLICT" });
    mocks.getUser.mockResolvedValueOnce({ data: { user: null } });
    await expect(completeRequestInformationAction({ status: "idle" }, form(base))).resolves.toEqual({ status: "error", reason: "UNAUTHENTICATED" });
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
});
