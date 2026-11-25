import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { catalogContextFocusTarget, CatalogContextRequired } from "./catalog-context-required";

function select(value: string, disabled = false): HTMLSelectElement {
  return { value, disabled } as HTMLSelectElement;
}

describe("catalogContextFocusTarget", () => {
  it("focuses the library when none is selected", () => {
    const library = select("");
    const service = select("", true);
    expect(catalogContextFocusTarget(library, service)).toBe(library);
  });

  it("focuses the service when a library is already selected", () => {
    const library = select("lib-1");
    const service = select("");
    expect(catalogContextFocusTarget(library, service)).toBe(service);
  });

  it("keeps the service target when both are filled so the user can confirm", () => {
    const library = select("lib-1");
    const service = select("svc-1");
    expect(catalogContextFocusTarget(library, service)).toBe(service);
  });

  it("links to the service control when only the service is missing", () => {
    const html = renderToStaticMarkup(
      <CatalogContextRequired
        title="Créer un questionnaire versionné"
        needContext="La bibliothèque est choisie."
        goContext="Choisir un service"
        missing="service"
      />,
    );
    expect(html).toContain('href="#catalogue-service"');
    expect(html).toContain("Choisir un service");
  });
});
