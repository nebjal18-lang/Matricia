import { selectProviderMembership } from "@/modules/provider/data/spaces/organization-context";
import { z } from "zod";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";
import { classifyAuthReadFailure } from "@/modules/shared/lib/auth/read-failure";
import { consultationPackFromQuoteData, formatDeclaredBytes, type ConsultationPackDocument, type ProviderQuoteDashboard } from "./model";

const id = z.string().uuid();
const currency = z.string().regex(/^[A-Z]{3}$/u);
// PostgreSQL bigint can contain 19 decimal digits. Values originate from bigint
// columns and are projected as text by the database before PostgREST serializes them.
const minor = z.string().regex(/^\d{1,19}$/u);
const membership = z.object({
  organization_id: id,
  organizations: z.object({ display_name: z.string().min(1) }),
  organization_member_roles: z.array(z.object({ role_code: z.string(), revoked_at: z.string().nullable() })).min(1),
});
const invite = z.object({ id, rfq_id: id, status: z.enum(["INVITED", "VIEWED", "ACCEPTED", "DECLINED", "WITHDRAWN", "SUSPENDED"]), row_version: z.number().int().positive(), rfqs: z.object({ deadline: z.string(), request_id: id, request_version_id: id,confidentiality_settings:z.unknown().optional() }) });
const version = z.object({ id, description: z.string(), currency_code: currency, required_quote_data: z.record(z.string(), z.unknown()) });
const quote = z.object({ id, rfq_provider_id: id, status: z.string(), current_version_id: id.nullable(),selected_version_id:id.nullable().optional() });
const quoteVersion = z.object({ id, version_number: z.number().int().positive(), currency, subtotal_minor: minor, tax_minor: minor, total_minor: minor });
const tax = z.object({ id, category_code: z.string().min(1), rate_basis_points: z.number().int().min(0).max(10000), effective_from: z.string(), effective_to: z.string().nullable(), professional_validation_status: z.literal("VALIDATED") });
type Tax = z.infer<typeof tax>;
type Failure = { status: "error"; reason: "UNAUTHENTICATED" | "AUTH_QUERY_FAILED" | "NO_ORGANIZATION" | "QUERY_FAILED" | "INVALID_RESPONSE" };

export function unambiguousTaxRules(values: Tax[]): Tax[] {
  const grouped = new Map<string, Tax[]>();
  for (const value of values) {
    const key=`${value.category_code}:${value.effective_from}:${value.effective_to??""}`;
    grouped.set(key, [...(grouped.get(key) ?? []), value]);
  }
  return [...grouped.values()].filter((group) => group.length === 1).map((group) => group[0]!).sort((left, right) => left.category_code.localeCompare(right.category_code));
}

export function parseQuoteVersionAmounts(values: unknown) { return z.array(quoteVersion).max(100).safeParse(values); }

const sharedDocument = z.object({
  document_id: id,
  title: z.string().trim().min(1).max(255),
  file_extension: z.string().regex(/^[a-z0-9]{2,8}$/u),
  size_bytes: z.union([z.string().regex(/^\d{1,12}$/u), z.number().int().positive()]).transform(String),
});

export function sharedDocumentsFromRows(values: unknown): ConsultationPackDocument[] {
  const parsed = z.array(sharedDocument).max(20).safeParse(values);
  if (!parsed.success) return [];
  return parsed.data.map((row) => ({
    id: row.document_id,
    title: row.title,
    type: row.file_extension.toUpperCase(),
    size: formatDeclaredBytes(Number(row.size_bytes)),
  }));
}

export async function loadConsultationSharedDocuments(invitationId: string): Promise<ConsultationPackDocument[]> {
  if (!id.safeParse(invitationId).success) return [];
  const client = await getSupabaseServerClient();
  const result = await client.rpc("list_provider_consultation_documents", { p_rfq_provider_id: invitationId });
  if (result.error) return [];
  return sharedDocumentsFromRows(result.data);
}

export async function loadProviderQuotes(requestedOrganizationId?: string): Promise<{ status: "success"; dashboard: ProviderQuoteDashboard } | Failure> {
  const client = await getSupabaseServerClient();
  const { data: auth, error: authError } = await client.auth.getUser();
  const authFailure = classifyAuthReadFailure(authError);
  if (authFailure) return { status: "error", reason: authFailure === "UNAUTHENTICATED" ? "UNAUTHENTICATED" : "AUTH_QUERY_FAILED" };
  if (!auth.user) return { status: "error", reason: "UNAUTHENTICATED" };
  if (requestedOrganizationId && !id.safeParse(requestedOrganizationId).success) return { status: "error", reason: "NO_ORGANIZATION" };

  const memberResult = await client.from("organization_memberships")
    .select("organization_id,organizations!inner(display_name),organization_member_roles!inner(role_code,revoked_at)")
    .eq("user_id", auth.user.id).eq("status", "ACTIVE").is("organization_member_roles.revoked_at", null)
    .in("organization_member_roles.role_code", ["PROVIDER_OWNER", "PROVIDER_MANAGER", "PROVIDER_SALES", "PROVIDER_VIEWER"])
    .order("organization_id").limit(100);
  if (memberResult.error) return { status: "error", reason: "QUERY_FAILED" };
  const members = z.array(membership).max(100).safeParse(memberResult.data);
  if (!members.success) return { status: "error", reason: "INVALID_RESPONSE" };
  const availableOrganizations = [...new Map(members.data.map((item) => [item.organization_id, { id: item.organization_id, name: item.organizations.display_name }])).values()];
  const selected = selectProviderMembership(members.data, requestedOrganizationId);
  if (!selected) return { status: "error", reason: "NO_ORGANIZATION" };

  const organizationId = selected.organization_id;
  const canManage = selected.organization_member_roles.some((role) => ["PROVIDER_OWNER", "PROVIDER_MANAGER", "PROVIDER_SALES"].includes(role.role_code));
  const [invitesResult, taxResult] = await Promise.all([
    client.from("rfq_providers").select("id,rfq_id,status,row_version,rfqs!inner(deadline,request_id,request_version_id,confidentiality_settings)").eq("provider_organization_id", organizationId).order("invited_at", { ascending: false }).limit(100),
    client.from("tax_rule_versions").select("id,category_code,rate_basis_points,effective_from,effective_to,professional_validation_status")
      .eq("jurisdiction_code", "MA").eq("status", "ACTIVE").eq("professional_validation_status", "VALIDATED")
      .order("category_code").order("effective_from").limit(100),
  ]);
  if (invitesResult.error || taxResult.error) return { status: "error", reason: "QUERY_FAILED" };
  const invites = z.array(invite).max(100).safeParse(invitesResult.data);
  const taxes = z.array(tax).max(100).safeParse(taxResult.data);
  if (!invites.success || !taxes.success) return { status: "error", reason: "INVALID_RESPONSE" };

  const policyResult = await client.rpc("list_provider_quote_service_tax_policies_v1", {p_provider_organization_id:organizationId,p_rfq_provider_ids:invites.data.map(item=>item.id)});
  const policies=z.array(z.object({invitation_id:id,category_code:z.string().regex(/^[A-Z][A-Z0-9_]{2,79}$/u).nullable(),blocked_reason:z.string().nullable()})).max(100).safeParse(policyResult.data);
  if(policyResult.error||!policies.success||policies.data.length!==invites.data.length)return{status:"error",reason:"QUERY_FAILED"};
  const policyByInvitation=new Map(policies.data.map(policy=>[policy.invitation_id,policy]));
  const versionIds = [...new Set(invites.data.map((item) => item.rfqs.request_version_id))];
  const versionsResult = versionIds.length ? await client.from("service_request_versions").select("id,description,currency_code,required_quote_data").in("id", versionIds).limit(100) : { data: [], error: null };
  const versions = z.array(version).max(100).safeParse(versionsResult.data);
  if (versionsResult.error || !versions.success) return { status: "error", reason: "QUERY_FAILED" };

  const quoteResult = await client.from("quotes").select("id,rfq_provider_id,status,current_version_id,selected_version_id").eq("provider_organization_id", organizationId).limit(100);
  const quotes = z.array(quote).max(100).safeParse(quoteResult.data);
  if (quoteResult.error || !quotes.success) return { status: "error", reason: "QUERY_FAILED" };
  const quoteVersionIds = quotes.data.flatMap((item) => item.current_version_id ? [item.current_version_id] : []);
  const quoteVersionsResult = quoteVersionIds.length ? await client.rpc("list_provider_quote_version_amounts", { p_provider_organization_id: organizationId, p_quote_version_ids: quoteVersionIds }) : { data: [], error: null };
  const quoteVersions = parseQuoteVersionAmounts(quoteVersionsResult.data);
  if (quoteVersionsResult.error || !quoteVersions.success) return { status: "error", reason: "QUERY_FAILED" };

  const metadataResult = quoteVersionIds.length ? await client.from("quote_versions").select("id,created_at,valid_until").eq("provider_organization_id", organizationId).in("id", quoteVersionIds) : { data: [], error: null };
  const metadata = z.array(z.object({ id, created_at: z.string(), valid_until: z.string() })).safeParse(metadataResult.data);
  if (metadataResult.error || !metadata.success) return { status: "error", reason: "QUERY_FAILED" };
  const [anchorResult,identityResult]=await Promise.all([quoteVersionIds.length?client.from("provider_quote_identity_snapshots").select("quote_version_id").in("quote_version_id",quoteVersionIds):{data:[],error:null},client.rpc("get_my_provider_identity_status_v1",{p_provider_organization_id:organizationId})]);
  const anchors=z.array(z.object({quote_version_id:id})).safeParse(anchorResult.data),identity=z.object({publication_allowed:z.boolean().optional(),publication_block_reason:z.enum(["PROVIDER_IDENTITY_REVIEW_REQUIRED","CLIENT_IDENTITY_REVIEW_REQUIRED","ORGANIZATION_NOT_ACTIVE"]).nullable().optional(),canonical_registered_address:z.string().min(5).max(1000).nullable().optional(),verified:z.boolean(),identity_hash:z.string().regex(/^[0-9a-f]{64}$/u),identity_review_id:id.nullable(),identity_snapshot:z.object({legal_name:z.string(),identifiers:z.object({ICE:z.string().optional()})})}).safeParse(identityResult.data);
  if(anchorResult.error||identityResult.error||!anchors.success||!identity.success)return{status:"error",reason:"QUERY_FAILED"};
  const anchoredIds=new Set(anchors.data.map(x=>x.quote_version_id));
  const metadataById = new Map(metadata.data.map((item) => [item.id, item]));
  const versionById = new Map(versions.data.map((item) => [item.id, item]));
  const quoteByInvitation = new Map(quotes.data.map((item) => [item.rfq_provider_id, item]));
  const quoteVersionById = new Map(quoteVersions.data.map((item) => [item.id, item]));
  const invitationRows = invites.data.map((item) => {
    const requestVersion = versionById.get(item.rfqs.request_version_id);
    const currentQuote = quoteByInvitation.get(item.id);
    const currentQuoteVersion = currentQuote?.current_version_id ? quoteVersionById.get(currentQuote.current_version_id) : undefined;
    if (!requestVersion || (currentQuote?.current_version_id && !currentQuoteVersion) || (currentQuoteVersion && currentQuoteVersion.currency !== requestVersion.currency_code)) return null;
    const taxCategoryCode = policyByInvitation.get(item.id)?.category_code ?? null;
    const context=z.object({admin_consultation:z.object({subject:z.string().trim().min(1).max(500),context:z.string().trim().max(12000),response_deadline:z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),channel:z.literal("platform")})}).safeParse(item.rfqs.confidentiality_settings);
    const adminConsultation=context.success?{subject:context.data.admin_consultation.subject,context:context.data.admin_consultation.context,responseDeadline:context.data.admin_consultation.response_deadline,channel:"platform"as const}:null;
    const deadlineLabels={fr:new Intl.DateTimeFormat("fr-MA",{timeZone:"Africa/Casablanca",dateStyle:"medium",timeStyle:"short"}).format(new Date(item.rfqs.deadline)),ar:new Intl.DateTimeFormat("ar-MA",{timeZone:"Africa/Casablanca",dateStyle:"medium",timeStyle:"short"}).format(new Date(item.rfqs.deadline))};
    return { deadlineLabels,adminConsultation,id: item.id, status: item.status, rowVersion: item.row_version, rfqId: item.rfq_id, deadline: item.rfqs.deadline, requestId: item.rfqs.request_id, description: requestVersion.description, regionCode: String(requestVersion.required_quote_data.region_code ?? "—"), currency: requestVersion.currency_code, taxCategoryCode, pack: consultationPackFromQuoteData(requestVersion.required_quote_data), quote: currentQuote ? { selectedVersionId:currentQuote.selected_version_id??null,identityAnchored:anchoredIds.has(currentQuote.current_version_id??""),id: currentQuote.id, status: currentQuote.status, currentVersionId: currentQuote.current_version_id, versionNumber: currentQuoteVersion?.version_number ?? null, currency: currentQuoteVersion?.currency ?? null, subtotalMinor: currentQuoteVersion?.subtotal_minor ?? null, taxMinor: currentQuoteVersion?.tax_minor ?? null, totalMinor: currentQuoteVersion?.total_minor ?? null, validUntil: metadataById.get(currentQuoteVersion?.id ?? "")?.valid_until ?? null, createdAt: metadataById.get(currentQuoteVersion?.id ?? "")?.created_at ?? null } : null };
  });
  if (invitationRows.some((item) => item === null)) return { status: "error", reason: "INVALID_RESPONSE" };
  const applicableTaxes = unambiguousTaxRules(taxes.data);
  return { status: "success", dashboard: { identityReview:{publicationAllowed:identity.data.publication_allowed??identity.data.verified,publicationBlockReason:identity.data.publication_block_reason??null,canonicalRegisteredAddress:identity.data.canonical_registered_address??null,verified:identity.data.verified,identityHash:identity.data.identity_hash,reviewId:identity.data.identity_review_id,legalName:identity.data.identity_snapshot.legal_name,ice:identity.data.identity_snapshot.identifiers.ICE??null},organizations: availableOrganizations, organizationId, organizationName: selected.organizations.display_name, canManage, taxRules: applicableTaxes.map((item) => ({ id: item.id, category: item.category_code, rateBasisPoints: item.rate_basis_points, effectiveFrom:item.effective_from, effectiveTo:item.effective_to })), invitations: invitationRows.filter((item): item is NonNullable<typeof item> => item !== null) } };
}

export type ProviderQuoteRevision = { id:string; version:number; createdAt:string; changeReason:string; contentHash:string; authorId:string; snapshot?:import("@/modules/provider/screens/devis/prefill").QuotePrefill };
export async function loadProviderQuoteHistory(organizationId:string,quoteId:string):Promise<ProviderQuoteRevision[]|null>{
 if(!id.safeParse(organizationId).success||!id.safeParse(quoteId).success)return null;
 const client=await getSupabaseServerClient();
 const rows:unknown[]=[];
 for(let offset=0;offset<10000;offset+=200){
  const result=await client.from("quote_versions").select("id,version_number,created_at,change_reason,content_hash,created_by").eq("provider_organization_id",organizationId).eq("quote_id",quoteId).order("version_number",{ascending:false}).range(offset,offset+199);
  if(result.error||!Array.isArray(result.data))return null;
  rows.push(...result.data);if(result.data.length<200)break;if(offset===9800)return null;
 }
 const parsed=z.array(z.object({id,version_number:z.number().int().positive(),created_at:z.string(),change_reason:z.string(),created_by:id,content_hash:z.string().regex(/^[0-9a-f]{64}$/)})).safeParse(rows);
 return parsed.success?parsed.data.map(v=>({id:v.id,version:v.version_number,createdAt:v.created_at,changeReason:v.change_reason,contentHash:v.content_hash,authorId:v.created_by})):null;
}
