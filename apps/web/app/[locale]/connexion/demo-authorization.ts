import type { DemoPersona } from "./demo-personas";

type DemoRoleAdmin = {
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }>;
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
  return !viaRpc.error && viaRpc.data === true;
}
