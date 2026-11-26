import { createHash } from "node:crypto";
import { applyMarginBps, DEFAULT_BOX_PLATFORM_MARGIN_BPS } from "./margin";
import type { DemoActorProfile, DemoValidationDocument, WholesaleCatalog, WholesaleOffer } from "./model";
import { isDemoAccessEnabled } from "@/modules/shared/lib/demo-access";

/** Use the same demo gate as the login page. */
export function isDemoWholesaleEnabled() {
  return isDemoAccessEnabled();
}

/** 12 régions administratives Maroc (même liste que franchise_applications). */
export const DEMO_BOX_TERRITORIES = [
  { code: "TANGER_TETOUAN_AL_HOCEIMA", nameFr: "Tanger-Tétouan-Al Hoceïma", nameAr: "طنجة تطوان الحسيمة", city: "Tanger" },
  { code: "ORIENTAL", nameFr: "Oriental", nameAr: "الشرق", city: "Oujda" },
  { code: "FES_MEKNES", nameFr: "Fès-Meknès", nameAr: "فاس مكناس", city: "Fès" },
  { code: "RABAT_SALE_KENITRA", nameFr: "Rabat-Salé-Kénitra", nameAr: "الرباط سلا القنيطرة", city: "Rabat" },
  { code: "BENI_MELLAL_KHENIFRA", nameFr: "Béni Mellal-Khénifra", nameAr: "بني ملال خنيفرة", city: "Béni Mellal" },
  { code: "CASABLANCA_SETTAT", nameFr: "Casablanca-Settat", nameAr: "الدار البيضاء سطات", city: "Casablanca" },
  { code: "MARRAKECH_SAFI", nameFr: "Marrakech-Safi", nameAr: "مراكش آسفي", city: "Marrakech" },
  { code: "DRAA_TAFILALET", nameFr: "Drâa-Tafilalet", nameAr: "درعة تافيلالت", city: "Errachidia" },
  { code: "SOUSS_MASSA", nameFr: "Souss-Massa", nameAr: "سوس ماسة", city: "Agadir" },
  { code: "GUELMIM_OUED_NOUN", nameFr: "Guelmim-Oued Noun", nameAr: "كلميم واد نون", city: "Guelmim" },
  { code: "LAAYOUNE_SAKIA_EL_HAMRA", nameFr: "Laâyoune-Sakia El Hamra", nameAr: "العيون الساقية الحمراء", city: "Laâyoune" },
  { code: "DAKHLA_OUED_ED_DAHAB", nameFr: "Dakhla-Oued Ed-Dahab", nameAr: "الداخلة وادي الذهب", city: "Dakhla" },
] as const;

/** 10 secteurs = 10 bibliothèques Gold Master. */
export const DEMO_BOX_SECTORS = [
  { code: "IT", nameFr: "Informatique", nameAr: "المعلوميات" },
  { code: "COM", nameFr: "Communication & marketing", nameAr: "التواصل والتسويق" },
  { code: "ACC", nameFr: "Comptabilité & fiscalité", nameAr: "المحاسبة والضرائب" },
  { code: "LEGAL", nameFr: "Juridique", nameAr: "القانون" },
  { code: "HR", nameFr: "Ressources humaines", nameAr: "الموارد البشرية" },
  { code: "INS", nameFr: "Assurance", nameAr: "التأمين" },
  { code: "LOG", nameFr: "Logistique & achats", nameAr: "اللوجستيك والمشتريات" },
  { code: "BTP", nameFr: "BTP & immobilier", nameAr: "البناء والعقار" },
  { code: "QHSE", nameFr: "Qualité HSE", nameAr: "الجودة والسلامة" },
  { code: "SALES", nameFr: "Commercial & vente", nameAr: "المبيعات" },
] as const;

const PROVIDERS = ["A", "B", "C"] as const;

const SERVICE_TEMPLATES: Record<(typeof DEMO_BOX_SECTORS)[number]["code"], Array<{ code: string; unit: string; qty: string; fr: string; ar: string; wholesaleMinor: string }>> = {
  IT: [
    { code: "WEB_PACK10", unit: "SITE", qty: "10", fr: "Pack 10 sites web", ar: "حزمة 10 مواقع", wholesaleMinor: "2500000" },
    { code: "SEC_AUDIT", unit: "AUDIT", qty: "1", fr: "Audit cybersécurité", ar: "تدقيق أمن سيبراني", wholesaleMinor: "1800000" },
    { code: "DATA_DASH", unit: "TABLEAU", qty: "1", fr: "Tableau de bord data", ar: "لوحة بيانات", wholesaleMinor: "1200000" },
  ],
  COM: [
    { code: "BRAND_KIT", unit: "KIT", qty: "1", fr: "Identité de marque", ar: "هوية علامة", wholesaleMinor: "900000" },
    { code: "SOCIAL_30", unit: "POST", qty: "30", fr: "30 publications sociales", ar: "30 منشوراً", wholesaleMinor: "750000" },
    { code: "VIDEO_3", unit: "VIDEO", qty: "3", fr: "Pack 3 vidéos", ar: "حزمة 3 فيديوهات", wholesaleMinor: "1100000" },
  ],
  ACC: [
    { code: "CO_CREATE", unit: "DOSSIER", qty: "1", fr: "Création de société", ar: "إنشاء شركة", wholesaleMinor: "1000000" },
    { code: "TAX_YEAR", unit: "ANNEE", qty: "1", fr: "Tenue fiscale annuelle", ar: "مسك ضريبي سنوي", wholesaleMinor: "1600000" },
    { code: "PAYROLL_12", unit: "MOIS", qty: "12", fr: "Paie 12 mois", ar: "أجور 12 شهراً", wholesaleMinor: "2100000" },
  ],
  LEGAL: [
    { code: "STATUTS", unit: "DOSSIER", qty: "1", fr: "Rédaction statuts", ar: "تحرير النظام الأساسي", wholesaleMinor: "800000" },
    { code: "CGV", unit: "PACK", qty: "1", fr: "CGV / contrats types", ar: "شروط عامة وعقود", wholesaleMinor: "650000" },
    { code: "COMPLIANCE", unit: "REVUE", qty: "1", fr: "Revue conformité", ar: "مراجعة امتثال", wholesaleMinor: "950000" },
  ],
  HR: [
    { code: "RECRUIT_3", unit: "POSTE", qty: "3", fr: "Recrutement 3 postes", ar: "توظيف 3 مناصب", wholesaleMinor: "1400000" },
    { code: "TRAIN_20", unit: "HEURE", qty: "20", fr: "Formation 20 h", ar: "تكوين 20 ساعة", wholesaleMinor: "700000" },
    { code: "HR_POLICY", unit: "PACK", qty: "1", fr: "Politiques RH", ar: "سياسات الموارد البشرية", wholesaleMinor: "550000" },
  ],
  INS: [
    { code: "RC_PRO", unit: "POLICE", qty: "1", fr: "RC professionnelle", ar: "مسؤولية مهنية", wholesaleMinor: "600000" },
    { code: "MULTI_RISK", unit: "POLICE", qty: "1", fr: "Multirisque locaux", ar: "تأمين محلات", wholesaleMinor: "850000" },
    { code: "FLOTTE_5", unit: "VEHICULE", qty: "5", fr: "Flotte 5 véhicules", ar: "أسطول 5 مركبات", wholesaleMinor: "1300000" },
  ],
  LOG: [
    { code: "SOURCING", unit: "LOT", qty: "1", fr: "Sourcing fournisseurs", ar: "توريد موردين", wholesaleMinor: "900000" },
    { code: "STOCK_OPT", unit: "AUDIT", qty: "1", fr: "Optimisation stock", ar: "تحسين المخزون", wholesaleMinor: "750000" },
    { code: "SHIP_100", unit: "COLIS", qty: "100", fr: "100 expéditions", ar: "100 شحنة", wholesaleMinor: "1100000" },
  ],
  BTP: [
    { code: "FIT_OUT", unit: "M2", qty: "80", fr: "Aménagement 80 m²", ar: "تهيئة 80 م²", wholesaleMinor: "3200000" },
    { code: "MAINT_12", unit: "MOIS", qty: "12", fr: "Maintenance annuelle", ar: "صيانة سنوية", wholesaleMinor: "1500000" },
    { code: "DIAG_TECH", unit: "DIAG", qty: "1", fr: "Diagnostic technique", ar: "تشخيص تقني", wholesaleMinor: "700000" },
  ],
  QHSE: [
    { code: "ISO_GAP", unit: "AUDIT", qty: "1", fr: "Gap analysis ISO", ar: "تحليل فجوة ISO", wholesaleMinor: "1000000" },
    { code: "HSE_TRAIN", unit: "SESSION", qty: "1", fr: "Session HSE", ar: "دورة سلامة", wholesaleMinor: "450000" },
    { code: "CERT_PREP", unit: "DOSSIER", qty: "1", fr: "Préparation certification", ar: "تحضير شهادة", wholesaleMinor: "1200000" },
  ],
  SALES: [
    { code: "CRM_SETUP", unit: "SETUP", qty: "1", fr: "Mise en place CRM", ar: "إعداد CRM", wholesaleMinor: "950000" },
    { code: "FUNNEL_90", unit: "JOUR", qty: "90", fr: "Tunnel vente 90 j", ar: "قمع مبيعات 90 يوماً", wholesaleMinor: "1400000" },
    { code: "CX_AUDIT", unit: "AUDIT", qty: "1", fr: "Audit expérience client", ar: "تدقيق تجربة الزبون", wholesaleMinor: "800000" },
  ],
};

function demoUuid(seed: string): string {
  const hex = createHash("sha256").update(`DEMO_BOX_NETWORK_V2:${seed}`).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function digits(seed: string, length: number): string {
  const hex = createHash("sha256").update(seed).digest("hex");
  let out = "";
  for (let i = 0; out.length < length; i += 1) {
    out += Number.parseInt(hex.slice((i * 2) % 60, ((i * 2) % 60) + 2), 16) % 10;
  }
  return out.slice(0, length);
}

function priceVariant(baseMinor: string, providerIndex: number): string {
  const base = BigInt(baseMinor);
  const delta = base / BigInt(20);
  const adjusted = providerIndex === 0 ? base : providerIndex === 1 ? base + delta : base - delta;
  return adjusted.toString();
}

function doc(input: {
  code: string;
  kind: string;
  labelFr: string;
  labelAr: string;
  reference: string;
  issuedOn: string;
  expiresOn?: string | null;
  status?: DemoValidationDocument["status"];
}): DemoValidationDocument {
  return {
    code: input.code,
    kind: input.kind,
    label_fr: input.labelFr,
    label_ar: input.labelAr,
    status: input.status ?? "VERIFIED",
    reference: input.reference,
    issued_on: input.issuedOn,
    expires_on: input.expiresOn ?? null,
  };
}

function franchiseDocuments(seed: string, ice: string, taxId: string, rc: string): DemoValidationDocument[] {
  return [
    doc({ code: "ICE", kind: "LEGAL", labelFr: "Attestation ICE", labelAr: "شهادة ICE", reference: ice, issuedOn: "2025-01-10" }),
    doc({ code: "IF", kind: "FISCAL", labelFr: "Identifiant fiscal", labelAr: "المعرف الضريبي", reference: taxId, issuedOn: "2025-01-10" }),
    doc({ code: "RC", kind: "LEGAL", labelFr: "Extrait RC", labelAr: "مستخرج السجل التجاري", reference: rc, issuedOn: "2025-01-12" }),
    doc({ code: "CIN_GERANT", kind: "IDENTITY", labelFr: "CIN du gérant", labelAr: "بطاقة تعريف المسير", reference: `CIN-${digits(seed + ":cin", 8)}`, issuedOn: "2024-06-01", expiresOn: "2034-06-01" }),
    doc({ code: "STATUTS", kind: "LEGAL", labelFr: "Statuts société", labelAr: "النظام الأساسي", reference: `STAT-${digits(seed + ":stat", 6)}`, issuedOn: "2024-11-20" }),
    doc({ code: "DOMICILE", kind: "LEGAL", labelFr: "Justificatif siège", labelAr: "إثبات المقر", reference: `DOM-${digits(seed + ":dom", 6)}`, issuedOn: "2025-02-01" }),
    doc({ code: "RIB", kind: "BANK", labelFr: "RIB bancaire", labelAr: "RIB بنكي", reference: `007${digits(seed + ":rib", 21)}`, issuedOn: "2025-01-15" }),
    doc({ code: "FRANCHISE_CONTRACT", kind: "CONTRACT", labelFr: "Contrat de franchise signé", labelAr: "عقد الامتياز الموقع", reference: `FRC-${digits(seed + ":frc", 8)}`, issuedOn: "2025-03-01", expiresOn: "2028-03-01" }),
    doc({ code: "ENTRY_FEE_PROOF", kind: "FINANCE", labelFr: "Preuve droit d’entrée / dispense IT", labelAr: "إثبات حق الدخول / إعفاء IT", reference: `ENT-${digits(seed + ":ent", 6)}`, issuedOn: "2025-03-01" }),
  ];
}

function providerDocuments(seed: string, ice: string, taxId: string, rc: string, sectorCode: string): DemoValidationDocument[] {
  return [
    doc({ code: "ICE", kind: "LEGAL", labelFr: "Attestation ICE", labelAr: "شهادة ICE", reference: ice, issuedOn: "2025-01-08" }),
    doc({ code: "IF", kind: "FISCAL", labelFr: "Identifiant fiscal", labelAr: "المعرف الضريبي", reference: taxId, issuedOn: "2025-01-08" }),
    doc({ code: "RC", kind: "LEGAL", labelFr: "Extrait RC", labelAr: "مستخرج السجل التجاري", reference: rc, issuedOn: "2025-01-09" }),
    doc({ code: "CIN_GERANT", kind: "IDENTITY", labelFr: "CIN du gérant", labelAr: "بطاقة تعريف المسير", reference: `CIN-${digits(seed + ":cin", 8)}`, issuedOn: "2023-09-15", expiresOn: "2033-09-15" }),
    doc({ code: "RC_PRO", kind: "INSURANCE", labelFr: "Assurance RC professionnelle", labelAr: "تأمين المسؤولية المهنية", reference: `RCP-${digits(seed + ":rcp", 7)}`, issuedOn: "2025-01-01", expiresOn: "2026-01-01" }),
    doc({ code: "CNSS", kind: "SOCIAL", labelFr: "Attestation CNSS", labelAr: "شهادة CNSS", reference: `CNSS-${digits(seed + ":cnss", 8)}`, issuedOn: "2025-02-10" }),
    doc({ code: "RIB", kind: "BANK", labelFr: "RIB bancaire", labelAr: "RIB بنكي", reference: `007${digits(seed + ":rib", 21)}`, issuedOn: "2025-01-20" }),
    doc({
      code: "SECTOR_CERT",
      kind: "CERTIFICATION",
      labelFr: `Certification métier ${sectorCode}`,
      labelAr: `شهادة مهنية ${sectorCode}`,
      reference: `CERT-${sectorCode}-${digits(seed + ":cert", 6)}`,
      issuedOn: "2024-10-01",
      expiresOn: "2027-10-01",
    }),
    doc({ code: "QUALIFICATION_DOSSIER", kind: "QUALIFICATION", labelFr: "Dossier qualification Matricia", labelAr: "ملف تأهيل ماتريسيا", reference: `QUAL-${digits(seed + ":qual", 8)}`, issuedOn: "2025-03-15" }),
  ];
}

function buildActor(input: {
  role: "FRANCHISEE" | "PROVIDER";
  territoryCode: string;
  territoryCity: string;
  territoryNameFr: string;
  sector: (typeof DEMO_BOX_SECTORS)[number];
  label: string;
  index: number;
}): DemoActorProfile {
  const seed = `${input.role}:${input.territoryCode}:${input.sector.code}:${input.label}`;
  const organizationId = demoUuid(`org:${seed}`);
  const ice = digits(`ice:${seed}`, 15);
  const taxId = digits(`if:${seed}`, 8);
  const rc = `RC-${digits(`rc:${seed}`, 7)}`;
  const legalName = input.role === "FRANCHISEE"
    ? `${input.territoryCity} ${input.sector.nameFr} Franchise SARL`
    : `${input.territoryCity} ${input.sector.nameFr} ${input.label} SARL`;
  const displayName = input.role === "FRANCHISEE"
    ? `${input.territoryCity} ${input.sector.nameFr} Franchise`
    : `${input.territoryCity} ${input.sector.nameFr} ${input.label}`;
  return {
    organization_id: organizationId,
    role: input.role,
    display_name: displayName,
    legal_name: legalName,
    territory_code: input.territoryCode,
    sector_code: input.sector.code,
    sector_name_fr: input.sector.nameFr,
    sector_name_ar: input.sector.nameAr,
    city: input.territoryCity,
    address_fr: `${12 + input.index} Boulevard Démo, ${input.territoryCity}`,
    address_ar: `${12 + input.index} شارع تجريبي، ${input.territoryCity}`,
    email: `${input.role.toLowerCase()}.${input.sector.code.toLowerCase()}.${input.label.toLowerCase()}@demo.matricia.local`,
    phone: `+2126${digits(`tel:${seed}`, 8)}`,
    manager_name: input.role === "FRANCHISEE"
      ? `Karim Benjelloun · ${input.territoryCity}`
      : `Youssef Amrani · ${input.label}`,
    manager_cin: `A${digits(`cin:${seed}`, 7)}`,
    ice,
    tax_id: taxId,
    trade_register: rc,
    rib: `007${digits(`rib:${seed}`, 21)}`,
    cnss: digits(`cnss:${seed}`, 9),
    validation_status: "ACTIVE",
    documents: input.role === "FRANCHISEE"
      ? franchiseDocuments(seed, ice, taxId, rc)
      : providerDocuments(seed, ice, taxId, rc, input.sector.code),
  };
}

export type DemoNetworkSummary = {
  territories: number;
  sectors: number;
  franchisesPerTerritory: number;
  providersPerFranchise: number;
  servicesPerProvider: number;
  documentsPerFranchisee: number;
  documentsPerProvider: number;
  totalOffers: number;
};

export function demoNetworkSummary(): DemoNetworkSummary {
  return {
    territories: DEMO_BOX_TERRITORIES.length,
    sectors: DEMO_BOX_SECTORS.length,
    franchisesPerTerritory: DEMO_BOX_SECTORS.length,
    providersPerFranchise: PROVIDERS.length,
    servicesPerProvider: 3,
    documentsPerFranchisee: 9,
    documentsPerProvider: 9,
    totalOffers: DEMO_BOX_TERRITORIES.length * DEMO_BOX_SECTORS.length * PROVIDERS.length * 3,
  };
}

/** Tous les acteurs démo (12 régions) pour les espaces admin Franchisés / Prestataires / Capacité. */
export function listAllDemoActors(): DemoActorProfile[] {
  const actors: DemoActorProfile[] = [];
  for (const territory of DEMO_BOX_TERRITORIES) {
    for (const sector of DEMO_BOX_SECTORS) {
      actors.push(buildActor({
        role: "FRANCHISEE",
        territoryCode: territory.code,
        territoryCity: territory.city,
        territoryNameFr: territory.nameFr,
        sector,
        label: "F",
        index: 1,
      }));
      for (let p = 0; p < PROVIDERS.length; p += 1) {
        actors.push(buildActor({
          role: "PROVIDER",
          territoryCode: territory.code,
          territoryCity: territory.city,
          territoryNameFr: territory.nameFr,
          sector,
          label: PROVIDERS[p],
          index: p + 2,
        }));
      }
    }
  }
  return actors;
}

/** Catalogue démo : 12 régions × 10 secteurs × 1 franchisé × 3 ST × 3 services + dossiers complets. */
export function buildDemoWholesaleCatalog(input: {
  territoryCode: string;
  subject?: string | null;
  generatedAt?: string;
  marginBps?: number;
}): WholesaleCatalog {
  const territory = input.territoryCode.trim().toUpperCase();
  const subject = input.subject?.trim().toLowerCase() || null;
  const marginBps = input.marginBps ?? DEFAULT_BOX_PLATFORM_MARGIN_BPS;
  const offers: WholesaleOffer[] = [];
  const actors: DemoActorProfile[] = [];
  const territoryMeta = DEMO_BOX_TERRITORIES.find((item) => item.code === territory);

  if (territoryMeta) {
    for (const sector of DEMO_BOX_SECTORS) {
      const franchise = buildActor({
        role: "FRANCHISEE",
        territoryCode: territory,
        territoryCity: territoryMeta.city,
        territoryNameFr: territoryMeta.nameFr,
        sector,
        label: "F",
        index: 1,
      });
      actors.push(franchise);
      const templates = SERVICE_TEMPLATES[sector.code];
      for (let p = 0; p < PROVIDERS.length; p += 1) {
        const providerLabel = PROVIDERS[p];
        const provider = buildActor({
          role: "PROVIDER",
          territoryCode: territory,
          territoryCity: territoryMeta.city,
          territoryNameFr: territoryMeta.nameFr,
          sector,
          label: providerLabel,
          index: p + 2,
        });
        actors.push(provider);
        for (const service of templates) {
          const wholesale = priceVariant(service.wholesaleMinor, p);
          const proposed = applyMarginBps(BigInt(wholesale), marginBps).toString();
          const offer: WholesaleOffer = {
            commitment_id: demoUuid(`commit:${territory}:${sector.code}:${providerLabel}:${service.code}`),
            provider_organization_id: provider.organization_id,
            provider_name: provider.display_name,
            franchise_organization_id: franchise.organization_id,
            franchise_name: franchise.display_name,
            agreement_id: demoUuid(`agr:${territory}:${sector.code}:${providerLabel}`),
            agreement_code: `DEMO_${territory}_${sector.code}_${providerLabel}`,
            sku_id: demoUuid(`sku:${sector.code}:${service.code}`),
            sku_code: `${sector.code}_${service.code}`,
            unit_code: service.unit,
            pack_quantity: service.qty,
            sku_currency: "MAD",
            reference_cost_minor: (BigInt(wholesale) + BigInt(wholesale) / BigInt(10)).toString(),
            wholesale_unit_price_minor: wholesale,
            currency: "MAD",
            capacity_units: "100",
            remaining_units: "100",
            region_codes: [territory],
            library_code: sector.code,
            category_code: sector.code,
            category_name_fr: sector.nameFr,
            category_name_ar: sector.nameAr,
            service_name_fr: `${service.fr} (${franchise.display_name})`,
            service_name_ar: `${service.ar} (${sector.nameAr} · ${territoryMeta.nameAr})`,
            proposed_pack_price_minor: proposed,
          };
          if (
            !subject
            || offer.service_name_fr.toLowerCase().includes(subject)
            || offer.service_name_ar.toLowerCase().includes(subject)
            || offer.category_name_fr.toLowerCase().includes(subject)
            || offer.category_code.toLowerCase().includes(subject)
            || offer.sku_code.toLowerCase().includes(subject)
            || offer.provider_name.toLowerCase().includes(subject)
            || franchise.display_name.toLowerCase().includes(subject)
          ) {
            offers.push(offer);
          }
        }
      }
    }
  }

  return {
    generated_at: input.generatedAt ?? new Date().toISOString(),
    territory_code: territory || "ZZ_EMPTY",
    subject,
    margin_bps: marginBps,
    margin_source: "DEFAULT",
    territories: DEMO_BOX_TERRITORIES.map((item) => ({
      code: item.code,
      name_fr: item.nameFr,
      name_ar: item.nameAr,
    })),
    offers,
    actors,
  };
}
