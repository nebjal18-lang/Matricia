import type { DemoRegionalActor } from "./demo-regional-directory";
import { findDemoRegionalActor } from "./demo-regional-directory";
import { ensureDemoRegionalActor, type DemoAdminClient } from "./demo-regional-ensure";

/**
 * After a regional Client is ensured, seed the COM film against providers A+B
 * of the same territory. Failures are soft — login must still succeed.
 */
export async function ensureDemoClientComFilm(input: {
  admin: DemoAdminClient;
  client: DemoRegionalActor;
  clientUserId: string;
  clientOrganizationId: string;
}): Promise<boolean> {
  if (input.client.persona !== "client") return false;
  try {
    const providerA = findDemoRegionalActor({
      kind: "provider",
      territoryCode: input.client.territoryCode,
      slot: "A",
    });
    const providerB = findDemoRegionalActor({
      kind: "provider",
      territoryCode: input.client.territoryCode,
      slot: "B",
    });
    if (!providerA || !providerB) return false;

    const ensuredA = await ensureDemoRegionalActor({ admin: input.admin, actor: providerA });
    const ensuredB = await ensureDemoRegionalActor({ admin: input.admin, actor: providerB });
    if (!ensuredA || !ensuredB) return false;

    const seeded = await input.admin.rpc("ensure_demo_client_com_film_v1", {
      p_client_organization_id: input.clientOrganizationId,
      p_client_user_id: input.clientUserId,
      p_provider_a_organization_id: ensuredA.organizationId,
      p_provider_a_user_id: ensuredA.userId,
      p_provider_b_organization_id: ensuredB.organizationId,
      p_provider_b_user_id: ensuredB.userId,
    });
    return !seeded.error;
  } catch {
    return false;
  }
}
