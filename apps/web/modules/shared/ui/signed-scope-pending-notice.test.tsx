import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SignedScopePendingNotice } from "./signed-scope-pending-notice";
import { MissionDeliveryWorkbench } from "@/modules/provider/screens/spaces/workbenches";
import { FollowBoard } from "@/modules/client/screens/spaces/follow-board";
const id="a9700000-0000-4000-8000-000000000001",contractId="a9700000-0000-4000-8000-000000000002",query=`?organizationId=${id}`;
const mission={id,contractId,signedScopePending:true,scopeReconciliationRequired:false,status:"COMPLETED",startedAt:null,completedAt:"2026-11-01T12:00:00Z",contract:null,contractVersionId:id,contractSnapshot:{versionId:id,version:1,selectedQuoteVersionId:id,priceMinor:"10000",currency:"MAD",contentHash:"a".repeat(64),changeReason:"Version historique",createdAt:"2026-10-01T12:00:00Z",items:[],signatures:[]},milestones:[{id,key:"OLD",title:"Jalon historique achevé",status:"COMPLETED",dueAt:null,rowVersion:1}],checklistItems:[],deliverables:[]};
describe("signed pending scope presentation",()=>{
  it.each(["fr","ar"]as const)("keeps completed operational history while exposing Client preparation in %s",locale=>{
    const provider=renderToStaticMarkup(<MissionDeliveryWorkbench locale={locale} query={query} missionId={id} mission={mission}/>);
    const client=renderToStaticMarkup(<FollowBoard locale={locale} query={query} mission={mission}/>);
    for(const html of [provider,client]){expect(html).toContain('role="status"');expect(html).toContain(locale==="ar"?"ملحق موقّع ينتظر التحضير":"Un avenant signé attend sa préparation");expect(html).toContain(locale==="ar"?"مكتمل":"Terminé");expect(html).toContain("Jalon historique achevé");expect(html).toContain(locale==="ar"?'dir="rtl"':'dir="ltr"');}
    expect(provider).toContain(`/${locale}/sous-traitant/contrats/${contractId}${query}`);
    expect(provider).toContain(locale==="ar"?"من مسؤولية العميل":"relève du Client");
    expect(client).toContain(`/${locale}/client/contrats${query}#contrat-${contractId}`);
    expect(client).toContain(locale==="ar"?"تنتظر مواعيد الملحق":"Les échéances de l’avenant attendent");
    const priorities=client.match(/<article class="client-card">([\s\S]*?)<\/article>/u)?.[1]??"";
    expect(priorities).toContain(locale==="ar"?"تحضير التزامات الملحق":"Préparer les obligations de l’avenant");
    expect(priorities).not.toContain(locale==="ar"?"لا يوجد عنصر للعرض حالياً":"Aucun élément à afficher pour le moment");
    expect(provider).not.toContain('name="preparationHash"');
  });
  it.each(["client","provider"]as const)("removes the pending notice after an explicit non-pending state for %s",audience=>{
    expect(renderToStaticMarkup(<SignedScopePendingNotice pending={false} locale="fr" audience={audience} contractId={contractId} query={query}/>)).toBe("");
  });
});
