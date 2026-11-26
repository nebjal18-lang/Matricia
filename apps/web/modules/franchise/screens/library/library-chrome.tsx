import Link from "next/link";
import { CheckCircle2, Lock, ShieldAlert } from "lucide-react";
import { libraryCopy } from "@/modules/franchise/data/library/copy";
import { catalogStatusLabel, catalogStatusTone } from "@/modules/franchise/data/library/workspace-model";
import type { Locale } from "@/modules/shared/lib/i18n/locale";

export function validationChipLabel(status: string, locale: Locale) {
  const c = libraryCopy(locale);
  if (status === "DRAFT") return c.validationPending;
  if (["IN_REVIEW", "FRANCHISE_REVIEW", "CENTRAL_REVIEW", "LOCAL_TEST"].includes(status)) return c.validationSubmitted;
  if (status === "PUBLISHED" || status === "APPROVED") return c.validationApproved;
  if (status === "REJECTED" || status === "CHANGES_REQUESTED") return c.validationReturns;
  return catalogStatusLabel(status, locale);
}

export function validationChipTone(status: string): "violet" | "sky" | "mint" | "peach" {
  if (status === "DRAFT") return "sky";
  if (["IN_REVIEW", "FRANCHISE_REVIEW", "CENTRAL_REVIEW", "LOCAL_TEST"].includes(status)) return "peach";
  if (status === "PUBLISHED" || status === "APPROVED") return "mint";
  if (status === "REJECTED" || status === "CHANGES_REQUESTED") return "peach";
  return catalogStatusTone(status);
}

export function workflowChipLabel(status: string, locale: Locale) {
  return catalogStatusLabel(status, locale);
}

export function FranchiseScopeInfo({ locale }: { locale: Locale }) {
  const c = libraryCopy(locale);
  return (
    <p className="franchise-scope-info" role="note">
      <Lock className="size-4" aria-hidden />
      <span>{c.scope}</span>
    </p>
  );
}

export function FranchiseSecurityPanel({ locale }: { locale: Locale }) {
  const c = libraryCopy(locale);
  return (
    <aside className="franchise-security-panel" aria-label={c.securityTitle}>
      <h2><ShieldAlert className="size-4" aria-hidden /> {c.securityTitle}</h2>
      <ul>
        {c.securityBullets.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </aside>
  );
}

export function FranchiseMandatePerimeter({ locale, name }: { locale: Locale; name: string }) {
  const c = libraryCopy(locale);
  return (
    <article className="client-card franchise-mandate-ok">
      <header className="client-priority-head">
        <h2>{c.mandatePerimeter}</h2>
        <CheckCircle2 className="size-5" aria-hidden />
      </header>
      <p><strong>{name}</strong></p>
      <p className="client-access-note">{c.scope}</p>
    </article>
  );
}

export function FranchiseRowMenu({ href, label }: { href: string; label: string }) {
  return <Link href={href} className="franchise-row-menu" aria-label={label}>⋯</Link>;
}

export function FranchiseMandateRail({ locale, name }: { locale: Locale; name?: string | null | undefined }) {
  const c = libraryCopy(locale);
  return (
    <aside className="franchise-home-rail">
      <FranchiseMandatePerimeter locale={locale} name={name ?? c.mandate} />
      <article className="client-card franchise-reminders">
        <header><h2>{c.reminders}</h2></header>
        <ul className="franchise-dot-list">
          {c.reminderItems.map((item) => (
            <li key={item}><span className="franchise-dot" data-tone="peach" /><span>{item}</span></li>
          ))}
        </ul>
      </article>
      <div className="franchise-security-inline" role="note">
        <p><Lock className="size-4" aria-hidden /> {c.securityReminders}</p>
        <ul>{c.securityBullets.map((item) => <li key={item}>{item}</li>)}</ul>
      </div>
    </aside>
  );
}
