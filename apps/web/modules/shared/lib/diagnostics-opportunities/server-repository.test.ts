import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("@/modules/shared/lib/supabase/server", () => ({ getSupabaseServerClient: async () => ({ auth: { getUser: async () => ({ data:{ user:{id:"actor"} } }) }, from:mocks.from }) }));
import { createServerDiagnosticsRepository } from "./server-repository";
function query() {
 const builder={select:vi.fn(),eq:vi.fn(),order:vi.fn(),limit:vi.fn(),range:vi.fn(),not:vi.fn(),then:(resolve:(value:unknown)=>unknown)=>Promise.resolve({data:[],error:null}).then(resolve)};
 for(const method of [builder.select,builder.eq,builder.order,builder.limit,builder.range,builder.not])method.mockReturnValue(builder);
 return builder;
}
describe("diagnostic tenant history",()=>{
 beforeEach(()=>mocks.from.mockReset());
 it("scopes both questionnaire history and completed runs to the selected organization",async()=>{
  const queries=new Map<string,ReturnType<typeof query>>();mocks.from.mockImplementation((name:string)=>{const value=query();queries.set(name,value);return value;});
  const result=await(await createServerDiagnosticsRepository("selected-org",3)).list();
  expect(result.status).toBe("success");
  expect(queries.get("questionnaire_sessions")?.eq).toHaveBeenCalledWith("organization_id","selected-org");
  expect(queries.get("diagnostic_runs")?.eq).toHaveBeenCalledWith("organization_id","selected-org");
  expect(queries.get("diagnostic_runs")?.range).toHaveBeenCalledWith(40,60);
 });
});
