import { preparationListSchema, preparationOverviewSchema, type PreparationItem, type PreparationOverview } from "./model";

const pageSize = 20;

export function preparationPageNumber(value: string | undefined) {
  const parsed = Number.parseInt(value ?? "1", 10);
  return Number.isFinite(parsed) ? Math.min(500, Math.max(1, parsed)) : 1;
}

type PreparationRpc = {
  rpc: (fn: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>;
};

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
};

export async function loadDeliveryPreparationWorkspace(client: PreparationRpc, query: { serviceQ?: string; servicePage?: string; categoryQ?: string; categoryPage?: string }): Promise<{ status: "success"; workspace: DeliveryPreparationWorkspace } | { status: "error"; servicePage: number; categoryPage: number }> {
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
  const overview = preparationOverviewSchema.safeParse(overviewResult.data);
  const services = preparationListSchema.safeParse(servicesResult.data);
  const categories = preparationListSchema.safeParse(categoriesResult.data);
  const legal = preparationListSchema.safeParse(legalResult.data);
  const box = preparationListSchema.safeParse(boxResult.data);
  const integrations = preparationListSchema.safeParse(integrationResult.data);
  const release = preparationListSchema.safeParse(releaseResult.data);
  const failed = [overviewResult, servicesResult, categoriesResult, legalResult, boxResult, integrationResult, releaseResult].some((result) => result.error) || !overview.success || !services.success || !categories.success || !legal.success || !box.success || !integrations.success || !release.success;
  if (failed || !overview.success || !services.success || !categories.success || !legal.success || !box.success || !integrations.success || !release.success) return { status: "error", servicePage, categoryPage };
  return { status: "success", workspace: { servicePage, categoryPage, overview: overview.data, services: services.data, categories: categories.data, legal: legal.data, box: box.data, integrations: integrations.data, release: release.data } };
}
