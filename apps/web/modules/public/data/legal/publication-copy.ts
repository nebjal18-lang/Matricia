import type { Locale } from "@/modules/shared/lib/i18n/locale";
import type { legalPublicationFields } from "./publication";

type PublicationField = (typeof legalPublicationFields)[number];

const labels: Record<Locale, Record<PublicationField, string>> = {
  fr: {
    LEGAL_ENTITY_NAME: "Raison sociale de l’éditeur",
    LEGAL_ENTITY_FORM: "Forme juridique de l’éditeur",
    LEGAL_ENTITY_ADDRESS: "Adresse du siège de l’éditeur",
    LEGAL_REGISTRATION_ID: "Référence d’immatriculation de l’éditeur",
    LEGAL_PUBLICATION_DIRECTOR: "Responsable de publication",
    LEGAL_HOST_NAME: "Nom de l’hébergeur",
    LEGAL_HOST_ADDRESS: "Adresse de l’hébergeur",
    LEGAL_PRIVACY_EMAIL: "Adresse de contact pour les données personnelles",
    LEGAL_RETENTION_FR: "Durées de conservation validées en français",
    LEGAL_RETENTION_AR: "Durées de conservation validées en arabe",
    LEGAL_TERMS_APPROVAL_REFERENCE: "Validation des conditions et de la politique de confidentialité",
  },
  ar: {
    LEGAL_ENTITY_NAME: "الاسم القانوني للناشر",
    LEGAL_ENTITY_FORM: "الشكل القانوني للناشر",
    LEGAL_ENTITY_ADDRESS: "عنوان المقر القانوني للناشر",
    LEGAL_REGISTRATION_ID: "مرجع تسجيل الناشر",
    LEGAL_PUBLICATION_DIRECTOR: "مسؤول النشر",
    LEGAL_HOST_NAME: "اسم جهة الاستضافة",
    LEGAL_HOST_ADDRESS: "عنوان جهة الاستضافة",
    LEGAL_PRIVACY_EMAIL: "عنوان التواصل بشأن البيانات الشخصية",
    LEGAL_RETENTION_FR: "مدد الاحتفاظ المعتمدة باللغة الفرنسية",
    LEGAL_RETENTION_AR: "مدد الاحتفاظ المعتمدة باللغة العربية",
    LEGAL_TERMS_APPROVAL_REFERENCE: "اعتماد شروط الاستخدام وسياسة الخصوصية",
  },
};

export function legalPublicationLabel(locale: Locale, field: PublicationField) {
  return labels[locale][field];
}
