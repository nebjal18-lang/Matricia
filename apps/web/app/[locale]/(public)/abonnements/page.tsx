import type { Metadata } from "next";
import Link from "next/link";
import { notFound, unstable_rethrow } from "next/navigation";
import { isLocale } from "@/modules/shared/lib/i18n/locale";
import { localizedRouteMetadata } from "@/modules/shared/lib/seo/metadata";
import { formatMinor } from "@/modules/shared/lib/subscriptions/model";
import { loadPublicSubscriptionPlans, type PublicSubscriptionPlan } from "@/modules/public/data/subscriptions/repository";
import { PublicPhoto } from "@/modules/public/ui/site/public-photo";

const copy = {
  fr: {
    eyebrow: "Abonnements",
    title: "Abonnements Matricia",
    headline: "Des formules adaptées à vos besoins professionnels",
    description: "Accédez aux outils Matricia pour simplifier vos projets, collaborer avec des professionnels qualifiés et garder le contrôle à chaque étape.",
    monthly: "par mois",
    annual: "par an",
    credits: "crédits commerciaux mensuels inclus",
    unavailable: "Les offres publiées n’ont pas pu être chargées. Cette indisponibilité ne confirme ni un tarif ni une vente sur devis. Réessayez ou demandez les conditions écrites à notre équipe.",
    unavailableTitle: "Offres momentanément indisponibles",
    emptyTitle: "Aucune formule publiée pour le moment",
    empty: "Aucun prix ou quota n’est actuellement présenté comme une offre disponible. Demandez une proposition écrite précisant le prix, les fonctionnalités et les limites avant de vous engager.",
    retry: "Réessayer le chargement",
    compare: "Comparer les offres publiées",
    element: "Conditions de l’offre",
    limits: "Fonctionnalités, limites et avantages",
    limitsUnpublished: "Détail à confirmer dans l’offre écrite avant souscription",
    offerDetails: "Ce que votre offre doit préciser",
    details: [
      ["Fonctionnalités et limites", "L’abonnement concerne l’accès aux outils Matricia : diagnostic, demandes, comparaison, suivi et documents. L’offre écrite doit préciser les fonctions accessibles, les utilisateurs et sites autorisés, les quotas et le niveau de support. Aucun accès illimité n’est promis ici."],
      ["Essai Client", "L’essai dure 30 jours après vérification et activation de l’organisation, sans carte ni moyen de paiement obligatoire. Il ne devient pas automatiquement un abonnement. Après l’essai, un plan Premium, Gold ou Platinum actif est nécessaire aux nouvelles actions soumises au plan ; vos données et obligations existantes restent accessibles."],
      ["Box et crédits", "La quantité mensuelle publiée est propre à chaque formule. La composition de la Box, ses conditions d’utilisation, la date d’attribution, la validité et les éventuelles restrictions des crédits doivent être précisées avant paiement. Les crédits ne sont ni des euros ni des dirhams et ne paient pas automatiquement les honoraires d’un professionnel."],
      ["Coût des prestations", "Les prestations des professionnels font l’objet de devis distincts que vous examinez et acceptez. Un abonnement ou une demande de contact ne vaut ni commande de prestation ni paiement. Tout achat de crédits supplémentaires doit présenter son propre prix et ses conditions avant confirmation."],
    ],
    tariff: "Tarif communiqué avant souscription",
    action: "Sur demande",
    manage: "Déjà client ? Gérer mon abonnement",
    contact: "Nous contacter",
    discover: "Découvrir le parcours",
    note: "Seuls les prix et quantités de crédits issus des offres publiées sont affichés. Les limites et avantages non publiés restent à confirmer par écrit avant souscription ; aucun tarif indicatif ou quota illimité n’est ajouté.",
    ctaTitle: "Prêt à simplifier vos projets ?",
    ctaText: "Découvrez la formule qui vous convient et échangez avec notre équipe pour en savoir plus.",
    funds: "L’abonnement finance l’accès aux outils Matricia : diagnostic, demandes, comparaison, suivi et documents. Il ne finance pas les honoraires du professionnel, qui fixe ses propres prix.",
    pillars: [["Des outils concrets pour passer à l’action"], ["Une expérience sécurisée et confidentielle"], ["Un accompagnement à chaque étape"]],
  },
  ar: {
    eyebrow: "الاشتراكات",
    title: "اشتراكات ماتريسيا",
    headline: "صيغ مناسبة لاحتياجاتكم المهنية",
    description: "ادخلوا إلى أدوات ماتريسيا لتبسيط مشاريعكم والتعاون مع مهنيين مؤهلين والاحتفاظ بالتحكم في كل مرحلة.",
    monthly: "شهرياً",
    annual: "سنوياً",
    credits: "أرصدة تجارية شهرية مشمولة",
    unavailable: "تعذر تحميل العروض المنشورة. لا يؤكد هذا العطل أي سعر أو اعتماد البيع بعرض سعر. أعيدوا المحاولة أو اطلبوا الشروط المكتوبة من فريقنا.",
    unavailableTitle: "العروض غير متاحة مؤقتاً",
    emptyTitle: "لا توجد صيغة منشورة حالياً",
    empty: "لا يُقدَّم حالياً أي سعر أو حصة على أنه عرض متاح. اطلبوا اقتراحاً مكتوباً يحدد السعر والوظائف والحدود قبل الالتزام.",
    retry: "إعادة محاولة تحميل العروض",
    compare: "مقارنة العروض المنشورة",
    element: "شروط العرض",
    limits: "الوظائف والحدود والمنافع",
    limitsUnpublished: "تُؤكد التفاصيل في العرض المكتوب قبل الاشتراك",
    offerDetails: "ما يجب أن يوضحه عرضكم",
    details: [
      ["الوظائف والحدود", "يتعلق الاشتراك بالوصول إلى أدوات ماتريسيا: التشخيص والطلبات والمقارنة والمتابعة والوثائق. يجب أن يحدد العرض المكتوب الوظائف المتاحة وعدد المستخدمين والمواقع والحصص ومستوى الدعم. لا نعد هنا بوصول غير محدود."],
      ["تجربة العميل", "تدوم التجربة 30 يوماً بعد التحقق من المؤسسة وتفعيلها، دون إلزام ببطاقة أو وسيلة دفع. ولا تتحول تلقائياً إلى اشتراك. بعد التجربة، تلزم خطة بريميوم أو غولد أو بلاتينيوم نشطة للإجراءات الجديدة المرتبطة بالخطة، مع بقاء البيانات والالتزامات القائمة متاحة."],
      ["Box والأرصدة", "تخص كمية الأرصدة الشهرية المنشورة كل صيغة على حدة. يجب تحديد محتوى Box وشروط استخدامها وتاريخ منح الأرصدة وصلاحيتها وأي قيود عليها قبل الدفع. الأرصدة ليست يورو أو دراهم ولا تسدد أتعاب المهني تلقائياً."],
      ["تكلفة الخدمات", "تخضع خدمات المهنيين لعروض أسعار منفصلة تراجعونها وتوافقون عليها. لا يُعد الاشتراك أو طلب التواصل طلباً لخدمة أو دفعاً لها. ويجب عرض سعر أي شراء إضافي للأرصدة وشروطه قبل التأكيد."],
    ],
    tariff: "يُبلَّغ السعر قبل الاشتراك",
    action: "عند الطلب",
    manage: "لديكم حساب؟ إدارة الاشتراك",
    contact: "اتصلوا بنا",
    discover: "اكتشاف المسار",
    note: "لا نعرض إلا الأسعار وكميات الأرصدة الواردة في العروض المنشورة. وتبقى الحدود والمنافع غير المنشورة بحاجة إلى تأكيد مكتوب قبل الاشتراك؛ لا نضيف سعراً تقديرياً أو حصة غير محدودة.",
    ctaTitle: "جاهزون لتبسيط مشاريعكم؟",
    ctaText: "اكتشفوا الصيغة المناسبة وتبادلوا مع فريقنا لمعرفة المزيد.",
    funds: "يموّل الاشتراك الوصول إلى أدوات ماتريسيا: التشخيص والطلبات والمقارنة والمتابعة والوثائق. ولا يموّل أتعاب المهني، الذي يحدد أسعاره بنفسه.",
    pillars: [["أدوات ملموسة للانتقال إلى التنفيذ"], ["تجربة مؤمنة وسرية"], ["مرافقة في كل مرحلة"]],
  },
} as const;

const planNames = {
  PREMIUM: { fr: "Premium", ar: "بريميوم" },
  GOLD: { fr: "Gold", ar: "غولد" },
  PLATINUM: { fr: "Platinum", ar: "بلاتينيوم" },
} as const;

function creditCount(value: string, locale: "fr" | "ar") {
  return new Intl.NumberFormat(locale === "ar" ? "ar-MA" : "fr-MA", { maximumFractionDigits: 0 }).format(BigInt(value));
}

function publishedPrice(plan: PublicSubscriptionPlan) {
  return BigInt(plan.monthlyPriceMinor) > BigInt(0) ? plan.monthlyPriceMinor : null;
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return localizedRouteMetadata(locale, "/abonnements", copy[locale].title, copy[locale].description);
}

export default async function PublicSubscriptionsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const messages = copy[locale];
  let result: Awaited<ReturnType<typeof loadPublicSubscriptionPlans>>;
  try {
    result = await loadPublicSubscriptionPlans();
  } catch (error) {
    unstable_rethrow(error);
    result = { status: "unavailable" };
  }
  const plans = result.status === "success" ? result.plans : [];

  return (
    <main id="contenu-principal" className="public-page pb-16">
      <section className="public-hero-split">
        <div>
          <p className="journey-eyebrow">{messages.eyebrow}</p>
          <h1>{messages.headline}</h1>
          <p className="public-lead mt-4">{messages.description}</p>
          <ul className="journey-trust">
            {messages.pillars.map(([item]) => <li key={item}>{item}</li>)}
          </ul>
        </div>
        <PublicPhoto scene="lantern" caption={locale === "ar" ? "مشاريع اليوم لمغرب الغد" : "Des projets d’aujourd’hui pour un Maroc de demain"} />
      </section>
      <p className="public-wrap mt-8 text-sm leading-6 text-slate-700">{messages.funds}</p>
      {plans.length ? (
        <section className="public-wrap min-w-0" aria-labelledby="published-offers-title">
        <h2 id="published-offers-title" className="public-h2">{messages.compare}</h2>
        <div role="region" aria-labelledby="published-offers-title" tabIndex={0} className="mt-4 min-w-0 max-w-full overflow-x-auto rounded-2xl border bg-white">
          <table className="w-full min-w-[36rem] text-start text-sm">
            <thead><tr><th scope="col" className="p-4 text-start">{messages.element}</th>{plans.map(plan => <th key={plan.id} scope="col" className="p-4 text-start">{planNames[plan.code][locale]}</th>)}</tr></thead>
            <tbody>
              <tr className="border-t"><th scope="row" className="p-4 text-start">{messages.monthly}</th>{plans.map(plan => <td key={plan.id} className="p-4"><bdi>{publishedPrice(plan) ? formatMinor(plan.monthlyPriceMinor, plan.currency, locale) : messages.tariff}</bdi></td>)}</tr>
              <tr className="border-t"><th scope="row" className="p-4 text-start">{messages.annual}</th>{plans.map(plan => <td key={plan.id} className="p-4"><bdi>{BigInt(plan.annualPriceMinor) > BigInt(0) ? formatMinor(plan.annualPriceMinor, plan.currency, locale) : messages.tariff}</bdi></td>)}</tr>
              <tr className="border-t"><th scope="row" className="p-4 text-start">{messages.credits}</th>{plans.map(plan => <td key={plan.id} className="p-4"><bdi>{creditCount(plan.monthlyCreditGrant, locale)}</bdi></td>)}</tr>
              <tr className="border-t"><th scope="row" className="p-4 text-start">{messages.limits}</th>{plans.map(plan => <td key={plan.id} className="p-4">{messages.limitsUnpublished}</td>)}</tr>
            </tbody>
          </table>
        </div>
        <ul className="public-plans">
          {plans.map((plan) => {
            const price = publishedPrice(plan);
            return (
              <li key={plan.id}>
                <article className={plan.code === "GOLD" ? "is-featured" : undefined}>
                  <h2>{planNames[plan.code][locale]}</h2>
                  <p className="mt-3 text-2xl font-semibold" dir="ltr">
                    {price ? formatMinor(price, plan.currency, locale) : messages.tariff}
                  </p>
                  {price ? <p className="text-sm text-slate-600">{messages.monthly}</p> : null}
                  {BigInt(plan.annualPriceMinor) > BigInt(0) ? (
                    <p className="mt-1 text-sm text-slate-600" dir="ltr">{formatMinor(plan.annualPriceMinor, plan.currency, locale)} {messages.annual}</p>
                  ) : null}
                  <p className="mt-4 text-sm text-slate-700"><span dir="ltr">{creditCount(plan.monthlyCreditGrant, locale)}</span> {messages.credits}</p>
                  <Link href={`/${locale}/contact?motif=CLIENT&plan=${encodeURIComponent(plan.code)}`} className="journey-secondary mt-6 w-full">{messages.action}</Link>
                </article>
              </li>
            );
          })}
        </ul>
        </section>
      ) : (
        <div className="public-wrap">
          <section role="status" aria-labelledby="offers-status" className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950">
            <h2 id="offers-status" className="text-lg font-semibold">{result.status === "unavailable" ? messages.unavailableTitle : messages.emptyTitle}</h2>
            <p className="mt-2">{result.status === "unavailable" ? messages.unavailable : messages.empty}</p>
          </section>
          {result.status === "unavailable" ? <Link href={`/${locale}/abonnements`} className="journey-secondary mt-4">{messages.retry}</Link> : null}
          <Link href={`/${locale}/contact?motif=CLIENT`} className="journey-secondary mt-6">{messages.contact}</Link>
        </div>
      )}
      <p className="public-wrap mt-6 text-sm text-slate-600">{messages.note}</p>
      <section className="public-wrap mt-10" aria-labelledby="offer-scope-title">
        <h2 id="offer-scope-title" className="public-h2">{messages.offerDetails}</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">{messages.details.map(([title, text]) => <div key={title} className="public-card min-w-0"><dt className="font-semibold">{title}</dt><dd className="mt-2 leading-7">{text}</dd></div>)}</dl>
      </section>
      <section className="public-wrap journey-cta-band mt-10">
        <div>
          <h2>{messages.ctaTitle}</h2>
          <p>{messages.ctaText}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link className="journey-primary" href={`/${locale}/diagnostic`}>{messages.discover}</Link>
          <Link className="journey-secondary" href={`/${locale}/contact`}>{messages.contact}</Link>
        </div>
      </section>
      <section className="public-wrap mt-12">
        <h2 className="public-h2">{locale === "ar" ? "أسئلة متكررة" : "Questions fréquentes"}</h2>
        <p className="public-muted mt-3">{locale === "ar" ? "ما تحتاجون معرفته عن الاشتراكات والتجربة والأرصدة." : "Tout ce que vous devez savoir sur nos abonnements, l’essai et la gestion des crédits."}</p>
        <div className="journey-faq">
          {(locale === "ar"
            ? [
                ["هل يمكن تجربة ماتريسيا قبل الاشتراك؟", "نعم، لمدة 30 يوماً بعد التحقق من المؤسسة وتفعيلها، دون إلزام بوسيلة دفع، ودون تحول تلقائي إلى اشتراك."],
                ["كيف تعمل الأرصدة؟", "تُستخدم الأرصدة للمنافع المؤهلة في صيغتكم. تعرض محفظتكم الكميات والصلاحية والحركات، وتُحدد شروط الاستعمال قبل الشراء."],
                ["ما هي Box؟", "Box حزمة منافع مرتبطة بالخطة. محتواها وشروطها تُؤكَّد في العرض المكتوب قبل أي التزام أو دفع، ثم تظهر في المساحة الآمنة."],
                ["هل يمكن تغيير الصيغة لاحقاً؟", "نعم، من مساحة الاشتراك بعد الاتصال. أي تغيير يُطبَّق وفق القواعد النشطة للخطة."],
                ["ماذا يحدث عند نهاية فترة التجربة؟", "تلزم خطة بريميوم أو غولد أو بلاتينيوم نشطة للإجراءات الجديدة المرتبطة بالخطة. وتبقى البيانات والالتزامات القائمة متاحة."],
                ["كيف أدير اشتراكي من حسابي؟", "بعد الاتصال، الصفحة Client / Abonnement يعرض الخطة والدورة والحركات المرتبطة."],
              ]
            : [
                ["Puis-je essayer Matricia avant de m’abonner ?", "Oui : 30 jours après vérification et activation de l’organisation, sans moyen de paiement obligatoire et sans conversion automatique en abonnement."],
                ["Comment fonctionnent les crédits ?", "Les crédits servent aux avantages éligibles de votre formule. Votre portefeuille présente les quantités, la validité et les mouvements ; les conditions d’utilisation sont précisées avant l’achat."],
                ["Qu’est-ce qu’une Box ?", "Une Box est un ensemble d’avantages lié à un plan. Son contenu et ses conditions sont confirmés dans l’offre écrite avant tout engagement ou paiement, puis consultables dans l’espace sécurisé."],
                ["Puis-je changer de formule plus tard ?", "Oui, depuis l’espace abonnement après connexion. Tout changement s’applique selon les règles actives du plan."],
                ["Que se passe-t-il à la fin de ma période d’essai ?", "Un plan Premium, Gold ou Platinum actif est nécessaire aux nouvelles actions soumises au plan. Vos données et obligations existantes restent accessibles."],
                ["Comment gérer mon abonnement depuis mon compte ?", "Après connexion, la page Client / Abonnement affiche le plan, le cycle et les mouvements associés."],
              ]
          ).map(([question, answer]) => (
            <details key={question}>
              <summary>{question}<span aria-hidden="true">+</span></summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
      </section>
      <Link href={`/${locale}/client/abonnement`} className="public-wrap mt-4 inline-flex min-h-11 items-center font-semibold text-[var(--mat-violet)] underline underline-offset-4">{messages.manage}</Link>
    </main>
  );
}
