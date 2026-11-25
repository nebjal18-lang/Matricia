import { describe, expect, it } from "vitest";
import { actorPageSchema, groupActorAccounts, mapActorUserRow, matchesActorUser } from "./actor-user-model";
const id="a2290000-0000-4000-8000-000000000003";
const wire={user_id:id,membership_id:null,organization_id:null,organization_name:null,roles:[],platform_roles:["MATRICIA_ADMIN"],display_name:"Administratrice sans organisation",email:"account@example.invalid",phone:"+212611111111",preferred_locale:"fr-MA",given_name:"Nadia",family_name:"El Fassi",status:"ACTIVE",account_status:"ACTIVE",updated_at:null,mfa_status:"ENABLED",session_count:2};
describe("account identity distinct from membership",()=>{
 it("keeps a central account visible without inventing an organization or membership",()=>{const page=actorPageSchema.parse({rows:[wire],total:1});const row=mapActorUserRow(page.rows[0]!);expect(row).toMatchObject({membershipId:null,organizationId:null,organizationName:null,roles:[],platformRoles:["MATRICIA_ADMIN"],mfaStatus:"ENABLED",sessionCount:2,phone:"+212611111111",preferredLocale:"fr-MA",givenName:"Nadia",familyName:"El Fassi"});});
 it("rejects inconsistent or invented partial membership scopes",()=>{for(const patch of[{membership_id:id},{organization_id:id},{roles:["CLIENT_OWNER"]}])expect(actorPageSchema.safeParse({rows:[{...wire,...patch}],total:1}).success).toBe(false);});
 it("uses the same unassigned, platform-role and identity filters for list and CSV",()=>{const row=mapActorUserRow(actorPageSchema.parse({rows:[wire],total:1}).rows[0]!);expect(matchesActorUser(row,{org:"unassigned",role:"MATRICIA_ADMIN"},"ACCOUNT@example.invalid")).toBe(true);expect(matchesActorUser(row,{org:id})).toBe(false);expect(matchesActorUser(row,{role:"CLIENT_OWNER"})).toBe(false);expect(matchesActorUser(row,{status:"ACTIVE"})).toBe(true);});
 it("groups membership rows into one account card",()=>{
  const membership="b2290000-0000-4000-8000-000000000001";
  const organization="c2290000-0000-4000-8000-000000000001";
  const rows=[mapActorUserRow(actorPageSchema.parse({rows:[wire],total:1}).rows[0]!),mapActorUserRow(actorPageSchema.parse({rows:[{...wire,membership_id:membership,organization_id:organization,organization_name:"Org A",roles:["CLIENT_OWNER"]}],total:1}).rows[0]!)];
  expect(groupActorAccounts(rows)).toHaveLength(1);
  expect(groupActorAccounts(rows)[0]?.memberships).toHaveLength(1);
 });
});
