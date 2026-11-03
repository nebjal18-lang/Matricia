import { formatExactMoney } from "@/modules/shared/lib/contracts-missions/model";
import Link from "next/link";
import { randomUUID } from "node:crypto";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import { ApprovalResumeForm } from "./resume-form";
import { ApprovalDecisionForm } from "./decision-form";
import type { ApprovalMessages } from "./messages";
import type { ClientApprovalPage, ClientApprovalRequest } from "./model";

export function ClientApprovalsPanel({
  locale,
  items = [],
  messages,
  result,
  organizationId,
}: {
  locale: Locale;
  items?: ClientApprovalRequest[];
  messages: ApprovalMessages;
  result?: ClientApprovalPage;
  organizationId?: string | null;
}) {
  const href = (page = 1) => `/${locale}/client/actions?${new URLSearchParams({ ...(organizationId ? { organizationId } : {}), approvalPage: String(page) })}`;
  if (result && result.status !== "success") {
    const text = result.status === "organization_required" ? messages.organizationRequired : result.status === "unauthenticated" ? messages.unauthenticated : result.status === "forbidden" ? messages.forbiddenLoad : messages.unavailable;
    return <section className="client-card space-y-3" aria-labelledby="client-approvals"><h2 id="client-approvals">{messages.title}</h2><p role="alert">{text}</p>
      {result.status === "unauthenticated" ? <Link className="underline" href={`/${locale}/connexion?${new URLSearchParams({ next: href() })}`}>{messages.retry}</Link> : <Link className="underline" href={href()}>{messages.retry}</Link>}
      <p className="text-sm text-muted-foreground">{messages.reference}</p></section>;
  }
  const visible = result?.status === "success" ? result.items : items;
  const resourceLabel = (type: string) => messages.resources[type as keyof typeof messages.resources] ?? messages.resourceFallback;
  return (
    <section className="client-card space-y-4" aria-labelledby="client-approvals">
      <header>
        <h2 id="client-approvals">{messages.title}</h2>
        <p>{messages.intro}</p>
      </header>
      {visible.length === 0 ? <p>{messages.empty}</p> : (
        <ul className="space-y-4">
          {visible.map((item) => (
            <li key={item.id} className="rounded-xl border p-4">
              <dl className="grid gap-2 text-sm sm:grid-cols-2">
                <div><dt className="text-muted-foreground">{messages.resource}</dt><dd>{resourceLabel(item.resourceType)}{item.labelFr ? <p>{locale === "ar" ? item.labelAr : item.labelFr}</p> : null}</dd></div>
                <div><dt className="text-muted-foreground">{messages.status}</dt><dd>{messages.statuses[item.status]}</dd></div>
                <div><dt className="text-muted-foreground">{messages.amount}</dt><dd dir="ltr">{item.amountMinor && item.currency ? formatExactMoney(item.amountMinor, item.currency, locale) : "—"}</dd></div>
                <div><dt className="text-muted-foreground">{messages.requestedAt}</dt><dd><time dateTime={item.requestedAt}>{new Intl.DateTimeFormat(locale === "ar" ? "ar-MA" : "fr-MA", { dateStyle: "medium" }).format(new Date(item.requestedAt))}</time></dd></div>
              </dl>
              {item.path ? <Link className="my-2 inline-flex min-h-11 items-center underline" href={`/${locale}${item.path.replace("#", `?organizationId=${organizationId ?? ""}#`)}${item.path.includes("#") ? "" : `?organizationId=${organizationId ?? ""}`}`}>{messages.resume}</Link> : null}
              {item.completed ? <p>{messages.commandCompleted}</p> : item.canResume ? <ApprovalResumeForm organizationId={organizationId} item={item} locale={locale} messages={messages}/> : null}
              {item.status === "PENDING" ? <ApprovalDecisionForm item={item} locale={locale} messages={messages} idempotencyKey={randomUUID()} /> : null}
            </li>
          ))}
        </ul>
      )}
      {result?.status === "success" && (result.page > 1 || result.hasNext) ? <nav aria-label={messages.title} className="flex flex-wrap gap-4">
        {result.page > 1 ? <Link href={href(result.page - 1)} className="underline">{messages.previous}</Link> : null}
        {result.hasNext ? <Link href={href(result.page + 1)} className="underline">{messages.next}</Link> : null}
      </nav> : null}
    </section>
  );
}
