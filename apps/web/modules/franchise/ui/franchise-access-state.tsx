import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/modules/shared/ui/alert";
import { Button } from "@/modules/shared/ui/button";
import { Label } from "@/modules/shared/ui/label";
import { NativeSelect } from "@/modules/shared/ui/native-select";
import { WorkspaceFailure } from "@/modules/shared/ui/workspace-failure";
import type { FranchiseLibraryLoadResult } from "@/modules/franchise/data/library/workspace-model";
import type { Locale } from "@/modules/shared/lib/i18n/locale";

const copy = {
  fr: {
    organization: "Organisation franchisée", choose: "Choisir une organisation", show: "Afficher",
    selectTitle: "Choisissez votre organisation franchisée",
    selectHelp: "Plusieurs organisations sont autorisées pour votre compte. Sélectionnez celle dont vous souhaitez consulter le périmètre.",
    noMandateTitle: "Aucun mandat de bibliothèque actif accessible",
    noMandateHelp: "Ce compte ne dispose pas actuellement d’un mandat actif permettant de gérer une bibliothèque de services professionnels.",
    regularize: "Pour commencer, déposez une candidature. Si votre dossier est déjà validé, demandez à Matricia de vérifier votre organisation, votre rôle et l’affectation du mandat signé avant son activation.",
    apply: "Déposer une candidature", contact: "Contacter Matricia pour vérifier mon accès",
  },
  ar: {
    organization: "مؤسسة الامتياز", choose: "اختيار مؤسسة", show: "عرض",
    selectTitle: "اختاروا مؤسسة الامتياز",
    selectHelp: "يرتبط حسابكم بعدة مؤسسات مصرح بها. اختاروا المؤسسة التي ترغبون في الاطلاع على نطاقها.",
    noMandateTitle: "لا يوجد تكليف نشط بمكتبة متاح لهذا الحساب",
    noMandateHelp: "لا يملك هذا الحساب حالياً تكليفاً نشطاً يتيح تدبير مكتبة للخدمات المهنية.",
    regularize: "للبدء، أودعوا ترشيحاً. إذا صودق على ملفكم، اطلبوا من ماتريسيا التحقق من مؤسستكم ودوركم وإسناد التكليف الموقّع قبل تفعيله.",
    apply: "إيداع ترشيح", contact: "التواصل مع ماتريسيا للتحقق من صلاحية الولوج",
  },
} as const;

export function FranchiseOrganizationSelector({ locale, organizations, selectedOrganizationId, returnPath }: {
  locale: Locale; organizations: Array<{ id: string; name: string }>; selectedOrganizationId: string | null; returnPath: string;
}) {
  if (organizations.length < 2) return null;
  const c = copy[locale];
  return <form method="get" action={returnPath} className="client-card mx-4 flex flex-wrap items-end gap-3" aria-label={c.organization}>
    <div className="grid min-w-0 flex-1 gap-2">
      <Label htmlFor="franchise-organization-context">{c.organization}</Label>
      <NativeSelect id="franchise-organization-context" name="organizationId" required defaultValue={selectedOrganizationId ?? ""}>
        <option value="" disabled>{c.choose}</option>
        {organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}
      </NativeSelect>
    </div>
    <Button type="submit">{c.show}</Button>
  </form>;
}

export function FranchiseAccessState({ locale, reason, returnPath }: {
  locale: Locale; reason: Extract<FranchiseLibraryLoadResult, { status: "error" }>["reason"]; returnPath: string;
}) {
  const c = copy[locale];
  if (reason !== "NO_MANDATE" && reason !== "ORGANIZATION_REQUIRED") {
    return <WorkspaceFailure locale={locale} reason={reason} returnPath={returnPath} supportReference="FRANCHISE_LIBRARY" />;
  }
  return <main className="client-page">
    <Alert>
      <AlertTitle>{reason === "NO_MANDATE" ? c.noMandateTitle : c.selectTitle}</AlertTitle>
      <AlertDescription className="grid gap-4">
        <p>{reason === "NO_MANDATE" ? c.noMandateHelp : c.selectHelp}</p>
        {reason === "NO_MANDATE" ? <>
          <p>{c.regularize}</p>
          <div className="flex flex-wrap gap-3">
            <Link href={`/${locale}/franchise/candidature`} className="client-cta">{c.apply}</Link>
            <Link href={`/${locale}/contact`} className="client-cta-soft">{c.contact}</Link>
          </div>
        </> : null}
      </AlertDescription>
    </Alert>
  </main>;
}
