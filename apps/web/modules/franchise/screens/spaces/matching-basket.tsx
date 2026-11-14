"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useMemo, useState } from "react";
import { networkStateLabel } from "@/modules/franchise/data/network/filters";
import { franchiseCopy } from "@/modules/franchise/data/spaces/copy";
import type { Locale } from "@/modules/shared/lib/i18n/locale";

type MatchingRow = {
  id: string;
  name: string;
  status: string;
  tone: "peach" | "sky" | "mint" | "violet";
  href: string;
};

export function FranchiseMatchingPanel({
  locale,
  query,
  requestId,
  rows,
}: {
  locale: Locale;
  query: string;
  requestId: string;
  rows: readonly MatchingRow[];
}) {
  const c = franchiseCopy(locale);
  const initial = rows.slice(0, Math.min(2, rows.length)).map((row) => row.id);
  const [selected, setSelected] = useState<string[]>(initial);
  const selectedRows = useMemo(
    () => rows.filter((row) => selected.includes(row.id)),
    [rows, selected],
  );
  const consultationHref = `/${locale}/franchise/demandes/${requestId}/consultation${query}`;

  function toggle(id: string) {
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  return (
    <section className="franchise-matching-layout">
      <div>
        <header className="client-priority-head">
          <h2>{c.matchingEligible} <small dir="ltr">({rows.length})</small></h2>
        </header>
        <p>{c.matchingLead}</p>
        {rows.length ? (
          <div tabIndex={0} className="client-table-wrap">
            <table className="client-space-table">
              <thead>
                <tr>
                  <th>{c.netPeople}</th>
                  <th>{c.stepQual}</th>
                  <th>{c.state}</th>
                  <th>{c.action}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const checked = selected.includes(row.id);
                  return (
                    <tr key={row.id} data-selected={checked ? "true" : undefined}>
                      <td>
                        <label className="franchise-check-row">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggle(row.id)}
                            aria-label={row.name}
                          />
                          <strong>{row.name}</strong>
                        </label>
                      </td>
                      <td><em className="client-status-chip" data-tone={row.tone}>{networkStateLabel(row.status, locale)}</em></td>
                      <td><em className="client-status-chip" data-tone="mint">{locale === "ar" ? "متاح" : "Disponible"}</em></td>
                      <td>
                        <Link href={row.href} className="client-soft-link">{c.openFolder}</Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <p className="franchise-empty-panel">{c.emptyMatching}</p>}
        <ol className="franchise-mini-pipe franchise-consult-steps">
          <li data-active="true"><em>1</em><strong>{c.matchingStepPrepare}</strong><small>{c.needLead}</small></li>
          <li data-active={selectedRows.length > 0 ? "true" : undefined}><em>2</em><strong>{c.matchingStepConfirm}</strong><small>{c.structureLead}</small></li>
          <li><em>3</em><strong>{c.matchingStepSend}</strong><small>{c.consultLead}</small></li>
          <li><em>4</em><strong>{c.matchingStepFollow}</strong><small>{c.followLead}</small></li>
        </ol>
      </div>
      <aside className="client-card franchise-basket">
        <header className="client-priority-head">
          <h2>{c.matchingBasket} <small dir="ltr">({selectedRows.length})</small></h2>
          <button type="button" className="client-soft-link" onClick={() => setSelected([])}>{c.matchingClear}</button>
        </header>
        <ul className="client-feed">
          {selectedRows.length === 0 ? (
            <li><span><strong>{locale === "ar" ? "لا اختيار بعد" : "Aucune sélection"}</strong><small>{locale === "ar" ? "حدّدوا مقدمي خدمة مؤهلين" : "Cochez des prestataires éligibles"}</small></span></li>
          ) : selectedRows.map((row) => (
            <li key={row.id}><span><strong>{row.name}</strong><small>{networkStateLabel(row.status, locale)}</small></span></li>
          ))}
        </ul>
        <p className="client-access-note">{c.matchingNoAmount}</p>
        <p className="franchise-mandate-banner" role="note">{c.privacyLead}</p>
        <Link
          href={consultationHref}
          className="franchise-cta"
          aria-disabled={selectedRows.length === 0 ? "true" : undefined}
          tabIndex={selectedRows.length === 0 ? -1 : undefined}
        >
          {c.matchingSubmit} <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
        </Link>
        <p className="client-access-note">{c.matchingSubmitNote}</p>
      </aside>
    </section>
  );
}
