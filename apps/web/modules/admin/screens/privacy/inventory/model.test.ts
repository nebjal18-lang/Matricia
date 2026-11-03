import {describe,expect,it} from "vitest";
import {disclosureFieldChoices} from "./model";
describe("privacy disclosure path choices",()=>{
 it("supports selective object redaction while preserving the subject's other fields",()=>{const fields={profile_data:{own:{email:"subject@example.invalid"},representative:{email:"third-party@example.invalid"}}};const choices=disclosureFieldChoices([{fields}],["profile_data"]);expect(choices.map(c=>c.value)).toContain("/profile_data/representative/email");expect(choices.map(c=>c.value)).toContain("/profile_data/own/email");expect(JSON.stringify(choices)).not.toContain("@example.invalid");});
 it("does not offer unsafe array indexes whose deletion would shift later targets",()=>{const values=disclosureFieldChoices([{fields:{answers:[{name:"Third party"},{name:"Subject"}]}}],["answers"]);expect(values).toEqual([{value:"answers",label:"answers"}]);});
 it("encodes property names exactly and ignores inherited properties",()=>{const nested=Object.assign(Object.create({inherited:"private"})as Record<string,unknown>,{"a/b~c":"safe"});const values=disclosureFieldChoices([{fields:{profile:nested}}],["profile"]);expect(values.map(c=>c.value)).toEqual(["profile","/profile/a~1b~0c"]);});
 it("deduplicates object paths across records without exposing values",()=>{const values=disclosureFieldChoices([{fields:{profile:{name:"One"}}},{fields:{profile:{name:"Two"}}}],["profile"]);expect(values).toHaveLength(2);expect(JSON.stringify(values)).not.toMatch(/One|Two/u);});
});
