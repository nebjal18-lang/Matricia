import { describe, expect, it } from "vitest";
import {
  actorAccountSubtitle,
  actorAccountTitle,
  actorAvatarInitial,
  actorMembershipOrganizationsLabel,
  actorOrganizationLabel,
  actorRolesLabel,
  actorScopeLabels,
  isAdminDirectoryFixture,
  isAdminOrgDirectoryFixture,
} from "./actor-presentation";
import { groupActorAccounts, type ActorUserRow } from "./actor-user-model";

const id = "a2290000-0000-4000-8000-000000000003";
const membershipA = "b2290000-0000-4000-8000-000000000001";
const membershipB = "b2290000-0000-4000-8000-000000000002";
const orgA = "c2290000-0000-4000-8000-000000000001";
const orgB = "c2290000-0000-4000-8000-000000000002";

describe("admin actor presentation", () => {
  it("hides E2E, example.invalid and Démo seed accounts from the default directory", () => {
    expect(isAdminDirectoryFixture({
      email: `conformite-e2e-${id}@example.invalid`,
      displayName: `Conformité E2E${id}@example.invalid`,
      organizationName: `P05 E2E A ${id}`,
    })).toBe(true);
    expect(isAdminDirectoryFixture({
      email: "demo.prestataire@matricia.test",
      displayName: "Prestataire Démo Matricia",
      organizationName: "Prestataire - Bibliothèque concurrence",
    })).toBe(true);
    expect(isAdminDirectoryFixture({
      email: "client.validation@matricia.test",
      displayName: "Sara Kadiri",
      organizationName: "Atlas Client Services",
    })).toBe(false);
    expect(isAdminOrgDirectoryFixture("Prestataire - Bibliothèque concurrence")).toBe(true);
    expect(isAdminOrgDirectoryFixture("Atlas Franchise Conseil", "Atlas Franchise Conseil SARL")).toBe(false);
  });

  it("prefers real person names and never surfaces UUID@email blobs as the primary title", () => {
    expect(actorAccountTitle({
      givenName: "Leila",
      familyName: "Amrani",
      displayName: "Profil technique",
      email: "leila@example.com",
    }, "fr")).toBe("Leila Amrani");
    expect(actorAccountTitle({
      displayName: `Conformité E2Ep05-e2e-central-${id}@example.invalid`,
      email: `conformite-e2e-central-${id}@example.invalid`,
    }, "fr")).toBe("Conformite Central");
    expect(actorAccountSubtitle({
      email: "client.validation@matricia.test",
      phone: "+212612345678",
      preferredLocale: "fr-MA",
      userId: id,
    })).toContain("client.validation@matricia.test");
  });

  it("labels roles, cleans technical organization names and groups memberships per account", () => {
    expect(actorRolesLabel(["CLIENT_OWNER", "MATRICIA_ADMIN"], "fr")).toBe("Propriétaire client · Admin Matricia");
    expect(actorRolesLabel([], "fr")).toBe("—");
    expect(actorOrganizationLabel(`P05 E2E A ${id}`, "fr")).toBe("P05 A");
    expect(actorOrganizationLabel(null, "fr")).toBe("Sans organisation");

    const rows: ActorUserRow[] = [
      {
        userId: id,
        membershipId: membershipA,
        organizationId: orgA,
        organizationName: "Validation client",
        roles: ["CLIENT_OWNER"],
        status: "ACTIVE",
        updatedAt: null,
        displayName: "Sara Kadiri",
        email: "client.validation@matricia.test",
        phone: "+212600000001",
        preferredLocale: "fr-MA",
        givenName: "Sara",
        familyName: "Kadiri",
        platformRoles: [],
        libraryScopes: [],
        franchiseScopes: [],
        accountStatus: "ACTIVE",
        lastSignInAt: "2026-11-09T10:00:00.000Z",
        mfaStatus: "ENABLED",
        sessionCount: 1,
      },
      {
        userId: id,
        membershipId: membershipB,
        organizationId: orgB,
        organizationName: "Deuxième org",
        roles: ["CLIENT_ADMIN"],
        status: "ACTIVE",
        updatedAt: null,
        displayName: "Sara Kadiri",
        email: "client.validation@matricia.test",
        phone: "+212600000001",
        preferredLocale: "fr-MA",
        givenName: "Sara",
        familyName: "Kadiri",
        platformRoles: ["COMPLIANCE_MANAGER"],
        libraryScopes: [],
        franchiseScopes: [],
        accountStatus: "ACTIVE",
        lastSignInAt: "2026-11-09T10:00:00.000Z",
        mfaStatus: "ENABLED",
        sessionCount: 1,
      },
    ];
    const accounts = groupActorAccounts(rows);
    expect(accounts).toHaveLength(1);
    expect(accounts[0]?.memberships).toHaveLength(2);
    expect(accounts[0]?.platformRoles).toEqual(["COMPLIANCE_MANAGER"]);
    expect(actorMembershipOrganizationsLabel(accounts[0]!.memberships, "fr")).toBe("Validation client · Deuxième org");
    expect(actorAccountTitle(accounts[0]!, "fr")).toBe("Sara Kadiri");
    expect(actorAvatarInitial(accounts[0]!, "fr")).toBe("S");
    expect(actorScopeLabels(["IT", "IT:HATIM_AHMITECH"], "fr")).toBe("IT · IT:HATIM_AHMITECH");
  });
});
