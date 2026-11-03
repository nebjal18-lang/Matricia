import {z} from "zod";
import { readAllPages } from "@/modules/shared/lib/data/read-pages";
import { loadAllocationTargets } from "./allocation-targets";
import { classifyAuthReadFailure } from "@/modules/shared/lib/auth/read-failure";
import { resolveClientOrganizationContext } from "@/modules/shared/client-organization-context";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";
import { uuid } from "./model";
import type { Portfolio, RepoResult } from "./model";

type Row = Record<string, unknown>;
const rows = (value: unknown): Row[] => Array.isArray(value) ? value as Row[] : [];
const text = (row: Row, key: string) => String(row[key] ?? "");
const nullable = (row: Row, key: string) => row[key] == null ? null : String(row[key]);
const nested = (row: Row, key: string): Row => { const value=row[key]; return Array.isArray(value) ? (value[0] as Row ?? {}) : value && typeof value === "object" ? value as Row : {}; };

export function validPortfolioTenantPayload(organizationIds:string[],projectRows:Row[],contractRows:Row[],linkRows:Row[],calendarRows:Row[]):boolean {
  const allowed=new Set(organizationIds),projects=new Map(projectRows.map(row=>[text(row,"id"),text(row,"organization_id")])),contracts=new Map(contractRows.map(row=>[text(row,"id"),text(row,"client_organization_id")]));
  if(projectRows.some(row=>!allowed.has(text(row,"organization_id")))||contractRows.some(row=>!allowed.has(text(row,"client_organization_id")))||linkRows.some(row=>!allowed.has(text(row,"organization_id")))||calendarRows.some(row=>!allowed.has(text(row,"organization_id"))))return false;
  return linkRows.every(row=>{const org=text(row,"organization_id");return projects.get(text(row,"project_id"))===org&&contracts.get(text(row,"contract_id"))===org;})&&calendarRows.every(row=>{const projectId=nullable(row,"project_id");return projectId===null||projects.get(projectId)===text(row,"organization_id");});
}

export async function loadClientPortfolio(requestedOrganizationId?: string): Promise<RepoResult<Portfolio>> {
  const client = await getSupabaseServerClient();
  const { data: auth, error: authError } = await client.auth.getUser();
  const authFailure = classifyAuthReadFailure(authError);
  if (authFailure) return { status: "error", reason: authFailure };
  if (!auth.user) return { status: "error", reason: "UNAUTHENTICATED" };
  const memberships = await client.from("organization_memberships").select("id,organization_id").eq("user_id", auth.user.id).eq("status", "ACTIVE").limit(100);
  if (memberships.error) return { status: "error", reason: "UNAVAILABLE" };
  const membershipRows = rows(memberships.data);
  const membershipIds = membershipRows.map(row => text(row, "id"));
  const authorizedRoles = membershipIds.length ? await client.from("organization_member_roles").select("membership_id,role_code,revoked_at").in("membership_id", membershipIds).is("revoked_at", null).in("role_code", ["CLIENT_OWNER", "CLIENT_ADMIN", "CLIENT_BUYER", "CLIENT_ACCOUNTING", "CLIENT_VIEWER"]).limit(500) : { data: [], error: null };
  if (authorizedRoles.error) return { status: "error", reason: "UNAVAILABLE" };
  const authorizedMembershipIds = new Set(rows(authorizedRoles.data).map(row => text(row, "membership_id")));
  const authorizedMemberships = membershipRows.filter(row => authorizedMembershipIds.has(text(row, "id"))).map(row => ({ organization_id: text(row, "organization_id") }));
  const context = resolveClientOrganizationContext(authorizedMemberships, requestedOrganizationId);
  if (context.status === "error") {
    if (context.reason === "NO_CLIENT_ORGANIZATION" && requestedOrganizationId === undefined) return { status: "success", value: { organizations: [], sites: [], projects: [], contracts: [], tasks: [], budgets: [], costCenters: [], allocations: [], calendar: [], libraries: [] } };
    return { status: "error", reason: "FORBIDDEN" };
  }
  const organizationIds = [context.membership.organization_id];
  const [roles, organizations, sites, siteVersions, projects, projectVersions, contracts, projectContracts, tasks, taskVersions, budgets, budgetVersions, costCenters, costCenterVersions, allocations, calendar, libraries, budgetTotals, members] = await Promise.all([
    readAllPages((from,to) => client.from("organization_member_roles").select("membership_id,role_code,revoked_at").in("membership_id", membershipIds).is("revoked_at", null).order("membership_id").order("role_code").order("library_id",{nullsFirst:true}).order("franchise_id",{nullsFirst:true}).range(from,to)),
    readAllPages((from,to) => client.from("organizations").select("id,display_name").in("id", organizationIds).order("id").range(from,to)),
    readAllPages((from,to) => client.from("client_sites").select("id,organization_id,code,current_version,status").in("organization_id", organizationIds).eq("status", "ACTIVE").order("id").range(from,to)),
    readAllPages((from,to) => client.from("client_site_versions").select("site_id,organization_id,version,name_fr,name_ar").in("organization_id", organizationIds).order("id").range(from,to)),
    readAllPages((from,to) => client.from("client_projects").select("id,organization_id,project_code,site_id,status,current_version,row_version,progress_basis_points,started_on,target_end_on").in("organization_id", organizationIds).order("updated_at", { ascending: false }).order("id").range(from,to)),
    readAllPages((from,to) => client.from("client_project_versions").select("project_id,organization_id,version,name_fr,name_ar,description_fr,description_ar").in("organization_id", organizationIds).order("id").range(from,to)),
    readAllPages((from,to) => client.from("contracts").select("id,client_organization_id,provider_organization_id,status,current_version").in("client_organization_id", organizationIds).order("updated_at", { ascending: false }).order("id").range(from,to)),
    readAllPages((from,to) => client.from("client_project_contracts").select("organization_id,project_id,contract_id").in("organization_id", organizationIds).order("id").range(from,to)),
    readAllPages((from,to) => client.from("client_project_tasks").select("id,project_id,organization_id,task_key,task_type,status,due_at,assignee_user_id,current_version,row_version").in("organization_id", organizationIds).order("due_at", { ascending: true }).order("id").range(from,to)),
    readAllPages((from,to) => client.from("client_project_task_versions").select("task_id,organization_id,version,title_fr,title_ar,description_fr,description_ar,acceptance_criteria").in("organization_id", organizationIds).order("id").range(from,to)),
    readAllPages((from,to) => client.from("client_annual_budgets").select("id,organization_id,fiscal_year,currency,library_id,site_id,project_id,current_version,status").in("organization_id", organizationIds).order("fiscal_year", { ascending: false }).order("id").range(from,to)),
    readAllPages((from,to) => client.from("client_annual_budget_versions").select("budget_id,organization_id,version,amount_minor::text,approved_amount_minor::text").in("organization_id", organizationIds).order("id").range(from,to)),
    readAllPages((from,to) => client.from("client_cost_centers").select("id,organization_id,code,status,current_version").in("organization_id", organizationIds).order("id").range(from,to)),
    readAllPages((from,to) => client.from("client_cost_center_versions").select("cost_center_id,organization_id,version,name_fr,name_ar").in("organization_id", organizationIds).order("id").range(from,to)),
    readAllPages((from,to) => client.from("client_cost_allocations").select("id,organization_id,cost_center_id,budget_id,project_id,allocation_type,amount_minor::text,currency,created_at").in("organization_id", organizationIds).order("created_at", { ascending: false }).order("id").range(from,to)),
    readAllPages((from,to) => client.from("client_central_calendar").select("organization_id,project_id,item_id,source_kind,event_type,title_fr,title_ar,starts_at,ends_at,status,occurs_on,all_day").in("organization_id", organizationIds).order("starts_at", { ascending: true }).order("item_id").order("source_kind").range(from,to)),
    readAllPages((from,to) => client.from("catalog_libraries").select("id,current_published_version_id,published:catalog_library_versions!catalog_libraries_published_fk(id,library_id,status,name_fr,name_ar)").eq("status", "PUBLISHED").not("current_published_version_id", "is", null).order("id").range(from,to)),
    readAllPages((from,to) => client.from("client_budget_totals_v1").select("organization_id,budget_id,net_minor").in("organization_id", organizationIds).order("budget_id").range(from,to)),
    readAllPages((from,to) => client.rpc("list_client_project_assignees_v1",{p_organization_id:organizationIds[0]!}).range(from,to))
  ]);
  const all = [roles, organizations, sites, siteVersions, projects, projectVersions, contracts, projectContracts, tasks, taskVersions, budgets, budgetVersions, costCenters, costCenterVersions, allocations, calendar, libraries, budgetTotals, members];
  if (all.some(result => result.error)) return { status: "error", reason: "UNAVAILABLE" };
  const versionedTenantResults = [siteVersions, projectVersions, taskVersions, budgetVersions, costCenterVersions];
  if (versionedTenantResults.some(result => rows(result.data).some(row => !organizationIds.includes(text(row, "organization_id"))))) {
    return { status: "error", reason: "UNAVAILABLE" };
  }
  if(!validPortfolioTenantPayload(organizationIds,rows(projects.data),rows(contracts.data),rows(projectContracts.data),rows(calendar.data)))return{status:"error",reason:"UNAVAILABLE"};
  const libraryRows = rows(libraries.data);
  if (libraryRows.some(row => {
    const published = nested(row, "published");
    return !text(row, "id")
      || !text(row, "current_published_version_id")
      || text(published, "id") !== text(row, "current_published_version_id")
      || text(published, "library_id") !== text(row, "id")
      || text(published, "status") !== "PUBLISHED"
      || !text(published, "name_fr").trim()
      || !text(published, "name_ar").trim();
  })) return { status: "error", reason: "UNAVAILABLE" };
  const roleRows = rows(roles.data);
  const membershipOrg = new Map(membershipRows.map(row => [text(row, "id"), text(row, "organization_id")]));
  const byOrg = new Map<string, Set<string>>();
  for (const role of roleRows) { const org = membershipOrg.get(text(role, "membership_id")); if (org) { const set = byOrg.get(org) ?? new Set<string>(); set.add(text(role, "role_code")); byOrg.set(org, set); } }
  const siteVersionRows = rows(siteVersions.data), projectVersionRows = rows(projectVersions.data), taskVersionRows = rows(taskVersions.data), budgetVersionRows = rows(budgetVersions.data), centerVersionRows = rows(costCenterVersions.data);
  const contractProject = new Map(rows(projectContracts.data).map(row => [text(row,"contract_id"),text(row,"project_id")]));
  const allocationTargets = await loadAllocationTargets(client, organizationIds[0]!);
  const current = (list: Row[], idKey: string, id: string, version: number) => list.find(row => text(row, idKey) === id && Number(row.version) === version);
  const requiredVersions: Array<[Row[], Row[], string]> = [[rows(sites.data),siteVersionRows,"site_id"],[rows(projects.data),projectVersionRows,"project_id"],[rows(tasks.data),taskVersionRows,"task_id"],[rows(budgets.data),budgetVersionRows,"budget_id"],[rows(costCenters.data),centerVersionRows,"cost_center_id"]];
  if (requiredVersions.some(([entities,versions,key]) => entities.some(row => !current(versions,key,text(row,"id"),Number(row.current_version))))) return { status:"error",reason:"UNAVAILABLE" };
  return { status: "success", value: {
    members: rows(members.data).map(row=>({userId:text(row,"user_id"),organizationId:text(row,"organization_id"),label: text(row,"user_id")===auth.user!.id ? "SELF" : text(row,"label")})),
    budgetTotals: rows(budgetTotals.data).map(row=>({budgetId:text(row,"budget_id"),netMinor:text(row,"net_minor")})),
    allocationTargetsStatus: allocationTargets.status,
    allocationTargetsTruncated: allocationTargets.status !== "unavailable" && allocationTargets.truncated,
    allocationInvoiceError: allocationTargets.status === "unavailable" ? undefined : allocationTargets.invoiceError,
    allocationTargets: allocationTargets.status === "unavailable" ? [] : allocationTargets.targets,
    organizations: rows(organizations.data).map(row => { const id = text(row, "id"), set = byOrg.get(id) ?? new Set<string>(); const capabilities: ("READ"|"MANAGE_PORTFOLIO"|"MANAGE_BUDGET")[] = ["READ"]; if (["CLIENT_OWNER","CLIENT_ADMIN","CLIENT_BUYER"].some(role => set.has(role))) capabilities.push("MANAGE_PORTFOLIO"); if (["CLIENT_OWNER","CLIENT_ADMIN","CLIENT_ACCOUNTING"].some(role => set.has(role))) capabilities.push("MANAGE_BUDGET"); return { id, name: text(row, "display_name"), capabilities }; }),
    sites: rows(sites.data).map(row => { const id=text(row,"id"), version=Number(row.current_version), v=current(siteVersionRows,"site_id",id,version); return { id, organizationId:text(row,"organization_id"), code:text(row,"code"), nameFr:v?text(v,"name_fr"):text(row,"code"), nameAr:v?text(v,"name_ar"):text(row,"code") }; }),
    projects: rows(projects.data).map(row => { const id=text(row,"id"), version=Number(row.current_version), v=current(projectVersionRows,"project_id",id,version); return { id, organizationId:text(row,"organization_id"), code:text(row,"project_code"), siteId:nullable(row,"site_id"), status:text(row,"status"), version, rowVersion:Number(row.row_version), progressBasisPoints:Number(row.progress_basis_points), nameFr:v?text(v,"name_fr"):text(row,"project_code"), nameAr:v?text(v,"name_ar"):text(row,"project_code"), descriptionFr:v?text(v,"description_fr"):"", descriptionAr:v?text(v,"description_ar"):"", startedOn:nullable(row,"started_on"), targetEndOn:nullable(row,"target_end_on") }; }),
    contracts: rows(contracts.data).map(row => ({ id:text(row,"id"), organizationId:text(row,"client_organization_id"), providerOrganizationId:text(row,"provider_organization_id"), projectId:contractProject.get(text(row,"id"))??null, status:text(row,"status"), version:Number(row.current_version) })),
    tasks: rows(tasks.data).map(row => { const id=text(row,"id"), version=Number(row.current_version), v=current(taskVersionRows,"task_id",id,version); return { id, projectId:text(row,"project_id"), key:text(row,"task_key"), type:text(row,"task_type"), status:text(row,"status"), dueAt:nullable(row,"due_at"), rowVersion:Number(row.row_version), assigneeUserId:nullable(row,"assignee_user_id"), descriptionFr:v?text(v,"description_fr"):"", descriptionAr:v?text(v,"description_ar"):"", acceptanceCriteria:v&&Array.isArray(v.acceptance_criteria)?v.acceptance_criteria:[], titleFr:v?text(v,"title_fr"):text(row,"task_key"), titleAr:v?text(v,"title_ar"):text(row,"task_key") }; }),
    budgets: rows(budgets.data).map(row => { const id=text(row,"id"), version=Number(row.current_version), v=current(budgetVersionRows,"budget_id",id,version); return { id, organizationId:text(row,"organization_id"), fiscalYear:Number(row.fiscal_year), currency:text(row,"currency"), libraryId:nullable(row,"library_id"), siteId:nullable(row,"site_id"), projectId:nullable(row,"project_id"), status:text(row,"status"), version, amountMinor:v?text(v,"amount_minor"):"0", approvedAmountMinor:v?nullable(v,"approved_amount_minor"):null }; }),
    costCenters: rows(costCenters.data).map(row => { const id=text(row,"id"), version=Number(row.current_version), v=current(centerVersionRows,"cost_center_id",id,version); return { id, organizationId:text(row,"organization_id"), code:text(row,"code"), status:text(row,"status"), version, nameFr:v?text(v,"name_fr"):text(row,"code"), nameAr:v?text(v,"name_ar"):text(row,"code") }; }),
    allocations: rows(allocations.data).map(row => ({ id:text(row,"id"), organizationId:text(row,"organization_id"), costCenterId:text(row,"cost_center_id"), budgetId:text(row,"budget_id"), projectId:nullable(row,"project_id"), type:text(row,"allocation_type"), amountMinor:text(row,"amount_minor"), currency:text(row,"currency"), createdAt:text(row,"created_at") })),
    calendar: rows(calendar.data).map(row => ({ organizationId:text(row,"organization_id"), projectId:nullable(row,"project_id"), itemId:text(row,"item_id"), sourceKind:text(row,"source_kind"), eventType:text(row,"event_type"), titleFr:text(row,"title_fr"), titleAr:text(row,"title_ar"), startsAt:text(row,"starts_at"), endsAt:nullable(row,"ends_at"), status:text(row,"status"), occursOn:nullable(row,"occurs_on"), allDay:Boolean(row.all_day) })),
    libraries: libraryRows.map(row => { const published=nested(row,"published"); return { id:text(row,"id"), nameFr:text(published,"name_fr"), nameAr:text(published,"name_ar") }; })
  } };
}

export async function portfolioRpc(name: string, input: Record<string, unknown>): Promise<RepoResult<Record<string, unknown>>> {
  const client = await getSupabaseServerClient();
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) return { status: "error", reason: "UNAUTHENTICATED" };
  const { data, error } = await client.rpc(name, input);
  if (error) return { status: "error", reason: error.code === "42501" ? "FORBIDDEN" : error.code === "40001" ? "CONFLICT" : "UNAVAILABLE" };
  if (name === "record_client_typed_cost_allocation" && data?.outcome === "CLIENT_APPROVAL_REQUIRED") {
    const pending=z.object({outcome:z.literal("CLIENT_APPROVAL_REQUIRED"),approval_request_id:z.string().uuid(),status:z.enum(["PENDING","REJECTED","CANCELLED"])}).safeParse(data);
    return pending.success ? {status:"success",value:pending.data} : {status:"error",reason:"UNAVAILABLE"};
  }
  if (name === "record_client_typed_cost_allocation" && (!data || typeof data !== "object" || data.outcome !== "CLIENT_TYPED_COST_ALLOCATED" || !uuid.safeParse(data.allocation_id).success)) return {status:"error",reason:"UNAVAILABLE"};
  return { status: "success", value: (data ?? {}) as Record<string, unknown> };
}
