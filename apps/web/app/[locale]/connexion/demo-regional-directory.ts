import { DEMO_BOX_TERRITORIES } from "@/modules/admin/data/wholesale/demo-network";
import type { DemoPersona } from "./demo-personas";
import { demoCityBrands } from "./demo-regional-names";

export const DEMO_CLIENTS_PER_REGION = 6;
export const DEMO_PROVIDERS_PER_REGION = 3;

export type DemoRegionalTerritory = (typeof DEMO_BOX_TERRITORIES)[number];

export type DemoRegionalActorKind = "franchise" | "provider" | "client";

export type DemoRegionalActor = {
  kind: DemoRegionalActorKind;
  persona: Exclude<DemoPersona, "admin">;
  territoryCode: string;
  territoryNameFr: string;
  territoryNameAr: string;
  slot: string;
  email: string;
  labelFr: string;
  labelAr: string;
};

function slugTerritory(code: string) {
  return code.toLowerCase().replace(/_/gu, "-");
}

export function demoRegionalEmail(kind: DemoRegionalActorKind, territoryCode: string, slot: string) {
  const territory = slugTerritory(territoryCode);
  if (kind === "franchise") return `demo.franchise.${territory}@matricia.test`;
  if (kind === "provider") return `demo.st.${territory}.${slot.toLowerCase()}@matricia.test`;
  return `demo.client.${territory}.${slot}@matricia.test`;
}

export function listDemoRegionalTerritories() {
  return DEMO_BOX_TERRITORIES.map((item) => ({
    code: item.code,
    nameFr: item.nameFr,
    nameAr: item.nameAr,
    city: item.city,
  }));
}

function brandsFor(city: string, nameFr: string, nameAr: string) {
  return demoCityBrands(city) ?? {
    franchise: { fr: `Conseil ${nameFr}`, ar: `استشارة ${nameAr}` },
    providers: [
      { fr: `Services Pro ${city}`, ar: `خدمات برو ${city}` },
      { fr: `Tech Ops ${city}`, ar: `تك أوبس ${city}` },
      { fr: `Digital Desk ${city}`, ar: `ديجيتال ديسك ${city}` },
    ] as const,
    clients: [
      { fr: `Entreprise Alpha ${city}`, ar: `شركة ألفا ${city}` },
      { fr: `Entreprise Beta ${city}`, ar: `شركة بيتا ${city}` },
      { fr: `Entreprise Gamma ${city}`, ar: `شركة غاما ${city}` },
      { fr: `Entreprise Delta ${city}`, ar: `شركة دلتا ${city}` },
      { fr: `Entreprise Epsilon ${city}`, ar: `شركة إبسيلون ${city}` },
      { fr: `Entreprise Zêta ${city}`, ar: `شركة زيتا ${city}` },
    ] as const,
  };
}

export function listDemoRegionalActors(territoryCode: string): DemoRegionalActor[] {
  const territory = DEMO_BOX_TERRITORIES.find((item) => item.code === territoryCode);
  if (!territory) return [];
  const brands = brandsFor(territory.city, territory.nameFr, territory.nameAr);
  const actors: DemoRegionalActor[] = [
    {
      kind: "franchise",
      persona: "franchise",
      territoryCode: territory.code,
      territoryNameFr: territory.nameFr,
      territoryNameAr: territory.nameAr,
      slot: "F",
      email: demoRegionalEmail("franchise", territory.code, "F"),
      labelFr: brands.franchise.fr,
      labelAr: brands.franchise.ar,
    },
  ];
  for (const [index, slot] of (["A", "B", "C"] as const).entries()) {
    const brand = brands.providers[index]!;
    actors.push({
      kind: "provider",
      persona: "provider",
      territoryCode: territory.code,
      territoryNameFr: territory.nameFr,
      territoryNameAr: territory.nameAr,
      slot,
      email: demoRegionalEmail("provider", territory.code, slot),
      labelFr: brand.fr,
      labelAr: brand.ar,
    });
  }
  for (let index = 1; index <= DEMO_CLIENTS_PER_REGION; index += 1) {
    const slot = String(index);
    const brand = brands.clients[index - 1]!;
    actors.push({
      kind: "client",
      persona: "client",
      territoryCode: territory.code,
      territoryNameFr: territory.nameFr,
      territoryNameAr: territory.nameAr,
      slot,
      email: demoRegionalEmail("client", territory.code, slot),
      labelFr: brand.fr,
      labelAr: brand.ar,
    });
  }
  return actors;
}

export function findDemoRegionalActor(input: {
  kind: string;
  territoryCode: string;
  slot: string;
}): DemoRegionalActor | null {
  const kind = input.kind === "franchise" || input.kind === "provider" || input.kind === "client" ? input.kind : null;
  if (!kind) return null;
  return listDemoRegionalActors(input.territoryCode).find(
    (actor) => actor.kind === kind && actor.slot.toLowerCase() === input.slot.toLowerCase(),
  ) ?? null;
}

export function listAllDemoRegionalActors(): DemoRegionalActor[] {
  return DEMO_BOX_TERRITORIES.flatMap((territory) => listDemoRegionalActors(territory.code));
}

export function demoRegionalSummary() {
  const territories = DEMO_BOX_TERRITORIES.length;
  return {
    territories,
    franchises: territories,
    providers: territories * DEMO_PROVIDERS_PER_REGION,
    clients: territories * DEMO_CLIENTS_PER_REGION,
  };
}
