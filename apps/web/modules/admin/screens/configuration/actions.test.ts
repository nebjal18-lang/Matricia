import {beforeEach,describe,it,expect,vi} from "vitest";
const mocks=vi.hoisted(()=>({save:vi.fn(),test:vi.fn(),decide:vi.fn(),disable:vi.fn(),revalidate:vi.fn()}));
vi.mock("next/cache",()=>({revalidatePath:mocks.revalidate}));
vi.mock("@/modules/shared/lib/platform-configuration/repository",()=>({saveConfigurationForm:mocks.save,testConfigurationForm:mocks.test,decideConfigurationForm:mocks.decide,deactivateConfigurationForm:mocks.disable,configurationFailure:()=>"CONFIGURATION_UNAVAILABLE"}));
import {managePlatformConfiguration} from "./actions";
const form=(intent:string)=>{const f=new FormData();f.set("locale","fr");f.set("intent",intent);return f;};
beforeEach(()=>{vi.clearAllMocks();});
describe("configuration action responses",()=>{
 it("returns only a safe save receipt without serializing private repository data",async()=>{mocks.save.mockResolvedValue({outcome:"CONFIGURATION_SAVED",encrypted_secrets:"must-stay-server-only",private_token:"must-stay-server-only"});expect(await managePlatformConfiguration({status:"idle"},form("save"))).toEqual({status:"success",reason:"CONFIGURATION_SAVED"});expect(mocks.revalidate).toHaveBeenCalledWith("/fr/administration/configuration");});
 it("reports a connectivity result without claiming external delivery",async()=>{mocks.test.mockResolvedValue({outcome:"CONFIGURATION_CHECKED",probeCode:"RESEND_DOMAIN_VERIFIED"});expect(await managePlatformConfiguration({status:"idle"},form("test"))).toEqual({status:"success",reason:"CONFIGURATION_CHECKED",probeCode:"RESEND_DOMAIN_VERIFIED"});expect(mocks.decide).not.toHaveBeenCalled();});
 it("does not leak a thrown provider body or key",async()=>{mocks.test.mockRejectedValue(new Error("private-token/provider-error"));expect(await managePlatformConfiguration({status:"idle"},form("test"))).toEqual({status:"error",reason:"CONFIGURATION_UNAVAILABLE"});expect(mocks.revalidate).toHaveBeenCalledWith("/fr/administration/configuration");});
 it("does not dispatch an unknown action",async()=>{expect((await managePlatformConfiguration({status:"idle"},form("setProductionEnabled"))).status).toBe("error");expect(mocks.save).not.toHaveBeenCalled();expect(mocks.decide).not.toHaveBeenCalled();});
});
