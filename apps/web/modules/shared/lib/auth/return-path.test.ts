import { describe, expect, it } from "vitest";
import { safeReturnPath } from "./return-path";
describe("local auth return path",()=>{
 it.each(["fr","ar"])("preserves %s dossier and query",locale=>{const path=`/${locale}/client/demandes/id?organizationId=org&q=devis%20annuel&tab=offres`;expect(safeReturnPath(path,locale)).toBe(path);});
 it.each(["https://evil.invalid/","//evil.invalid/","/fr/../../evil","/fr/%2e%2e/evil","/fr/\\evil","/fr/%5cevil","/fr/client?x=%0aevil","/ar/client"])("rejects unsafe return %s",value=>{expect(safeReturnPath(value,"fr")).toBeUndefined();});
});
