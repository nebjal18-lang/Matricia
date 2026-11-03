import { z } from "zod";
const identifier = z.string().uuid();
export const contractPolicyConsoleSchema = z.object({
  policies: z.array(z.object({
    id: identifier, kind: z.enum(["TEMPLATE", "COMMISSION"]), code: z.string(), version: z.number().int(),
    library_id: identifier, service_id: identifier.nullable(), currency: z.string().nullable(), country_code: z.string(),
    title_fr: z.string(), title_ar: z.string(), data: z.object({clauses: z.object({fr: z.string(), ar: z.string()}).optional(), commission_basis_points: z.number().int().optional(), basis_code: z.string().optional()}),
    valid_from: z.string(), valid_until: z.string().nullable(), approval_reference: z.string(), content_hash: z.string(), created_by: identifier,
    decision: z.object({decision: z.enum(["APPROVE", "REJECT"]), reason: z.string(), decided_at: z.string()}).nullable(),
  })),
  libraries: z.array(z.object({id: identifier, name_fr: z.string(), name_ar: z.string()})),
  services: z.array(z.object({id: identifier, library_id: identifier, name_fr: z.string(), name_ar: z.string()})),
  page: z.number().int(), has_next: z.boolean(),
});
export type ContractPolicyConsole = z.infer<typeof contractPolicyConsoleSchema>;
export type ContractPolicyState = {status: "idle" | "success" | "error"; reason?: string};
