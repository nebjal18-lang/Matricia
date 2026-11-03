import Link from "next/link";
import { ArrowLeft, ArrowRight, Info, LifeBuoy, MessageSquare } from "lucide-react";
import type { ReactNode } from "react";
import { canApplyClientSpaceDemo, demoClientSpaces } from "@/modules/client/data/spaces/demo";
import { spaceCopy } from "@/modules/client/data/spaces/copy";
import type { DisputeDetail, DisputeSummary } from "@/modules/shared/lib/disputes/model";
import type { DisputeMessages } from "@/modules/client/screens/litiges/messages";
import type { Locale } from "@/modules/shared/lib/i18n/locale";

function formatDate(value: string | null, locale: Locale) {
  return value ? new Intl.DateTimeFormat(locale === "ar" ? "ar-MA" : "fr-MA", { dateStyle: "medium" }).format(new Date(value)) : "—";
}

function statusTone(status: DisputeSummary["status"]): "violet" | "mint" | "sky" | "peach" {
  if (status === "MEDIATION_REVIEW") return "violet";
  if (status === "PROVIDER_RESPONDED" || status === "WARNING_LEVEL_1") return "mint";
  if (status === "APPEALED") return "peach";
  return "sky";
}

export function DisputesBoard({
  locale,
  query,
  cases,
  selected,
  messages,
  canOpen,
  hrefPrefix,
  children,
}: {
  locale: Locale;
  query: string;
  organizationName?: string | null;
  cases: DisputeSummary[];
  selected: DisputeDetail | null;
  messages: DisputeMessages;
  canOpen: boolean;
  hrefPrefix?: string;
  children?: ReactNode;
}) {
  const c = spaceCopy(locale);
  const demo = demoClientSpaces(locale, query);
  const base = hrefPrefix ?? `/${locale}/client/litiges`;
  const preferDemo = !hrefPrefix && canApplyClientSpaceDemo() && cases.length === 0;
  const BackIcon = locale === "ar" ? ArrowRight : ArrowLeft;
  const listHref = `${base}${query}`;
  const helpHref = `/${locale}/contact${query}`;
  const messagesHref = `/${locale}/messagerie${query}`;
  const newHref = `${base}/nouveau${query}`;

  if (!preferDemo && cases.length === 0) {
    return (
      <main className="client-page">
        <p className="client-card">{messages.empty}</p>
        {canOpen ? <Link href={newHref} className="client-cta">{messages.newCase}</Link> : null}
      </main>
    );
  }

  return (
    <main className="client-page">
      <section className="client-dispute-layout">
        <article className="client-card">
          <header className="client-priority-head">
            <h2>{c.myDisputes}</h2>
            <span className="client-status-chip" data-tone="sky">{c.allStatuses}</span>
          </header>
          <ul className="client-dispute-list">
            {preferDemo
              ? demo.disputes.map((item, index) => (
                  <li key={item.id}>
                    <a href="#litige-detail" aria-current={index === 0 ? "true" : undefined}>
                      <span>
                        <strong>{item.title}</strong>
                        <small>{item.project}</small>
                      </span>
                      <em>
                        <span className="client-status-chip" data-tone={item.tone}>{item.status}</span>
                        <small>{item.due}</small>
                      </em>
                    </a>
                  </li>
                ))
              : cases.map((item) => (
                  <li key={item.id}>
                    <Link href={`${base}/${item.id}${query}`} aria-current={selected?.id === item.id ? "true" : undefined}>
                      <span>
                        <strong>{item.obligationKey}</strong>
                        <small>{messages.mission} · {formatDate(item.responseDueAt, locale)}</small>
                      </span>
                      <em>
                        <span className="client-status-chip" data-tone={statusTone(item.status)}>{messages.statuses[item.status]}</span>
                        <small>{formatDate(item.responseDueAt, locale)}</small>
                      </em>
                    </Link>
                  </li>
                ))}
          </ul>
        </article>
        <div className="client-stack" id="litige-detail">
          {preferDemo ? (
            <DemoDisputeDetail locale={locale} query={query} />
          ) : selected ? (
            <LiveDisputeDetail locale={locale} query={query} selected={selected} messages={messages} actions={children} />
          ) : (
            <article className="client-card">
              <p>{messages.empty}</p>
            </article>
          )}
        </div>
      </section>
      <div className="client-dispute-foot">
        <Link href={listHref} className="client-text-link"><BackIcon className="size-4" aria-hidden />{c.backDisputes}</Link>
        <p><Info className="size-4" aria-hidden />{c.noAutoVerdict}</p>
      </div>
      <div className="client-offer-actions">
        <Link href={helpHref} className="client-soft-link"><LifeBuoy className="size-4" aria-hidden />{c.needHelp}</Link>
        <Link href={messagesHref} className="client-cta"><MessageSquare className="size-4" aria-hidden />{c.contactAssist}</Link>
        {canOpen ? <Link href={newHref} className="client-ghost-link">{messages.newCase}</Link> : null}
      </div>
    </main>
  );
}

function DemoDisputeDetail({ locale, query }: { locale: Locale; query: string }) {
  const c = spaceCopy(locale);
  const demo = demoClientSpaces(locale, query);
  const detail = demo.disputeDetail;
  const docsHref = `/${locale}/client/documents${query}`;
  const newHref = `/${locale}/client/litiges/nouveau${query}`;
  return (
    <>
      <article className="client-card">
        <header className="client-priority-head">
          <div>
            <h2>{detail.title}</h2>
            <p>{detail.project} · {detail.provider}</p>
          </div>
          <span className="client-status-chip" data-tone="violet">{demo.disputes[0]?.status}</span>
        </header>
        <nav className="client-tabs" aria-label={c.myDisputes}>
          <a href="#details" aria-current="page">{c.tabDetails}</a>
          <Link href={`/${locale}/messagerie${query}`}>{c.tabExchanges}</Link>
          <Link href={docsHref}>{c.tabDocs}</Link>
          <a href="#mediation">{c.tabMediation}</a>
          <a href="#history">{c.tabHistory}</a>
        </nav>
        <section id="details" className="client-dispute-split">
          <div>
            <h3>{c.contextReminder}</h3>
            <p>{detail.context}</p>
          </div>
        </section>
        <section className="client-dispute-split">
          <article>
            <h3>{c.clientPosition}</h3>
            <p>{detail.client}</p>
          </article>
          <article>
            <h3>{c.providerReply}</h3>
            <p>{detail.providerReply}</p>
          </article>
        </section>
        <section>
          <header className="client-priority-head">
            <h3>{c.sharedDocs}</h3>
            <Link href={docsHref} className="client-text-link">{c.seeAllDocs} ({detail.files.length})</Link>
          </header>
          <ul className="client-feed">
            {detail.files.map((file) => (
              <li key={file.id}><Link href={file.href}><span>{file.title}</span><small>{file.by}</small></Link></li>
            ))}
          </ul>
          <p className="client-access-note">{c.confidentialProofsLead}</p>
        </section>
      </article>
      <article className="client-card" id="mediation">
        <header><h2>{c.mediationFollow}</h2></header>
        <ol className="client-mediation">
          {detail.mediation.map((step) => (
            <li key={step.id} data-state={step.state}>
              <strong>{step.title}</strong>
              <small>{step.date}</small>
            </li>
          ))}
        </ol>
        <div className="client-next-action">
          <h3>{c.nextPossible}</h3>
          <p>{detail.nextLead}</p>
          <Link href={newHref} className="client-cta">{c.submitResponse}</Link>
          <Link href={docsHref} className="client-ghost-link">{c.addProof}</Link>
        </div>
      </article>
      <article className="client-card" id="history">
        <header><h2>{c.tabHistory}</h2></header>
        <ol className="client-mediation">
          {detail.mediation.map((step) => (
            <li key={`history-${step.id}`} data-state={step.state}>
              <strong>{step.title}</strong>
              <small>{step.date}</small>
            </li>
          ))}
        </ol>
      </article>
    </>
  );
}

function LiveDisputeDetail({
  locale,
  query,
  selected,
  messages,
  actions,
}: {
  locale: Locale;
  query: string;
  selected: DisputeDetail;
  messages: DisputeMessages;
  actions?: ReactNode;
}) {
  const c = spaceCopy(locale);
  const docsHref = `/${locale}/client/documents${query}`;
  const visible = selected.evidence.filter((item) => item.visibility !== "MEDIATOR_ONLY");
  const confidential = selected.evidence.filter((item) => item.visibility === "MEDIATOR_ONLY");
  return (
    <>
      <article className="client-card">
        <header className="client-priority-head">
          <div>
            <h2>{selected.obligationKey}</h2>
            <p>{messages.mission} · {formatDate(selected.responseDueAt, locale)}</p>
          </div>
          <span className="client-status-chip" data-tone={statusTone(selected.status)}>{messages.statuses[selected.status]}</span>
        </header>
        <nav className="client-tabs" aria-label={c.myDisputes}>
          <a href="#details" aria-current="page">{c.tabDetails}</a>
          <Link href={`/${locale}/messagerie${query}`}>{c.tabExchanges}</Link>
          <Link href={docsHref}>{c.tabDocs}</Link>
          <a href="#mediation">{c.tabMediation}</a>
          <a href="#history">{c.tabHistory}</a>
        </nav>
        <section id="details">
          <h3>{c.contextReminder}</h3>
          <p className="whitespace-pre-wrap">{selected.description}</p>
        </section>
        <section className="client-dispute-split">
          <article>
            <h3>{c.clientPosition}</h3>
            <p>{selected.description}</p>
          </article>
          <article>
            <h3>{c.providerReply}</h3>
            <p>{selected.response ? selected.response.statement : c.awaitingProvider}</p>
          </article>
        </section>
        <section>
          <header className="client-priority-head">
            <h3>{c.sharedDocs}</h3>
            <Link href={docsHref} className="client-text-link">{c.seeAllDocs} ({visible.length})</Link>
          </header>
          {visible.length === 0 ? <p>{messages.none}</p> : (
            <ul className="client-feed">
              {visible.map((item) => (
                <li key={item.id}><span>{item.type}</span><small dir="auto">{item.statement ?? item.url}</small>{(item.type==="DOCUMENT"||(item.type==="DELIVERY_PROOF"&&!item.url))?<a href={`/api/client/disputes/evidence/${item.id}`} className="client-text-link">{locale==="ar"?"تنزيل الدليل":"Télécharger la pièce"}</a>:null}</li>
              ))}
            </ul>
          )}
          {confidential.length > 0 ? <p className="client-access-note">{c.confidentialProofsLead}</p> : null}
        </section>
      </article>
      <article className="client-card" id="mediation">
        <header><h2>{c.mediationFollow}</h2></header>
        <ol className="client-mediation" id="history">
          {selected.events.map((event) => (
            <li key={event.id} data-state="done">
              <strong>{event.type}</strong>
              <small>{formatDate(event.createdAt, locale)}</small>
            </li>
          ))}
        </ol>
        <div className="client-next-action">
          <h3>{c.nextPossible}</h3>
          {actions ?? <p>{messages.noAction}</p>}
        </div>
      </article>
    </>
  );
}
