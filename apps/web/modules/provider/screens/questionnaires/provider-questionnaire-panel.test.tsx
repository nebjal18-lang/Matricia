import{describe,it,expect,vi}from"vitest";
import{renderToStaticMarkup}from"react-dom/server";
vi.mock("./actions",()=>({startQuestionnaireAction:vi.fn(),saveQuestionnaireAnswerAction:vi.fn(),submitQuestionnaireAction:vi.fn()}));
vi.mock("@/modules/client/screens/questionnaires/actions",()=>({startQuestionnaireAction:vi.fn(),saveQuestionnaireAnswerAction:vi.fn(),submitQuestionnaireAction:vi.fn()}));
import{ProviderQuestionnairePanel}from"./provider-questionnaire-panel";
import type{QuestionnaireDashboard}from"@/modules/shared/lib/questionnaire-sessions/model";
const id="11111111-1111-4111-8111-111111111111",key={idempotencyKey:id,correlationId:id};
const dashboard:QuestionnaireDashboard={organizations:[{id,name:"Entreprise déclarée"}],questionnaires:[{id,version:1,titleFr:"Qualification publiée",titleAr:"تأهيل منشور",descriptionFr:"Revue humaine",descriptionAr:"مراجعة بشرية"}],sessions:[{id,organizationId:id,questionnaireVersionId:id,status:"SUBMITTED",locale:"fr-MA",updatedAt:"2026-11-01T12:00:00Z",submittedAt:"2026-11-01T12:00:00Z",rowVersion:2,titleFr:"Qualification publiée",titleAr:"تأهيل منشور"}],selected:null};
describe("Provider questionnaire route and role presentation",()=>{
 it.each(["fr","ar"]as const)("retains Provider tenant/session context in %s",locale=>{
  const html=renderToStaticMarkup(<ProviderQuestionnairePanel locale={locale}dashboard={dashboard}canEdit={true}identities={{start:key,submit:key,answers:{}}}/>);
  expect(html).toContain(`/${locale}/sous-traitant/questionnaires?session=${id}&amp;organizationId=${id}`);
  expect(html).not.toContain("/client/questionnaires");expect(html).toContain('name="questionnaireVersionId"');
 });
 it("keeps reader navigation available without offering evidence mutations",()=>{
  const html=renderToStaticMarkup(<ProviderQuestionnairePanel locale="fr"dashboard={dashboard}canEdit={false}identities={{start:key,submit:key,answers:{}}}/>);
  expect(html).toContain("consulter les questionnaires");expect(html).toContain(`/fr/sous-traitant/questionnaires?session=${id}`);expect(html).not.toContain('name="questionnaireVersionId"');
 });
});
