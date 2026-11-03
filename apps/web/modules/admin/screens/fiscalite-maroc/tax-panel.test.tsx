import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
vi.mock("@/modules/shared/ui/alert",()=>({Alert:({children,...props}:{children:ReactNode}&ComponentPropsWithoutRef<"div">)=><div {...props}>{children}</div>,AlertDescription:({children}:{children:ReactNode})=><div>{children}</div>}));
vi.mock("@/modules/shared/ui/badge",()=>({Badge:({children}:{children:ReactNode})=><span>{children}</span>}));
vi.mock("@/modules/shared/ui/button",()=>({Button:({children,...props}:ComponentPropsWithoutRef<"button">)=><button {...props}>{children}</button>}));
vi.mock("@/modules/shared/ui/card",()=>({Card:({children}:{children:ReactNode})=><article>{children}</article>,CardContent:({children}:{children:ReactNode})=><div>{children}</div>,CardDescription:({children}:{children:ReactNode})=><p>{children}</p>,CardHeader:({children}:{children:ReactNode})=><header>{children}</header>,CardTitle:({children}:{children:ReactNode})=><h3>{children}</h3>}));
vi.mock("@/modules/shared/ui/input",()=>({Input:(props:ComponentPropsWithoutRef<"input">)=><input {...props}/>}));
vi.mock("@/modules/shared/ui/label",()=>({Label:({children,...props}:ComponentPropsWithoutRef<"label">)=><label {...props}>{children}</label>}));
vi.mock("./actions",()=>({simulateTax:async()=>({status:"idle"}),proposeTaxRule:async()=>({status:"idle"}),decideTaxRule:async()=>({status:"idle"})}));
import { TaxPanel } from "./tax-panel";
import { getMoroccoTaxMessages } from "./messages";
const id="11111111-1111-4111-8111-111111111111",dashboard={context:{kind:"ORGANIZATION" as const,organizationId:id},categories:[{code:"CLIENT_SUBSCRIPTION",nameFr:"Abonnement client",nameAr:"اشتراك العميل",kind:"SALE",requiresSourceRule:false}],rules:[{id,categoryCode:"CLIENT_SUBSCRIPTION",version:1,rateBasisPoints:2000,status:"ACTIVE",validationStatus:"DEMO",ruleType:"VAT",effectiveFrom:"2026-01-01",effectiveTo:null,legalReference:"Configuration démonstration",rowVersion:1}]},keys={proposal:id,[id]:id};
function render(locale:"fr"|"ar"){return renderToStaticMarkup(<div dir={locale==="ar"?"rtl":"ltr"}><TaxPanel dashboard={dashboard} locale={locale} m={getMoroccoTaxMessages(locale)} keys={keys}/></div>)}
describe("TaxPanel localisation et accessibilité",()=>{it("associe explicitement tous les libellés aux contrôles",()=>{const html=render("fr"),controls=[...html.matchAll(/<(?:input|select)[^>]*\sid="([^"]+)"/g)].map(value=>value[1]),labels=[...html.matchAll(/<label[^>]+for="([^"]+)"/g)].map(value=>value[1]);expect(controls.length).toBeGreaterThan(10);expect(labels).toHaveLength(controls.length);expect(labels.filter(value=>!controls.includes(value))).toEqual([])});it("traduit les valeurs métier visibles en français",()=>{const text=render("fr").replace(/<[^>]+>/g," ");expect(text).toContain("Taxe sur la valeur ajoutée");expect(text).toContain("Active");expect(text).toContain("Démonstration non-production");expect(text).toContain("points de base");expect(text).not.toMatch(/\bVAT\b|\bACTIVE\b|\bDEMO\b|\bbps\b/)});it("rend les valeurs arabes dans un conteneur RTL adapté à 360 px",()=>{const html=render("ar"),text=html.replace(/<[^>]+>/g," ");expect(html).toContain('dir="rtl"');expect(text).toContain("الضريبة على القيمة المضافة");expect(text).toContain("نشطة");expect(text).toContain("عرض خارج الإنتاج");expect(text).toContain("نقطة أساس");expect(html).not.toMatch(/(?:min-w|max-w|w)-\[(?:[4-9]\d\d|\d{4,})px\]/)})});

it("submits an explicit global context without inventing a tenant",()=>{
 const html=renderToStaticMarkup(<TaxPanel dashboard={{...dashboard,context:{kind:"PLATFORM"}}} locale="fr" m={getMoroccoTaxMessages("fr")} keys={keys}/>);
 expect(html).toContain('name="contextKind" value="PLATFORM"');
 expect(html).not.toContain('name="organizationId"');
});
