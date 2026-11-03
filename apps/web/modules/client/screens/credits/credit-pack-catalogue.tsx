import { z } from "zod";
import Link from "next/link";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";
import { formatMinor } from "@/modules/shared/lib/subscriptions/model";
import { getSubscriptionMessages } from "../abonnement/messages";
import { PaymentIntentButton } from "../abonnement/payment-intent-button";
import { PaymentCaptureReturn } from "../abonnement/payment-capture-return";
import { CreditPackStatus } from "./credit-pack-status";

export const creditPackCatalogueSchema = z.object({
  can_purchase: z.boolean(),
  packs: z.array(z.object({
    id: z.string().uuid(), name_fr: z.string(), name_ar: z.string(),
    quantity: z.string().regex(/^[1-9]\d*$/), price_minor: z.string().regex(/^[1-9]\d*$/),
    currency: z.string().regex(/^[A-Z]{3}$/), validity_days: z.number().int().positive(),
    pending: z.boolean(), attempt_key: z.string().nullable(), payment_intent_id: z.string().uuid().nullable(),
  })),
});

export async function CreditPackCatalogue({ locale, organizationId }: { locale: "fr" | "ar"; organizationId: string }) {
  const c = await getSupabaseServerClient();
  const result = await c.rpc("get_client_credit_pack_catalogue_v1", { p_organization_id: organizationId });
  const parsed = result.error ? null : creditPackCatalogueSchema.safeParse(result.data);
  const ar = locale === "ar", messages = getSubscriptionMessages(locale);
  return <section className="client-card" aria-labelledby="credit-pack-title">
    <h2 id="credit-pack-title">{ar ? "شراء أرصدة إضافية" : "Acheter des crédits supplémentaires"}</h2>
    <PaymentCaptureReturn locale={locale} organizationId={organizationId} messages={messages} purchaseKind="CREDIT_PACK" />
    {!parsed?.success ? <p role="alert">{ar ? "تعذر تحميل عروض الأرصدة. أعيدوا تحميل الصفحة للمحاولة مجدداً." : "Les offres de crédits sont indisponibles. Rechargez la page pour réessayer."}</p>
      : parsed.data.packs.length === 0 ? <p>{ar ? "لا توجد حزمة أرصدة منشورة حالياً." : "Aucun pack de crédits n’est publié actuellement."}</p>
        : <ul className="grid gap-4 md:grid-cols-3">{parsed.data.packs.map(pack => <li className="rounded-xl border p-4" key={pack.id}>
          <h3 className="font-semibold">{ar ? pack.name_ar : pack.name_fr}</h3>
          <p><span dir="ltr">{pack.quantity}</span> {ar ? "رصيداً" : "crédits"}</p>
          <p dir="auto">{formatMinor(pack.price_minor, pack.currency, locale)}</p>
          <p>{ar ? `الصلاحية: ${pack.validity_days} يوماً بعد تأكيد الدفع` : `Validité : ${pack.validity_days} jours après confirmation du paiement`}</p>
          {pack.payment_intent_id ? <CreditPackStatus locale={locale} organizationId={organizationId} paymentIntentId={pack.payment_intent_id} /> : null}
          {pack.pending ? <p role="status" className="my-2">{ar ? "توجد عملية شراء قيد الانتظار؛ لا تنشئوا دفعة أخرى." : "Un achat est déjà en cours ; ne créez pas une nouvelle charge."}</p> : null}
          {parsed.data.can_purchase && (!pack.pending || pack.attempt_key) ? <PaymentIntentButton locale={locale} organizationId={organizationId} packVersionId={pack.id} attemptKey={pack.attempt_key ?? undefined} billingInterval="MONTHLY" messages={messages} /> : null}
          {pack.pending && !pack.attempt_key ? <Link className="underline" href={`/${locale}/client/assistance?organizationId=${organizationId}`}>{messages.contactSupport}</Link> : null}
        </li>)}</ul>}
  </section>;
}
