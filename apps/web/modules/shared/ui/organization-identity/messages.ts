import type { Locale } from "@/modules/shared/lib/i18n/locale";

const fr = {
  identity: "Identité de l’organisation",
  identifiers: "Identifiants canoniques",
  representative: "Représentant autorisé",
  legalName: "Raison sociale",
  displayName: "Nom commercial",
  country: "Pays",
  legalForm: "Forme juridique",
  incorporationDate: "Date de création",
  activity: "Activité",
  sector: "Secteur",
  city: "Ville du RC",
  address: "Adresse enregistrée",
  postalCode: "Code postal",
  firstName: "Prénom",
  lastName: "Nom",
  titleRole: "Fonction",
  email: "Courriel",
  phone: "Téléphone",
  power: "Pouvoir / mandat",
  empty: "—",
  identifierLabels: { ICE: "ICE", IF: "IF", RC: "RC" },
} as const;

const ar = {
  identity: "هوية المؤسسة",
  identifiers: "المعرّفات القانونية",
  representative: "الممثل المخول",
  legalName: "الاسم القانوني",
  displayName: "الاسم التجاري",
  country: "البلد",
  legalForm: "الشكل القانوني",
  incorporationDate: "تاريخ التأسيس",
  activity: "النشاط",
  sector: "القطاع",
  city: "مدينة السجل",
  address: "العنوان المسجل",
  postalCode: "الرمز البريدي",
  firstName: "الاسم الشخصي",
  lastName: "اسم العائلة",
  titleRole: "الصفة",
  email: "البريد",
  phone: "الهاتف",
  power: "التفويض / الوكالة",
  empty: "—",
  identifierLabels: { ICE: "ICE", IF: "IF", RC: "RC" },
} as const;

export type OrganizationIdentityMessages = {
  readonly [K in keyof typeof fr]: (typeof fr)[K] extends string ? string : { readonly [P in keyof (typeof fr)[K]]: string };
};

export function getOrganizationIdentityMessages(locale: Locale): OrganizationIdentityMessages {
  return locale === "ar" ? ar : fr;
}
