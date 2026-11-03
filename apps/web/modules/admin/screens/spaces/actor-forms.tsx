"use client";

import{ProductionReference}from"./production-reference";
import { organizationRoleGates } from "@/modules/admin/data/spaces/role-preview";
import { useActionState, useState, useId, type ReactNode } from "react";
import Link from "next/link";
import type { InvitationOrganization, InvitationRole } from "@/app/[locale]/invitations/actions";
import { getInvitationMessages } from "@/app/[locale]/invitations/messages";
import { actorCopy } from "@/modules/admin/data/spaces/actors-copy";
import { adminCopy } from "@/modules/admin/data/spaces/copy";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import { requestActorMutation, submitActorInvitation, type ActorInviteState, type AdminActionState } from "./actor-actions";

const idleInvite: ActorInviteState = { status: "idle" };
const idle: AdminActionState = { status: "idle" };

const roles: InvitationRole[] = [
  "CLIENT_OWNER", "CLIENT_ADMIN", "CLIENT_BUYER", "CLIENT_ACCOUNTING", "CLIENT_MEMBER", "CLIENT_VIEWER",
  "PROVIDER_OWNER", "PROVIDER_MANAGER", "PROVIDER_SALES", "PROVIDER_TECHNICIAN", "PROVIDER_ACCOUNTING", "PROVIDER_VIEWER",
  "FRANCHISE_OWNER", "FRANCHISE_MANAGER", "FRANCHISE_EXPERT", "FRANCHISE_PROVIDER_MANAGER", "FRANCHISE_ACCOUNTING", "FRANCHISE_VIEWER",
];

const capabilityGroups = {
  gUsers: ["seeUsers", "createUsers", "editUsers", "manageRoles", "sendInvites"],
  gOrgs: ["seeOrgs", "editOrgs", "manageMandates", "manageTerritories", "accessDocs"],
  gData: ["readData", "exportData", "sensitiveData", "financeData", "complianceData"],
  gAdmin: ["settings", "security", "auditLogs", "integrations"],
  gBiz: ["catalog", "rules", "validateJourneys", "providers"],
  gOther: ["api", "webhooks", "readOnly", "support"],
} as const;

function Field({ id, label, hint, required, span, children }: { id: string; label: string; hint?: string; required?: boolean; span?: boolean; children: ReactNode }) {
  return (
    <div className="admin-field" data-span={span ? "2" : undefined}>
      <label htmlFor={id}>{label}{required ? " *" : ""}</label>
      {children}
      {hint ? <p className="client-access-note">{hint}</p> : null}
    </div>
  );
}

function Feedback({ state, locale, success }: { state: { status: string; reason?: string; outcome?: string }; locale: Locale; success: string }) {
  const a = actorCopy(locale);
  if (state.status === "success") return <p className="admin-banner" data-tone="ok" role="status">{success}</p>;
  if (state.status !== "error") return null;
  if (state.reason === "CONFLICT") return <p className="admin-banner" data-tone="danger" role="alert">{a.tooMany}</p>;
  return <p className="admin-banner" data-tone="danger" role="alert">{state.reason ?? a.tooMany}</p>;
}

export function InviteUserForm({
  locale,
  query,
  organizations,
  eligibleIds,
  defaultOrganizationId,
  defaultRole,
  roleFamily,
  franchises = [],
  idempotencyKey,invitationExpiresAt,
}: {
  locale: Locale;
  query: string;
  organizations: Array<{ id: string; displayName: string }>;
  eligibleIds: string[];
  defaultOrganizationId?: string;
  defaultRole?: string;
  roleFamily?: "PROVIDER";
  franchises?:Array<{id:string;organizationId:string;label:string}>;
  idempotencyKey?:string;invitationExpiresAt?:string;
}) {
  const a = actorCopy(locale);
  const c = adminCopy(locale);
  const formKey=useId();
  const inviteMessages = getInvitationMessages(locale);
  const [state, action, pending] = useActionState(submitActorInvitation, idleInvite);
  const [email, setEmail] = useState("");
  const [organizationId, setOrganizationId] = useState(defaultOrganizationId ?? organizations[0]?.id ?? "");
  const availableRoles = roleFamily ? roles.filter(role => role.startsWith(`${roleFamily}_`)) : roles;
  const [role, setRole] = useState(defaultRole && availableRoles.includes(defaultRole as InvitationRole) ? defaultRole : roleFamily === "PROVIDER" ? "PROVIDER_VIEWER" : "CLIENT_MEMBER");
  const [perimeter, setPerimeter] = useState("organization");
  const [inviteLocale, setInviteLocale] = useState(locale);
  const [message, setMessage] = useState("");
  const org = organizations.find((item) => item.id === organizationId);
  const canInvite = eligibleIds.includes(organizationId);
  const orgOptions: InvitationOrganization[] = organizations.map((item) => ({ id: item.id, displayName: item.displayName }));

  return (
    <form action={action} className="admin-form-layout">
      <input type="hidden" name="locale" value={locale} /><ProductionReference locale={locale}/>
      <input type="hidden" name="idempotencyKey" value={idempotencyKey??`admin-invite-${formKey}`} /><input type="hidden" name="invitationExpiresAt" value={invitationExpiresAt??""}/><input type="hidden" name="canInvite" value={canInvite ? "yes" : "no"} />
      <input type="hidden" name="roleCodes" value={role} />
      <input type="hidden" name="expiryDays" value="7" />
      <input type="hidden" name="reason" value="Invitation utilisateur soumise depuis l’administration Matricia." />
      <div className="client-stack">
        <article className="client-card">
          <header>
            <h2>{a.inviteInfo}</h2>
            <p>{a.inviteInfoLead}</p>
          </header>
          <div className="admin-form-grid">
            <Field id="invite-email" label={a.contact} hint={a.contactHint} required>
              <input id="invite-email" name="invitedEmail" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} dir="ltr" autoComplete="off" />
            </Field>
            <Field id="invite-org" label={c.orgTitle} hint={a.pickOrgHint} required>
              <select id="invite-org" name="organizationId" required value={organizationId} onChange={(event) => setOrganizationId(event.target.value)}>
                <option value="">{a.pickOrg}</option>
                {orgOptions.map((item) => <option key={item.id} value={item.id}>{item.displayName}</option>)}
              </select>
            </Field>
            <Field id="invite-role" label={a.requestedRole} hint={a.roleHint} required>
              <select id="invite-role" name="roleCode" required value={role} onChange={(event) => setRole(event.target.value)}>
                <option value="">{a.pickRole}</option>
                {availableRoles.map((item) => <option key={item} value={item}>{inviteMessages.roles[item]}</option>)}
              </select>
            </Field>
            {role.startsWith("FRANCHISE_")?<Field id="invite-franchise"label={locale==="ar"?"التفويض النشط للمؤسسة":"Mandat actif de l’organisation"}required><select id="invite-franchise"name="franchiseId"required><option value="">—</option>{franchises.filter((f)=>f.organizationId===organizationId).map((f)=><option key={f.id}value={f.id}>{f.label}</option>)}</select></Field>:null}
            <Field id="invite-perimeter" label={a.perimeter} hint={a.perimeterHint} required>
              <select id="invite-perimeter" name="perimeter" required value={perimeter} onChange={(event) => setPerimeter(event.target.value)}>
                <option value="organization">{org?.displayName || a.pickPerimeter}</option>
              </select>
            </Field>
            <div className="admin-field" data-span>
              <span>{a.inviteLang} *</span>
              <div className="admin-radio-row">
                <label><input type="radio" name="inviteLocale" value="fr" checked={inviteLocale === "fr"} onChange={() => setInviteLocale("fr")} /> Français (FR)</label>
                <label><input type="radio" name="inviteLocale" value="ar" checked={inviteLocale === "ar"} onChange={() => setInviteLocale("ar")} /> {locale === "ar" ? "العربية" : "Arabe (AR)"}</label>
              </div>
              <p className="client-access-note">{a.langHint}</p>
            </div>
            <Field id="invite-message" label={a.optionalMessage} span>
              <textarea id="invite-message" name="message" maxLength={500} value={message} onChange={(event) => setMessage(event.target.value)} />
              <p className="client-access-note">{message.length}/500</p>
            </Field>
          </div>
        </article>
        <div className="admin-form-foot">
          <Link href={`/${locale}/administration/utilisateurs${query}`} className="client-ghost-link">{c.cancel}</Link>
          {!roleFamily ? <button type="submit" name="intent" value="INVITE_DRAFT" className="admin-soft-cta" disabled={pending}>{c.saveDraft}</button> : null}
          <button type="submit" name="intent" value="INVITE_USER" className="admin-primary-cta" disabled={pending}>{pending ? "…" : roleFamily && !canInvite ? (locale === "ar" ? "إرسال طلب الدعوة للمراجعة" : "Soumettre la demande d’invitation") : a.sendInvite}</button>
        </div>
        <Feedback state={state} locale={locale} success={"outcome" in state ? (locale === "ar" ? "تم تسجيل الطلب؛ الدعوة قيد المراجعة المستقلة ولم تُنفّذ بعد." : "Demande enregistrée ; l’invitation reste en attente de revue indépendante et n’est pas encore exécutée.") : a.inviteSent} />
      </div>
      <aside className="client-stack">
        <article className="client-card">
          <header><h2>{a.inviteSummary}</h2><p>{a.inviteSummaryLead}</p></header>
          <dl className="admin-dl">
            <div><dt>{a.contact}</dt><dd>{email || "—"}</dd></div>
            <div><dt>{c.orgTitle}</dt><dd>{org?.displayName || "—"}</dd></div>
            <div><dt>{a.requestedRole}</dt><dd>{inviteMessages.roles[role as InvitationRole] ?? "—"}</dd></div>
            <div><dt>{a.perimeter}</dt><dd>{org?.displayName || "—"}</dd></div>
            <div><dt>{a.inviteLang}</dt><dd>{inviteLocale === "ar" ? "العربية" : "Français (FR)"}</dd></div>
            <div><dt>{a.optionalMessage}</dt><dd>{message || "—"}</dd></div>
          </dl>
        </article>
        <article className="admin-granted">
          <h2>{a.granted}</h2>
          <p>{a.grantedLead}</p>
          <ul>
            <li>{inviteMessages.roles[role as InvitationRole] ?? a.requestedRole}</li>
            <li>{a.sepOrgs}</li>
            <li>{a.leastPriv}</li>
            <li>{a.noCross}</li>
          </ul>
        </article>
        <article className="admin-attention">
          <h2>{a.attention}</h2>
          <ul>
            <li>{a.a1}</li>
            <li>{a.a2}</li>
            <li>{a.a3}</li>
          </ul>
        </article>
      </aside>
    </form>
  );
}

export function ActorIntentForm({
  locale,
  organizationId,
  resourceId,
  resourceType,
  intent,
  reason,
  label,
  tone = "ghost",
}: {
  locale: Locale;
  organizationId?: string;
  resourceId: string;
  resourceType: string;
  intent: "CHANGE_CONFIGURATION" | "RESTRICT_ENTITY" | "SUSPEND_ENTITY";
  reason: string;
  label: string;
  tone?: "ghost" | "danger" | "soft";
}) {
  const [state, action, pending] = useActionState(requestActorMutation, idle);
  return (
    <form action={action}>
      <input type="hidden" name="locale" value={locale} /><ProductionReference locale={locale}/>
      <input type="hidden" name="organizationId" value={organizationId ?? ""} />
      <input type="hidden" name="resourceId" value={resourceId} />
      <input type="hidden" name="resourceType" value={resourceType} />
      <input type="hidden" name="intent" value={intent} />
      <input type="hidden" name="reason" value={reason} />
      <button type="submit" className={tone === "danger" ? "admin-danger-cta" : tone === "soft" ? "admin-soft-cta" : "client-ghost-link"} disabled={pending}>{pending ? "…" : label}</button>
      {state.status === "success" ? <p role="status">{locale === "ar" ? "طلب مسجَّل." : "Demande enregistrée."}</p> : null}
    </form>
  );
}

export function EditUserRolesForm({
  locale,
  query,
  userId,
  organizationId,
  organizationName,
  currentRole,
  roleAssignments = [],
  franchises = [],
}: {
  locale: Locale;
  query: string;
  userId: string;
  organizationId: string;
  organizationName: string;
  currentRole: string;
  roleAssignments?:Array<{roleCode:string;franchiseId:string|null;franchiseLabel:string|null}>;
  franchises?:Array<{id:string;label:string}>;
}) {
  const a = actorCopy(locale);
  const c = adminCopy(locale);
  const inviteMessages = getInvitationMessages(locale);
  const [state, action, pending] = useActionState(requestActorMutation, idle);
  const[source,setSource]=useState(roleAssignments.length===0&&!currentRole?"add":"0");
  const chosen=roleAssignments[Number(source)];
  const sourceRole=source==="add"?"":chosen?.roleCode??currentRole;
  const sourceFranchise=source==="add"?null:chosen?.franchiseId??null;
  const [newRole, setNewRole] = useState(currentRole);
  const [reason, setReason] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const elevated = /OWNER|ADMIN|MANAGER/.test(newRole) && !/OWNER|ADMIN|MANAGER/.test(currentRole);
  const labels: Record<string, string> = locale === "ar"
    ? {
      seeUsers: "عرض المستخدمين", createUsers: "إنشاء مستخدمين", editUsers: "تعديل المستخدمين", manageRoles: "إدارة الأدوار", sendInvites: "إرسال دعوات",
      seeOrgs: "عرض المؤسسات", editOrgs: "تعديل المعلومات", manageMandates: "إدارة التفويضات", manageTerritories: "إدارة الأقاليم", accessDocs: "الوصول إلى الوثائق",
      readData: "استشارة البيانات", exportData: "تصدير البيانات", sensitiveData: "بيانات حسّاسة", financeData: "بيانات مالية", complianceData: "بيانات امتثال",
      settings: "الوصول إلى الإعدادات", security: "إدارة الأمن", auditLogs: "سجلات التدقيق", integrations: "إدارة التكاملات",
      catalog: "إدارة الدليل", rules: "إدارة القواعد", validateJourneys: "المصادقة على المسارات", providers: "إدارة مقدمي الخدمات",
      api: "وصول API", webhooks: "إدارة الويب هوك", readOnly: "وضع القراءة فقط", support: "وصول الدعم",
    }
    : {
      seeUsers: "Voir les utilisateurs", createUsers: "Créer des utilisateurs", editUsers: "Modifier les utilisateurs", manageRoles: "Gérer les rôles et accès", sendInvites: "Envoyer des invitations",
      seeOrgs: "Voir les organisations", editOrgs: "Modifier les informations", manageMandates: "Gérer les mandats", manageTerritories: "Gérer les territoires", accessDocs: "Accéder aux documents",
      readData: "Consulter les données", exportData: "Exporter des données", sensitiveData: "Accès aux données sensibles", financeData: "Accès aux données financières", complianceData: "Accès aux données de conformité",
      settings: "Accéder aux paramètres", security: "Gérer la sécurité", auditLogs: "Consulter les journaux d’audit", integrations: "Gérer les intégrations",
      catalog: "Gérer le catalogue", rules: "Gérer les règles", validateJourneys: "Valider des parcours", providers: "Gérer les prestataires",
      api: "Accès API", webhooks: "Gérer les webhooks", readOnly: "Mode lecture seule étendu", support: "Accès support",
    };
  const groupTitles = { gUsers: a.gUsers, gOrgs: a.gOrgs, gData: a.gData, gAdmin: a.gAdmin, gBiz: a.gBiz, gOther: a.gOther };
  const allCaps = Object.values(capabilityGroups).flat();
  const roleLabel = (roles as readonly string[]).includes(currentRole) ? inviteMessages.roles[currentRole as InvitationRole] : currentRole || (locale==="ar"?"لا يوجد دور مسند":"Aucun rôle attribué");

  const impact = [
    `${locale === "ar" ? "قدرات مطلوبة للمراجعة" : "Capacités demandées à examiner"} : ${selected.slice(0, 2).map((item) => labels[item]).join(", ")}`,
    `${locale === "ar" ? "تطبيق على" : "S’appliquer à"} : ${organizationName}`,
  ];

  return (
    <div className="admin-form-layout">
    <form action={action} className="client-stack">
      <input type="hidden" name="locale" value={locale} /><ProductionReference locale={locale}/>
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="resourceId" value={userId} />
      <input type="hidden" name="resourceType" value="MEMBERSHIP" />
      <input type="hidden" name="intent" value="CHANGE_CONFIGURATION" />
      <input type="hidden" name="currentRole" value={sourceRole} />
      <input type="hidden" name="currentFranchiseId" value={sourceFranchise??""}/>
      <div className="client-stack">
        <article className="client-card">
          <header><h2>{a.mainInfo}</h2></header>
          <div className="admin-form-grid" data-cols="3">
            <Field id="role-org" label={a.selectedOrg}><input id="role-org" readOnly value={organizationName} /></Field>
            <Field id="role-current" label={a.currentRole}><select id="role-current"value={source}onChange={(event)=>{setSource(event.target.value);const role=roleAssignments[Number(event.target.value)]?.roleCode;if(role)setNewRole(role);}}>{roleAssignments.length?roleAssignments.map((assignment,index)=><option key={`${assignment.roleCode}:${assignment.franchiseId}`}value={String(index)}>{assignment.roleCode}{assignment.franchiseLabel?` · ${assignment.franchiseLabel}`:""}</option>):<option value="0">{roleLabel}</option>}<option value="add">{locale==="ar"?"إضافة دور مع الحفاظ على الأدوار الحالية":"Ajouter un rôle en conservant les rôles actuels"}</option></select></Field>
            <Field id="role-new" label={a.newRole} required>
              <select id="role-new" name="newRole" required value={newRole} onChange={(event) => setNewRole(event.target.value)}>
                <option value="">{a.pickRole}</option>
                {roles.map((item) => <option key={item} value={item}>{inviteMessages.roles[item]}</option>)}
              </select>
            </Field>
            {newRole.startsWith("FRANCHISE_")?<Field id="role-franchise"label={locale==="ar"?"التفويض النشط للمؤسسة":"Mandat actif de l’organisation"}required><select key={`${source}:${newRole}`}id="role-franchise"name="franchiseId"required defaultValue={sourceFranchise??""}><option value="">—</option>{franchises.map((franchise)=><option key={franchise.id}value={franchise.id}>{franchise.label}</option>)}</select></Field>:null}
          </div>
        </article>
        <article className="client-card">
          <header className="client-priority-head">
            <div>
              <h2>{a.caps}</h2>
              <p>{locale === "ar" ? "الأذونات الفعلية يحددها الدور وسياسات قاعدة البيانات. تحفظ الاختيارات التالية كمقترح مراجعة ولا تمنح صلاحيات إضافية." : "Les droits effectifs proviennent du rôle et des politiques de la base. Les choix ci-dessous constituent une demande de revue et n’accordent pas de privilèges supplémentaires."}</p>
            </div>
            <button type="button" className="admin-select-all" onClick={() => setSelected([...allCaps])}>{a.selectAll}</button>
          </header>
          <div className="admin-perm-grid">
            {(Object.keys(capabilityGroups) as Array<keyof typeof capabilityGroups>).map((group) => (
              <fieldset key={group}>
                <legend>{groupTitles[group]}</legend>
                {capabilityGroups[group].map((cap) => (
                  <label key={cap}>
                    <input
                      type="checkbox"
                      name="capabilities"
                      value={cap}
                      checked={selected.includes(cap)}
                      onChange={(event) => setSelected((current) => event.target.checked ? [...current, cap] : current.filter((item) => item !== cap))}
                    />
                    {labels[cap]}
                  </label>
                ))}
              </fieldset>
            ))}
          </div>
        </article>
        <div className="admin-two">
          <article className="client-card">
            <header><h2>{a.effect}</h2><p>{a.effectLead}</p></header>
            <div className="admin-form-grid">
              <Field id="role-scope" label={a.scope}>
                <select id="role-scope" name="scope" defaultValue="organization">
                  <option value="organization">{organizationName}</option>
                </select>
              </Field>
              <Field id="role-entities" label={a.entities}>
                <input id="role-entities" name="entities" defaultValue={organizationName} />
              </Field>
            </div>
          </article>
          <article className="client-card">
            <header><h2>{a.changeReason}</h2><p>{a.changeReasonLead}</p></header>
            <Field id="role-reason" label={a.changeReason} required>
              <textarea id="role-reason" name="reason" required minLength={10} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} />
            </Field>
            <p className="client-access-note">{reason.length}/500</p>
          </article>
        </div>
        <div className="admin-two">
          <article className="client-card">
            <header><h2>{a.impactSummary}</h2><p>{locale === "ar" ? "معاينة بوابات الأوامر الفعلية للدور المقترح؛ يبقى نطاق المؤسسة والمصادقة الثنائية مطلوبين." : "Aperçu des commandes effectivement ouvertes par le rôle proposé ; le périmètre de l’organisation et la MFA restent obligatoires."}</p></header>
            <ul>{organizationRoleGates(newRole).map((gate) => <li key={gate}>{({TENANT_MEMBERSHIP_READ:locale === "ar" ? "قراءة عضوية المؤسسة" : "Lecture au titre de membre actif",CLIENT_REQUEST_MANAGE:locale === "ar" ? "إدارة طلبات العميل" : "Gestion des demandes Client",PROVIDER_RFQ_RESPOND:locale === "ar" ? "الرد على استشارات مقدم الخدمة" : "Réponse aux consultations Prestataire",ORGANIZATION_INVITE:locale === "ar" ? "دعوة أعضاء المؤسسة" : "Invitation de membres de l’organisation",CLIENT_DOCUMENT_REUSE_AAL2:locale === "ar" ? "إعادة استخدام وثائق العميل بمصادقة ثنائية" : "Réutilisation des documents Client avec MFA"} as Record<string,string>)[gate]}</li>)}</ul>
            {selected.length ? <p>{locale === "ar" ? "القدرات الإضافية: قيد الانتظار، للمراجعة من مسؤول ماتريسيا / مسؤول الامتثال. الحل عبر دور معتمد؛ لا يتم منحها تلقائياً." : "Capacités supplémentaires : EN ATTENTE, destinataires Matricia Admin / Conformité. Résolution via un rôle autorisé ; aucun octroi automatique."} <Link href={`/${locale}/administration/revues-capacites`}>{locale === "ar" ? "مسار المراجعة" : "Parcours de revue"}</Link></p> : null}
            <ul className="admin-impact">{impact.map((item) => <li key={item}>{item}</li>)}</ul>
          </article>
          {elevated ? (
            <article className="admin-banner" data-tone="warn">
              <strong>{a.elevation}</strong>
              <p>{a.elevationLead}</p>
            </article>
          ) : null}
        </div>
        <div className="admin-form-foot">
          <Link href={`/${locale}/administration/utilisateurs/${userId}${query}`} className="client-ghost-link">{c.cancel}</Link>
          <button type="submit" name="intent" value="SAVE_DRAFT" className="admin-soft-cta" disabled={pending}>{c.saveDraft}</button>
          <button type="submit" className="admin-primary-cta" disabled={pending}>{pending ? "…" : a.submitChange}</button>
        </div>
        <Feedback state={state} locale={locale} success={locale === "ar" ? "طلب التعديل مسجَّل للمصادقة." : "Modification soumise à la validation à quatre yeux."} />
      </div>
    </form>
      <aside className="client-stack admin-revoke">
        <article className="client-card">
          <header><h2>{a.revokeBlock}</h2><p>{a.revokeBlockLead}</p></header>
        </article>
        <article data-tone="danger">
          <strong>{a.revokeSession}</strong>
          <p>{a.revokeSessionLead}</p>
          <p className="client-access-note">{a.audited}</p>
          <ActorIntentForm locale={locale} organizationId={organizationId} resourceId={userId} resourceType="SESSION" intent="RESTRICT_ENTITY" reason="Révocation de session demandée depuis la fiche utilisateur." label={a.revokeSession} tone="danger" />
        </article>
        <article data-tone="warn">
          <strong>{a.suspendAccount}</strong>
          <p>{a.suspendAccountLead}</p>
          <p className="client-access-note">{a.audited}</p>
          <ActorIntentForm locale={locale} organizationId={organizationId} resourceId={userId} resourceType="MEMBERSHIP" intent="SUSPEND_ENTITY" reason="Suspension de compte demandée depuis la fiche utilisateur." label={a.suspendAccount} tone="soft" />
        </article>
        <article data-tone="sky">
          <strong>{a.removeOrg}</strong>
          <p>{a.removeOrgLead}</p>
          <p className="client-access-note">{a.audited}</p>
          <ActorIntentForm locale={locale} organizationId={organizationId} resourceId={userId} resourceType="MEMBERSHIP" intent="RESTRICT_ENTITY" reason="Retrait d’organisation demandé depuis la fiche utilisateur." label={a.removeOrg} />
        </article>
        <article data-tone="violet">
          <strong>{a.archiveUser}</strong>
          <p>{a.archiveUserLead}</p>
          <p className="client-access-note">{a.audited}</p>
          <ActorIntentForm locale={locale} organizationId={organizationId} resourceId={userId} resourceType="MEMBERSHIP" intent="SUSPEND_ENTITY" reason="Archivage utilisateur demandé. Aucune suppression définitive." label={a.archiveUser} />
        </article>
        <article className="admin-note">
          <strong>{a.noDelete}</strong>
          <p>{a.noDeleteLead}</p>
        </article>
      </aside>
    </div>
  );
}
