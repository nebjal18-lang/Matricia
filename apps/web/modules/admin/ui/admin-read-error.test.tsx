import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AdminReadError } from "./admin-read-error";
describe("Admin forbidden guidance",()=>{
 it.each(["fr","ar"] as const)("asks for the missing authorization without suggesting login or MFA in %s",locale=>{const html=renderToStaticMarkup(<AdminReadError locale={locale} reason="FORBIDDEN" retryHref={`/${locale}/administration/entreprises?status=ACTIVE`}/>);expect(html).toContain(locale==="ar"?"اطلب من مسؤول مخوّل":"Demandez à un administrateur habilité");expect(html).toContain(`/${locale}/tableau-de-bord`);expect(html).not.toContain("/connexion");expect(html).not.toContain("/securite/compte");expect(html).not.toContain("Vérifier ma connexion");});
 it("keeps a technical retry on the exact filtered path",()=>{const html=renderToStaticMarkup(<AdminReadError locale="fr" reason="UNAVAILABLE" retryHref="/fr/administration/entreprises?q=hello&status=ACTIVE"/>);expect(html).toContain("Réessayer");expect(html).toContain("q=hello");expect(html).not.toContain("Demandez à un administrateur");});
});
