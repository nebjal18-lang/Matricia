import { renderAdminSpacePage } from "@/modules/admin/screens/spaces/render-admin-space";

export default async function AdminSpacePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; space: string }>;
  searchParams: Promise<{ organizationId?: string; q?: string; vue?: string; fixtures?: string }>;
}) {
  const [{ locale, space }, query] = await Promise.all([params, searchParams]);
  return renderAdminSpacePage({ locale, space, organizationId: query.organizationId, q: query.q, vue: query.vue, fixtures: query.fixtures });
}
