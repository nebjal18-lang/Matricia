import { describe,expect,it } from "vitest";
import { getProviderMessages, getProviderStatusLabel } from "./messages";
describe("provider qualification localization",()=>{
 it("has complete FR and Arabic copies",()=>{const fr=getProviderMessages("fr");const ar=getProviderMessages("ar");expect(Object.keys(ar)).toEqual(Object.keys(fr));expect(ar.title).toMatch(/[\u0600-\u06ff]/u);expect(fr.description.length).toBeGreaterThan(30)});
 it("expose uniquement des copies renseignées",()=>{for(const locale of["fr","ar"]as const)for(const value of Object.values(getProviderMessages(locale)))expect(value.trim().length).toBeGreaterThan(0)});
 it("localise les états et types techniques visibles",()=>{expect(getProviderStatusLabel("fr","UNDER_REVIEW")).toBe("En cours de vérification");expect(getProviderStatusLabel("ar","INSURANCE")).toMatch(/[\u0600-\u06ff]/u)});
});

import { getProviderQualificationStatusLabel } from "./messages";
describe("qualification request lifecycle labels",()=>{it("shows a submitted request as awaiting human review in French and Arabic",()=>{expect(getProviderQualificationStatusLabel("fr","NOT_REQUESTED","SUBMITTED")).toBe("En attente d’examen");expect(getProviderQualificationStatusLabel("ar","NOT_REQUESTED","SUBMITTED")).toBe("بانتظار المراجعة")});it("does not call a withdrawn request pending and does not leak unmapped backend English",()=>{expect(getProviderQualificationStatusLabel("fr","NOT_REQUESTED","WITHDRAWN")).toBe("Demande retirée");expect(getProviderStatusLabel("ar","NOT_REQUESTED")).toBe("لم يطلب");expect(getProviderStatusLabel("ar","UNRECOGNIZED_BACKEND_STATUS")).toBe("حالة تحتاج إلى مراجعة")})});
