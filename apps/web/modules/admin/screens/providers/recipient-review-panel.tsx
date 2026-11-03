"use client";
import {useId, useState} from "react";
import type {Locale} from "@/modules/shared/lib/i18n/locale";
import type {AdminProvider} from "@/modules/admin/data/providers/model";
import {ProviderBillingRecipientReview} from "@/modules/provider/screens/facturation/recipient-review";
export function AdminProviderRecipientReview({locale, providers}: {locale: Locale; providers: AdminProvider[]}) {
  const [organizationId, setOrganizationId] = useState("");
  const id = useId(), ar = locale === "ar";
  const selected = providers.find((provider) => provider.organizationId === organizationId);
  return <section className="client-card"><h2>{ar ? "مراجعة المستفيد التاريخي وتصحيح الفاتورة" : "Destinataire historique et correction de facture"}</h2>
    <label htmlFor={id}>{ar ? "مقدم الخدمة المعني" : "Prestataire concerné"}</label><select id={id} className="min-h-11 w-full rounded-md border bg-background px-3" value={organizationId} onChange={(event) => setOrganizationId(event.target.value)}><option value="">{ar ? "اختيار مقدم خدمة" : "Choisir un prestataire"}</option>{providers.map((provider) => <option key={provider.organizationId} value={provider.organizationId}>{provider.organizationName}</option>)}</select>
    {selected ? <ProviderBillingRecipientReview key={selected.organizationId} organizationId={selected.organizationId} locale={locale}/> : <p>{ar ? "اختاروا المؤسسة لفتح مراجعة مصادرها وأدلتها الخاصة." : "Choisissez l’organisation pour ouvrir ses sources et pièces privées autorisées."}</p>}
  </section>;
}
