import { describe, expect, it, vi } from "vitest";
import { configuredExternalProvider, configuredProviders, deterministicSandboxProvider, generateWithFailover } from "./provider-orchestrator";

const request={campaignId:"11111111-1111-4111-8111-111111111111",serviceId:"22222222-2222-4222-8222-222222222222",libraryId:"33333333-3333-4333-8333-333333333333",organizationId:"44444444-4444-4444-8444-444444444444",language:"FR" as const,serviceName:"Conseil sécurité",valueProposition:"Une démarche structurée et vérifiable.",primaryCta:"Commencer",trackedUrl:"https://matricia.example/start",approvedHashtags:["#Matricia"],templateKey:"EXPERT_TIP" as const,sourceHash:"b".repeat(64),providerIdempotencyKey:"marketing-content:stable-campaign"};

describe("marketing content provider orchestration",()=>{
  it("uses the deterministic sandbox adapter without external credentials",async()=>{
    await expect(generateWithFailover(request,[deterministicSandboxProvider])).resolves.toMatchObject({provider:"DETERMINISTIC_SANDBOX",failoverUsed:false,contents:expect.any(Array)});
  });
  it("fails over without leaking the primary provider error",async()=>{
    const primary={name:"PRIMARY",generate:vi.fn(async()=>{throw new Error("credential detail")})};
    await expect(generateWithFailover(request,[primary,deterministicSandboxProvider])).resolves.toMatchObject({provider:"DETERMINISTIC_SANDBOX",failoverUsed:true});
  });
  it("rejects malformed provider batches",async()=>{
    const malformed={name:"MALFORMED",generate:vi.fn(async()=>[])};
    await expect(generateWithFailover(request,[malformed])).rejects.toThrow("MARKETING_PROVIDER_UNAVAILABLE");
  });
  it("fails closed in production when no external provider is configured",()=>{
    expect(configuredProviders({NODE_ENV:"production"})).toEqual([]);
  });
  it("validates a configured HTTPS provider response",async()=>{
    const contents=await deterministicSandboxProvider.generate(request),fetchMock=vi.spyOn(globalThis,"fetch").mockResolvedValueOnce(new Response(JSON.stringify(contents),{status:200,headers:{"content-type":"application/json"}}));
    const provider=configuredExternalProvider({endpoint:"https://8.8.8.8/v1/content",endpointAllowlist:["https://8.8.8.8/v1/content"],apiKey:"k".repeat(32)});
    await expect(provider.generate(request)).resolves.toHaveLength(3);
    expect(fetchMock).toHaveBeenCalledWith(expect.any(URL),expect.objectContaining({method:"POST",headers:expect.objectContaining({"idempotency-key":"marketing-content:stable-campaign"}),signal:expect.any(AbortSignal),redirect:"error"}));fetchMock.mockRestore();
  });
  it("rejects DNS, private and non-allowlisted provider endpoints",()=>{for(const endpoint of["https://generator.example.invalid/v1/content","https://127.0.0.1/v1/content","https://10.0.0.1/v1/content"]){expect(()=>configuredExternalProvider({endpoint,endpointAllowlist:[endpoint],apiKey:"k".repeat(32)})).toThrow("MARKETING_PROVIDER_CONFIG_INVALID")}expect(()=>configuredExternalProvider({endpoint:"https://8.8.8.8/v1/content",endpointAllowlist:[],apiKey:"k".repeat(32)})).toThrow("MARKETING_PROVIDER_CONFIG_INVALID")});
});

it("pins allowed DNS answers and rejects a mixed private answer before connecting", async () => {
  const contents = await deterministicSandboxProvider.generate(request);
  const sendPinned = vi.fn(async () => new Response(JSON.stringify(contents)));
  const config = { endpoint: "https://generator.example.com/content", endpointAllowlist: ["https://generator.example.com/content"], apiKey: "k".repeat(32), sendPinned };
  await expect(configuredExternalProvider({ ...config, resolveAddresses: async () => ["8.8.8.8"] }).generate(request)).resolves.toHaveLength(3);
  expect(sendPinned).toHaveBeenCalledWith(new URL(config.endpoint), "8.8.8.8", expect.any(String), expect.any(Object), expect.any(AbortSignal));
  sendPinned.mockClear();
  await expect(configuredExternalProvider({ ...config, resolveAddresses: async () => ["8.8.8.8", "127.0.0.1"] }).generate(request)).rejects.toThrow("MARKETING_PROVIDER_ADDRESS_DENIED");
  expect(sendPinned).not.toHaveBeenCalled();
});
