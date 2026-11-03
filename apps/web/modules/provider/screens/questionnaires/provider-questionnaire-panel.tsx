"use client";
import {QuestionnairePanel} from "@/modules/client/screens/questionnaires/questionnaire-panel";
import {getQuestionnaireMessages} from "@/modules/client/screens/questionnaires/messages";
import type {QuestionnaireDashboard} from "@/modules/shared/lib/questionnaire-sessions/model";
import type {CommandIdentity} from "@/modules/shared/lib/questionnaire-sessions/contracts";
import {startQuestionnaireAction,saveQuestionnaireAnswerAction,submitQuestionnaireAction}from"./actions";
export function ProviderQuestionnairePanel({locale,dashboard,canEdit,identities}:{locale:"fr"|"ar";dashboard:QuestionnaireDashboard;canEdit:boolean;identities:{start:CommandIdentity;submit:CommandIdentity;answers:Record<string,CommandIdentity>}}){
 const original=getQuestionnaireMessages(locale),messages={...original,noCompanySite:locale==="ar"?"يتعلق الاستبيان بمؤسستكم المقدمة للخدمات.":"Ce questionnaire concerne votre entreprise prestataire.",bounds:locale==="ar"?"يتجاوز هذا الاستبيان حد 100 سؤال لكل جلسة.":"Ce questionnaire dépasse la limite de 100 questions par session.",selectOrg:locale==="ar"?"اختاروا مؤسسة مقدم الخدمات المعنية.":"Choisissez l’organisation prestataire concernée.",availableEmpty:locale==="ar"?"لا يوجد استبيان تأهيل منشور للخدمات المطلوبة. تواصلوا مع فريق التأهيل.":"Aucun questionnaire de qualification publié pour les services demandés. Contactez l’équipe de qualification.",noOrg:locale==="ar"?"لا توجد مؤسسة مقدم خدمات مخولة.":"Aucune organisation Sous-traitant autorisée."};
 return <QuestionnairePanel locale={locale}dashboard={dashboard}messages={messages}identities={identities}runtime={{basePath:`/${locale}/sous-traitant/questionnaires`,canEdit,actions:{start:startQuestionnaireAction,save:saveQuestionnaireAnswerAction,submit:submitQuestionnaireAction}}}/>;
}
