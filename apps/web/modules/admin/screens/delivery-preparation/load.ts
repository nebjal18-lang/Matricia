import { preparationListSchema, preparationOverviewSchema, type PreparationItem, type PreparationOverview } from "./model";

const pageSize = 20;

export function preparationPageNumber(value: string | undefined) {
  const parsed = Number.parseInt(value ?? "1", 10);
  return Number.isFinite(parsed) ? Math.min(500, Math.max(1, parsed)) : 1;
}

type PreparationRpc = {
  rpc: (fn: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { code?: string; message?: string } | null }>;
};

export type DeliveryPreparationFailure = "MFA_REQUIRED" | "FORBIDDEN" | "UNAUTHENTICATED" | "QUERY_FAILED" | "INVALID_RESPONSE";

export type DeliveryPreparationWorkspace = {
  servicePage: number;
  categoryPage: number;
  overview: PreparationOverview;
  services: { total: number; items: PreparationItem[] };
  categories: { total: number; items: PreparationItem[] };
  legal: { total: number; items: PreparationItem[] };
  box: { total: number; items: PreparationItem[] };
  integrations: { total: number; items: PreparationItem[] };
  release: { total: number; items: PreparationItem[] };
  unavailableSections: string[];
};

function classifyPreparationError(error: { code?: string; message?: string } | null | undefined): DeliveryPreparationFailure {
  if (!error) return "INVALID_RESPONSE";
  if (error.code === "PGRST301" || error.code === "PGRST303") return "UNAUTHENTICATED";
  if (error.code === "42501") return /MFA|AAL2/i.test(error.message ?? "") ? "MFA_REQUIRED" : "FORBIDDEN";
  return "QUERY_FAILED";
}

function emptyList(): { total: number; items: PreparationItem[] } {
  return { total: 0, items: [] };
}

export async function loadDeliveryPreparationWorkspace(client: PreparationRpc, query: { serviceQ?: string; servicePage?: string; categoryQ?: string; categoryPage?: string }): Promise<
  | { status: "success"; workspace: DeliveryPreparationWorkspace }
  | { status: "error"; reason: DeliveryPreparationFailure; servicePage: number; categoryPage: number }
> {
  const servicePage = preparationPageNumber(query.servicePage);
  const categoryPage = preparationPageNumber(query.categoryPage);
  const [overviewResult, servicesResult, categoriesResult, legalResult, boxResult, integrationResult, releaseResult] = await Promise.all([
    client.rpc("delivery_preparation_overview"),
    client.rpc("list_delivery_preparation", { p_section: "CATALOG_SERVICE_AR", p_query: query.serviceQ ?? "", p_limit: pageSize, p_offset: (servicePage - 1) * pageSize }),
    client.rpc("list_delivery_preparation", { p_section: "CATALOG_CATEGORY_AR", p_query: query.categoryQ ?? "", p_limit: pageSize, p_offset: (categoryPage - 1) * pageSize }),
    client.rpc("list_delivery_preparation", { p_section: "LEGAL", p_query: "", p_limit: 20, p_offset: 0 }),
    client.rpc("list_delivery_preparation", { p_section: "BOX", p_query: "", p_limit: 50, p_offset: 0 }),
    client.rpc("list_delivery_preparation", { p_section: "INTEGRATION", p_query: "", p_limit: 20, p_offset: 0 }),
    client.rpc("list_delivery_preparation", { p_section: "RELEASE", p_query: "", p_limit: 20, p_offset: 0 }),
  ]);

  if (overviewResult.error) return { status: "error", reason: classifyPreparationError(overviewResult.error), servicePage, categoryPage };
  const overview = preparationOverviewSchema.safeParse(overviewResult.data);
  if (!overview.success) return { status: "error", reason: "INVALID_RESPONSE", servicePage, categoryPage };

  const unavailableSections: string[] = [];
  const parseList = (label: string, result: { data: unknown; error: { code?: string; message?: string } | null }) => {
    if (result.error) {
      unavailableSections.push(label);
      return emptyList();
    }
    const parsed = preparationListSchema.safeParse(result.data);
    if (!parsed.success) {
      unavailableSections.push(label);
      return emptyList();
    }
    return parsed.data;
  };

  return {
    status: "success",
    workspace: {
      servicePage,
      categoryPage,
      overview: overview.data,
      services: parseList("SERVICES", servicesResult),
      categories: parseList("CATEGORIES", categoriesResult),
      legal: parseList("LEGAL", legalResult),
      box: parseList("BOX", boxResult),
      integrations: parseList("INTEGRATIONS", integrationResult),
      release: parseList("RELEASE", releaseResult),
      unavailableSections,
    },
  };
}
