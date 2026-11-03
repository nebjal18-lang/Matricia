import { renderToStaticMarkup } from "react-dom/server";
import type { ComponentPropsWithoutRef } from "react";
import { describe, expect, it, vi } from "vitest";
vi.mock("next/navigation",()=>({useRouter:()=>({refresh:vi.fn()})}));
vi.mock("@/modules/shared/ui/button",()=>({Button:({children,...props}:ComponentPropsWithoutRef<"button">)=><button {...props}>{children}</button>}));
vi.mock("@/modules/shared/ui/badge",()=>({Badge:({children}:ComponentPropsWithoutRef<"span">)=><span>{children}</span>}));
vi.mock("@/modules/shared/ui/card",()=>({Card:({children}:ComponentPropsWithoutRef<"section">)=><section>{children}</section>,CardHeader:({children}:ComponentPropsWithoutRef<"header">)=><header>{children}</header>,CardTitle:({children}:ComponentPropsWithoutRef<"h2">)=><h2>{children}</h2>,CardContent:({children}:ComponentPropsWithoutRef<"div">)=><div>{children}</div>}));
vi.mock("@/modules/shared/ui/input",()=>({Input:(props:ComponentPropsWithoutRef<"input">)=><input {...props}/>}));
vi.mock("@/modules/shared/ui/textarea",()=>({Textarea:(props:ComponentPropsWithoutRef<"textarea">)=><textarea {...props}/>}));
vi.mock("@/modules/client/data/rfq/model",()=>({formatMinorExact:(value:string)=>value}));
vi.mock("@/modules/provider/data/quotes/model",async()=>await import("@/modules/provider/data/quotes/model"));
vi.mock("./actions",()=>({decideInvitation:async()=>({status:"idle"}),saveQuoteRevision:async()=>({status:"idle"}),submitQuote:async()=>({status:"idle"}),reopenQuoteIdentity:async()=>({status:"idle"})}));
import { QuotePanel,QuoteSubmitForm } from "./quote-panel";
import { getProviderQuoteMessages } from "./messages";

const id=(value:number)=>`${String(value).padStart(8,"0")}-0000-4000-8000-000000000000`;
const dashboard={organizations:[{id:id(1),name:"Provider"}],organizationId:id(1),organizationName:"Provider",canManage:true,taxRules:[{id:id(2),category:"STANDARD_SERVICE",rateBasisPoints:2000,effectiveFrom:"2026-01-01",effectiveTo:null}],invitations:[{id:id(3),status:"ACCEPTED" as const,rowVersion:1,rfqId:id(4),deadline:"2027-01-01T00:00:00.000Z",requestId:id(5),description:"Audit",regionCode:"CASABLANCA",currency:"MAD",taxCategoryCode:null,quote:{id:id(6),status:"DRAFT",currentVersionId:id(7),versionNumber:1,currency:"MAD",subtotalMinor:"10000",taxMinor:"2000",totalMinor:"12000"}}]};
const identities={[id(3)]:{decision:id(8),revision:id(9),submit:id(10),correlation:id(11)}};

describe("QuotePanel fiscal fail-closed",()=>{
  it("garde un devis DRAFT soumissible sans règle active mais interdit une nouvelle révision",()=>{
    const withoutActiveRule={...dashboard,taxRules:[]};
    const messages=getProviderQuoteMessages("fr");
    const html=renderToStaticMarkup(<QuotePanel dashboard={withoutActiveRule} locale="fr" m={messages} identities={identities}/>);
    expect(html).toContain("catégorie fiscale du besoin");
    expect(html).toContain('role="alert"');
    expect(html).toContain(messages.submit);
    expect(html.match(/<form/g)).toHaveLength(1);
    expect(html).not.toContain('name="solutionFr"');
    expect(html).not.toContain("STANDARD_SERVICE");
  });
  it("autorise le reflow des montants bigint tout en conservant leur direction LTR",()=>{
    const exact={...dashboard,invitations:[{...dashboard.invitations[0]!,taxCategoryCode:"STANDARD_SERVICE",quote:{...dashboard.invitations[0]!.quote!,subtotalMinor:"900719925474099300",taxMinor:"180143985094819860",totalMinor:"1080863910568919160"}}]};
    const html=renderToStaticMarkup(<QuotePanel dashboard={exact} locale="ar" m={getProviderQuoteMessages("ar")} identities={identities}/>);
    expect(html).toContain('dir="ltr"');
    expect(html).toContain("[overflow-wrap:anywhere]");
    expect(html).toContain("1080863910568919160");
    expect(html).toContain('name="taxRuleVersionId"');
    expect(html).toContain("w-full min-w-0 max-w-full");
  });
});

describe("canonical offer identity confirmation",()=>{
 const review={verified:true,identityHash:"a".repeat(64),reviewId:id(12),legalName:"Entreprise vérifiée",ice:"999000000000265",canonicalRegisteredAddress:"Adresse canonique approuvée, Rabat, MA",publicationAllowed:true};
 it("shows the exact canonical address read-only and requires a fresh unchecked confirmation",()=>{const html=renderToStaticMarkup(<QuoteSubmitForm item={dashboard.invitations[0]!} locale="fr" m={getProviderQuoteMessages("fr")} identity={identities[id(3)]!} identityReview={review}/>);expect(html).toContain(review.canonicalRegisteredAddress);expect(html).toMatch(/readonly=""/iu);expect(html).toContain('name="confirmed"');expect(html).not.toContain('checked=""');});
 it("blocks publication when a valid Provider review coexists with pending Client legal review",()=>{const html=renderToStaticMarkup(<QuoteSubmitForm item={dashboard.invitations[0]!} locale="fr" m={getProviderQuoteMessages("fr")} identity={identities[id(3)]!} identityReview={{...review,publicationAllowed:false,publicationBlockReason:"CLIENT_IDENTITY_REVIEW_REQUIRED"}}/>);expect(html).toContain('disabled=""');expect(html).toContain("dossier Client");expect(html).not.toContain("CLIENT_IDENTITY_REVIEW_REQUIRED");});
 it("keeps the explicitly declared legacy address editable when no canonical profile exists",()=>{const html=renderToStaticMarkup(<QuoteSubmitForm item={dashboard.invitations[0]!} locale="ar" m={getProviderQuoteMessages("ar")} identity={identities[id(3)]!} identityReview={{...review,canonicalRegisteredAddress:null}}/>);expect(html).not.toMatch(/readonly=""/iu);expect(html).toContain('name="confirmed"');});
});

describe("Selected quote identity reconfirmation entry",()=>{
  it("offers the actual selected-version path without loading all history in the list",()=>{
    const selected={...dashboard,invitations:[{...dashboard.invitations[0]!,quote:{...dashboard.invitations[0]!.quote!,status:"SELECTED",selectedVersionId:id(12)}}]};
    const html=renderToStaticMarkup(<QuotePanel dashboard={selected} locale="fr" m={getProviderQuoteMessages("fr")} identities={identities}/>);
    expect(html).toContain("Examiner et reconfirmer les identités du devis retenu");expect(html).not.toContain('name="registeredAddress"');
  });
  it("refuses to substitute currentVersionId when selected-version metadata is unavailable",()=>{
    const selected={...dashboard,invitations:[{...dashboard.invitations[0]!,quote:{...dashboard.invitations[0]!.quote!,status:"SELECTED",selectedVersionId:null}}]};
    const html=renderToStaticMarkup(<QuotePanel dashboard={selected} locale="fr" m={getProviderQuoteMessages("fr")} identities={identities}/>);
    expect(html).toContain("La version retenue n’est pas disponible");expect(html).not.toContain("Examiner et reconfirmer");
  });
});
