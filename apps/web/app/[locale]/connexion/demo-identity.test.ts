import { describe, expect, it, vi } from "vitest";
import { findDemoIdentity, isDemoIdentity } from "./demo-identity";
import { ensureDemoRegionalActor } from "./demo-regional-ensure";
import { listDemoRegionalActors, listDemoRegionalTerritories } from "./demo-regional-directory";

describe("SEC-02 trusted synthetic identity", () => {
  it.each(["person@example.com", "demo@matricia.test.attacker.com", "a@b@test.invalid"])("rejects deliverable or malformed address %s", (email) => {
    expect(isDemoIdentity({ id: "user", email, app_metadata: { matricia_demo: true, demo_persona: "admin" } }, email, "admin")).toBe(false);
  });
  it("does not accept user-controlled metadata or a string boolean", () => {
    expect(isDemoIdentity({ id: "user", email: "demo@matricia.test", app_metadata: { matricia_demo: "true", demo_persona: "admin" } }, "demo@matricia.test", "admin")).toBe(false);
  });
  it("fails closed on directory errors and absent users", async () => {
    const listUsers = vi.fn().mockResolvedValueOnce({ data: { users: [] }, error: { message: "unavailable" } }).mockResolvedValueOnce({ data: { users: [] }, error: null });
    const admin = { auth: { admin: { listUsers } } };
    expect(await findDemoIdentity(admin, "demo@matricia.test", "admin")).toBeNull();
    expect(await findDemoIdentity(admin, "demo@matricia.test", "admin")).toBeNull();
  });
  it.each([{}, { matricia_demo: true, demo_persona: "admin" }])("does not relabel an existing regional account: %j", async (app_metadata) => {
    const territory = listDemoRegionalTerritories().at(0);
    if (!territory) throw new Error("Missing regional fixture");
    const actor = listDemoRegionalActors(territory.code).at(0);
    if (!actor) throw new Error("Missing regional actor fixture");
    const createUser = vi.fn();
    const updateUserById = vi.fn();
    const rpc = vi.fn();
    const admin = { auth: { admin: {
      getUserById: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      listUsers: vi.fn().mockResolvedValue({ data: { users: [{ id: "existing", email: actor.email, app_metadata }] }, error: null }),
      createUser, updateUserById,
    } }, rpc };
    expect(await ensureDemoRegionalActor({ admin, actor })).toBeNull();
    expect(createUser).not.toHaveBeenCalled();
    expect(updateUserById).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("creates via deterministic seed when Auth listUsers pagination fails", async () => {
    const territory = listDemoRegionalTerritories().find((item) => item.code === "TANGER_TETOUAN_AL_HOCEIMA")
      ?? listDemoRegionalTerritories().at(0);
    if (!territory) throw new Error("Missing regional fixture");
    const actor = listDemoRegionalActors(territory.code).find((item) => item.kind === "provider" && item.slot === "A");
    if (!actor) throw new Error("Missing regional provider fixture");
    const { demoRegionalIds } = await import("./demo-regional-ensure");
    const ids = demoRegionalIds(actor);
    const createdUser = {
      id: ids.userIdSeed,
      email: actor.email,
      app_metadata: {
        matricia_demo: true,
        demo_persona: actor.persona,
        demo_territory: actor.territoryCode,
        demo_slot: actor.slot,
      },
    };
    const getUserById = vi.fn()
      .mockResolvedValueOnce({ data: { user: null }, error: null })
      .mockResolvedValue({ data: { user: createdUser }, error: null });
    const createUser = vi.fn().mockResolvedValue({ data: { user: { id: ids.userIdSeed } }, error: null });
    const updateUserById = vi.fn().mockResolvedValue({ data: { user: { id: ids.userIdSeed } }, error: null });
    const rpc = vi.fn().mockResolvedValue({ data: {}, error: null });
    const admin = {
      auth: {
        admin: {
          getUserById,
          listUsers: vi.fn().mockResolvedValue({ data: { users: [] }, error: { message: "Database error finding users" } }),
          createUser,
          updateUserById,
        },
      },
      rpc,
    };
    await expect(ensureDemoRegionalActor({ admin, actor })).resolves.toEqual({
      userId: ids.userIdSeed,
      organizationId: ids.organizationId,
    });
    expect(createUser).toHaveBeenCalledOnce();
    expect(rpc).toHaveBeenCalledOnce();
  });
});
