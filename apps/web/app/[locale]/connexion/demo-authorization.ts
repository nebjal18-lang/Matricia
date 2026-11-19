import type { DemoPersona } from "./demo-personas";

type DemoRoleAdmin = {
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }>;
  from: (table: string) => {
    upsert: (
      values: Record<string, unknown>,
      options?: { onConflict?: string },
    ) => PromiseLike<{ error: { message: string; code?: string } | null }>;
  };
};

/**
 * Sans MATRICIA_ADMIN actif, le bouton Admin tombe en `navigation=role-fallback`
 * vers l’espace client. On rétablit le rôle plateforme en mode démo uniquement.
 */
export async function ensureDemoPersonaAuthorization(input: {
  persona: DemoPersona;
  userId: string;
  admin: DemoRoleAdmin;
}): Promise<boolean> {
  if (input.persona !== "admin") return true;

  const viaRpc = await input.admin.rpc("ensure_demo_admin_platform_role_v1", {
    p_user_id: input.userId,
  });
  if (!viaRpc.error) return true;

  // Fallback tant que la migration RPC n’est pas appliquée : upsert direct service_role.
  const granted = await input.admin.from("platform_user_roles").upsert(
    {
      user_id: input.userId,
      role_code: "MATRICIA_ADMIN",
      granted_by: input.userId,
      revoked_at: null,
    },
    { onConflict: "user_id,role_code" },
  );
  return !granted.error;
}
