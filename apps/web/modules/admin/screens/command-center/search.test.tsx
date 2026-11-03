import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AdminSearchResults, searchAdminLoadedContent } from "./search";
import type { AdminCommandCenter } from "@/modules/admin/data/command-center/model";
const dashboard: AdminCommandCenter = {workItems:[{id:"work",queueKey:"TEST",sourceKind:"MANUAL_REVIEW",queueLabelFr:"Test",queueLabelAr:"اختبار",organizationId:"org",resourceType:"CONTRACT",resourceId:"contract-123",titleFr:"Révision facture spéciale",titleAr:"مراجعة فاتورة خاصة",priority:"HIGH",status:"OPEN",dueAt:"2026-11-02",assignedTo:null,rowVersion:1}],actions:[{id:"action-1",workItemId:null,organizationId:"org",actionType:"RESTRICT_ENTITY",targetEnvironment:"DEVELOPMENT",resourceType:"TEST",resourceId:"resource-123",reason:"Revoir la restriction temporaire",approvalsRequired:1,status:"PENDING_APPROVAL",requestedAt:"2026-11-02",rowVersion:1}]};
describe("Admin command search",()=>{
 it.each(["fr","ar"] as const)("finds missions in %s and preserves the selected organization",locale=>{expect(searchAdminLoadedContent(locale,"missions","?organizationId=org",dashboard)).toContainEqual(expect.objectContaining({href:`/${locale}/administration/missions?organizationId=org`,kind:"page"}));});
 it("matches Arabic page labels",()=>{expect(searchAdminLoadedContent("ar","المهام","",dashboard).some(item=>item.href.includes("/missions"))).toBe(true);});
 it("matches accents and multiple words against loaded case titles",()=>{expect(searchAdminLoadedContent("fr","revision speciale","?organizationId=org",dashboard)).toEqual([expect.objectContaining({href:"/fr/administration/contrats/contract-123?organizationId=org",kind:"dossier"})]);});
 it("links only actions actually loaded",()=>{expect(searchAdminLoadedContent("fr","resource-123","",dashboard)).toEqual([expect.objectContaining({href:"#admin-action-action-1"})]);});
 it.each(["fr","ar"] as const)("announces no match without claiming exhaustive archival search in %s",locale=>{const html=renderToStaticMarkup(<AdminSearchResults locale={locale} query="not-found-xyz" organizationQuery="" dashboard={dashboard}/>);expect(html).toContain(locale==="ar"?"لا توجد نتيجة":"Aucun résultat");expect(html).toContain(locale==="ar"?"لا يشمل كامل الأرشيف":"L’archive complète n’est pas parcourue");});
 it("keeps page suggestions when cases fail, with an explicit partial state",()=>{const html=renderToStaticMarkup(<AdminSearchResults locale="fr" query="missions" organizationQuery="" dashboard={null}/>);expect(html).toContain('/fr/administration/missions');expect(html).toContain("seuls les liens de pages");});
 it("ignores a whitespace query",()=>expect(searchAdminLoadedContent("fr","  ","",dashboard)).toEqual([]));
});
