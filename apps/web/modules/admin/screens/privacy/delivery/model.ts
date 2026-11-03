import {z} from "zod";
export const dsrScopes = ["ACCOUNT", "MEMBERSHIP", "CONSENTS", "ASSISTANCE", "OWN_MESSAGES", "FINANCIAL_CONTRACT_RECORDS", "ALL"] as const;
export const dsrDeliveryConsoleSchema = z.object({
  requests: z.array(z.object({id: z.string().uuid(), request_type: z.string(), status: z.string(), row_version: z.number().int(), verified: z.boolean(), scope: z.object({id: z.string().uuid(), version: z.number().int(), requested_scopes: z.array(z.enum(dsrScopes))}).nullable(), response: z.object({id: z.string().uuid(), scope_version_id: z.string().uuid(), sha256: z.string().regex(/^[a-f0-9]{64}$/u), complete: z.boolean(), covered_scopes: z.array(z.string()), uncovered_scopes: z.array(z.string()), created_by: z.string().uuid(), all_package: z.boolean().default(false), decision: z.enum(["APPROVE", "REJECT"]).nullable(), acknowledged: z.boolean(), reference: z.string()}).nullable()})),
  page: z.number().int(), has_next: z.boolean(),
});
export type DsrDeliveryConsole = z.infer<typeof dsrDeliveryConsoleSchema>;
export type DsrDeliveryState = {status: "idle" | "success" | "error"; reason?: string};
