import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";
import {
  buildDemoCommerceCatalog,
  buildDemoDocumentVault,
  buildDemoVolumeDemand,
  canApplyAdminDemoHubs,
} from "@/modules/admin/data/spaces/demo-hubs";
import {
  adminCommerceCatalogSchema,
  adminDocumentVaultSchema,
  adminVolumeDemandSchema,
  type AdminCatalogErrorReason,
  type AdminCatalogResult,
  type AdminCommerceCatalog,
  type AdminDocumentVault,
  type AdminVolumeDemand,
} from "./model";

function mapError(code?: string): AdminCatalogErrorReason {
  return code === "42501" ? "FORBIDDEN" : "UNAVAILABLE";
}

async function load<T>(name: string, args: Record<string, unknown>, parse: (data: unknown) => T | null): Promise<AdminCatalogResult<T>> {
  const client = await getSupabaseServerClient();
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) return { status: "error", reason: "UNAUTHENTICATED" };
  const response = await client.rpc(name, args);
  if (response.error) return { status: "error", reason: mapError(response.error.code) };
  const value = parse(response.data);
  return value ? { status: "success", value } : { status: "error", reason: "INVALID_RESPONSE" };
}

export async function loadAdminCommerceCatalog(): Promise<AdminCatalogResult<AdminCommerceCatalog>> {
  if (canApplyAdminDemoHubs()) {
    const parsed = adminCommerceCatalogSchema.safeParse(buildDemoCommerceCatalog());
    return parsed.success ? { status: "success", value: parsed.data } : { status: "error", reason: "INVALID_RESPONSE" };
  }
  return load("list_admin_commerce_catalog", { p_limit: 100 }, (data) => {
    const parsed = adminCommerceCatalogSchema.safeParse(data);
    return parsed.success ? parsed.data : null;
  });
}

export async function loadAdminVolumeDemand(): Promise<AdminCatalogResult<AdminVolumeDemand>> {
  if (canApplyAdminDemoHubs()) {
    const parsed = adminVolumeDemandSchema.safeParse(buildDemoVolumeDemand());
    return parsed.success ? { status: "success", value: parsed.data } : { status: "error", reason: "INVALID_RESPONSE" };
  }
  return load("list_admin_volume_demand", { p_limit: 24 }, (data) => {
    const parsed = adminVolumeDemandSchema.safeParse(data);
    return parsed.success ? parsed.data : null;
  });
}

export async function loadAdminDocumentVault(): Promise<AdminCatalogResult<AdminDocumentVault>> {
  if (canApplyAdminDemoHubs()) {
    const parsed = adminDocumentVaultSchema.safeParse(buildDemoDocumentVault());
    return parsed.success ? { status: "success", value: parsed.data } : { status: "error", reason: "INVALID_RESPONSE" };
  }
  return load("list_admin_document_vault", { p_limit: 80 }, (data) => {
    const parsed = adminDocumentVaultSchema.safeParse(data);
    return parsed.success ? parsed.data : null;
  });
}
