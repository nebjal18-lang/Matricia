import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ProviderInboxBoard } from "./inbox-board";

vi.mock("next/navigation", () => ({useRouter: () => ({refresh: vi.fn()})}));

vi.mock("@/app/[locale]/messagerie/messaging-forms", () => ({
  OpenThreadForm: () => null,
  SendMessageForm: () => <form data-testid="send-control" />,
}));

const thread = {
  id: "11111111-1111-4111-8111-111111111111",
  object_type: "RFQ" as const,
  object_id: "22222222-2222-4222-8222-222222222222",
  service_request_id: "33333333-3333-4333-8333-333333333333",
  subject: "Clarification lot CVC",
  status: "OPEN" as const,
  contact_policy_version: "v1",
  participant_organization_id: "44444444-4444-4444-8444-444444444444",
  participant_kind: "PROVIDER" as const,
  counterparty_alias: "CLIENT" as const,
  created_at: "2026-09-20T10:00:00.000Z",
  last_message_at: "2026-09-20T11:00:00.000Z",
  message_count: 1,
};

describe("provider inbox board", () => {
  it.each(["fr","ar"] as const)("does not infer send/upload authorization from a missing capability in %s",locale=>{
    const html=renderToStaticMarkup(<ProviderInboxBoard locale={locale} query="" threads={[thread]} options={[]} conversation={{thread:{...thread},messages:[]}}/>);
    expect(html).toContain(locale==="ar"?"صلاحيات الإرسال غير متاحة":"Les droits d’envoi sont indisponibles");expect(html).not.toContain('data-testid="send-control"');expect(html).not.toContain('type="file"');
  });
  it("renders send controls only with the explicit current server capability",()=>{
    const html=renderToStaticMarkup(<ProviderInboxBoard locale="fr" query="" threads={[thread]} options={[]} conversation={{thread:{...thread,can_send:true},messages:[]}}/>);
    expect(html).toContain('data-testid="send-control"');expect(html).toContain("Message avec pièces jointes — brouillon privé");
  });

  it("keeps the real conversation readable without exposing send/upload forms when the server denies execution",()=>{
    const html=renderToStaticMarkup(<ProviderInboxBoard locale="fr" query="" threads={[thread]} options={[]} conversation={{thread:{...thread,can_send:false},messages:[]}}/>);
    expect(html).toContain("lecture seule pour votre rôle ou votre affectation");expect(html).not.toContain('data-testid="send-control"');expect(html).not.toContain('name="body"');expect(html).not.toContain('type="file"');expect(html).toContain(thread.subject);
  });
  it("reports partial loading failures without asserting an empty inbox or notification feed", () => {
    const html=renderToStaticMarkup(<ProviderInboxBoard locale="fr" query="?organizationId=org" threads={[]} conversation={null} options={[]} inboxError="UNAVAILABLE" optionsError notificationsUnavailable />);
    expect(html).toContain('role="alert"');expect(html).toContain("Réessayer");expect(html).not.toContain("Aucune conversation liée");expect(html).not.toContain("Aucune notification pour le moment");
  });
  it("translates the consultation label without translating the user's message", () => {
    const html=renderToStaticMarkup(<ProviderInboxBoard locale="ar" query="?page=5" threads={[thread]} conversation={null} options={[]} page={5} total={126}/>);
    expect(html).toContain("طلب العروض");expect(html).toContain('page=6');expect(html).toContain('page=4');expect(html).toContain(thread.subject);
  });
  it("affiche une conversation RFQ réelle et le lien consultation", () => {
    const html = renderToStaticMarkup(
      <ProviderInboxBoard
        locale="fr"
        query=""
        threads={[thread]}
        conversation={{
          thread: {
            id: thread.id,
            object_type: thread.object_type,
            object_id: thread.object_id,
            service_request_id: thread.service_request_id,
            subject: thread.subject,
            status: thread.status,
            contact_policy_version: thread.contact_policy_version,
            participant_organization_id: thread.participant_organization_id,
            participant_kind: thread.participant_kind,
            counterparty_alias: thread.counterparty_alias,
            created_at: thread.created_at,
          },
          messages: [{
            id: "55555555-5555-4555-8555-555555555555",
            sender_alias: "CLIENT",
            mine: false,
            body: "Pouvez-vous préciser le lot CVC ?",
            created_at: "2026-09-20T11:00:00.000Z",
            attachments: [],
          }],
        }}
        options={[]}
      />,
    );
    expect(html).toContain("Clarification lot CVC");
    expect(html).toContain("/sous-traitant/messages/11111111-1111-4111-8111-111111111111");
    expect(html).toContain("/sous-traitant/consultations/22222222-2222-4222-8222-222222222222");
    expect(html).toContain("Pouvez-vous préciser le lot CVC ?");
    expect(html).not.toContain("Merci pour votre devis.");
  });

  it("reste vide sans inventer de fil", () => {
    const html = renderToStaticMarkup(<ProviderInboxBoard locale="fr" query="" threads={[]} conversation={null} options={[]} />);
    expect(html).toContain("Aucune conversation");
    expect(html).not.toContain("Merci pour votre devis.");
  });

  it("affiche les notifications réelles et un vide sans fil inventé", () => {
    const withNotif = renderToStaticMarkup(
      <ProviderInboxBoard
        locale="fr"
        query=""
        threads={[]}
        conversation={null}
        options={[]}
        notifications={[{ id: "77777777-7777-4777-8777-777777777777", subject: "Invitation RFQ reçue", createdAt: "2026-09-20T10:00:00.000Z", href: "/fr/sous-traitant/consultations/22222222-2222-4222-8222-222222222222", unread: true }]}
      />,
    );
    expect(withNotif).toContain("Invitation RFQ reçue");
    expect(withNotif).toContain("/fr/sous-traitant/consultations/22222222-2222-4222-8222-222222222222");
    expect(withNotif).toContain("/notifications");
    expect(withNotif).not.toContain("Merci pour votre devis.");
  });
});
