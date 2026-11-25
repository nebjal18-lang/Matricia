import { readFileSync } from "node:fs";
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

  it("anchors the hover tip below the row so it does not cover the label or card header", () => {
    const css = readFileSync(new URL("../../ui/admin-experience.css", import.meta.url), "utf8");
    expect(css).toMatch(/\.admin-dir-tip\s*\{[^}]*top:\s*calc\(100%\s*\+\s*0\.2rem\)/u);
    expect(css).not.toMatch(/\.admin-dir-tip\s*\{[^}]*bottom:\s*calc\(100%\s*-\s*0\.15rem\)/u);
  });
});
