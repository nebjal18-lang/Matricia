import {describe,it,expect} from "vitest";
import {creditCommandErrorCodes} from "@/modules/shared/lib/credits-wallet/command-errors";
import {creditCommandFeedback} from "./command-feedback";
describe("credit command feedback",()=>{it.each(creditCommandErrorCodes)("localizes %s in FR and AR without exposing its code",code=>{const fr=creditCommandFeedback(code,"fr","Unknown"),ar=creditCommandFeedback(code,"ar","Unknown");expect(fr).not.toBe("Unknown");expect(ar).not.toBe("Unknown");expect(fr).not.toBe(ar);expect(fr+ar).not.toContain(code);});it("keeps untrusted failures generic",()=>{expect(creditCommandFeedback("private arbitrary failure","fr","Indisponible")).toBe("Indisponible");});});
