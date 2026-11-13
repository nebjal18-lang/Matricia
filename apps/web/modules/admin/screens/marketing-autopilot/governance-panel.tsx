"use client";

import { useActionState } from "react";
import { Button } from "@/modules/shared/ui/button";
import { Input } from "@/modules/shared/ui/input";
import type { MarketingGovernance } from "@/modules/shared/lib/marketing-autopilot/governance-repository";
import type { MarketingDashboard } from "@/modules/shared/lib/marketing-autopilot/model";
import { recordBrandAuthorization, recordConnectionSecurity, setKillSwitch, type MarketingActionState } from "./actions";

const idle: MarketingActionState = { status: "idle" };
const control = "min-h-11 rounded-md border bg-background px-3";
function Hidden({ locale, keyValue }: { locale: "fr" | "ar"; keyValue: string }) { return <><input type="hidden" name="locale" value={locale}/><input type="hidden" name="idempotencyKey" value={keyValue}/></>; }
function Feedback({ state, ar }: { state: MarketingActionState; ar: boolean }) { return <p aria-live="polite" role={state.status === "error" ? "alert" : "status"}>{state.status === "success" ? (ar ? "تم التسجيل." : "Décision enregistrée.") : state.status === "error" ? (ar ? "تعذر تنفيذ القرار. تحقق من الحقول والصلاحيات." : "Décision non exécutée. Vérifiez les champs et les droits.") : ""}</p>; }

export function GovernancePanel({ dashboard, data, locale, keys }: { dashboard: MarketingDashboard; data: MarketingGovernance; locale: "fr" | "ar"; keys: Record<string, string> }) {
  const ar = locale === "ar";
  const noOrganizations = dashboard.organizations.length === 0;
  const noConnections = dashboard.connections.length === 0;
  const [authorizationState, authorizationAction, authorizationPending] = useActionState(recordBrandAuthorization, idle);
  const [securityState, securityAction, securityPending] = useActionState(recordConnectionSecurity, idle);
  const [stopState, stopAction, stopPending] = useActionState(setKillSwitch, idle);
  return <section id="gouvernance" aria-labelledby="marketing-governance" className="scroll-mt-24 rounded-2xl border bg-card p-4 sm:p-6">
    <h2 id="marketing-governance" className="text-2xl font-semibold">{ar ? "تفويضات وأمان النشر" : "Autorisations et sécurité des publications"}</h2>
    <p className="mt-2 text-sm text-muted-foreground">{ar ? "سجّل القرارات المهنية فقط. يبني الخادم الأدلة التقنية من السياق والبيانات المحفوظة." : "Saisissez les décisions métier. Le serveur construit les preuves techniques à partir du contexte et des données enregistrées."}</p>
    <div className="mt-5 grid gap-5 xl:grid-cols-3">
      <form action={authorizationAction} className="grid content-start gap-3">
        <h3 className="font-semibold">{ar ? "تفويض العلامة" : "Autorisation de marque"}</h3>
        <Hidden locale={locale} keyValue={keys.brandAuthorization}/>
        {noOrganizations ? <p className="text-sm text-muted-foreground">{ar ? "لا مؤسسة متاحة." : "Aucune organisation disponible."}</p> : null}
        <select aria-label={ar ? "المؤسسة" : "Organisation"} name="organizationId" className={control} disabled={noOrganizations} required={!noOrganizations}>{dashboard.organizations.map(organization => <option key={organization.id} value={organization.id}>{organization.name}</option>)}</select>
        <select aria-label={ar ? "القرار" : "Décision"} name="decision" className={control}><option value="GRANTED">{ar ? "منح التفويض" : "Accorder"}</option><option value="WITHDRAWN">{ar ? "سحب التفويض" : "Retirer"}</option></select>
        <select aria-label={ar ? "نطاق التفويض" : "Portée de l’autorisation"} name="authorizationScope" className={control}><option value="CONTENT_ONLY">{ar ? "إنشاء المحتوى فقط" : "Création de contenu uniquement"}</option><option value="CONTENT_AND_SOCIAL">{ar ? "المحتوى والنشر الاجتماعي" : "Contenu et publication sociale"}</option></select>
        <select aria-label={ar ? "مصدر التفويض" : "Source de l’autorisation"} name="authorizationSource" className={control}><option value="SIGNED_MANDATE">{ar ? "تفويض موقع" : "Mandat signé"}</option><option value="BOARD_DECISION">{ar ? "قرار إداري" : "Décision de gouvernance"}</option><option value="AUTHORIZED_EMAIL">{ar ? "بريد من مسؤول مخول" : "Courriel d’un responsable autorisé"}</option></select>
        <Input aria-label={ar ? "سبب القرار" : "Motif de l’autorisation"} name="authorizationReason" minLength={3} maxLength={500} required/>
        <Input aria-label={ar ? "بداية الصلاحية" : "Début de validité"} name="effectiveFrom" type="datetime-local" required/>
        <Input aria-label={ar ? "نهاية الصلاحية" : "Fin de validité"} name="effectiveUntil" type="datetime-local"/>
        <Button disabled={authorizationPending || noOrganizations}>{ar ? "تسجيل القرار" : "Enregistrer la décision"}</Button>
        <Feedback state={authorizationState} ar={ar}/>
      </form>
      <form id="connexions" action={securityAction} className="grid scroll-mt-24 content-start gap-3">
        <h3 className="font-semibold">{ar ? "حالة الاتصال الاجتماعي" : "État de la connexion sociale"}</h3>
        <p className="text-sm text-muted-foreground">{ar ? "لا تدخل رمزاً أو سراً. يستخدم الخادم مرجع الاعتماد المحفوظ." : "Ne saisissez aucun jeton ni secret. Le serveur utilise la référence d’identification déjà conservée."}</p>
        <Hidden locale={locale} keyValue={keys.connectionSecurity}/>
        {noConnections ? <p className="text-sm text-muted-foreground">{ar ? "لا اتصال اجتماعي متاح." : "Aucune connexion sociale disponible."}</p> : null}
        <select aria-label={ar ? "الاتصال" : "Connexion"} name="connectionId" className={control} disabled={noConnections} required={!noConnections}>{dashboard.connections.map(connection => <option key={connection.id} value={connection.id}>{connection.provider}</option>)}</select>
        <select aria-label={ar ? "الحالة" : "Statut"} name="status" className={control}><option value="ACTIVE">{ar ? "نشط ومصرح" : "Active et autorisée"}</option><option value="ROTATION_REQUIRED">{ar ? "تجديد الاعتماد مطلوب" : "Renouvellement requis"}</option><option value="REVOKED">{ar ? "ملغاة" : "Révoquée"}</option></select>
        <Input aria-label={ar ? "سبب تغيير الحالة" : "Motif du changement d’état"} name="securityReason" minLength={3} maxLength={500} required/>
        <Input aria-label={ar ? "انتهاء الاعتماد" : "Expiration de l’autorisation"} name="expiresAt" type="datetime-local"/>
        <Button disabled={securityPending || noConnections}>{ar ? "تسجيل الحالة" : "Enregistrer l’état"}</Button>
        <Feedback state={securityState} ar={ar}/>
      </form>
      <form action={stopAction} className="grid content-start gap-3">
        <h3 className="font-semibold">{ar ? "إيقاف طارئ للنشر" : "Arrêt d’urgence des publications"}</h3>
        <Hidden locale={locale} keyValue={keys.killSwitch}/>
        <select aria-label={ar ? "المؤسسة" : "Organisation"} name="organizationId" className={control}><option value="">{ar ? "كل المنصة" : "Toute la plateforme"}</option>{dashboard.organizations.map(organization => <option key={organization.id} value={organization.id}>{organization.name}</option>)}</select>
        <select aria-label={ar ? "النطاق" : "Portée"} name="scope" className={control}><option value="GLOBAL">{ar ? "كل مزودي النشر" : "Tous les fournisseurs"}</option><option value="PROVIDER">{ar ? "مزود واحد" : "Un fournisseur"}</option></select>
        <select aria-label={ar ? "مزود النشر عند اختيار مزود واحد" : "Fournisseur si la portée est limitée"} name="provider" className={control}><option value="">{ar ? "غير محدد" : "Non applicable"}</option><option value="LINKEDIN">LinkedIn</option><option value="META">Meta</option></select>
        <select aria-label={ar ? "القرار" : "Décision"} name="enabled" className={control}><option value="yes">{ar ? "إيقاف النشر" : "Suspendre les publications"}</option><option value="no">{ar ? "استئناف النشر" : "Autoriser la reprise"}</option></select>
        <select aria-label={ar ? "مصدر القرار" : "Source de la décision"} name="decisionSource" className={control}><option value="SECURITY_INCIDENT">{ar ? "حادث أمني" : "Incident de sécurité"}</option><option value="COMPLIANCE_DECISION">{ar ? "قرار امتثال" : "Décision de conformité"}</option><option value="OPERATIONAL_SAFETY">{ar ? "حماية تشغيلية" : "Protection opérationnelle"}</option><option value="RESUME_APPROVED">{ar ? "استئناف معتمد" : "Reprise approuvée"}</option></select>
        <Input aria-label={ar ? "سبب مفصل" : "Motif détaillé"} name="reason" minLength={3} maxLength={1000} required/>
        <Button disabled={stopPending}>{ar ? "تطبيق القرار" : "Appliquer la décision"}</Button>
        <Feedback state={stopState} ar={ar}/>
      </form>
    </div>
    <p className="mt-5 text-sm">{ar ? "التفويضات" : "Autorisations"}: {data.authorizations.length} · {ar ? "نسخ الأمان" : "Versions de sécurité"}: {data.securityVersions.length} · {ar ? "عمليات الإيقاف النشطة" : "Arrêts actifs"}: {data.killSwitches.filter(value => value.enabled).length}</p>
  </section>;
}
