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
    mandate: "Mandat de bibliothèque", chooseMandate: "Choisir un mandat",
    mandateTitle: "Choisissez le mandat à consulter", mandateHelp: "Plusieurs mandats sont autorisés dans cette organisation. Choisissez le territoire indiqué avec sa bibliothèque et votre rôle avant de poursuivre.",
    noMandateTitle: "Aucun mandat de bibliothèque actif accessible",
    noMandateHelp: "Ce compte ne dispose pas actuellement d’un mandat actif permettant de gérer une bibliothèque de services professionnels.",
    regularize: "Pour commencer, déposez une candidature. Si votre dossier est déjà validé, demandez à Matricia de vérifier votre organisation, votre rôle et l’affectation du mandat signé avant son activation.",
    apply: "Déposer une candidature", contact: "Contacter Matricia pour vérifier mon accès",
  },
  ar: {
    organization: "مؤسسة الامتياز", choose: "اختيار مؤسسة", show: "عرض",
    selectTitle: "اختاروا مؤسسة الامتياز",
    selectHelp: "يرتبط حسابكم بعدة مؤسسات مصرح بها. اختاروا المؤسسة التي ترغبون في الاطلاع على نطاقها.",
    mandate: "تكليف المكتبة", chooseMandate: "اختيار تكليف",
    mandateTitle: "اختاروا التكليف المطلوب", mandateHelp: "تتوفرون على عدة تكليفات مصرح بها داخل هذه المؤسسة. اختاروا النطاق المبيّن مع مكتبته ودوركم قبل المتابعة.",
    noMandateTitle: "لا يوجد تكليف نشط بمكتبة متاح لهذا الحساب",
    noMandateHelp: "لا يملك هذا الحساب حالياً تكليفاً نشطاً يتيح تدبير مكتبة للخدمات المهنية.",
    regularize: "للبدء، أودعوا ترشيحاً. إذا صودق على ملفكم، اطلبوا من ماتريسيا التحقق من مؤسستكم ودوركم وإسناد التكليف الموقّع قبل تفعيله.",
    apply: "إيداع ترشيح", contact: "التواصل مع ماتريسيا للتحقق من صلاحية الولوج",
  },
} as const;

export function FranchiseMandateSelector({locale, mandates, organizationId, selectedFranchiseId, returnPath}: {
  locale: Locale; mandates?: Array<{id:string;organizationId:string;label:string}>; organizationId:string|null; selectedFranchiseId:string|null; returnPath:string;
}) {
  const options = mandates?.filter(item => item.organizationId === organizationId) ?? [];
  if (options.length < 2) return null;
  const c=copy[locale];
  return <form dir={locale==="ar"?"rtl":"ltr"} method="get" action={returnPath.split("?")[0]} className="client-card mx-4 flex flex-wrap items-end gap-3" aria-label={c.mandate}>
    <input type="hidden" name="organizationId" value={organizationId ?? ""} />
    <div className="grid min-w-0 flex-1 gap-2"><Label htmlFor="franchise-mandate-context">{c.mandate}</Label>
      <NativeSelect id="franchise-mandate-context" name="franchiseId" required defaultValue={selectedFranchiseId ?? ""}>
        <option value="" disabled>{c.chooseMandate}</option>
        {options.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
      </NativeSelect>
    </div><Button type="submit">{c.show}</Button>
  </form>;
}

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
  if (reason !== "NO_MANDATE" && reason !== "ORGANIZATION_REQUIRED" && reason !== "MANDATE_REQUIRED") {
    return <WorkspaceFailure locale={locale} reason={reason} returnPath={returnPath} supportReference="FRANCHISE_LIBRARY" />;
  }
  return <main className="client-page">
    <Alert>
      <AlertTitle>{reason === "NO_MANDATE" ? c.noMandateTitle : reason === "MANDATE_REQUIRED" ? c.mandateTitle : c.selectTitle}</AlertTitle>
      <AlertDescription className="grid gap-4">
        <p>{reason === "NO_MANDATE" ? c.noMandateHelp : reason === "MANDATE_REQUIRED" ? c.mandateHelp : c.selectHelp}</p>
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
