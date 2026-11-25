import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("./actions", () => ({ saveDeliveryPreparation: vi.fn() }));
import { BoxFormulaForm, PreparationField } from "./forms";

describe("delivery preparation forms", () => {
  it("keeps an integration credential out of the rendered page", () => {
    const html = renderToStaticMarkup(<PreparationField locale="fr" section="INTEGRATION" idempotencyKey="00000000-0000-4000-8000-000000000381" secret item={{ key: "EMAIL", reference: null, value: "SMTP de préproduction", row_version: 1, secret_present: true }} />);
    expect(html).toContain("SMTP de préproduction");
    expect(html).toContain("type=\"password\"");
    expect(html).toContain("Un secret est déjà enregistré");
    expect(html).not.toContain("value=\"secret");
    expect(html).toContain("ne modifie ni le site public");
  });

  it("states that a Box formula draft creates neither a price nor a public offer", () => {
    const html = renderToStaticMarkup(<BoxFormulaForm locale="ar" idempotencyKeys={{ quota: "00000000-0000-4000-8000-000000000391", privileges: "00000000-0000-4000-8000-000000000392", conditions: "00000000-0000-4000-8000-000000000393" }} />);
    expect(html).toContain("لا تنشئ سعراً");
    expect(html).toContain("الحصص");
  });
});
