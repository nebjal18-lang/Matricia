import Link from "next/link";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import { financeCostProofCopy } from "@/modules/admin/screens/pnl/finance-cost-proof-copy";
import type { AdminFinanceMessages } from "./messages";

export function FinanceWorkshops({
  locale,
  m,
  organizationQuery = "",
}: {
  locale: Locale;
  m: AdminFinanceMessages;
  organizationQuery?: string;
}) {
  const q = organizationQuery;
  const groups = [
    {
      title: m.workshopBilling,
      links: [
        { href: `/${locale}/administration/finance${q}#paiements`, label: m.linkClientInvoices },
        { href: `/${locale}/administration/finance/prestataires${q}`, label: m.linkProviderInvoices },
        { href: `/${locale}/administration/finance${q}#sorties`, label: m.linkPayments },
      ],
    },
    {
      title: m.workshopControl,
      links: [
        { href: `/${locale}/administration/approbations-finance${q}`, label: m.linkApprovals },
        { href: `/${locale}/administration/finance/recompenses${q}`, label: m.linkRewards },
        { href: `/${locale}/administration/approbations-finance${q}`, label: m.linkCommissions },
        { href: `/${locale}/administration/finance/rapprochements-couts${q}`, label: financeCostProofCopy[locale].openReconciliation || m.linkCostProof },
      ],
    },
    {
      title: m.workshopCatalog,
      links: [
        { href: `/${locale}/administration/finance/offres${q}`, label: m.linkBoxes },
        { href: `/${locale}/administration/finance/credits${q}`, label: m.linkCreditPacks },
        { href: `/${locale}/administration/achats-groupes${q}`, label: m.linkVolume },
      ],
    },
  ];

  return (
    <section className="client-card admin-finance-workshops scroll-mt-24 space-y-4 p-4" aria-labelledby="finance-workshops-title">
      <h2 id="finance-workshops-title">{m.workshopsTitle}</h2>
      <div className="admin-finance-workshops-grid">
        {groups.map((group) => (
          <div key={group.title}>
            <h3>{group.title}</h3>
            <ul>
              {group.links.map((link) => (
                <li key={`${group.title}:${link.href}:${link.label}`}>
                  <Link href={link.href} className="client-text-link">{link.label}</Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <section id="boxes" className="client-access-note scroll-mt-24">
        <p role="status">
          {locale === "ar" ? "إنشاء عروض Box:" : "Créer une offre Box :"}{" "}
          <Link href={`/${locale}/administration/finance/offres${q}`} className="client-text-link">{m.linkBoxes}</Link>
        </p>
      </section>
      <section id="plans" className="client-access-note scroll-mt-24">
        <p role="status">
          <Link href={`/${locale}/administration/finance/offres${q}`} className="client-text-link">{m.linkBoxes}</Link>
        </p>
      </section>
      <section id="credits" className="client-access-note scroll-mt-24">
        <p role="status">
          <Link href={`/${locale}/administration/finance/credits${q}`} className="client-text-link">{m.linkCreditPacks}</Link>
        </p>
      </section>
    </section>
  );
}
