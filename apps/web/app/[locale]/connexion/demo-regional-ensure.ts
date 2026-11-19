import { createHash } from "node:crypto";
import type { DemoRegionalActor } from "./demo-regional-directory";

type DemoAdminClient = {
  auth: {
    admin: {
      listUsers: (args: { page: number; perPage: number }) => Promise<{
        data: { users: Array<{ id: string; email?: string | null }> };
        error: { message: string } | null;
      }>;
      createUser: (args: Record<string, unknown>) => Promise<{
        data: { user: { id: string } | null };
        error: { message: string } | null;
      }>;
      updateUserById: (id: string, args: Record<string, unknown>) => Promise<{
        data: { user: { id: string } | null };
        error: { message: string } | null;
      }>;
    };
  };
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

export function demoRegionalUuid(seed: string): string {
  const hex = createHash("sha256").update(`DEMO_REGIONAL_ACTOR_V1:${seed}`).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export function demoRegionalIds(actor: DemoRegionalActor) {
  const seed = `${actor.kind}:${actor.territoryCode}:${actor.slot}`;
  return {
    organizationId: demoRegionalUuid(`${seed}:org`),
    membershipId: demoRegionalUuid(`${seed}:membership`),
    userIdSeed: demoRegionalUuid(`${seed}:user`),
  };
}

async function findUserIdByEmail(admin: DemoAdminClient, email: string) {
  for (let page = 1; page <= 10; page += 1) {
    const listed = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (listed.error) return null;
    const found = listed.data.users.find((user) => (user.email || "").toLowerCase() === email.toLowerCase());
    if (found) return found.id;
    if (listed.data.users.length < 200) break;
  }
  return null;
}

/** Crée / met à jour l’utilisateur démo régional et son membership. */
export async function ensureDemoRegionalActor(input: {
  admin: DemoAdminClient;
  actor: DemoRegionalActor;
}): Promise<{ userId: string; organizationId: string } | null> {
  const { organizationId, membershipId, userIdSeed } = demoRegionalIds(input.actor);

  let userId = await findUserIdByEmail(input.admin, input.actor.email);
  if (!userId) {
    const created = await input.admin.auth.admin.createUser({
      id: userIdSeed,
      email: input.actor.email,
      email_confirm: true,
      user_metadata: {
        full_name: input.actor.labelFr,
        preferred_locale: "fr-MA",
      },
      app_metadata: {
        matricia_demo: true,
        demo_persona: input.actor.persona,
        demo_territory: input.actor.territoryCode,
        demo_slot: input.actor.slot,
      },
    });
    if (created.error || !created.data.user) return null;
    userId = created.data.user.id;
  } else {
    await input.admin.auth.admin.updateUserById(userId, {
      email_confirm: true,
      user_metadata: { full_name: input.actor.labelFr, preferred_locale: "fr-MA" },
      app_metadata: {
        matricia_demo: true,
        demo_persona: input.actor.persona,
        demo_territory: input.actor.territoryCode,
        demo_slot: input.actor.slot,
      },
    });
  }

  const attached = await input.admin.rpc("ensure_demo_regional_actor_v1", {
    p_user_id: userId,
    p_organization_id: organizationId,
    p_membership_id: membershipId,
    p_persona: input.actor.persona,
    p_territory_code: input.actor.territoryCode,
    p_slot: input.actor.slot,
    p_email: input.actor.email,
    p_display_name: input.actor.labelFr,
  });
  if (attached.error) return null;
  return { userId, organizationId };
}
