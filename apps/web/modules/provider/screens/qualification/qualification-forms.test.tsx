import { renderToStaticMarkup } from "react-dom/server";
import type { ComponentPropsWithoutRef } from "react";
import { describe, expect, it, vi } from "vitest";
import type { ProviderDashboard } from "@/modules/provider/data/qualification/model";

vi.mock("next/navigation",()=>({useRouter:()=>({refresh:vi.fn()})}));
vi.mock("@/modules/shared/ui/button",()=>({Button:({children,...props}:ComponentPropsWithoutRef<"button">)=><button {...props}>{children}</button>}));
vi.mock("@/modules/shared/ui/input",()=>({Input:(props:ComponentPropsWithoutRef<"input">)=><input {...props}/>}));
vi.mock("@/modules/shared/ui/label",()=>({Label:({children,...props}:ComponentPropsWithoutRef<"label">)=><label {...props}>{children}</label>}));
vi.mock("@/modules/shared/ui/textarea",()=>({Textarea:(props:ComponentPropsWithoutRef<"textarea">)=><textarea {...props}/>}));
vi.mock("./actions",()=>({declareProviderCapacity:async()=>({status:"idle"}),recordProviderDocument:async()=>({status:"idle"}),requestProviderService:async()=>({status:"idle"}),submitProviderProfile:async()=>({status:"idle"})}));
vi.mock("./provider-intent",()=>({activitySummaryFromProviderStorage:()=>"",clearProviderIntent:vi.fn(),readStructuredProviderIntent:()=>null}));

import { QualificationForms } from "./qualification-forms";
import { getProviderMessages } from "./messages";

const id=(value:number)=>`${String(value).padStart(8,"0")}-0000-4000-8000-000000000000`;
const label={fr:"Audit des systèmes",ar:"تدقيق الأنظمة"};
const dashboard:ProviderDashboard={organizationId:id(1),organizationName:"Cabinet Atlas",profile:null,services:[{id:id(2),serviceId:id(3),code:"IT-AUDIT-SI",label,libraryLabel:{fr:"Digital et IT",ar:"الرقمنة وتقنية المعلومات"},categoryLabel:{fr:"Audit et sécurité",ar:"التدقيق والأمن"},requestStatus:"SUBMITTED",qualificationId:id(4),qualificationStatus:"UNDER_REVIEW",capacityStatus:"LIMITED",availableUnits:2,leadTimeDays:5,eligibility:{eligible:false,reasons:["QUALIFICATION_PENDING"],decisionVersion:2,ruleVersion:"provider-v2",checkedAt:"2026-09-15T10:00:00Z"}}],documents:[{id:id(5),kind:"INSURANCE",code:"ASSURANCE_2026",version:1,status:"VERIFIED",expiresOn:"2027-01-01"}],catalogServices:[{id:id(3),code:"IT-AUDIT-SI",label,libraryLabel:{fr:"Digital et IT",ar:"الرقمنة وتقنية المعلومات"},categoryLabel:{fr:"Audit et sécurité",ar:"التدقيق والأمن"}}]};
const keys={profile:id(6),service:id(7),capacity:id(8),document:id(9)};

describe("QualificationForms",()=>{
  it("affiche les libellés métier publiés sans codes d’état bruts",()=>{const html=renderToStaticMarkup(<QualificationForms dashboard={dashboard} locale="fr" messages={getProviderMessages("fr")} keys={keys}/>);expect(html).toContain("Audit des systèmes");expect(html).toContain("En cours de vérification");expect(html).toContain("Capacité limitée");expect(html).not.toContain("UNDER_REVIEW");expect(html).not.toContain(">LIMITED<")});
  it("rend les contrôles arabes et une mise en page fluide à 360 px",()=>{const html=renderToStaticMarkup(<div dir="rtl" lang="ar"><QualificationForms dashboard={dashboard} locale="ar" messages={getProviderMessages("ar")} keys={keys}/></div>);expect(html).toContain("تدقيق الأنظمة");expect(html).toContain('dir="rtl"');expect(html).toContain("min-h-11");expect(html).not.toMatch(/(?:min-w|max-w|w)-\[(?:[4-9]\d\d|\d{4,})px\]/u)});
});
