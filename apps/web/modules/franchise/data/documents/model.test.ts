import { describe,expect,it } from "vitest";
import { statementCsv,statementExport } from "./model";
const id="11111111-1111-4111-8111-111111111111";
const statement={outcome:"ALLOWED",id,bookId:id,version:3,periodStart:"2026-01-01",periodEnd:"2026-01-31",currency:"MAD",revenueMinor:"9007199254740993",costsMinor:"1",profitMinor:"9007199254740992",shareMinor:"4503599627370496",contentHash:"a".repeat(64),cutoffAt:"2026-02-01T00:00:00Z",closedAt:"2026-02-01T01:00:00Z",ruleVersionId:id,proofs:[],accessHistory:[]};
describe("exact private statement export",()=>{
 it("preserves exact minor amounts and frozen statement version/hash",()=>{const result=statementExport.parse(statement);const csv=statementCsv(result);expect(csv).toContain('"9007199254740993"');expect(csv).toContain('"version";"3"');expect(csv).toContain('"'+"a".repeat(64)+'"');});
 it("rejects malformed or denied responses instead of producing a financial document",()=>{expect(statementExport.safeParse({...statement,outcome:"DENIED"}).success).toBe(false);expect(statementExport.safeParse({...statement,shareMinor:"=1+1"}).success).toBe(false);});
});
