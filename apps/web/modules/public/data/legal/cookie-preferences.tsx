import Link from "next/link";
import type { Locale } from "@/modules/shared/lib/i18n/locale";

/** No optional tracking is installed: communication choices belong to the account. */
export function CookiePreferences({ locale }: { locale: Locale }) {
  return <section className="mt-8 rounded-2xl border border-[var(--mat-border)] bg-white p-6">
    <h2>{locale === "fr" ? "Cookies nécessaires" : "ملفات ضرورية"}</h2>
    <p className="mt-4">{locale === "fr" ? "La langue, la session et les protections de sécurité sont nécessaires au fonctionnement du site. Aucun cookie publicitaire ni outil de mesure d’audience optionnel n’est activé." : "تُستخدم ملفات اللغة والجلسة والأمان الضرورية لتشغيل الموقع. لا يتم تفعيل ملفات إعلانية أو أدوات قياس جمهور اختيارية."}</p>
    <p className="mt-4">{locale === "fr" ? "Vos choix de courriels et notifications se gèrent dans votre compte. Cette page ne modifie pas vos autorisations de communication." : "تُدار خيارات البريد والإشعارات من حسابكم. لا تغيّر هذه الصفحة أذونات التواصل."}</p>
    <Link href={`/${locale}/notifications`} className="journey-primary mt-6 inline-flex">{locale === "fr" ? "Gérer mes notifications" : "إدارة إشعاراتي"}</Link>
  </section>;
}
