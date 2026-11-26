import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({ default: ({ children, href, ...props }: React.ComponentPropsWithoutRef<"a"> & { href: string }) => <a href={href} {...props}>{children}</a> }));
vi.mock("@/app/[locale]/notifications/notification-forms", () => ({
  PreferenceForm: () => <div data-testid="pref-form">pref</div>,
}));
vi.mock("@/app/[locale]/notifications/messages", () => ({
  getNotificationMessages: () => ({
    mandatory: "Critique",
    preferences: "Préférences",
  }),
}));

import { ProviderSettingsBoard } from "./settings-board";

describe("ProviderSettingsBoard", () => {
  it("expose les préférences d’intervention et le rail profil", () => {
    const html = renderToStaticMarkup(
      <ProviderSettingsBoard
        locale="fr"
        query=""
        dashboard={null}
        notifications={{
          organizationId: "00000000-0000-4000-8000-000000000001",
          organizationName: "Demo",
          canViewDeliveryOperations: false,
          categories: [{ code: "MISSION_ALERT", label: "Missions", mandatory: false }],
          preferences: [],
          notifications: [],
          templates: [],
        }}
      />,
    );
    expect(html).toContain("Préférences d’intervention");
    expect(html).toContain("Notifications de l’entreprise");
    expect(html).toContain("provider-profile-rail");
    expect(html).toContain("sous-traitant/parametres");
  });

  it("distingue capacité chargée et notifications indisponibles", () => {
    const html = renderToStaticMarkup(
      <ProviderSettingsBoard
        locale="fr"
        query="?organizationId=00000000-0000-4000-8000-000000000001"
        dashboard={null}
        notifications={null}
        capacityUnavailable
        notificationsUnavailable
      />,
    );
    expect(html).toContain("modalités et zones n’ont pas pu être chargées");
    expect(html).toContain("préférences de notification n’ont pas pu être chargées");
    expect(html).not.toContain("Chargement temporairement indisponible");
  });
});
