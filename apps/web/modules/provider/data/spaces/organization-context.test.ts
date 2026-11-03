import {describe,it,expect} from "vitest";
import {providerContextReadState, selectProviderMembership} from "./organization-context";
const a={organization_id:"11111111-1111-4111-8111-111111111111"},b={organization_id:"22222222-2222-4222-8222-222222222222"};
describe("provider tenant selection",()=>{
 it("requires explicit selection for multiple authorized organizations",()=>{expect(selectProviderMembership([a,b])).toBeUndefined();expect(selectProviderMembership([a,b],b.organization_id)).toBe(b);});
 it("never falls back to another tenant for forged or malformed scope",()=>{expect(selectProviderMembership([a],b.organization_id)).toBeUndefined();expect(selectProviderMembership([a],"../other")).toBeUndefined();});
 it("allows the sole authorized organization and deduplicates memberships",()=>{expect(selectProviderMembership([a,a])).toBe(a);expect(selectProviderMembership([])).toBeUndefined();});
});

describe("provider context read states", () => {
 it("never classifies a failed membership read as no organization", () => {
  expect(providerContextReadState({ selectedOrganizationId: null, organizations: [], readError: "QUERY_FAILED" })).toBe("unavailable");
  expect(providerContextReadState({ selectedOrganizationId: null, organizations: [], readError: "INVALID_RESPONSE" })).toBe("unavailable");
 });
 it("distinguishes selection, absence and an unauthorized requested scope", () => {
  expect(providerContextReadState({ selectedOrganizationId: null, organizations: [a, b] })).toBe("choose-organization");
  expect(providerContextReadState({ selectedOrganizationId: null, organizations: [] })).toBe("no-organization");
  expect(providerContextReadState({ selectedOrganizationId: null, organizations: [a] }, b.organization_id)).toBe("forbidden");
  expect(providerContextReadState({ selectedOrganizationId: a.organization_id, organizations: [a] })).toBeNull();
 });
});
