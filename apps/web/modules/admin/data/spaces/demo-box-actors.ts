import { createHash } from "node:crypto";
import {
  isDemoWholesaleEnabled,
  listAllDemoActors,
} from "@/modules/admin/data/wholesale/demo-network";
import type { DemoActorProfile } from "@/modules/admin/data/wholesale/model";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import type { AdminSpaceId } from "./admin-nav";
import { spaceHref, statusTone } from "./screen-catalog";
import type { SpaceRow } from "./space-data";

function demoDocId(seed: string): string {
  const hex = createHash("sha256").update(`DEMO_BOX_DOC:${seed}`).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function territoryLabel(code: string, locale: Locale) {
  return code
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(locale === "ar" ? " " : "-");
}

function documentsSummary(actor: DemoActorProfile, locale: Locale) {
  return actor.documents
    .map((document) => {
      const label = locale === "ar" ? document.label_ar : document.label_fr;
      const expiry = document.expires_on ? ` · exp ${document.expires_on}` : "";
      return `${label} (${document.code}) ${document.status} · ${document.reference}${expiry}`;
    })
    .join(" | ");
}

function actorExtras(actor: DemoActorProfile, locale: Locale): Record<string, string> {
  return {
    legalName: actor.legal_name,
    city: actor.city,
    address: locale === "ar" ? actor.address_ar : actor.address_fr,
    email: actor.email,
    phone: actor.phone,
    manager: `${actor.manager_name} · CIN ${actor.manager_cin}`,
    ice: actor.ice,
    taxId: actor.tax_id,
    tradeRegister: actor.trade_register,
    rib: actor.rib,
    cnss: actor.cnss,
    sector: locale === "ar" ? actor.sector_name_ar : actor.sector_name_fr,
    territory: actor.territory_code,
    documents: documentsSummary(actor, locale),
    documentCount: String(actor.documents.length),
  };
}

function franchiseRow(locale: Locale, query: string, actor: DemoActorProfile): SpaceRow {
  const territory = territoryLabel(actor.territory_code, locale);
  const sector = locale === "ar" ? actor.sector_name_ar : actor.sector_name_fr;
  const title = `${actor.display_name}`;
  return {
    id: actor.organization_id,
    href: spaceHref(locale, "franchises", query, actor.organization_id),
    title,
    cells: [
      title,
      sector,
      territory,
      "v1",
      actor.validation_status,
      actor.sector_code === "IT" ? "IT" : locale === "ar" ? "قياسي" : "Standard",
      "—",
      actor.validation_status,
    ],
    status: actor.validation_status,
    tone: statusTone(actor.validation_status),
    organizationId: actor.organization_id,
    treat: false,
    extras: actorExtras(actor, locale),
  };
}

function providerRow(locale: Locale, query: string, actor: DemoActorProfile): SpaceRow {
  const sector = locale === "ar" ? actor.sector_name_ar : actor.sector_name_fr;
  const docsOk = `${actor.documents.filter((d) => d.status === "VERIFIED").length}/${actor.documents.length}`;
  return {
    id: actor.organization_id,
    href: `/${locale}/administration/providers/${actor.organization_id}${query}`,
    title: actor.display_name,
    cells: [
      actor.display_name,
      sector,
      docsOk,
      docsOk,
      String(actor.documents.length),
      "SIGNED",
    ],
    status: actor.validation_status,
    tone: statusTone(actor.validation_status),
    organizationId: actor.organization_id,
    treat: false,
    extras: { ...actorExtras(actor, locale), partner: "SIGNED", rowVersion: "1" },
  };
}

function capacityRows(locale: Locale, query: string, actor: DemoActorProfile): SpaceRow[] {
  return actor.documents.map((document, index) => {
    const label = locale === "ar" ? document.label_ar : document.label_fr;
    const id = demoDocId(`${actor.organization_id}:${document.code}:${index}`);
    return {
      id,
      href: spaceHref(locale, "capacite", query, id),
      title: `${actor.display_name} · ${label}`,
      cells: [
        actor.display_name,
        document.code,
        label,
        document.status,
        document.expires_on ?? "—",
        document.reference,
      ],
      status: document.status,
      tone: statusTone(document.status),
      organizationId: actor.organization_id,
      treat: document.status !== "VERIFIED",
      extras: {
        ...actorExtras(actor, locale),
        documentCode: document.code,
        documentLabel: label,
        documentStatus: document.status,
        documentReference: document.reference,
        documentExpires: document.expires_on ?? "",
      },
    };
  });
}

/** Remplace les files acteurs par le réseau Box démo (dossiers hors page Offres). */
export function buildDemoBoxActorSpaceRows(
  locale: Locale,
  space: AdminSpaceId,
  query: string,
): SpaceRow[] | null {
  if (!isDemoWholesaleEnabled()) return null;
  if (space !== "franchises" && space !== "providers" && space !== "capacite") return null;

  const actors = listAllDemoActors();
  if (space === "franchises") {
    return actors.filter((actor) => actor.role === "FRANCHISEE").map((actor) => franchiseRow(locale, query, actor));
  }
  if (space === "providers") {
    return actors.filter((actor) => actor.role === "PROVIDER").map((actor) => providerRow(locale, query, actor));
  }
  return actors
    .filter((actor) => actor.role === "PROVIDER")
    .flatMap((actor) => capacityRows(locale, query, actor));
}
