import { describe, expect, it } from "vitest";
import {
  isDirectoryFixture,
  isDirectoryOrgFixture,
  organizationDisplayLabel,
  personAvatarInitial,
  personDisplayLabel,
  scopeLabelsLine,
} from "./directory-presentation";

const id = "a2290000-0000-4000-8000-000000000003";

describe("shared directory presentation", () => {
  it("hides lab identities and cleans organization labels for all actor spaces", () => {
    expect(isDirectoryFixture({
      email: "demo.prestataire@matricia.test",
      displayName: "Prestataire Démo Matricia",
    })).toBe(true);
    expect(isDirectoryOrgFixture(`P05 E2E A ${id}`)).toBe(true);
    expect(isDirectoryOrgFixture("Atlas Franchise Conseil")).toBe(false);
    expect(organizationDisplayLabel(`P05 E2E A ${id}`, "fr")).toBe("P05 A");
    expect(organizationDisplayLabel(`P05 E2E A ${id} SUPERSEDED`, "fr")).toBe("P05 A");
    expect(personDisplayLabel({ givenName: "Karim", familyName: "Benjelloun" }, "fr")).toBe("Karim Benjelloun");
    expect(personAvatarInitial({ givenName: "Hatim", familyName: "Ahmitech", displayName: "Franchise Parcours IT" }, "fr")).toBe("H");
    expect(scopeLabelsLine(["IT", "IT:HATIM_AHMITECH · MA"], "Non défini")).toBe("IT · IT:HATIM_AHMITECH · MA");
  });
});
