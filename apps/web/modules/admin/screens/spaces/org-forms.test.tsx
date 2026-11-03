import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
vi.mock("./org-actions",()=>({requestOrganizationMutation:async()=>({status:"idle"})}));
import { CreateOrganizationForm } from "./org-forms";
describe("Organization ICE input",()=>{
 it.each(["fr","ar"] as const)("explains the exact server-aligned fifteen digits in %s",locale=>{const html=renderToStaticMarkup(<CreateOrganizationForm locale={locale} query=""/>);expect(html).toContain("ICE");expect(html).toContain('aria-describedby="create-ice-help"');expect(html).toContain('pattern="[0-9]{15}"');expect(html).toContain('inputMode="numeric"');expect(html).toContain(locale==="ar"?"15 رقماً بالضبط":"exactement 15 chiffres");expect(html).toContain("RC");expect(html).toContain("IF");});
});
