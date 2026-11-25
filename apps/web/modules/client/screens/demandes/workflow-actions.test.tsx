import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { getClientRfqMessages } from "./messages";
import { WorkflowActions } from "./workflow-actions";

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return {
    ...actual,
    useActionState: () => [{ status: "idle" }, vi.fn(), false],
  };
});

const id = "11111111-1111-4111-8111-111111111111";
const keys = { ready: id, match: id, open: id };

describe("WorkflowActions", () => {
  it("shows mark ready for INFORMATION_REQUIRED when complete", () => {
    const html = renderToStaticMarkup(
      <WorkflowActions locale="fr" organizationId={id} requestId={id} rowVersion={2} status="INFORMATION_REQUIRED" canMarkReady matchingRunId={null} messages={getClientRfqMessages("fr")} keys={keys} />,
    );
    expect(html).toContain("Valider les informations");
    expect(html).not.toContain("Ouvrir la consultation");
  });

  it("shows open RFQ only when matching is ready", () => {
    const html = renderToStaticMarkup(
      <WorkflowActions locale="fr" organizationId={id} requestId={id} rowVersion={2} status="MATCHING" canMarkReady={false} matchingRunId={id} messages={getClientRfqMessages("fr")} keys={keys} />,
    );
    expect(html).toContain("Ouvrir la consultation");
    expect(html).not.toContain("Rechercher des prestataires");
  });

  it("does not open RFQ from a READY status alone", () => {
    const html = renderToStaticMarkup(
      <WorkflowActions locale="fr" organizationId={id} requestId={id} rowVersion={2} status="READY" canMarkReady={false} matchingRunId={id} messages={getClientRfqMessages("fr")} keys={keys} />,
    );
    expect(html).toContain("Rechercher des prestataires");
    expect(html).not.toContain("Ouvrir la consultation");
  });
});
