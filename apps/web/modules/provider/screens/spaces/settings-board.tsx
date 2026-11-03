import {capacitySummaryStatus} from "@/modules/provider/data/qualification/capacity-summary";
import {interventionModeLabel} from "@/modules/provider/data/qualification/intervention-modes";
import { moroccoRegionLabel } from "@/modules/shared/lib/geo/morocco-regions";
import Link from "next/link";
import { ArrowRight, Bell, MapPin, Settings2 } from "lucide-react";
import { PreferenceForm } from "@/app/[locale]/notifications/notification-forms";
import { getNotificationMessages } from "@/app/[locale]/notifications/messages";
import type { NotificationDashboard } from "@/modules/shared/lib/notifications/model";
import type { ProviderDashboard } from "@/modules/provider/data/qualification/model";
import { ProviderProfileRail } from "@/modules/provider/ui/provider-profile-rail";
import type { Locale } from "@/modules/shared/lib/i18n/locale";

const copy = {
  fr: {
    title: "Préférences",
    lead: "Ajustez vos modalités d’intervention et le rythme de vos alertes. Les modifications sensibles passent par les écrans métier liés.",
    missionTitle: "Préférences d’intervention",
    missionLead: "Ces préférences s’appuient sur votre capacité déclarée. Elles orientent les consultations compatibles — elles ne créent pas de missions.",
    modalities: "Modalités",
    onsite: "Sur site",
    remote: "Télétravail",
    hybrid: "Hybride",
    zones: "Zones d’intérêt",
    zonesLead: "Déclarez vos zones dans la capacité pour recevoir des dossiers géographiquement pertinents.",
    editCapacity: "Mettre à jour ma capacité",
    unset: "À renseigner",
    notifTitle: "Notifications",
    notifLead: "Choisissez le rythme par catégorie et canal. Les alertes critiques restent immédiates.",
    openCenter: "Ouvrir le centre de notifications",
    saveHint: "Enregistrez chaque canal pour appliquer le rythme choisi.",
  },
  ar: {
    title: "التفضيلات",
    lead: "اضبطوا طرق التدخل ووتيرة التنبيهات. التعديلات الحساسة تمر عبر الشاشات المهنية المرتبطة.",
    missionTitle: "تفضيلات التدخل",
    missionLead: "تستند هذه التفضيلات إلى قدرتكم المصرَّح بها. توجّه الاستشارات المتوافقة — ولا تنشئ مهاماً.",
    modalities: "أنماط التدخل",
    onsite: "في الموقع",
    remote: "عن بُعد",
    hybrid: "هجين",
    zones: "مناطق الاهتمام",
    zonesLead: "صرّحوا بمناطقكم في القدرة لاستلام ملفات ذات صلة جغرافياً.",
    editCapacity: "تحديث قدرتي",
    unset: "يلزم التصريح",
    notifTitle: "الإشعارات",
    notifLead: "اختاروا الوتيرة حسب الفئة والقناة. تبقى التنبيهات الحرجة فورية.",
    openCenter: "فتح مركز الإشعارات",
    saveHint: "احفظوا كل قناة لتطبيق الوتيرة المختارة.",
  },
} as const;


export function ProviderSettingsBoard({
  locale,
  query,
  dashboard,
  notifications,
}: {
  locale: Locale;
  query: string;
  dashboard: ProviderDashboard | null;
  notifications: NotificationDashboard | null;
}) {
  const c = copy[locale];
  const n = getNotificationMessages(locale);
  const capacityHref = `/${locale}/sous-traitant/qualification${query}#capacite`;
  const capacityStatus=capacitySummaryStatus(dashboard?.services??[]);

  const zones = dashboard?.regionCodes?.map((code) => moroccoRegionLabel(code, locale)).join(" · ") || c.unset;

  return (
    <main className="client-page provider-settings">
      <div className="provider-settings-layout">
        <ProviderProfileRail locale={locale} query={query} active="settings" />
        <div className="client-stack">
          <article className="client-card">
            <header className="client-priority-head">
              <div>
                <h2><Settings2 className="size-4" aria-hidden /> {c.missionTitle}</h2>
                <p>{c.missionLead}</p>
              </div>
              <Link href={capacityHref} className="client-ghost-link">{c.editCapacity}<ArrowRight className="size-4 rtl:rotate-180" aria-hidden /></Link>
            </header>
            <div className="provider-settings-grid">
              <section>
                <h3>{c.modalities}</h3>
                <p>{dashboard?.interventionModes?.length?dashboard.interventionModes.map(mode=>interventionModeLabel(mode,locale)).join(" · "):c.unset}</p><Link className="client-text-link" href={`/${locale}/sous-traitant/qualification${query}#intervention`}>{locale==="ar"?"تعديل الكيفيات":"Modifier les modalités"}</Link>
                <p className="client-access-note">{locale==="ar"?"القدرة الحالية":"Disponibilité actuelle"}: {capacityStatus==="MIXED"?(locale==="ar"?"تختلف حسب الخدمة":"Variable selon le service"):capacityStatus==="FULL"?(locale==="ar"?"ممتلئة":"Complète"):capacityStatus==="PAUSED"?(locale==="ar"?"متوقفة":"En pause"):capacityStatus==="LIMITED"?(locale==="ar"?"محدودة":"Limitée"):capacityStatus==="AVAILABLE"?(locale==="ar"?"متاحة":"Disponible"):c.unset}</p>
              </section>
              <section>
                <h3><MapPin className="size-4" aria-hidden /> {c.zones}</h3>
                <p>{c.zonesLead}</p>
                <p className="provider-settings-zones">{zones}</p>
              </section>
            </div>
          </article>

          <article className="client-card" id="notifications">
            <header className="client-priority-head">
              <div>
                <h2><Bell className="size-4" aria-hidden /> {c.notifTitle}</h2>
                <p>{c.notifLead}</p>
              </div>
              <Link href={`/${locale}/notifications${query}`} className="client-text-link">{c.openCenter}</Link>
            </header>
            {!notifications ? (
              <p role="status">{locale === "ar" ? "تعذر تحميل تفضيلات الإشعارات." : "Impossible de charger les préférences de notification."}</p>
            ) : (
              <>
                <p className="client-access-note">{c.saveHint}</p>
                <div className="provider-settings-notif">
                  {notifications.categories
                    .filter((category) => !/ADMIN|FRANCHISE|DIAGNOSTIC/i.test(category.code))
                    .map((category) => (
                    <section key={category.code} className="provider-settings-notif-card">
                      <header>
                        <h3>{category.label}</h3>
                        {category.mandatory ? <span className="client-status-chip" data-tone="peach">{n.mandatory}</span> : null}
                      </header>
                      <div className="space-y-3">
                        {(["IN_APP", "EMAIL"] as const).map((channel) => (
                          <PreferenceForm
                            key={`${category.code}-${channel}`}
                            organizationId={notifications.organizationId}
                            categoryCode={category.code}
                            channel={channel}
                            mandatory={category.mandatory}
                            current={notifications.preferences.find((p) => p.category_code === category.code && p.channel === channel)}
                            locale={locale}
                            keyValue={crypto.randomUUID()}
                            m={n}
                          />
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              </>
            )}
          </article>
        </div>
      </div>
    </main>
  );
}
