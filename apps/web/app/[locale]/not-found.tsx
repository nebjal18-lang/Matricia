import Link from "next/link";
import { Clock3, LockKeyhole, Search } from "lucide-react";
import { PublicFooter } from "@/modules/public/ui/site/public-footer";
import { PublicNavigation } from "@/modules/public/ui/site/public-navigation";
import { PublicPathArt } from "@/modules/public/ui/site/public-art";
import { isLocale, type Locale } from "@/modules/shared/lib/i18n/locale";
import "./not-found.css";

export default function LocaleNotFound() {
  return <NotFoundScreen locale="fr" />;
}

export function NotFoundScreen({ locale }: { locale: Locale }) {
  const safe = isLocale(locale) ? locale : "fr";
  const fr = safe === "fr";
  return (
    <div dir={fr ? "ltr" : "rtl"} className="public-root not-found-root flex min-h-dvh flex-col text-[var(--mat-navy)]">
      <PublicNavigation locale={safe} />
      <main id="contenu-principal" className="public-page flex-1 pb-16">
        <section className="public-wrap public-error-hero">
          <div>
            <p className="journey-eyebrow">{fr ? "Toujours plus loin, ensemble" : "دائماً أبعد، معاً"}</p>
            <h1>{fr ? "Cette page n’est pas disponible" : "هذه الصفحة غير متاحة"}</h1>
            <p className="public-lead mt-4">{fr ? "L’adresse que vous avez demandée peut avoir changé, ne plus être disponible ou nécessiter une connexion à votre compte." : "قد يكون العنوان الذي طلبتموه قد تغيّر أو لم يعد متاحاً أو يتطلب تسجيلاً في حسابكم."}</p>
            <div className="journey-actions">
              <Link className="journey-primary is-coral" href={`/${safe}`}>{fr ? "Retour à l’accueil" : "العودة إلى الرئيسية"}</Link>
              <Link className="journey-secondary" href={`/${safe}/diagnostic`}>{fr ? "Reprendre mon parcours" : "استئناف مساري"}</Link>
              <Link className="journey-known" href={`/${safe}/contact`}>{fr ? "Nous contacter" : "اتصلوا بنا"}</Link>
            </div>
            <p className="public-muted mt-5">{fr ? "Une question ? Notre équipe est là pour vous accompagner." : "سؤال؟ فريقنا حاضر لمرافقتكم."}</p>
          </div>
          <PublicPathArt
            caption={fr ? "Le bon chemin vous ramène toujours plus loin" : "الطريق الصحيح يعيدكم دائماً أبعد"}
            signs={fr ? ["OPPORTUNITÉS", "PARTENARIATS", "RÉUSSITE"] : ["فرص", "شراكات", "نجاح"]}
          />
        </section>
        <section className="public-wrap public-error-cases">
          <div>
            <h2 className="public-h2" style={{ fontSize: "1.5rem" }}>{fr ? "Exemples illustratifs" : "أمثلة توضيحية"}</h2>
            <p className="public-muted mt-2">{fr ? "Voici quelques situations courantes et la meilleure action à entreprendre." : "إليكم بعض الحالات الشائعة وأفضل إجراء يمكن اتخاذه."}</p>
          </div>
          <article className="public-card">
            <Search aria-hidden="true" className="text-[var(--mat-violet)]" />
            <h2>{fr ? "Page introuvable" : "صفحة غير موجودة"}</h2>
            <p className="public-muted mt-2">{fr ? "Le lien est peut-être obsolète ou la page a été déplacée." : "ربما أصبح الرابط قديماً أو نُقلت الصفحة."}</p>
            <Link className="journey-secondary mt-4" href={`/${safe}`}>{fr ? "Retour" : "رجوع"}</Link>
          </article>
          <article className="public-card">
            <LockKeyhole aria-hidden="true" className="text-[var(--mat-violet)]" />
            <h2>{fr ? "Accès non autorisé" : "وصول غير مصرّح"}</h2>
            <p className="public-muted mt-2">{fr ? "Cette page est réservée aux utilisateurs connectés." : "هذه الصفحة مخصصة للمستخدمين المسجّلين."}</p>
            <Link className="journey-primary mt-4" href={`/${safe}/connexion`}>{fr ? "Se connecter" : "تسجيل الدخول"}</Link>
          </article>
          <article className="public-card">
            <Clock3 aria-hidden="true" className="text-[var(--mat-violet)]" />
            <h2>{fr ? "Service temporairement indisponible" : "خدمة غير متاحة مؤقتاً"}</h2>
            <p className="public-muted mt-2">{fr ? "Le service est momentanément indisponible. Veuillez réessayer dans quelques instants." : "الخدمة غير متاحة حالياً. أعيدوا المحاولة بعد لحظات."}</p>
            <Link className="journey-secondary mt-4" href={`/${safe}`}>{fr ? "Réessayer" : "إعادة المحاولة"}</Link>
          </article>
        </section>
        <section className="public-wrap public-error-help">
          <div>
            <h2>{fr ? "Besoin d’aide ?" : "هل تحتاجون مساعدة؟"}</h2>
            <p className="public-muted">{fr ? "Notre équipe peut vous répondre rapidement, du lundi au vendredi." : "يمكن لفريقنا الرد بسرعة من الاثنين إلى الجمعة."}</p>
          </div>
          <Link className="journey-known" href={`/${safe}/contact`}>{fr ? "Nous contacter" : "اتصلوا بنا"}</Link>
        </section>
      </main>
      <PublicFooter locale={safe} />
    </div>
  );
}
