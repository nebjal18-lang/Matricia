import Link from "next/link";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import { formatMinorExact, type SolutionBundle } from "@/modules/shared/lib/solution-insights/model";

export function SolutionBundlesPanel({locale,bundles}:{locale:Locale;bundles:SolutionBundle[]}) {
  if (bundles.length === 0) return null;
  const fr = locale === "fr";
  return <section aria-labelledby="solution-bundles-title" className="grid gap-4">
    <h2 id="solution-bundles-title">{fr ? "Solutions pour vos projets transversaux" : "حلول لمشاريعكم المشتركة بين المجالات"}</h2>
    <p>{fr ? "Ces propositions réunissent plusieurs domaines. Vous pouvez préparer votre besoin avant de confirmer une demande." : "تجمع هذه المقترحات عدة مجالات. يمكنكم إعداد احتياجكم قبل تأكيد الطلب."}</p>
    {bundles.map(bundle => {
      const title = fr ? bundle.titleFr : bundle.titleAr;
      const description = fr ? bundle.descriptionFr : bundle.descriptionAr;
      const query = new URLSearchParams({organizationId:bundle.organizationId,q:`${title}\n${description}`.slice(0,500)});
      return <article key={bundle.id} className="diag-conn-sol-card">
        <h3>{title}</h3>
        <p>{description}</p>
        <p>{fr ? "Version de la proposition" : "إصدار المقترح"} {bundle.version}</p>
        <p>{fr ? `${bundle.libraryCodes.length} domaines · ${bundle.items.length} prestations regroupées` : `${bundle.libraryCodes.length} مجالات · ${bundle.items.length} خدمات مجمعة`}</p>
        <p>{fr ? "Estimation de l’ensemble" : "التقدير الإجمالي"} : <strong>{formatMinorExact(bundle.totalAmountMinor,bundle.currency,locale)}</strong></p>
        <Link className="diag-conn-btn-grad justify-self-start" href={`/${locale}/besoin?${query}`}>{fr ? "Préparer mon besoin avec cette proposition" : "إعداد احتياجي انطلاقاً من هذا المقترح"}</Link>
      </article>;
    })}
  </section>;
}
