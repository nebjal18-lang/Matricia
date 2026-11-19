import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CreationPreparation, DocumentSharePreparation } from "./creation-preparation";
import type { SpaceSnapshot } from "@/modules/admin/data/spaces/space-data";
import type { AdminSpaceId } from "@/modules/admin/data/spaces/admin-nav";
const snapshot: SpaceSnapshot = {reason:null,rows:[],treat:[],supervision:null,providers:null,governance:null};
describe("Governed creation entrypoints",()=>{
 it.each(["devis","contrats","missions","jalons","territoires","franchises","gouvernance","avenants","diagnostics","demandes","matching","litiges","messagerie"] as AdminSpaceId[])("does not accept a generic free-text command for %s",space=>{for(const locale of ["fr","ar"] as const){const html=renderToStaticMarkup(<CreationPreparation locale={locale} query="?organizationId=org" space={space} snapshot={snapshot}/>);expect(html).not.toContain("<form");expect(html).not.toContain('name="resourceId"');expect(html).toContain(locale==="ar"?"لم يُنشأ أي عنصر هنا":"Aucun objet n’est créé ici");expect(html).toContain(locale==="ar"?"لا يوجد ملف مصدر":"Aucun dossier source");expect(html).toContain(`/${locale}/administration/${space}?organizationId=org`);}});
 it("routes franchise creation to the public deposit, admin review queue and gouvernance",()=>{const html=renderToStaticMarkup(<CreationPreparation locale="fr" query="?organizationId=org" space="franchises" snapshot={snapshot}/>);expect(html).toContain("/franchise/candidature");expect(html).toContain("/administration/candidatures-franchise?organizationId=org");expect(html).toContain("/administration/gouvernance?organizationId=org");expect(html).toContain("dépôt");expect(html).not.toContain("<form");});
 it("routes gouvernance creation to candidatures and territoires instead of a free form",()=>{const html=renderToStaticMarkup(<CreationPreparation locale="fr" query="?organizationId=org" space="gouvernance" snapshot={snapshot}/>);expect(html).toContain("/administration/candidatures-franchise?organizationId=org");expect(html).toContain("/administration/territoires?organizationId=org");expect(html).toContain("/administration/franchises?organizationId=org");expect(html).not.toContain("<form");});
 it("routes demandes creation to the client deposit path and diagnostics to admin supervision",()=>{
  expect(renderToStaticMarkup(<CreationPreparation locale="fr" query="" space="demandes" snapshot={snapshot}/>)).toContain("/client/demandes/nouvelle");
  const diagnostics=renderToStaticMarkup(<CreationPreparation locale="fr" query="" space="diagnostics" snapshot={snapshot}/>);
  expect(diagnostics).toContain("/administration/diagnostics");
  expect(diagnostics).not.toContain('href="/fr/client/diagnostics"');
 });
 it("renders source dossiers as an actionable table without dumping raw UUIDs",()=>{
  const supervision={organizations:[
    {id:"11111111-1111-4111-8111-111111111111",display_name:"Atlas Client Services",legal_name:"Atlas Client Services SARL",status:"ACTIVE",created_at:"2026-09-01T00:00:00Z",role_codes:["CLIENT"],member_count:2,open_requests:1,open_disputes:0},
    {id:"22222222-2222-4222-8222-222222222222",display_name:"Client · Bibliothèque concurrence",legal_name:"Client · Bibliothèque concurrence",status:"ARCHIVED",created_at:"2026-09-01T00:00:00Z",role_codes:["CLIENT"],member_count:1,open_requests:0,open_disputes:0},
    {id:"33333333-3333-4333-8333-333333333333",display_name:"Conseil Anfa",legal_name:"Conseil Anfa SARL",status:"ACTIVE",created_at:"2026-09-01T00:00:00Z",role_codes:["PROVIDER"],member_count:3,open_requests:0,open_disputes:0},
  ]} as NonNullable<SpaceSnapshot["supervision"]>;
  const html=renderToStaticMarkup(<CreationPreparation locale="fr" query="" space="diagnostics" snapshot={{...snapshot,supervision}}/>);
  expect(html).toContain("client-space-table");
  expect(html).toContain("Atlas Client Services");
  expect(html).toContain("/administration/diagnostics?organizationId=11111111-1111-4111-8111-111111111111");
  expect(html).toContain("Superviser les diagnostics de cette organisation");
  expect(html).toContain("Ouvrir le dossier");
  expect(html).not.toContain("/client/diagnostics?organizationId=");
  expect(html).not.toContain("Client · Bibliothèque concurrence");
  expect(html).not.toContain("Conseil Anfa");
  expect(html).not.toMatch(/Atlas Client Services<\/a>\s*·\s*<span dir="ltr">11111111/);
 });
 it("selects only retained quotes as authoritative contract sources",()=>{const supervision={quotes:[{id:"retained",status:"SELECTED",client_name:"Client A",provider_name:"Provider A"},{id:"unselected",status:"SUBMITTED",client_name:"Client B",provider_name:"Provider B"}]} as NonNullable<SpaceSnapshot["supervision"]>;const html=renderToStaticMarkup(<CreationPreparation locale="fr" query="?organizationId=org" space="contrats" snapshot={{...snapshot,supervision}}/>);expect(html).toContain("/administration/devis/retained?organizationId=org");expect(html).not.toContain("unselected");});
 it("requires an active contract without an existing mission",()=>{const supervision={contracts:[{id:"ready",status:"ACTIVE",mission_id:null,client_name:"Client",provider_name:"Provider",client_organization_id:"client-org"},{id:"draft",status:"DRAFT",mission_id:null},{id:"already-created",status:"ACTIVE",mission_id:"mission"}]} as NonNullable<SpaceSnapshot["supervision"]>;const html=renderToStaticMarkup(<CreationPreparation locale="fr" query="" space="missions" snapshot={{...snapshot,supervision}}/>);expect(html).toContain("/administration/contrats/ready");expect(html).toContain("/client/contrats?organizationId=client-org");expect(html).not.toContain("/contrats/draft");expect(html).not.toContain("already-created");});
 it.each(["fr","ar"] as const)("names document sharing truthfully in %s and links an exact existing version",locale=>{const rows=[{id:"doc-1",href:"",title:"Legal document",status:"VERIFIED",tone:"mint" as const,cells:[],organizationId:"org"}];const html=renderToStaticMarkup(<DocumentSharePreparation locale={locale} query="?organizationId=org" snapshot={{...snapshot,rows}}/>);expect(html).toContain(`/${locale}/administration/documents/doc-1/reutilisation?organizationId=org`);expect(html).toContain(locale==="ar"?"لا ترفع ملفاً جديداً":"n’importe aucun fichier");expect(html).not.toContain('type="file"');});
 it("announces the real missing document precondition",()=>{const html=renderToStaticMarkup(<DocumentSharePreparation locale="fr" query="" snapshot={snapshot}/>);expect(html).toContain("coffre de son propriétaire");expect(html).not.toContain("<form");});
});
