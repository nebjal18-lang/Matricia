import { describe,expect,it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { NetworkBoard } from "@/modules/franchise/screens/spaces/boards";
import { emptyFranchiseSpaces } from "../spaces/live";
import type { ProviderDossier } from "./provider-dossier";
const first:ProviderDossier={organizationId:"11111111-1111-4111-8111-111111111111",name:"Prestataire A",companyStatus:"VERIFIED",status:"ACTIVE",createdAt:"2026-01-01T00:00:00Z",teamSize:5,regions:["CASABLANCA_SETTAT"],qualifications:[{id:"qa",serviceId:"service-a",serviceCode:"SERVICE_A",status:"APPROVED",rowVersion:1}],capacities:[{id:"ca",serviceId:"service-a",serviceCode:"SERVICE_A",status:"AVAILABLE",availableUnits:5,leadTimeDays:2}],documents:[{id:"da",kind:"INSURANCE",code:"ASSURANCE_A",status:"SUBMITTED",expiresOn:"2028-01-01"}]};
const second:ProviderDossier={...first,organizationId:"22222222-2222-4222-8222-222222222222",name:"Prestataire B",status:"SUSPENDED",teamSize:1,regions:["ORIENTAL"],qualifications:[{...first.qualifications[0]!,id:"qb",serviceCode:"SERVICE_B",status:"REJECTED"}],capacities:[{...first.capacities[0]!,id:"cb",serviceCode:"SERVICE_B",status:"FULL",availableUnits:0}],documents:[{...first.documents[0]!,id:"db",code:"ASSURANCE_B",status:"EXPIRED",expiresOn:"2020-01-01"}]};
describe("provider dossier identity",()=>{
 it("never mixes two providers with opposing qualifications, regions, capacity and evidence",()=>{
  const board=emptyFranchiseSpaces("fr","");board.providerDossiers=[first,second];board.people=[first,second].map((d,i)=>({id:`prospect-${i}`,name:d.name,services:d.qualifications.map(q=>q.serviceCode).join(","),status:d.status,next:"",tone:"sky",stage:"VERIFIED",dossier:d,linkedOrganizationId:d.organizationId,createdAt:"2026-01-01T00:00:00Z"}));
  const html=renderToStaticMarkup(<NetworkBoard locale="fr" query="" board={board} itemId="prospect-0"/>);
  expect(html).toContain("SERVICE_A");expect(html).toContain("ASSURANCE_A");expect(html).toContain("AVAILABLE");expect(html).toContain("Casablanca-Settat");
  expect(html).not.toContain("SERVICE_B");expect(html).not.toContain("ASSURANCE_B");expect(html).not.toContain("FULL");expect(html).not.toContain("Oriental");
 });
 it("does not attribute global documents or qualification to an unlinked prospect",()=>{
  const board=emptyFranchiseSpaces("fr","");board.providerDossiers=[first];board.people=[{id:"prospect",name:"Prospect",services:"",status:"SENT",next:"",tone:"sky",stage:"SENT"}];board.qualifications=[{id:"q",title:"FOREIGN_QUALIFICATION",status:"APPROVED",href:"/"}];
  const html=renderToStaticMarkup(<NetworkBoard locale="fr" query="" board={board} itemId="prospect"/>);
  expect(html).not.toContain("FOREIGN_QUALIFICATION");expect(html).not.toContain("Haute");expect(html).not.toContain("Disponible maintenant");expect(html).toContain("pas encore relié");
 });
});
