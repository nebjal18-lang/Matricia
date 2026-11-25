import { connectDemoPersona, connectDemoRegionalActor } from "./demo-actions";
import { demoPersonaHome, type DemoPersona } from "./demo-personas";
import {
  demoRegionalSummary,
  listDemoRegionalActors,
  listDemoRegionalTerritories,
} from "./demo-regional-directory";
import type { Locale } from "@/modules/shared/lib/i18n/locale";

const personas = ["client", "provider", "franchise", "admin"] as const satisfies readonly DemoPersona[];

const copy = {
  fr: {
    title: "Connexion automatique",
    lead: "Personas globaux, puis raccourcis par région : 1 franchisé, 3 sous-traitants, 6 clients.",
    regionsTitle: "Raccourcis par région",
    franchise: "Franchisés",
    provider: "Sous-traitants",
    client: "Clients",
    admin: "Admin",
    globalClient: "Client",
    globalProvider: "Sous-traitant",
    globalFranchise: "Franchisé",
  },
  ar: {
    title: "دخول تلقائي",
    lead: "شخصيات عامة ثم اختصارات حسب الإقليم: امتياز واحد، 3 مقاولين، 6 عملاء.",
    regionsTitle: "اختصارات حسب الإقليم",
    franchise: "أصحاب الامتياز",
    provider: "المقاولون",
    client: "العملاء",
    admin: "إدارة",
    globalClient: "عميل",
    globalProvider: "مقاول من الباطن",
    globalFranchise: "صاحب امتياز",
  },
} satisfies Record<Locale, Record<string, string>>;

const buttonClass =
  "min-h-11 w-full rounded-lg bg-blue-700 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-blue-700";
const softButtonClass =
  "min-h-11 w-full rounded-lg border border-blue-300 bg-white px-3 py-2 text-left text-sm font-semibold text-blue-950 hover:bg-blue-100 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-blue-700";

export function DemoAccess({ locale }: { locale: Locale; nextPath?: string }) {
  const messages = copy[locale];
  const territories = listDemoRegionalTerritories();
  const summary = demoRegionalSummary();

  return (
    <section className="mt-7 rounded-2xl border border-blue-200 bg-blue-50 p-4" aria-labelledby="demo-access-title">
      <h2 id="demo-access-title" className="text-sm font-semibold text-blue-950">
        {messages.title}
      </h2>
      <p className="mt-1 text-sm text-blue-900/80">{messages.lead}</p>

      <DemoDashboardButtons locale={locale} />

      <div className="mt-5 space-y-2" aria-labelledby="demo-regions-title">
        <h3 id="demo-regions-title" className="text-sm font-semibold text-blue-950">
          {messages.regionsTitle}
        </h3>
        <p className="text-xs text-blue-900/70" dir="ltr">
          {summary.territories} régions · {summary.franchises} franchisés · {summary.providers} ST · {summary.clients} clients
        </p>
        {territories.map((territory) => {
          const actors = listDemoRegionalActors(territory.code);
          const franchises = actors.filter((actor) => actor.kind === "franchise");
          const providers = actors.filter((actor) => actor.kind === "provider");
          const clients = actors.filter((actor) => actor.kind === "client");
          return (
            <details key={territory.code} className="rounded-xl border border-blue-200 bg-white/80 p-3">
              <summary className="cursor-pointer text-sm font-semibold text-blue-950">
                {locale === "ar" ? territory.nameAr : territory.nameFr}
                <span className="ms-2 font-normal text-blue-800/70" dir="ltr">
                  {territory.city}
                </span>
              </summary>
              <div className="mt-3 space-y-3">
                <section aria-label={messages.franchise}>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-blue-900/70">{messages.franchise}</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {franchises.map((actor) => (
                      <RegionalForm key={actor.email} locale={locale} actor={actor} className={softButtonClass} />
                    ))}
                  </div>
                </section>
                <section aria-label={messages.provider}>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-blue-900/70">{messages.provider}</p>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {providers.map((actor) => (
                      <RegionalForm key={actor.email} locale={locale} actor={actor} className={softButtonClass} />
                    ))}
                  </div>
                </section>
                <section aria-label={messages.client}>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-blue-900/70">{messages.client}</p>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {clients.map((actor) => (
                      <RegionalForm key={actor.email} locale={locale} actor={actor} className={softButtonClass} />
                    ))}
                  </div>
                </section>
              </div>
            </details>
          );
        })}
      </div>
    </section>
  );
}

export function DemoDashboardButtons({ locale }: { locale: Locale }) {
  const messages = copy[locale];
  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      {personas.map((persona) => (
        <form action={connectDemoPersona} key={persona}>
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="persona" value={persona} />
          <input type="hidden" name="next" value={demoPersonaHome(persona, locale)} />
          <button type="submit" className={buttonClass}>
            {persona === "client"
              ? messages.globalClient
              : persona === "provider"
                ? messages.globalProvider
                : persona === "franchise"
                  ? messages.globalFranchise
                  : messages.admin}
          </button>
        </form>
      ))}
    </div>
  );
}

function RegionalForm({
  locale,
  actor,
  className,
}: {
  locale: Locale;
  actor: ReturnType<typeof listDemoRegionalActors>[number];
  className: string;
}) {
  return (
    <form action={connectDemoRegionalActor}>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="kind" value={actor.kind} />
      <input type="hidden" name="territoryCode" value={actor.territoryCode} />
      <input type="hidden" name="slot" value={actor.slot} />
      <button type="submit" className={className}>
        {locale === "ar" ? actor.labelAr : actor.labelFr}
      </button>
    </form>
  );
}
