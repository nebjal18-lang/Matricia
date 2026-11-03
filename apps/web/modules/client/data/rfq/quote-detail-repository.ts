import {readAllPages} from "@/modules/shared/lib/data/read-pages";
import{readQuoteOptionPricing}from"@/modules/shared/lib/contracts-missions/quote-option-pricing";
import{readQuoteCommercialTerms}from"@/modules/shared/lib/contracts-missions/quote-commercial-terms";
import { z } from "zod";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import { createServerClientRfqRepository } from "./server-repository";
import { uuidSchema } from "./model";
import {
  documentKind,
  formatExactQuantity,
  formatTaxRate,
  localizedText,
  offerLabel,
  textList,
  type ClientOfferDetail,
  type ClientOfferDocument,
  type ClientOfferFlag,
} from "./quote-detail-model";
import { canApplyDemoOffer, demoClientOfferDetail, isDemoOfferId } from "./quote-detail-demo";
import { offerDetailMessages } from "./quote-detail-copy";

const exactMinor = z.union([z.string().regex(/^\d+$/u), z.number().int().nonnegative().safe()]).transform(String);
const quoteRow = z.object({
  id: uuidSchema,
  rfq_id: uuidSchema,
  status: z.enum(["DRAFT", "SUBMITTED", "REVISION_REQUESTED", "REVISED", "SELECTED", "NOT_SELECTED", "WITHDRAWN", "EXPIRED"]),
  current_version_id: uuidSchema.nullable(),
  last_published_version_id:uuidSchema.nullable(),
}).strict();
const rfqRow = z.object({ id: uuidSchema, request_id: uuidSchema }).strict();
const versionRow = z.object({
  sla:z.unknown().optional(),
  id: uuidSchema,
  quote_id: uuidSchema,
  rfq_id: uuidSchema,
  version_number: z.number().int().positive(),
  lifecycle_status: z.enum(["DRAFT", "SUBMITTED", "REVISED", "WITHDRAWN", "EXPIRED"]),
  solution_fr: z.string(),
  solution_ar: z.string().nullable(),
  deliverables: z.unknown(),
  inclusions: z.unknown(),
  exclusions: z.unknown(),
  prerequisites: z.unknown(),
  warranty_fr: z.string(),
  warranty_ar: z.string().nullable(),
  correction_terms_fr: z.string(),
  correction_terms_ar: z.string().nullable(),
  proposed_start_date: z.string(),
  duration_days: z.number().int().positive(),
  valid_until: z.string(),
  currency: z.string().regex(/^[A-Z]{3}$/u),
}).strict();
const itemRow = z.object({
  id: uuidSchema,
  quote_version_id: uuidSchema,
  line_number: z.number().int().positive(),
  label_fr: z.string(),
  label_ar: z.string().nullable(),
  quantity: z.union([z.string(), z.number()]).transform(String),
  unit_code: z.string(),
  tax_rate_basis_points: z.number().int().nonnegative(),
  total_minor: exactMinor,
}).strict();
const bindingRow = z.object({ document_id: uuidSchema, target_id: uuidSchema, revoked_at: z.string().nullable().optional() }).passthrough();
const documentRow = z.object({ id: uuidSchema, original_file_name: z.string() }).strict();

export type OfferDetailResult =
  | { status: "success"; value: ClientOfferDetail }
  | { status: "unauthenticated" }
  | { status: "not_found" }
  | { status: "error" };

function formatDate(value: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-MA" : "fr-MA", { dateStyle: "long", timeZone: "Africa/Casablanca" }).format(new Date(value));
}

function flagsFrom(exclusions: string[], prerequisites: string[]): ClientOfferFlag[] {
  return [
    ...exclusions.slice(0, 6).map((text, index) => ({ id: `ex-${index}`, text, tone: "clarify" as const })),
    ...prerequisites.slice(0, 6).map((text, index) => ({ id: `pr-${index}`, text, tone: "confirm" as const })),
  ].slice(0, 8);
}

export async function loadClientOfferDetail(input: {
  locale: Locale;
  requestId: string;
  quoteId: string;
  organizationQuery: string;
  versionId?:string;
  organizationName?: string | null;
}): Promise<OfferDetailResult> {
  const repository = await createServerClientRfqRepository();
  const request = uuidSchema.safeParse(input.requestId).success
    ? await repository.detail(input.requestId)
    : null;
  if (request?.status === "error" && request.reason === "UNAUTHENTICATED") return { status: "unauthenticated" };
  if (request?.status === "error") return { status: "error" };

  const demo = canApplyDemoOffer(input.organizationName ?? null);
  if ((!request || request.status !== "success" || !request.value) && demo && isDemoOfferId(input.quoteId)) {
    return { status: "success", value: demoClientOfferDetail({ locale: input.locale, requestId: input.requestId, quoteId: input.quoteId, description: null, organizationQuery: input.organizationQuery, rfqId: null }) };
  }
  if (!request || request.status !== "success" || !request.value) return { status: "not_found" };

  const dossier = request.value;
  const client = await getSupabaseServerClient();
  const organizationName = input.organizationName ?? (await client.from("organizations").select("display_name").eq("id", dossier.organizationId).limit(1)).data?.[0]?.display_name ?? null;
  if (canApplyDemoOffer(organizationName) && isDemoOfferId(input.quoteId)) {
    return { status: "success", value: demoClientOfferDetail({ locale: input.locale, requestId: dossier.id, quoteId: input.quoteId, description: dossier.description, organizationQuery: input.organizationQuery, rfqId: dossier.rfqId }) };
  }
  if (!uuidSchema.safeParse(input.quoteId).success || !dossier.rfqId) return { status: "not_found" };

  const [quoteResult, comparison] = await Promise.all([
    client.from("quotes").select("id,rfq_id,status,current_version_id,last_published_version_id").eq("id", input.quoteId).eq("rfq_id", dossier.rfqId).limit(1),
    repository.comparison(dossier.rfqId),
  ]);
  if (quoteResult.error) return { status: "error" };
  const quote = z.array(quoteRow).max(1).safeParse(quoteResult.data);
  if (!quote.success || !quote.data[0] || quote.data[0].status === "DRAFT") return { status: "not_found" };

  const rfqResult = await client.from("rfqs").select("id,request_id").eq("id", quote.data[0].rfq_id).limit(1);
  if (rfqResult.error) return { status: "error" };
  const rfq = z.array(rfqRow).max(1).safeParse(rfqResult.data);
  if (!rfq.success || rfq.data[0]?.request_id !== dossier.id) return { status: "not_found" };

  const compared = comparison.status === "success" ? comparison.value?.rows.find((row) => row.quoteId === input.quoteId) : undefined;
  if(input.versionId&&!uuidSchema.safeParse(input.versionId).success)return{status:"not_found"};
  const versionId = input.versionId ?? quote.data[0].last_published_version_id ?? quote.data[0].current_version_id;
  if (!versionId) return { status: "not_found" };

  const [versionResult, itemsResult, bindingsResult, optionsResult, attachmentsResult, historyResult] = await Promise.all([
    client.from("quote_versions").select("sla,id,quote_id,rfq_id,version_number,lifecycle_status,solution_fr,solution_ar,deliverables,inclusions,exclusions,prerequisites,warranty_fr,warranty_ar,correction_terms_fr,correction_terms_ar,proposed_start_date,duration_days,valid_until,currency").eq("id", versionId).eq("quote_id", quote.data[0].id).limit(1),
    client.from("quote_items").select("id,quote_version_id,line_number,label_fr,label_ar,quantity::text,unit_code,tax_rate_basis_points,total_minor::text").eq("quote_version_id", versionId).order("line_number").limit(200),
    client.from("client_document_bindings").select("document_id,target_id").eq("target_type", "SERVICE_REQUEST").eq("target_id", dossier.id).limit(50),
    client.from("quote_options").select("id,label_fr,label_ar,amount_minor::text,currency").eq("quote_version_id",versionId).order("option_key").limit(20),
    client.from("quote_attachments").select("id,title").eq("quote_version_id",versionId).order("id").limit(20),
    readAllPages((from,to)=>client.from("quote_versions").select("id,version_number,submitted_at").eq("quote_id",input.quoteId).not("submitted_at","is",null).order("version_number",{ascending:false}).range(from,to)),
  ]);
  if (versionResult.error || itemsResult.error || optionsResult.error || attachmentsResult.error || bindingsResult.error || historyResult.error) return { status: "error" };
  const versionParsed = z.array(versionRow).max(1).safeParse(versionResult.data);
  const itemsParsed = z.array(itemRow).max(200).safeParse(itemsResult.data);
  if (!versionParsed.success || !itemsParsed.success) return { status: "error" };
  if(!versionParsed.data[0])return{status:"not_found"};
  const history=z.array(z.object({id:uuidSchema,version_number:z.number().int().positive(),submitted_at:z.string()})).safeParse(historyResult.data);
  if(!history.success)return{status:"error"};
  const version = versionParsed.data[0];
  const options=z.array(z.object({id:uuidSchema,label_fr:z.string(),label_ar:z.string().nullable(),amount_minor:z.string().regex(/^\d+$/u),currency:z.string().length(3)})).max(20).safeParse(optionsResult.data);
  const attachments=z.array(z.object({id:uuidSchema,title:z.string()})).max(20).safeParse(attachmentsResult.data);
  if(!options.success||!attachments.success||options.data.some(row=>row.currency!==version.currency))return{status:"error"};
  if (!["SUBMITTED", "REVISED"].includes(version.lifecycle_status) && quote.data[0].status !== "SELECTED") return { status: "not_found" };

  const copy = offerDetailMessages(input.locale);
  const inclusions = textList(version.inclusions);
  const deliverables = textList(version.deliverables);
  const exclusions = textList(version.exclusions);
  const prerequisites = textList(version.prerequisites);
  const rankIndex = compared ? Math.max(0, compared.priceRank - 1) : 0;
  const documentsHref = `/${input.locale}/client/documents${input.organizationQuery}`;
  const documents: ClientOfferDocument[] = attachments.data.map(row=>({id:row.id,fileName:row.title,kind:documentKind(row.title),href:`/api/quotes/attachments/${row.id}`}));
  if (!bindingsResult.error) {
    const bindings = z.array(bindingRow).max(50).safeParse(bindingsResult.data);
    if(!bindings.success)return{status:"error"};
    const ids = [...new Set(bindings.data.map((row) => row.document_id))].slice(0, 12);
    if (ids.length > 0) {
      const docsResult = await client.from("client_compliance_documents").select("id,original_file_name").in("id", ids).eq("status", "VERIFIED").eq("scan_status", "CLEAN").limit(12);
      if(docsResult.error)return{status:"error"};
      const docs = z.array(documentRow).max(12).safeParse(docsResult.data);
      if(!docs.success)return{status:"error"};
      if (docs.success) {
        for (const document of docs.data) {
          documents.push({ id: document.id, fileName: document.original_file_name, kind: documentKind(document.original_file_name), href: `/api/client/documents/${document.id}` });
        }
      }
    }
  }

  return {
    status: "success",
    value: {
      quoteId: quote.data[0].id,
      quoteVersionId: version.id,
      displayedVersionNumber:version.version_number,
      revisionInProgress:quote.data[0].status==="REVISED"||quote.data[0].status==="REVISION_REQUESTED",
      publishedVersions:history.data.map(row=>({id:row.id,version:row.version_number,submittedAt:row.submitted_at})),
      requestId: dossier.id,
      rfqId: dossier.rfqId,
      label: offerLabel(rankIndex, input.locale),
      description: localizedText(input.locale, version.solution_fr, version.solution_ar) || dossier.description,
      currency: version.currency,
      inclusions,
      deliverables,
      delays: [
        `${copy.startOn} ${formatDate(version.proposed_start_date, input.locale)}`,
        `${copy.durationOf} ${version.duration_days} ${copy.days}`,
        `${copy.validUntil} ${formatDate(version.valid_until, input.locale)}`,
      ],
      conditions: [
        ...(readQuoteCommercialTerms(version.sla)?[(input.locale==="ar"?"شروط الدفع":"Modalités de paiement")+" : "+readQuoteCommercialTerms(version.sla)!.payment_terms,...(readQuoteCommercialTerms(version.sla)!.maintenance_terms?[(input.locale==="ar"?"الصيانة والمتابعة":"Maintenance et suivi")+" : "+readQuoteCommercialTerms(version.sla)!.maintenance_terms]:[])]:[]),
        `${copy.warranty} : ${localizedText(input.locale, version.warranty_fr, version.warranty_ar)}`,
        `${copy.corrections} : ${localizedText(input.locale, version.correction_terms_fr, version.correction_terms_ar)}`,
        ...prerequisites.slice(0, 2),
      ].filter(Boolean),
      exclusions,
      lines: itemsParsed.data.map((item) => ({
        id: item.id,
        label: localizedText(input.locale, item.label_fr, item.label_ar),
        quantity: formatExactQuantity(item.quantity),
        unitCode: item.unit_code,
        taxLabel: formatTaxRate(item.tax_rate_basis_points),
        totalMinor: item.total_minor,
      })),
      optionPriceBasis:readQuoteOptionPricing(version.sla),
      options:options.data.map(row=>({id:row.id,label:localizedText(input.locale,row.label_fr,row.label_ar),amountMinor:row.amount_minor})),
      documents,
      points: [
        { id: "scope", hint: copy.scopeHint, action: "review" },
        { id: "timeline", hint: copy.delayHint, action: "compare" },
        { id: "exclusions", hint: copy.exclusionHint, action: "review" },
        { id: "terms", hint: copy.termsHint, action: "compare" },
      ],
      flags: flagsFrom(exclusions, prerequisites),
      comparisonHref: `/${input.locale}/client/demandes/${dossier.id}/offres?rfq=${dossier.rfqId}${input.organizationQuery ? `&${input.organizationQuery.slice(1)}` : ""}`,
      askHref: `/${input.locale}/messagerie${input.organizationQuery}`,
      documentsHref,
    },
  };
}
