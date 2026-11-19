import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { OrganizationIdentityBlock } from "@/modules/shared/ui/organization-identity/OrganizationIdentityBlock";

const identity = {
  legalName: "Atlas Conseil SARL",
  displayName: "Atlas Conseil",
  countryCode: "MA",
  legalForm: "SARL",
  incorporationDate: "2020-02-20",
  activity: "Conseil",
  sector: "Services",
  registeredCity: "Casablanca",
  registeredAddress: {
    line1: "10 rue Exemple",
    city: "Casablanca",
    postal_code: "20000",
    country_code: "MA",
  },
  identifiers: { ICE: "123456789012345", IF: "12345678", RC: "RC-42" },
  representative: {
    first_name: "Amal",
    last_name: "Alami",
    title: "Gérante",
    email: "amal@example.invalid",
    phone: "+212600000001",
    power: "Gérante statutaire",
  },
};

describe("OrganizationIdentityBlock", () => {
  it("renders Gold Master identity fields with Version A tones", () => {
    const html = renderToStaticMarkup(
      <OrganizationIdentityBlock locale="fr" identity={identity} />,
    );
    expect(html).toContain("Identité de l’organisation");
    expect(html).toContain("Identifiants canoniques");
    expect(html).toContain("Représentant autorisé");
    expect(html).toContain("SARL");
    expect(html).toContain("123456789012345");
    expect(html).toContain("Gérante statutaire");
    expect(html).toContain('data-tone="violet"');
    expect(html).toContain('data-tone="mint"');
    expect(html).toContain('data-tone="coral"');
  });

  it("localizes to Arabic", () => {
    const html = renderToStaticMarkup(
      <OrganizationIdentityBlock locale="ar" identity={identity} />,
    );
    expect(html).toContain("هوية المؤسسة");
    expect(html).toContain("الممثل المخول");
  });
});
