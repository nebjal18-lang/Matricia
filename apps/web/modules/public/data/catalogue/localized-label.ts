import type { Locale } from "@/modules/shared/lib/i18n/locale";

/** The bundled service/category sources contain French labels only; an Arabic
 * label may be supplied only when it comes from approved catalogue content. */
export function publicCatalogueLabel(nameFr: string, locale: Locale, approvedNameAr?: string | null): string {
  if (locale === "fr") return nameFr;
  if (approvedNameAr?.trim()) return approvedNameAr.trim();
  return `الاسم العربي غير متاح — بالفرنسية: ${nameFr}`;
}

export const publicCatalogueTranslationNotice = {
  fr: "",
  ar: "لا تتوفر بعد أسماء عربية معتمدة لبعض الخدمات والفئات. تُعرض أسماؤها المرجعية بالفرنسية مع تنبيه صريح؛ يمكنكم وصف احتياجكم بالعربية أو البحث بالفرنسية أو بمصطلحات المجالات العربية.",
} as const;
