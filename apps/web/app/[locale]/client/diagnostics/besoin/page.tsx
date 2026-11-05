import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import { ArrowLeft, ArrowRight, Target } from "lucide-react";
import { resolveClientSpace } from "@/modules/client/data/spaces/context";
import { spaceCopy } from "@/modules/client/data/spaces/copy";
import { ClientAppShell } from "@/modules/client/ui/client-app-shell";
import { isLocale } from "@/modules/shared/lib/i18n/locale";
import "@/modules/client/screens/diagnostics/diagnostic-connected.css";

export default async function PriorityToNeedPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ organizationId?: string; priority?: string; runId?: string }>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const space = await resolveClientSpace({ locale, organizationId: query.organizationId });
  if (space.status === "unauthenticated") redirect(connexionHref(locale, { next: `/${locale}/client/diagnostics/besoin` }));
  const c = spaceCopy(locale);
  const needHref = `/${locale}/besoin?source=diagnostic&priority=${encodeURIComponent(query.priority ?? "")}${space.selectedOrganizationId ? `&organizationId=${space.selectedOrganizationId}` : ""}`;
  const backHref = query.runId
    ? `/${locale}/client/diagnostics/${query.runId}${space.selectedQuery}`
    : `/${locale}/client/diagnostics${space.selectedQuery}`;
  const t = locale === "fr"
    ? {
        crumb: "Mes diagnostics > Transformer une priorité en besoin",
        title: "Transformer une priorité en besoin",
        lead: "Transformez un constat de votre diagnostic en un besoin concret pour trouver les bons partenaires.",
        quote: "Des diagnostics au service d’un Maroc qui entreprend.",
        context: "Contexte de votre priorité",
        contextBody: query.priority?.trim() || "Priorité issue de votre diagnostic versionné",
        define: "Définissez votre objectif",
        defineLead: "Précisez ce que vous souhaitez atteindre. Aucun prestataire n’est contacté sans votre confirmation.",
        understood: "Voici ce que Matricia a compris",
        understoodLead: "Vérifiez les informations avant de préparer la demande.",
        continue: "Continuer vers la description du besoin",
        back: "Revenir au diagnostic",
        notice: "Aucune consultation de prestataire ne sera envoyée avant votre confirmation finale.",
      }
    : {
        crumb: "تشخيصاتي > تحويل أولوية إلى احتياج",
        title: "تحويل أولوية إلى احتياج",
        lead: "حوّلوا ملاحظة من تشخيصكم إلى احتياج ملموس لإيجاد الشركاء المناسبين.",
        quote: "تشخيصات في خدمة مغرب يبادر.",
        context: "سياق أولويتكم",
        contextBody: query.priority?.trim() || "أولوية من تشخيصكم ذي الإصدار",
        define: "حددوا هدفكم",
        defineLead: "وضحوا ما تريدون بلوغه. لا يُتصل بأي مقدم خدمة دون تأكيدكم.",
        understood: "هذا ما فهمته ماتريسيا",
        understoodLead: "تحققوا من المعلومات قبل إعداد الطلب.",
        continue: "المتابعة إلى وصف الاحتياج",
        back: "العودة إلى التشخيص",
        notice: "لن تُرسل أي استشارة لمقدم خدمة قبل تأكيدكم النهائي.",
      };

  return (
    <ClientAppShell locale={locale} selectedQuery={space.selectedQuery} selectedOrganizationId={space.selectedOrganizationId} userEmail={space.userEmail} organizationName={space.organizationName} organizations={space.organizations} active="needs" kicker={c.kicker}>
      <main className="client-page">
        <div className="diag-conn">
          <header className="diag-conn-hero">
            <div>
              <p className="diag-conn-crumb">{t.crumb}</p>
              <h1>{t.title}</h1>
              <p>{t.lead}</p>
            </div>
            <p className="diag-conn-quote">« {t.quote} »</p>
          </header>

          <div className="diag-conn-grid4" style={{ gridTemplateColumns: "minmax(0,.9fr) minmax(0,1.3fr) minmax(0,1fr)" }}>
            <section className="diag-conn-card">
              <h2><Target size={18} color="#c2410c" aria-hidden />{t.context}</h2>
              <p style={{ marginTop: 12 }}>{t.contextBody}</p>
              <span className="diag-conn-badge" data-tone="coral" style={{ marginTop: 10 }}>{locale === "fr" ? "Priorité élevée" : "أولوية مرتفعة"}</span>
              <Link href={backHref} className="diag-conn-btn-outline" style={{ marginTop: 16, justifyContent: "center" }}><ArrowLeft className="rtl-mirror" size={15} aria-hidden />{t.back}</Link>
            </section>
            <section className="diag-conn-card">
              <h2>{t.define}</h2>
              <p style={{ marginTop: 8, color: "var(--diag-muted)" }}>{t.defineLead}</p>
              <div className="diag-conn-callout" data-tone="mint" style={{ marginTop: 14 }}>{t.notice}</div>
              <Link href={needHref} className="diag-conn-btn-grad" style={{ marginTop: 16, justifyContent: "center" }}>
                {t.continue}<ArrowRight className="rtl-mirror" size={16} aria-hidden />
              </Link>
            </section>
            <section className="diag-conn-card">
              <h2>{t.understood}</h2>
              <p style={{ marginTop: 8, color: "var(--diag-muted)" }}>{t.understoodLead}</p>
              <dl className="diag-conn-list" style={{ marginTop: 12 }}>
                <div><dt style={{ color: "#5e6a93", fontSize: "0.75rem" }}>{locale === "fr" ? "Priorité" : "الأولوية"}</dt><dd>{t.contextBody}</dd></div>
                <div><dt style={{ color: "#5e6a93", fontSize: "0.75rem" }}>{locale === "fr" ? "Organisation" : "المؤسسة"}</dt><dd>{space.organizationName ?? "—"}</dd></div>
              </dl>
            </section>
          </div>
        </div>
      </main>
    </ClientAppShell>
  );
}
