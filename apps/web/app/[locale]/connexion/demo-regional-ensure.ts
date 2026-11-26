import { createHash } from "node:crypto";
import { isDemoIdentity, type DemoIdentity } from "./demo-identity";
import type { DemoRegionalActor } from "./demo-regional-directory";

export type DemoAdminClient = {
  auth: {
    admin: {
      getUserById: (id: string) => Promise<{
        data: { user: DemoIdentity | null };
        error: { message: string } | null;
      }>;
      listUsers: (args: { page: number; perPage: number }) => Promise<{
        data: { users: DemoIdentity[] };
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

function matchesRegionalActor(user: DemoIdentity, actor: DemoRegionalActor): boolean {
  return isDemoIdentity(user, actor.email, actor.persona)
    && user.app_metadata?.demo_territory === actor.territoryCode
    && user.app_metadata?.demo_slot === actor.slot;
}

/** Prefer deterministic UUID — Auth listUsers pagination fails past a few hundred users. */
async function findUserBySeed(admin: DemoAdminClient, userIdSeed: string): Promise<DemoIdentity | null> {
  const byId = await admin.auth.admin.getUserById(userIdSeed);
  if (byId.error || !byId.data.user) return null;
  return byId.data.user;
}

/** Best-effort email scan; stop quietly when Auth pagination fails. */
async function findUserIdByEmail(admin: DemoAdminClient, email: string): Promise<DemoIdentity | null> {
  for (let page = 1; page <= 10; page += 1) {
    const listed = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (listed.error) return null;
    const found = listed.data.users.find((user) => (user.email || "").toLowerCase() === email.toLowerCase());
    if (found) return found;
    if (listed.data.users.length < 200) break;
  }
  return null;
}

async function loadDemoUser(admin: DemoAdminClient, userId: string): Promise<DemoIdentity | null> {
  const result = await admin.auth.admin.getUserById(userId);
  if (result.error || !result.data.user) return null;
  return result.data.user;
}

/**
 * Crée / met à jour l’utilisateur démo régional et son membership.
 * Never throws — callers redirect on null. Lookup is seed-first so Auth
 * listUsers pagination outages cannot produce a server digest.
 */
export async function ensureDemoRegionalActor(input: {
  admin: DemoAdminClient;
  actor: DemoRegionalActor;
}): Promise<{ userId: string; organizationId: string } | null> {
  try {
    const { organizationId, membershipId, userIdSeed } = demoRegionalIds(input.actor);
    const demoMeta = {
      matricia_demo: true,
      demo_persona: input.actor.persona,
      demo_territory: input.actor.territoryCode,
      demo_slot: input.actor.slot,
    };
    const userMeta = {
      full_name: input.actor.labelFr,
      preferred_locale: "fr-MA",
    };

    let existing = await findUserBySeed(input.admin, userIdSeed);
    if (existing && existing.email?.toLowerCase() !== input.actor.email.toLowerCase()) {
      return null;
    }

    if (!existing) {
      const byEmail = await findUserIdByEmail(input.admin, input.actor.email);
      if (byEmail) {
        // Never relabel a non-demo or differently tagged account.
        if (!matchesRegionalActor(byEmail, input.actor)) return null;
        existing = byEmail;
      }
    }

    let userId = existing?.id;
    if (!userId) {
      const created = await input.admin.auth.admin.createUser({
        id: userIdSeed,
        email: input.actor.email,
        email_confirm: true,
        user_metadata: userMeta,
        app_metadata: demoMeta,
      });
      if (created.error || !created.data.user) {
        const raced = (await findUserBySeed(input.admin, userIdSeed))
          ?? (await findUserIdByEmail(input.admin, input.actor.email));
        if (!raced || raced.email?.toLowerCase() !== input.actor.email.toLowerCase()) return null;
        if (raced.app_metadata?.matricia_demo === true
          && raced.app_metadata?.demo_persona
          && raced.app_metadata.demo_persona !== input.actor.persona) {
          return null;
        }
        if (raced.app_metadata?.matricia_demo === true
          && raced.app_metadata?.demo_territory
          && raced.app_metadata?.demo_slot
          && (raced.app_metadata.demo_territory !== input.actor.territoryCode
            || raced.app_metadata.demo_slot !== input.actor.slot)) {
          return null;
        }
        userId = raced.id;
      } else {
        userId = created.data.user.id;
      }
    }

    const updated = await input.admin.auth.admin.updateUserById(userId, {
      email_confirm: true,
      user_metadata: userMeta,
      app_metadata: demoMeta,
    });
    if (updated.error) return null;

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

    const confirmed = await loadDemoUser(input.admin, userId);
    if (!confirmed || !matchesRegionalActor(confirmed, input.actor)) return null;

    return { userId, organizationId };
  } catch {
    return null;
  }
}

/** Load a regional demo identity without depending on Auth listUsers pagination. */
export async function loadDemoRegionalIdentity(
  admin: DemoAdminClient,
  userId: string,
  actor: DemoRegionalActor,
): Promise<DemoIdentity | null> {
  try {
    const user = await loadDemoUser(admin, userId);
    if (!user || !matchesRegionalActor(user, actor)) return null;
    return user;
  } catch {
    return null;
  }
}
