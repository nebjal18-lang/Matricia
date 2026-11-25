"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { FranchiseApplicationStatus, MyFranchiseApplication } from "@/modules/franchise/data/candidature/repository";
import { organizationDisplayLabel } from "@/modules/shared/lib/directory-presentation";
import { moroccoRegionLabel } from "@/modules/shared/lib/geo/morocco-regions";
import { linkMyFranchiseApplicationOrganization, type CandidateLinkState } from "./actions";

const idle: CandidateLinkState = { status: "idle" };
const linkable: readonly FranchiseApplicationStatus[] = ["REGISTERED", "COMPANY_REVIEW", "DOCUMENT_REVIEW"];

const statusCopy: Record<FranchiseApplicationStatus, { fr: string; ar: string }> = {
  REGISTERED: { fr: "Inscrit", ar: "مسجّل" },
  COMPANY_REVIEW: { fr: "Revue de la société", ar: "مراجعة الشركة" },
  DOCUMENT_REVIEW: { fr: "Pièces demandées", ar: "الوثائق مطلوبة" },
  CLOSED: { fr: "Clos", ar: "مغلق" },
  CONTRACT_PENDING: { fr: "Mandat proposé, en attente d’approbation", ar: "التفويض مقترح في انتظار الموافقة" },
  ENTRY_FEE_SETUP: { fr: "Droit d’entrée en préparation", ar: "إعداد رسم الدخول" },
  LIBRARY_ASSIGNED: { fr: "Mandat approuvé, à activer", ar: "التفويض معتمد وينتظر التفعيل" },
  ACTIVE: { fr: "Franchise active", ar: "الامتياز نشط" },
  FINANCIAL_RESTRICTED: { fr: "Restriction financière", ar: "تقييد مالي" },
  SUSPENDED: { fr: "Suspendue", ar: "موقوف" },
  TERMINATED: { fr: "Terminée", ar: "منتهٍ" },
};

function LinkOrganization({ locale, application, organizations, idempotencyKey }: { locale: "fr" | "ar"; application: MyFranchiseApplication; organizations: Array<{ id: string; name: string }>; idempotencyKey: string }) {
  const fr = locale === "fr";
  const [state, action, pending] = useActionState(linkMyFranchiseApplicationOrganization, idle);
  const createHref = `/${locale}/organisation?${new URLSearchParams({ role: "franchise", next: `/${locale}/franchise/candidature` })}`;
  const selectId = `organisation-${application.id}`;
  return (
    <div className="mt-3 grid gap-2">
      {organizations.length ? (
        <form action={action} className="grid gap-2">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="applicationId" value={application.id} />
          <input type="hidden" name="rowVersion" value={application.rowVersion} />
          <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
          <label htmlFor={selectId} className="text-sm font-medium">{fr ? "Société qui portera la franchise" : "الشركة التي ستحمل الامتياز"}</label>
          <select id={selectId} name="organizationId" required className="min-h-11 w-full rounded-md border bg-background px-3">
            {organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}
          </select>
          <button className="client-cta w-fit" disabled={pending || state.status === "success"}>{pending ? (fr ? "Rattachement…" : "جارٍ الربط…") : (fr ? "Rattacher cette société au dossier" : "ربط هذه الشركة بالملف")}</button>
        </form>
      ) : <p className="text-sm">{fr ? "Aucune société franchisée n’est encore rattachée à votre compte." : "لا توجد بعد شركة امتياز مرتبطة بحسابكم."}</p>}
      <Link className="client-ghost-link w-fit" href={createHref}>{fr ? "Créer la société franchisée" : "إنشاء شركة الامتياز"}</Link>
      {state.status === "success" ? <p role="status">{fr ? "Société rattachée. Matricia poursuit l’étude du dossier." : "تم ربط الشركة. تواصل ماتريسيا دراسة الملف."}</p> : null}
      {state.status === "error" ? <p role="alert">{state.reason === "CONFLICT" ? (fr ? "Le dossier a changé. Rechargez la page." : "تغيّر الملف. أعيدوا تحميل الصفحة.") : state.reason === "DENIED" ? (fr ? "Cette société ou ce dossier n’appartient pas à votre compte." : "هذه الشركة أو هذا الملف لا يخص حسابكم.") : (fr ? "Le rattachement n’a pas abouti. Réessayez." : "تعذر الربط. أعيدوا المحاولة.")}</p> : null}
    </div>
  );
}

export function MyFranchiseApplications({ locale, applications, organizations, idempotencyKeys }: { locale: "fr" | "ar"; applications: MyFranchiseApplication[]; organizations: Array<{ id: string; name: string }>; idempotencyKeys: Record<string, string> }) {
  const fr = locale === "fr";
  if (!applications.length) return null;
  return (
    <section aria-labelledby="mes-dossiers-franchise" className="public-wrap mt-10">
      <h2 id="mes-dossiers-franchise">{fr ? "Mes dossiers de candidature" : "ملفات ترشيحي"}</h2>
      <ul className="mt-4 grid gap-4">
        {applications.map((application) => (
          <li key={application.id} className="client-card">
            <p><strong dir="ltr">{application.reference}</strong> · {statusCopy[application.status][locale]}</p>
            <p className="text-sm text-slate-600">{moroccoRegionLabel(application.territoryCode, locale)} · {application.domainLabel}</p>
            {application.organizationId ? <p className="text-sm">{fr ? "Société rattachée : " : "الشركة المرتبطة: "}{application.organizationName ? organizationDisplayLabel(application.organizationName, locale) : (fr ? "société de votre compte" : "شركة من حسابكم")}</p> : null}
            {!application.organizationId && linkable.includes(application.status) ? <LinkOrganization locale={locale} application={application} organizations={organizations} idempotencyKey={idempotencyKeys[application.id] ?? application.id} /> : null}
            {application.invitationId && ["CONTRACT_PENDING", "LIBRARY_ASSIGNED"].includes(application.status) ? (
              <p className="mt-3">
                <Link className="client-cta" href={`/${locale}/franchise/invitations/${application.invitationId}`}>
                  {application.status === "LIBRARY_ASSIGNED" ? (fr ? "Activer mon mandat" : "تفعيل تفويضي") : (fr ? "Consulter le mandat proposé" : "الاطلاع على التفويض المقترح")}
                </Link>
              </p>
            ) : null}
            {application.status === "ACTIVE" ? <p className="mt-3"><Link className="client-cta" href={`/${locale}/franchise/accueil`}>{fr ? "Ouvrir mon espace franchise" : "فتح فضاء الامتياز"}</Link></p> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
