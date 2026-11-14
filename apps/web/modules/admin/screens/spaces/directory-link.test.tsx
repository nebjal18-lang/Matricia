import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DirectoryLink } from "./directory-link";

describe("DirectoryLink", () => {
  it("does not render the summary until hover opens it", () => {
    const html = renderToStaticMarkup(
      <DirectoryLink
        href="/fr/administration/entreprises"
        label="Organisations"
        summary="Consulter et administrer les passeports d’organisations multi-rôles."
      />,
    );
    expect(html).toContain("Organisations");
    expect(html).toContain("admin-dir-link-wrap");
    expect(html).not.toContain("admin-dir-tip");
    expect(html).not.toContain("passeports");
  });
});
