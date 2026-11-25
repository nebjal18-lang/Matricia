"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useTransition } from "react";
import { actorOrganizationLabel, isAdminOrgDirectoryFixture } from "@/modules/admin/data/spaces/actor-presentation";
import { localizeStatus } from "@/modules/admin/data/spaces/view-model";
import { HashAwareLink } from "@/modules/shared/ui/hash-nav";
import type { FinanceAuditOrganizationContext } from "./audit-organization-context";

export type FinanceWorkshop = "hub" | "offres" | "credits";

export function FinanceAuditOrganizationSelector({
  locale,
  context,
  workshop = "hub",
  preserveParams,
}: {
  locale: "fr" | "ar";
  context: FinanceAuditOrganizationContext;
  workshop?: FinanceWorkshop;
  /** Keep territory/subject (etc.) when unlocking the org context. */
  preserveParams?: Record<string, string | null | undefined>;
}) {
  const ar = locale === "ar";
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const organizations = context.organizations.filter((row) => !isAdminOrgDirectoryFixture(row.display_name, row.legal_name));
  const visible = organizations.length ? organizations : context.organizations;
  const selected = context.organizationId
    ? visible.find((row) => row.id === context.organizationId)
    : null;
  const landHash = workshop === "offres" ? "#boxes" : workshop === "credits" ? "#credits" : "";

  function workshopPath(organizationId: string) {
    const params = new URLSearchParams();
    params.set("organizationId", organizationId);
    for (const [key, value] of Object.entries(preserveParams ?? {})) {
      if (value?.trim()) params.set(key, value.trim());
    }
    const q = `?${params.toString()}`;
    if (workshop === "credits") return `/${locale}/administration/finance/credits${q}${landHash}`;
    if (workshop === "offres") return `/${locale}/administration/finance/offres${q}${landHash}`;
    return `/${locale}/administration/finance${q}`;
  }

  function confirmOrganization(organizationId: string) {
    const href = workshopPath(organizationId);
    startTransition(() => {
      router.replace(href);
    });
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const organizationId = String(data.get("organizationId") ?? "");
    if (!organizationId) return;
    confirmOrganization(organizationId);
  }

  const lead =
    workshop === "credits"
      ? ar
        ? "اختاروا المؤسسة لفتح الحزم والمنح على حسابها."
        : "Choisissez l’entreprise pour ouvrir packs et attributions sur son compte."
      : workshop === "offres"
        ? ar
          ? "اختاروا المؤسسة ثم أكّدوا لفتح ورشة إنشاء العرض (خدمات + Box)."
          : "Choisissez l’entreprise puis confirmez pour ouvrir l’atelier de création d’offre (services + Box)."
        : ar
          ? "اختاروا المؤسسة المرجعية لقراءة المدفوعات والملفات المرتبطة."
          : "Choisissez l’entreprise de référence pour lire les paiements et dossiers liés.";

  const confirmLabel =
    workshop === "credits"
      ? ar
        ? "فتح حزم الأرصدة"
        : "Ouvrir Packs crédits"
      : workshop === "offres"
        ? ar
          ? "فتح ورشة العرض"
          : "Ouvrir l’atelier d’offre"
        : ar
          ? "تأكيد المؤسسة"
          : "Confirmer l’entreprise";

  const chooseHint =
    workshop === "hub"
      ? ar
        ? "بعد التأكيد تُحدَّث هذه الصفحة بالمؤسسة المختارة."
        : "Après confirmation, cette page se met à jour avec l’entreprise choisie."
      : workshop === "credits"
        ? ar
          ? "بعد التأكيد تُفتح نماذج الحزم والمنح."
          : "Après confirmation, les formulaires packs et attributions s’ouvrent."
        : ar
          ? "بعد التأكيد تُفتح ورشة إنشاء العرض."
          : "Après confirmation, l’atelier de création d’offre s’ouvre.";

  return (
    <section id="finance-contexte" className="admin-panel scroll-mt-24 space-y-3" data-tone="peach" aria-labelledby="finance-audit-organization-title">
      <div className="admin-section-head">
        <div>
          <h2 id="finance-audit-organization-title">{ar ? "المؤسسة المرجعية" : "Entreprise de référence"}</h2>
          <p>{lead}</p>
        </div>
      </div>
      {context.state === "UNAVAILABLE" ? (
        <p role="alert">
          {ar
            ? "تعذّر تحميل المؤسسات المصرّح بها. يمكنكم متابعة قراءة السجلات، لكن لا يمكن تأكيد سياق الإعداد. أعيدوا تحميل الصفحة."
            : "Impossible de charger les entreprises autorisées. Vous pouvez toujours lire les enregistrements, mais le contexte de configuration n’est pas confirmé. Rechargez la page."}
        </p>
      ) : visible.length ? (
        <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
          <label className="grid min-w-[16rem] flex-1 gap-1 text-sm font-medium" htmlFor="finance-audit-organization">
            <span>{ar ? "المؤسسة" : "Entreprise"}</span>
            <select
              id="finance-audit-organization"
              name="organizationId"
              defaultValue={context.organizationId ?? ""}
              required
              className="min-h-11 w-full rounded-lg border bg-background px-3 py-2"
            >
              <option value="" disabled>
                {ar ? "اختيار مؤسسة" : "Choisir une entreprise"}
              </option>
              {visible.map((row) => (
                <option key={row.id} value={row.id}>
                  {actorOrganizationLabel(row.display_name || row.legal_name, locale)} · {localizeStatus(row.status, locale)}
                </option>
              ))}
            </select>
          </label>
          <button className="admin-btn-primary min-h-11" type="submit" disabled={pending}>
            {pending ? (ar ? "جارٍ الفتح…" : "Ouverture…") : confirmLabel}
          </button>
        </form>
      ) : (
        <p role="status">
          {ar
            ? "لا توجد مؤسسة ظاهرة. أنشئوا المؤسسة أولاً، أكملوا مسار الموافقة، ثم عودوا لاختيارها هنا."
            : "Aucune entreprise visible. Créez d’abord l’entreprise, terminez son parcours d’approbation, puis revenez la sélectionner ici."}
        </p>
      )}
      {context.state === "INVALID" ? (
        <p role="alert">
          {ar
            ? "الاختيار غير صالح أو خارج صلاحياتكم. اختاروا مؤسسة من القائمة."
            : "La sélection est invalide ou hors de votre périmètre. Choisissez une entreprise dans la liste."}
        </p>
      ) : null}
      {context.state === "READY" && selected ? (
        <div className="admin-notice flex flex-wrap items-center justify-between gap-3">
          <p role="status">
            {ar
              ? `جاهز لـ «${actorOrganizationLabel(selected.display_name || selected.legal_name, locale)}».`
              : `Prêt pour « ${actorOrganizationLabel(selected.display_name || selected.legal_name, locale)} ».`}
          </p>
          {workshop === "hub" ? (
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/${locale}/administration/finance/offres?organizationId=${encodeURIComponent(selected.id)}#boxes`}
                className="admin-btn-primary min-h-11 inline-flex items-center"
              >
                {ar ? "ورشة العروض" : "Atelier des offres"}
              </Link>
              <Link
                href={`/${locale}/administration/finance/credits?organizationId=${encodeURIComponent(selected.id)}#credits`}
                className="admin-soft-cta min-h-11 inline-flex items-center"
              >
                {ar ? "حزم الأرصدة" : "Packs crédits"}
              </Link>
            </div>
          ) : landHash ? (
            <HashAwareLink href={landHash} className="admin-btn-primary min-h-11 inline-flex items-center">
              {workshop === "offres"
                ? ar
                  ? "الانتقال إلى الورشة"
                  : "Aller à l’atelier"
                : ar
                  ? "الانتقال إلى الحزم"
                  : "Aller aux packs"}
            </HashAwareLink>
          ) : (
            <p className="text-sm font-medium">{ar ? "النماذج متاحة أدناه." : "Les formulaires sont disponibles ci-dessous."}</p>
          )}
        </div>
      ) : null}
      {context.state === "CHOOSE" ? <p role="status">{chooseHint}</p> : null}
      {context.state !== "UNAVAILABLE" ? (
        <Link href={`/${locale}/administration/entreprises/nouvelle`} className="inline-flex min-h-11 items-center underline">
          {ar ? "إنشاء مؤسسة مرجعية" : "Créer une entreprise de référence"}
        </Link>
      ) : null}
    </section>
  );
}
